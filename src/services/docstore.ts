/**
 * Firestore-compatible document API backed by the Supabase `documents` table.
 * Keeps firestoreSync.ts unchanged in shape: collection/doc refs, merge writes,
 * batches, array sentinels and realtime snapshots. Access control lives in RLS.
 *
 * Offline: writes that cannot reach the server are queued (see outbox.ts) and
 * replayed in order when the connection comes back. Reads overlay pending writes
 * so records created in the field never disappear before they are uploaded.
 */
import { supabase } from './supabase';
import { QueuedOp, enqueue, newQid, outboxReady, pendingOps, remove } from './outbox';

export type Unsubscribe = () => void;

export const SYNC_ERROR_EVENT = 'bandiera:sync-error';
export const OUTBOX_EVENT = 'bandiera:outbox';

// Placeholder so call sites can keep passing `db` like the Firestore SDK.
export const db = Object.freeze({ kind: 'supabase-docstore' });
type Db = typeof db;

export interface CollectionRef {
  kind: 'collection';
  path: string;
}

export interface DocRef {
  kind: 'doc';
  collection: string;
  id: string;
}

export class DocSnapshot {
  constructor(public readonly ref: DocRef, private readonly payload: any | null) {}
  get id(): string {
    return this.ref.id;
  }
  exists(): boolean {
    return this.payload !== null;
  }
  data(): any {
    return this.payload ?? undefined;
  }
}

export class QuerySnapshot {
  constructor(public readonly docs: DocSnapshot[]) {}
  get empty(): boolean {
    return this.docs.length === 0;
  }
  get size(): number {
    return this.docs.length;
  }
  forEach(cb: (snap: DocSnapshot) => void): void {
    this.docs.forEach(cb);
  }
}

export function collection(_db: Db, path: string): CollectionRef {
  return { kind: 'collection', path };
}

export function doc(_db: Db, collectionName: string, id: string): DocRef {
  return { kind: 'doc', collection: collectionName, id };
}

// Array sentinels (Firestore arrayUnion / arrayRemove). Serialized as plain
// markers so they survive the offline queue and resolve at upload time.
const ARRAY_OP = '__docstoreArrayOp';
interface ArrayMarker {
  [ARRAY_OP]: 'union' | 'remove';
  values: unknown[];
}

export function arrayUnion(...values: unknown[]): any {
  return { [ARRAY_OP]: 'union', values } satisfies ArrayMarker;
}

export function arrayRemove(...values: unknown[]): any {
  return { [ARRAY_OP]: 'remove', values } satisfies ArrayMarker;
}

function isMarker(v: unknown): v is ArrayMarker {
  return !!v && typeof v === 'object' && ARRAY_OP in (v as object);
}

function hasSentinel(data: Record<string, any>): boolean {
  return Object.values(data).some(isMarker);
}

function resolveSentinels(current: Record<string, any> | null, data: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isMarker(value)) {
      const existing: unknown[] = Array.isArray(current?.[key]) ? current![key] : [];
      out[key] =
        value[ARRAY_OP] === 'union'
          ? [...existing, ...value.values.filter(v => !existing.includes(v))]
          : existing.filter(v => !value.values.includes(v));
    } else {
      out[key] = value;
    }
  }
  return out;
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function isNetworkError(err: unknown): boolean {
  if (!isOnline()) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timed? ?out|err_internet|err_network|err_connection/i.test(msg);
}

async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

const PAGE_SIZE = 1000;

// Apply queued (not yet uploaded) writes on top of server data.
function overlayCollection(path: string, rows: Map<string, any>): void {
  for (const op of pendingOps()) {
    if (op.kind === 'rpc' || op.collection !== path) continue;
    if (op.kind === 'delete') {
      rows.delete(op.id);
    } else {
      const current = rows.get(op.id) ?? null;
      const resolved = resolveSentinels(current, op.data);
      rows.set(op.id, op.kind === 'merge' && current ? { ...current, ...resolved } : resolved);
    }
  }
}

async function fetchCollection(path: string): Promise<DocSnapshot[]> {
  const rows = new Map<string, any>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('documents')
      .select('id, data')
      .eq('collection', path)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    (data || []).forEach(r => rows.set(r.id, r.data));
    if (!data || data.length < PAGE_SIZE) break;
  }
  await outboxReady;
  overlayCollection(path, rows);
  return [...rows].map(([id, data]) => new DocSnapshot({ kind: 'doc', collection: path, id }, data));
}

async function fetchDocRaw(ref: DocRef): Promise<any | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('data')
    .eq('collection', ref.collection)
    .eq('id', ref.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? data.data : null;
}

async function fetchDoc(ref: DocRef): Promise<DocSnapshot> {
  const rows = new Map<string, any>();
  const raw = await fetchDocRaw(ref);
  if (raw !== null) rows.set(ref.id, raw);
  await outboxReady;
  overlayCollection(ref.collection, rows);
  return new DocSnapshot(ref, rows.get(ref.id) ?? null);
}

export async function getDocs(ref: CollectionRef): Promise<QuerySnapshot> {
  return new QuerySnapshot(await fetchCollection(ref.path));
}

export async function getDoc(ref: DocRef): Promise<DocSnapshot> {
  return fetchDoc(ref);
}

interface MergeRow {
  collection: string;
  id: string;
  data: Record<string, any>;
}

async function mergeRows(rows: MergeRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.rpc('merge_documents', { p_rows: rows.slice(i, i + 200) });
    if (error) throw new Error(error.message);
  }
}

async function replaceRows(rows: MergeRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase
      .from('documents')
      .upsert(rows.slice(i, i + 200), { onConflict: 'collection,id' });
    if (error) throw new Error(error.message);
  }
}

async function toRow(op: { collection: string; id: string; data: Record<string, any> }): Promise<MergeRow> {
  if (!hasSentinel(op.data)) return { collection: op.collection, id: op.id, data: op.data };
  const current = await fetchDocRaw({ kind: 'doc', collection: op.collection, id: op.id });
  return { collection: op.collection, id: op.id, data: resolveSentinels(current, op.data) };
}

// Send a group of writes straight to the server (merges, then replaces, then deletes).
async function executeOps(ops: QueuedOp[]): Promise<void> {
  const merges: MergeRow[] = [];
  const replaces: MergeRow[] = [];
  const deletes = new Map<string, string[]>();
  for (const op of ops) {
    if (op.kind === 'rpc') {
      const { error } = await supabase.rpc(op.fn, op.args);
      if (error) throw new Error(error.message);
    } else if (op.kind === 'delete') {
      const ids = deletes.get(op.collection) || [];
      ids.push(op.id);
      deletes.set(op.collection, ids);
    } else {
      (op.kind === 'merge' ? merges : replaces).push(await toRow(op));
    }
  }
  if (merges.length) await mergeRows(merges);
  if (replaces.length) await replaceRows(replaces);
  for (const [col, ids] of deletes) {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from('documents').delete().eq('collection', col).in('id', ids.slice(i, i + 200));
      if (error) throw new Error(error.message);
    }
  }
}

function notifyOutbox(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OUTBOX_EVENT, { detail: { pending: pendingOps().length } }));
}

export function pendingWriteCount(): number {
  return pendingOps().length;
}

// Online with an empty queue: write directly. Otherwise (or on a network failure)
// queue the writes so order is preserved, and upload them later.
async function submit(ops: QueuedOp[]): Promise<void> {
  await outboxReady;
  if (pendingOps().length === 0 && isOnline()) {
    try {
      await executeOps(ops);
      return;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }
  await enqueue(ops);
  notifyOutbox();
  void flushOutbox();
}

function plain(data: Record<string, any>): Record<string, any> {
  // Writes are queued as JSON; drop anything that would not survive serialization.
  return JSON.parse(JSON.stringify(data));
}

let flushing: Promise<void> | null = null;

export function flushOutbox(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    await outboxReady;
    if (!pendingOps().length || !isOnline() || !(await hasSession())) return;
    let uploaded = false;
    while (pendingOps().length) {
      const op = pendingOps()[0];
      try {
        await executeOps([op]);
      } catch (err) {
        if (isNetworkError(err)) break;
        // Rejected by the server (e.g. permissions): report and drop so the queue keeps moving.
        const message = err instanceof Error ? err.message : String(err);
        window.dispatchEvent(
          new CustomEvent(SYNC_ERROR_EVENT, {
            detail: { operationType: 'write', path: `${op.collection}/${op.id}`, message }
          })
        );
      }
      await remove(op.qid);
      uploaded = true;
      notifyOutbox();
    }
    if (uploaded) window.dispatchEvent(new CustomEvent(`${OUTBOX_EVENT}:flushed`));
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushOutbox());
  supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') void flushOutbox();
  });
  // Mobile networks often report "online" while requests still fail: retry periodically.
  setInterval(() => {
    if (pendingOps().length) void flushOutbox();
  }, 30000);
  outboxReady.then(() => {
    notifyOutbox();
    void flushOutbox();
  });
}

export async function setDoc(ref: DocRef, data: Record<string, any>, options?: { merge?: boolean }): Promise<void> {
  await submit([
    { qid: newQid(), kind: options?.merge ? 'merge' : 'replace', collection: ref.collection, id: ref.id, data: plain(data), queuedAt: Date.now() }
  ]);
}

export async function deleteDoc(ref: DocRef): Promise<void> {
  await submit([{ qid: newQid(), kind: 'delete', collection: ref.collection, id: ref.id, queuedAt: Date.now() }]);
}

// Call a server function through the offline queue (runs now if online, later otherwise).
export async function callQueued(fn: string, args: Record<string, any>, ref: { collection: string; id: string }): Promise<void> {
  await submit([{ qid: newQid(), kind: 'rpc', fn, args: plain(args), collection: ref.collection, id: ref.id, queuedAt: Date.now() }]);
}

// Ids of records still waiting in the queue for a given server function.
export function pendingRpcIds(fn: string): Set<string> {
  return new Set(pendingOps().filter(op => op.kind === 'rpc' && op.fn === fn).map(op => op.id));
}

export function writeBatch(_db: Db) {
  const ops: QueuedOp[] = [];
  return {
    set(ref: DocRef, data: Record<string, any>, options?: { merge?: boolean }) {
      ops.push({ qid: newQid(), kind: options?.merge ? 'merge' : 'replace', collection: ref.collection, id: ref.id, data: plain(data), queuedAt: Date.now() });
    },
    delete(ref: DocRef) {
      ops.push({ qid: newQid(), kind: 'delete', collection: ref.collection, id: ref.id, queuedAt: Date.now() });
    },
    async commit(): Promise<void> {
      if (ops.length) await submit(ops);
    }
  };
}

let channelCounter = 0;

export function onSnapshot(ref: DocRef, next: (snap: DocSnapshot) => void, onError?: (err: Error) => void): Unsubscribe;
export function onSnapshot(ref: CollectionRef, next: (snap: QuerySnapshot) => void, onError?: (err: Error) => void): Unsubscribe;
export function onSnapshot(
  ref: DocRef | CollectionRef,
  next: (snap: any) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const collectionName = ref.kind === 'doc' ? ref.collection : ref.path;

  const emit = async () => {
    try {
      // Offline: keep the cached data the app already shows.
      if (!isOnline()) return;
      // Without a session RLS returns nothing; skip so callers don't treat it as "empty database".
      if (!(await hasSession())) return;
      const snap = ref.kind === 'doc' ? await fetchDoc(ref) : new QuerySnapshot(await fetchCollection(ref.path));
      if (active) next(snap);
    } catch (err) {
      if (active && onError) onError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(emit, 150);
  };

  const channel = supabase
    .channel(`docstore_${collectionName}_${++channelCounter}`)
    .on(
      'postgres_changes',
      // No server-side filter: DELETE events can't be filtered. The primary key
      // (collection, id) is always present in `old`, so filter here instead.
      { event: '*', schema: 'public', table: 'documents' },
      payload => {
        const row = ((payload.new as any)?.collection ? payload.new : payload.old) as any;
        if (row?.collection !== collectionName) return;
        if (ref.kind === 'doc' && row.id !== ref.id) return;
        schedule();
      }
    )
    .subscribe();

  const { data: authListener } = supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') schedule();
  });

  // Realtime events are missed while offline: refetch on reconnect and after uploads.
  const flushedEvent = `${OUTBOX_EVENT}:flushed`;
  window.addEventListener('online', schedule);
  window.addEventListener(flushedEvent, schedule);

  emit();

  return () => {
    active = false;
    if (timer) clearTimeout(timer);
    authListener.subscription.unsubscribe();
    window.removeEventListener('online', schedule);
    window.removeEventListener(flushedEvent, schedule);
    supabase.removeChannel(channel);
  };
}

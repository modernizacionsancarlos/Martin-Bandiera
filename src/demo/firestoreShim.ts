/**
 * Sustituto local de 'firebase/firestore' para el MODO DEMO.
 *
 * Solo se usa cuando el proyecto se compila con `npm run demo` (ver vite.config.ts).
 * Guarda todo en memoria (y en localStorage del navegador de la demo), no abre ninguna conexión
 * de red y nunca toca la base de datos real. Implementa únicamente lo que usa el sistema.
 */
import { DEMO_COLLECTIONS } from './demoSeed';

const STORAGE_KEY = 'bandiera_demo_db_v1';

type DocData = Record<string, any>;
type Store = Record<string, Record<string, DocData>>;

// ---------------------------------------------------------------- almacenamiento
function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return clone(DEMO_COLLECTIONS);
}

let store: Store = loadStore();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

export function resetDemoDatabase() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  store = clone(DEMO_COLLECTIONS);
  persist();
  notifyAll();
}

// ---------------------------------------------------------------- referencias
export interface CollectionRef {
  type: 'collection';
  path: string;
  id: string;
  filters?: { field: string; value: any }[];
}
export interface DocRef {
  type: 'document';
  path: string;
  id: string;
  parent: CollectionRef;
}

export function getFirestore(..._args: any[]) {
  return { type: 'demo-firestore' } as any;
}
export function initializeFirestore(..._args: any[]) {
  return getFirestore();
}
export const persistentLocalCache = (..._args: any[]) => ({});
export const persistentMultipleTabManager = (..._args: any[]) => ({});
export const persistentSingleTabManager = (..._args: any[]) => ({});
export function setLogLevel(..._args: any[]) {}

export function collection(_db: any, path: string): CollectionRef {
  return { type: 'collection', path, id: path };
}

export function doc(parent: any, ...segments: string[]): DocRef {
  if (parent && parent.type === 'collection') {
    const id = segments[0];
    return { type: 'document', path: `${parent.path}/${id}`, id, parent };
  }
  const [colName, id] = segments;
  return { type: 'document', path: `${colName}/${id}`, id, parent: collection(parent, colName) };
}

// ---------------------------------------------------------------- operadores de campo
interface FieldOp {
  __op: 'arrayUnion' | 'arrayRemove' | 'delete';
  values?: any[];
}
export const arrayUnion = (...values: any[]): FieldOp => ({ __op: 'arrayUnion', values });
export const arrayRemove = (...values: any[]): FieldOp => ({ __op: 'arrayRemove', values });
export const deleteField = (): FieldOp => ({ __op: 'delete' });

function isFieldOp(value: any): value is FieldOp {
  return value && typeof value === 'object' && typeof value.__op === 'string';
}

function applyValue(existing: any, incoming: any): any {
  if (isFieldOp(incoming)) {
    if (incoming.__op === 'arrayUnion') {
      const list: any[] = Array.isArray(existing) ? [...existing] : [];
      for (const v of incoming.values || []) {
        if (!list.some(item => JSON.stringify(item) === JSON.stringify(v))) list.push(v);
      }
      return list;
    }
    if (incoming.__op === 'arrayRemove') {
      const list: any[] = Array.isArray(existing) ? existing : [];
      const remove = (incoming.values || []).map(v => JSON.stringify(v));
      return list.filter(item => !remove.includes(JSON.stringify(item)));
    }
    return undefined;
  }
  if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
    const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
    return mergeInto(clone(base), incoming);
  }
  return clone(incoming);
}

function mergeInto(target: DocData, incoming: DocData): DocData {
  for (const [key, value] of Object.entries(incoming)) {
    const next = applyValue(target[key], value);
    if (next === undefined) delete target[key];
    else target[key] = next;
  }
  return target;
}

// ---------------------------------------------------------------- snapshots
function makeDocSnapshot(ref: DocRef) {
  const data = store[ref.parent.path]?.[ref.id];
  return {
    id: ref.id,
    ref,
    exists: () => data !== undefined,
    data: () => (data === undefined ? undefined : clone(data)),
    metadata: { fromCache: false, hasPendingWrites: false }
  };
}

function makeCollectionSnapshot(ref: CollectionRef) {
  const filters = ref.filters || [];
  const entries = Object.entries(store[ref.path] || {}).filter(([, data]) =>
    filters.every(f => (data as DocData)[f.field] === f.value)
  );
  const docs = entries.map(([id]) => makeDocSnapshot({ type: 'document', path: `${ref.path}/${id}`, id, parent: ref }));
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (cb: (d: any) => void) => docs.forEach(cb),
    docChanges: () => [],
    metadata: { fromCache: false, hasPendingWrites: false }
  };
}

export async function getDocs(ref: CollectionRef) {
  return makeCollectionSnapshot(ref);
}
export async function getDoc(ref: DocRef) {
  return makeDocSnapshot(ref);
}
export async function getDocFromServer(ref: DocRef) {
  return makeDocSnapshot(ref);
}

// ---------------------------------------------------------------- escritura
function writeDoc(ref: DocRef, data: DocData, merge: boolean) {
  const col = (store[ref.parent.path] = store[ref.parent.path] || {});
  col[ref.id] = merge && col[ref.id] ? mergeInto(col[ref.id], data) : mergeInto({}, data);
}

function removeDoc(ref: DocRef) {
  if (store[ref.parent.path]) delete store[ref.parent.path][ref.id];
}

// Simulación de fallas para probar la interfaz (solo demo). En la consola del navegador:
//   window.__DEMO_FAIL_WRITES__ = 'permission-denied'   (o 'unavailable')
//   window.__DEMO_DELAY_WRITES__ = 3000                  (milisegundos)
async function guardWrite() {
  const w = window as any;
  if (w.__DEMO_DELAY_WRITES__) await new Promise(res => setTimeout(res, Number(w.__DEMO_DELAY_WRITES__)));
  if (w.__DEMO_FAIL_WRITES__) {
    const err: any = new Error(String(w.__DEMO_FAIL_WRITES__));
    err.code = w.__DEMO_FAIL_WRITES__;
    throw err;
  }
}

export async function setDoc(ref: DocRef, data: DocData, options?: { merge?: boolean }) {
  await guardWrite();
  writeDoc(ref, data, Boolean(options?.merge));
  persist();
  notifyCollection(ref.parent.path);
}
export async function updateDoc(ref: DocRef, data: DocData) {
  await guardWrite();
  writeDoc(ref, data, true);
  persist();
  notifyCollection(ref.parent.path);
}
export async function deleteDoc(ref: DocRef) {
  await guardWrite();
  removeDoc(ref);
  persist();
  notifyCollection(ref.parent.path);
}

export function writeBatch(_db?: any) {
  const ops: Array<() => void> = [];
  const touched = new Set<string>();
  const batch = {
    set(ref: DocRef, data: DocData, options?: { merge?: boolean }) {
      ops.push(() => writeDoc(ref, data, Boolean(options?.merge)));
      touched.add(ref.parent.path);
      return batch;
    },
    update(ref: DocRef, data: DocData) {
      ops.push(() => writeDoc(ref, data, true));
      touched.add(ref.parent.path);
      return batch;
    },
    delete(ref: DocRef) {
      ops.push(() => removeDoc(ref));
      touched.add(ref.parent.path);
      return batch;
    },
    async commit() {
      await guardWrite();
      ops.forEach(op => op());
      persist();
      touched.forEach(notifyCollection);
    }
  };
  return batch;
}

// ---------------------------------------------------------------- suscripciones
type Listener = { ref: CollectionRef | DocRef; next: (snap: any) => void };
const listeners = new Set<Listener>();

function emit(listener: Listener) {
  const snap =
    listener.ref.type === 'collection'
      ? makeCollectionSnapshot(listener.ref as CollectionRef)
      : makeDocSnapshot(listener.ref as DocRef);
  try {
    listener.next(snap);
  } catch (err) {
    console.error('[Demo] Error en un listener de snapshot:', err);
  }
}

function notifyCollection(path: string) {
  listeners.forEach(l => {
    const lPath = l.ref.type === 'collection' ? l.ref.path : (l.ref as DocRef).parent.path;
    if (lPath === path) emit(l);
  });
}
function notifyAll() {
  listeners.forEach(emit);
}

export function onSnapshot(ref: CollectionRef | DocRef, next: (snap: any) => void, _error?: (e: any) => void) {
  const listener: Listener = { ref, next };
  listeners.add(listener);
  Promise.resolve().then(() => {
    if (listeners.has(listener)) emit(listener);
  });
  return () => {
    listeners.delete(listener);
  };
}

// Consultas: solo se admite where(campo, '==', valor), que es lo que usa el sistema (p. ej. el perfil propio del capataz).
export const query = (ref: any, ...constraints: any[]) => ({
  ...ref,
  filters: constraints.filter(c => c && c.__where).map(c => ({ field: c.field, value: c.value }))
});
export const where = (field: string, _op: string, value: any) => ({ __where: true, field, value });
export const orderBy = (..._args: any[]) => ({});
export const limit = (..._args: any[]) => ({});

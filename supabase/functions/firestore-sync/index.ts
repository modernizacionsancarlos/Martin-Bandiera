// Copies the old system (Firestore) into Supabase. Runs every 3 hours from pg_cron.
// Same rules as scripts/sync_firestore_to_supabase.mjs, plus: a document is applied again only when it
// changed in Firestore since the last copy, so edits made in the new system are kept.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const FIRESTORE = {
  project: 'gen-lang-client-0133313162',
  database: 'ai-studio-jobmartinbandier-d44d882d-1592-4457-b7d7-d21ee05f7b01',
  // Public web key of the old app (also in firebase-applet-config.json).
  key: 'AIzaSyB2_CIk8HX9SCqq-hrll5pYK55l83Etnfg'
};
const COLLECTIONS = [
  'users', 'workers', 'auditRecords', 'clients', 'materials', 'systemSettings', 'financials',
  'technicalParameters', 'archivedReceipts', 'projects', 'maintenanceServices', 'vehicles', 'vehicleEvents'
];
const ADD_ONLY = new Set(['users', 'workers']);

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false }
});

type FsValue = Record<string, any>;

function fromFirestore(v: FsValue): unknown {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return new Date(v.timestampValue).toISOString();
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestore);
  if ('referenceValue' in v) return v.referenceValue;
  return null;
}

function fromFields(fields: Record<string, FsValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k !== 'password') out[k] = fromFirestore(v);
  }
  return out;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

async function hash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Listing collections is denied by the old rules, but queries are allowed: page through with runQuery.
async function readFirestore(collection: string): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const base = `https://firestore.googleapis.com/v1/projects/${FIRESTORE.project}/databases/${FIRESTORE.database}/documents`;
  const docs: { id: string; data: Record<string, unknown> }[] = [];
  let last: string | null = null;
  for (;;) {
    const structuredQuery: Record<string, unknown> = {
      from: [{ collectionId: collection }],
      orderBy: [{ field: { fieldPath: '__name__' } }],
      limit: 300
    };
    if (last) structuredQuery.startAt = { values: [{ referenceValue: last }], before: false };
    const r = await fetch(`${base}:runQuery?key=${FIRESTORE.key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery })
    });
    if (!r.ok) throw new Error(`Firestore ${collection}: ${r.status}`);
    const rows = ((await r.json()) as { document?: { name: string; fields?: Record<string, FsValue> } }[]).filter(x => x.document);
    for (const { document } of rows) {
      docs.push({ id: document!.name.split('/').pop()!, data: fromFields(document!.fields || {}) });
    }
    if (rows.length < 300) return docs;
    last = rows[rows.length - 1].document!.name;
  }
}

async function readSupabase(collection: string): Promise<Map<string, Record<string, any>>> {
  const rows = new Map<string, Record<string, any>>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('documents').select('id, data').eq('collection', collection).order('id').range(from, from + 999);
    if (error) throw new Error(`${collection}: ${error.message}`);
    data!.forEach(r => rows.set(r.id, r.data));
    if (data!.length < 1000) return rows;
  }
}

async function readState(collection: string): Promise<Map<string, string>> {
  const rows = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('firestore_sync_state').select('id, hash').eq('collection', collection).range(from, from + 999);
    if (error) throw new Error(`estado ${collection}: ${error.message}`);
    data!.forEach(r => rows.set(r.id, r.hash));
    if (data!.length < 1000) return rows;
  }
}

async function sync() {
  const summary: Record<string, unknown> = {};
  for (const name of COLLECTIONS) {
    const [incomingDocs, current, state] = await Promise.all([readFirestore(name), readSupabase(name), readState(name)]);
    const writes: { collection: string; id: string; data: Record<string, unknown> }[] = [];
    const states: { collection: string; id: string; hash: string; synced_at: string }[] = [];
    const counts = { nuevos: 0, actualizados: 0, sinCambios: 0, protegidos: 0, rescatados: 0, unificados: 0, borradosAca: 0, soloSupabase: 0 };
    const seen = new Set<string>();
    const replaces: { collection: string; id: string; data: Record<string, unknown> }[] = [];
    // Same number and same paper: the same remito, whatever its internal id.
    const remitoKey = (r: Record<string, unknown>) => `${r.remitoId}|${r.remitoPapel}`;
    const incomingIds = new Set(incomingDocs.map(d => d.id));
    const incomingKeys = new Set(incomingDocs.map(d => remitoKey(d.data)));
    const currentKeys = new Map<string, number>();
    current.forEach(r => currentKeys.set(remitoKey(r), (currentKeys.get(remitoKey(r)) || 0) + 1));
    // Remitos rescued earlier, in case the old system loads them again under another id.
    const rescued = new Map<string, string>();
    current.forEach((r, rid) => {
      if (r.recuperado && !incomingIds.has(rid)) rescued.set(remitoKey(r), rid);
    });
    const deletes: string[] = [];
    const now = new Date().toISOString();

    for (const { id, data } of incomingDocs) {
      seen.add(id);
      // The old system may store a Pasado remito with the 7% inside or not: it is removed only when it is there.
      if (name === 'auditRecords' && data.status === 'Pasado' && Number(data.billedPrice) > 0) {
        const base = ['logisticsCost', 'techPay', 'helperPay', 'materialsCost', 'honorarios'].reduce((acc, k) => acc + (Number(data[k]) || 0), 0);
        const suggested = Number(data.suggestedPrice) || 0;
        const price = Number(data.billedPrice);
        if ([base, suggested].some(x => x > 0 && Math.abs(price / x - 1.07) < 0.004)) data.billedPrice = Math.round(price / 1.07);
      }
      const h = await hash(stable(data));
      // A remito not invoiced has no invoice: the old system leaves there the one of the remito it overwrote.
      if (name === 'auditRecords' && data.status === 'Cargado') {
        if (data.numeroFactura) data.numeroFactura = '';
        if (data.fechaFactura) data.fechaFactura = '';
      }
      const existing = current.get(id);
      if (!existing) {
        const rescuedId = name === 'auditRecords' ? rescued.get(remitoKey(data)) : undefined;
        if (rescuedId) {
          // Same remito loaded again: one record, with the complete rescued data under the new id.
          writes.push({ collection: name, id, data: { ...data, ...current.get(rescuedId), id, keepRemitoNumber: true } });
          deletes.push(rescuedId);
          states.push({ collection: name, id, hash: h, synced_at: now });
          counts.unificados++;
          continue;
        }
        // Copied before, unchanged there and no longer here: it was deleted in the new system, so it does not come back.
        // A changed document may be a different remito on a reused id: that one is copied.
        if (state.get(id) === h) {
          counts.borradosAca++;
          continue;
        }
        counts.nuevos++;
        writes.push({ collection: name, id, data: name === 'auditRecords' ? { ...data, keepRemitoNumber: true } : data });
        states.push({ collection: name, id, hash: h, synced_at: now });
        continue;
      }
      if (ADD_ONLY.has(name) || existing.origenCampo) {
        counts.protegidos++;
        continue;
      }
      if (state.get(id) === h) {
        counts.sinCambios++;
        continue;
      }
      // The old system reuses internal ids (4 digits), so a new remito can land on top of another one.
      // Keep the previous remito under its own id and number, unless it was loaded again.
      if (
        name === 'auditRecords' &&
        existing.remitoId && existing.remitoId !== data.remitoId &&
        (existing.remitoPapel !== data.remitoPapel || existing.clientName !== data.clientName) &&
        !incomingKeys.has(remitoKey(existing)) && currentKeys.get(remitoKey(existing)) === 1
      ) {
        const rescuedId = `AUD-REC-${id.replace(/^AUD-/, '')}-${String(existing.remitoId).replace(/[^A-Za-z0-9]/g, '')}`;
        counts.rescatados++;
        writes.push({
          collection: name,
          id: rescuedId,
          data: { ...existing, id: rescuedId, keepRemitoNumber: true, recuperado: true, recuperadoDe: id, recuperadoEn: now }
        });
        // Replaced, not merged: nothing of the previous remito stays in the new one.
        replaces.push({ collection: name, id, data });
        states.push({ collection: name, id, hash: h, synced_at: now });
        counts.actualizados++;
        continue;
      }
      states.push({ collection: name, id, hash: h, synced_at: now });
      if (Object.keys(data).some(k => stable(data[k]) !== stable(existing[k]))) {
        counts.actualizados++;
        writes.push({ collection: name, id, data });
      } else {
        counts.sinCambios++;
      }
    }
    counts.soloSupabase = [...current.keys()].filter(id => !seen.has(id)).length;

    for (let i = 0; i < writes.length; i += 100) {
      const { error } = await supabase.rpc('merge_documents', { p_rows: writes.slice(i, i + 100) });
      if (error) throw new Error(`${name}: ${error.message}`);
    }
    if (replaces.length) {
      const { error } = await supabase.from('documents').upsert(replaces, { onConflict: 'collection,id' });
      if (error) throw new Error(`${name}: ${error.message}`);
    }
    if (deletes.length) {
      const { error } = await supabase.from('documents').delete().eq('collection', name).in('id', deletes);
      if (error) throw new Error(`${name}: ${error.message}`);
    }
    for (let i = 0; i < states.length; i += 500) {
      const { error } = await supabase.from('firestore_sync_state').upsert(states.slice(i, i + 500), { onConflict: 'collection,id' });
      if (error) throw new Error(`estado ${name}: ${error.message}`);
    }
    if (incomingDocs.length || current.size) summary[name] = counts;
  }
  return summary;
}

Deno.serve(async req => {
  const { data: ok } = await supabase.rpc('firestore_sync_token_ok', { p_token: req.headers.get('x-sync-token') || '' });
  if (!ok) return new Response('forbidden', { status: 403 });
  try {
    const summary = await sync();
    await supabase.from('firestore_sync_runs').insert({ summary });
    return Response.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from('firestore_sync_runs').insert({ summary: { error: message } });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});

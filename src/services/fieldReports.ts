/**
 * Remito loading for field roles (Capataz, Empleado).
 * They never read business data: the form uses a price-free directory and the
 * remito is sent to `submit_field_report`, which drops any amount server-side.
 */
import { supabase } from './supabase';
import { callQueued, pendingRpcIds } from './docstore';

export const SUBMIT_FN = 'submit_field_report';
export const UPDATE_FN = 'update_field_report';
export const TRANSFER_FN = 'transfer_field_report';

export interface FieldClient {
  id: string;
  razonSocial: string;
  fincaLocacion?: string | null;
  direccionFiscal?: string | null;
  distanciaKm?: number | null;
}
export interface FieldWorker {
  id: string;
  name: string;
  role?: string | null;
  cargo?: string | null;
  category?: string | null;
  cuadrilla?: string | null;
}
export interface FieldDirectory {
  clients: FieldClient[];
  workers: FieldWorker[];
  capataces: { id?: string; name: string; cuadrilla?: string | null; hasAccount?: boolean }[];
  materials: { id: string; name: string; unit?: string | null }[];
  fetchedAt?: string;
}

export interface FieldReportPayload {
  remitoPapel?: string;
  date: string;
  clientName: string;
  siteLocation: string;
  workPoint: string;
  isGuardia: boolean;
  guardiaType: 'NO_GUARDIA' | 'GUARDIA_50';
  hoursWorked: number;
  travelHours: number;
  viajes: number;
  distanceKm: number;
  horaEntrada: string;
  horaSalida: string;
  jornadas: { entrada: string; salida: string; viajes: number }[];
  fieldMaterials: { name: string; qty: number }[];
  materialsDetails?: string;
  description: string;
  leadTech: string;
  helpers: string[];
  teamMembers: { name: string; role: 'Oficial' | 'Ayudante' }[];
  signatureUrl?: string;
}

export interface SentFieldReport {
  id: string;
  sentAt: number;
  payload: FieldReportPayload;
  failed?: boolean;
  transferredTo?: string;
}

export interface FieldTransfer {
  de: string;
  a: string;
  fecha: string;
  nota?: string | null;
}

// A remito in this account's charge as the server returns it (no amounts).
export interface ServerFieldReport extends FieldReportPayload {
  id: string;
  remitoId?: string;
  status?: string;
  editable: boolean;
  cargadoPor?: string;
  cargadoPorNombre?: string;
  cargadoEn?: string;
  transferencias: FieldTransfer[];
}

// One row of the field home list: server copy, local copy, or both.
export interface FieldReportItem {
  id: string;
  payload: FieldReportPayload;
  remitoId?: string;
  editable: boolean;
  pending: boolean;
  failed: boolean;
  receivedFrom?: string;
  transferredTo?: string;
  closed: boolean;
  sortKey: string;
}

const DIRECTORY_KEY = 'bandiera_field_directory_v1';
const HISTORY_KEY = 'bandiera_field_sent_v1';
const MINE_KEY = 'bandiera_field_mine_v1';
const EMPTY: FieldDirectory = { clients: [], workers: [], capataces: [], materials: [] };

export function cachedDirectory(): FieldDirectory {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(DIRECTORY_KEY) || '{}') };
  } catch {
    return EMPTY;
  }
}

// Fresh directory when online; the cached copy keeps the form usable without signal.
export async function loadDirectory(): Promise<FieldDirectory> {
  const { data, error } = await supabase.rpc('field_directory');
  if (error || !data) return cachedDirectory();
  const dir: FieldDirectory = { ...EMPTY, ...(data as FieldDirectory), fetchedAt: new Date().toISOString() };
  try {
    localStorage.setItem(DIRECTORY_KEY, JSON.stringify(dir));
  } catch {
    // ignore
  }
  return dir;
}

export function sentHistory(): SentFieldReport[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(list: SentFieldReport[]): void {
  try {
    // Keep the last 60 on the device (signatures are the heavy part).
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 60)));
  } catch {
    // ignore
  }
}

export function markFailed(id: string): void {
  saveHistory(sentHistory().map(r => (r.id === id ? { ...r, failed: true } : r)));
}

export function newFieldReportId(): string {
  return `AUD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function submitFieldReport(payload: FieldReportPayload, id = newFieldReportId()): Promise<string> {
  saveHistory([{ id, sentAt: Date.now(), payload }, ...sentHistory().filter(r => r.id !== id)]);
  try {
    await callQueued(SUBMIT_FN, { p_id: id, p_data: payload }, { collection: 'auditRecords', id });
  } catch (err) {
    markFailed(id);
    throw err;
  }
  return id;
}

export function pendingFieldIds(): Set<string> {
  return new Set([...pendingRpcIds(SUBMIT_FN), ...pendingRpcIds(UPDATE_FN), ...pendingRpcIds(TRANSFER_FN)]);
}

function updateHistory(id: string, change: (r: SentFieldReport) => SentFieldReport): void {
  saveHistory(sentHistory().map(r => (r.id === id ? change(r) : r)));
}

export function cachedMine(): ServerFieldReport[] {
  try {
    return JSON.parse(localStorage.getItem(MINE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveMine(list: ServerFieldReport[]): void {
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

// Remitos in this account's charge, including ones another capataz transferred here.
export async function loadMine(): Promise<ServerFieldReport[]> {
  const { data, error } = await supabase.rpc('field_my_reports');
  if (error || !Array.isArray(data)) return cachedMine();
  // Changes still queued on this phone win over the server copy until they upload.
  const pending = pendingFieldIds();
  const local = new Map(cachedMine().map(r => [r.id, r]));
  const list = (data as ServerFieldReport[]).map(r => (pending.has(r.id) && local.has(r.id) ? local.get(r.id)! : r));
  saveMine(list);
  return list;
}

export async function updateFieldReport(id: string, payload: FieldReportPayload): Promise<void> {
  saveMine(cachedMine().map(r => (r.id === id ? { ...r, ...payload } : r)));
  updateHistory(id, r => ({ ...r, payload, failed: false }));
  await callQueued(UPDATE_FN, { p_id: id, p_data: payload }, { collection: 'auditRecords', id });
}

export async function transferFieldReport(id: string, to: { id: string; name: string }, nota?: string): Promise<void> {
  saveMine(cachedMine().filter(r => r.id !== id));
  updateHistory(id, r => ({ ...r, transferredTo: to.name }));
  await callQueued(TRANSFER_FN, { p_id: id, p_to: to.id, p_nota: nota || null }, { collection: 'auditRecords', id });
}

const payloadOf = (r: ServerFieldReport): FieldReportPayload => {
  const { id: _id, remitoId: _r, status: _s, editable: _e, cargadoPor: _c, cargadoPorNombre: _n, cargadoEn: _ce, transferencias: _t, ...payload } = r;
  return payload;
};

// Server list plus what this phone sent that the server does not list (still queued, transferred away or closed).
export function mergedReports(mine: ServerFieldReport[], history: SentFieldReport[], pending: Set<string>, myEmail: string): FieldReportItem[] {
  const items = new Map<string, FieldReportItem>();
  for (const r of mine) {
    const last = r.transferencias?.[r.transferencias.length - 1];
    const received = r.cargadoPor && r.cargadoPor.toLowerCase() !== myEmail.toLowerCase();
    items.set(r.id, {
      id: r.id,
      payload: payloadOf(r),
      remitoId: r.remitoId,
      editable: r.editable,
      pending: pending.has(r.id),
      failed: false,
      receivedFrom: received ? last?.de || r.cargadoPorNombre || r.cargadoPor : undefined,
      closed: !r.editable,
      sortKey: `${r.date || ''}|${r.cargadoEn || ''}`
    });
  }
  for (const h of history) {
    if (items.has(h.id)) {
      const item = items.get(h.id)!;
      item.failed = !!h.failed && !item.pending;
      continue;
    }
    const isPending = pending.has(h.id);
    items.set(h.id, {
      id: h.id,
      payload: h.payload,
      editable: !h.transferredTo && (isPending || !!h.failed),
      pending: isPending,
      failed: !!h.failed && !isPending,
      transferredTo: h.transferredTo,
      // Sent from here but no longer in this account's charge: closed or transferred.
      closed: !isPending && !h.failed && !h.transferredTo,
      sortKey: `${h.payload.date || ''}|${new Date(h.sentAt).toISOString()}`
    });
  }
  return [...items.values()].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

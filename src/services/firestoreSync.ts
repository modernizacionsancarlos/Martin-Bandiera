import {
  collection,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  Unsubscribe,
  arrayUnion,
  arrayRemove,
  query,
  where
} from 'firebase/firestore';
// Escrituras con seguimiento: informan al indicador "Guardado / pendiente / error" (ver syncStatus.ts).
import { setDoc, deleteDoc, writeBatch } from './trackedWrites';
import { db } from './firebase';
import { normalizeWorkerName } from '../utils/calculationUtils';
import {
  UserProfile,
  WorkerItem,
  TechnicalAuditRecord,
  ClientItem,
  MaterialItem,
  FinancialMetricRecord,
  TechnicalCostParameters,
  ArchivedReceipt,
  ProjectItem,
  MaintenanceServiceItem,
  VehicleItem,
  VehicleEventItem,
  FieldReport,
  FieldCatalog
} from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const message = error instanceof Error ? error.message : String(error);
  // Gracefully handle benign offline / temporary network reconnection states
  if (message.includes('unavailable') || message.includes('offline') || message.includes('Could not reach Cloud Firestore')) {
    console.info(`[Firestore Sync: Offline/Reconnecting] op=${operationType} path=${path}. Local cache will be used.`);
    return;
  }
  console.warn(`[Firestore Error] op=${operationType} path=${path}:`, message);
}

/**
 * Deep sanitization for Firestore:
 * Strips all `undefined` values recursively so setDoc never fails.
 * Arrays and objects are converted safely.
 */
export function sanitizeForFirestore<T>(data: T): any {
  if (data === null || data === undefined) {
    return null;
  }
  if (data instanceof Date) {
    return data.toISOString();
  }
  if (Array.isArray(data)) {
    return data
      .filter(item => item !== undefined)
      .map(item => sanitizeForFirestore(item));
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned;
  }
  return data;
}

// -------------------------------------------------------------
// SYSTEM SETTINGS & ZERO STATE
// -------------------------------------------------------------
export interface SystemStatus {
  isZeroState: boolean;
  initialized: boolean;
  updatedAt?: string;
}

export function subscribeSystemStatus(callback: (status: SystemStatus) => void): Unsubscribe {
  const statusDocRef = doc(db, 'systemSettings', 'status');
  return onSnapshot(
    statusDocRef,
    snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.data() as SystemStatus;
        callback(data);
      } else {
        callback({ isZeroState: false, initialized: false });
      }
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'systemSettings/status');
    }
  );
}

export async function setSystemStatusInFirestore(status: Partial<SystemStatus>): Promise<void> {
  const statusDocRef = doc(db, 'systemSettings', 'status');
  try {
    await setDoc(
      statusDocRef,
      sanitizeForFirestore({
        ...status,
        updatedAt: new Date().toISOString()
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'systemSettings/status');
  }
}

// -------------------------------------------------------------
// USERS & RBAC PERMISSIONS SYNC
// -------------------------------------------------------------
export function subscribeUsers(callback: (users: UserProfile[]) => void): Unsubscribe {
  const usersCol = collection(db, 'users');
  return onSnapshot(
    usersCol,
    snapshot => {
      const usersList: UserProfile[] = [];
      snapshot.forEach(docSnap => {
        usersList.push(docSnap.data() as UserProfile);
      });
      callback(usersList);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'users');
    }
  );
}

// Las contraseñas viven solo en Firebase Auth; nunca se guardan en los documentos de usuario.
function stripSecrets(user: UserProfile): Omit<UserProfile, 'password'> {
  const { password: _password, ...rest } = user;
  return rest;
}

export async function saveUserToFirestore(user: UserProfile): Promise<void> {
  const userDocRef = doc(db, 'users', user.uid);
  try {
    await setDoc(userDocRef, sanitizeForFirestore(stripSecrets(user)), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

/**
 * Rol de acceso por cuenta de Firebase Auth. Las reglas de Firestore leen este documento
 * para decidir permisos, por eso solo un administrador puede escribirlo.
 */
export async function saveUserRoleToFirestore(
  authUid: string,
  data: { role: string; email: string; active: boolean }
): Promise<void> {
  try {
    await setDoc(doc(db, 'userRoles', authUid), sanitizeForFirestore(data), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `userRoles/${authUid}`);
  }
}

export async function saveUsersBatchToFirestore(users: UserProfile[]): Promise<void> {
  if (!users || users.length === 0) return;
  const chunkSize = 200;
  for (let i = 0; i < users.length; i += chunkSize) {
    const chunk = users.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach(u => {
      const ref = doc(db, 'users', u.uid);
      batch.set(ref, sanitizeForFirestore(stripSecrets(u)), { merge: true });
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/batch_${i}`);
    }
  }
}

// Deleted Users & Workers Tombstone Persistence
export async function markUserAsDeletedInFirestore(uid?: string, email?: string, name?: string): Promise<void> {
  const deletedDocRef = doc(db, 'systemSettings', 'deleted_users');
  try {
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanName = (name || '').toLowerCase().trim();
    const normName = normalizeWorkerName(name);
    const payload: any = {
      lastDeletedAt: new Date().toISOString()
    };
    if (uid) {
      payload.uids = arrayUnion(uid);
    }
    if (cleanEmail) {
      payload.emails = arrayUnion(cleanEmail);
    }
    if (normName) {
      payload.names = arrayUnion(normName);
    }
    if (cleanName && cleanName !== normName) {
      payload.names = arrayUnion(cleanName);
    }
    await setDoc(deletedDocRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'systemSettings/deleted_users');
  }
}

export async function unmarkUserAsDeletedInFirestore(uid?: string, email?: string, name?: string): Promise<void> {
  const deletedDocRef = doc(db, 'systemSettings', 'deleted_users');
  try {
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanName = (name || '').toLowerCase().trim();
    const normName = normalizeWorkerName(name);
    const payload: any = {};
    if (uid) {
      payload.uids = arrayRemove(uid);
    }
    if (cleanEmail) {
      payload.emails = arrayRemove(cleanEmail);
    }
    if (normName) {
      payload.names = arrayRemove(normName);
    }
    if (cleanName && cleanName !== normName) {
      payload.names = arrayRemove(cleanName);
    }
    if (Object.keys(payload).length > 0) {
      await setDoc(deletedDocRef, payload, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'systemSettings/deleted_users');
  }
}

export function subscribeDeletedUsers(
  callback: (deleted: { uids: string[]; emails: string[]; names: string[] }) => void
): Unsubscribe {
  const deletedDocRef = doc(db, 'systemSettings', 'deleted_users');
  return onSnapshot(
    deletedDocRef,
    docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback({
          uids: Array.isArray(data?.uids) ? data.uids : [],
          emails: Array.isArray(data?.emails) ? data.emails : [],
          names: Array.isArray(data?.names) ? data.names : []
        });
      } else {
        callback({ uids: [], emails: [], names: [] });
      }
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'systemSettings/deleted_users');
    }
  );
}

export async function deleteUserFromFirestore(uid: string, email?: string, name?: string): Promise<void> {
  const cleanEmail = (email || '').toLowerCase().trim();
  const normName = normalizeWorkerName(name);

  // 1. Delete explicit doc IDs
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
  }
  try {
    await deleteDoc(doc(db, 'workers', uid));
  } catch {}

  // 2. Scan and delete any matching workers in Firestore by ID, email, or name
  try {
    const workersSnap = await getDocs(collection(db, 'workers'));
    const batch = writeBatch(db);
    let count = 0;
    workersSnap.forEach(snap => {
      const data = snap.data() as WorkerItem;
      const wEmail = (data.email || '').toLowerCase().trim();
      const wNorm = normalizeWorkerName(data.name);
      if (
        snap.id === uid ||
        (cleanEmail && wEmail === cleanEmail) ||
        (normName && wNorm === normName)
      ) {
        batch.delete(snap.ref);
        count++;
      }
    });
    if (count > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.warn('Could not query/delete workers in Firestore:', err);
  }

  // 3. Scan and delete any duplicate user docs in Firestore
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const batch = writeBatch(db);
    let count = 0;
    usersSnap.forEach(snap => {
      const data = snap.data() as UserProfile;
      const uEmail = (data.email || '').toLowerCase().trim();
      const uNorm = normalizeWorkerName(data.displayName);
      if (
        snap.id === uid ||
        (cleanEmail && uEmail === cleanEmail) ||
        (normName && uNorm === normName)
      ) {
        batch.delete(snap.ref);
        count++;
      }
    });
    if (count > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.warn('Could not query/delete users in Firestore:', err);
  }

  // 4. Record permanent tombstone in Firestore
  await markUserAsDeletedInFirestore(uid, email, name);
}

// -------------------------------------------------------------
// WORKERS / PERSONAL & CUADRILLAS SYNC
// -------------------------------------------------------------
export function subscribeWorkers(callback: (workers: WorkerItem[]) => void): Unsubscribe {
  const workersCol = collection(db, 'workers');
  return onSnapshot(
    workersCol,
    snapshot => {
      const list: WorkerItem[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as WorkerItem);
      });
      callback(list);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'workers');
    }
  );
}

export async function saveWorkerToFirestore(worker: WorkerItem): Promise<void> {
  const workerDocRef = doc(db, 'workers', worker.id);
  try {
    await setDoc(workerDocRef, sanitizeForFirestore(worker), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `workers/${worker.id}`);
  }
}

export async function saveWorkersBatchToFirestore(workers: WorkerItem[]): Promise<void> {
  if (!workers || workers.length === 0) return;
  const chunkSize = 200;
  for (let i = 0; i < workers.length; i += chunkSize) {
    const chunk = workers.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach(w => {
      const ref = doc(db, 'workers', w.id);
      batch.set(ref, sanitizeForFirestore(w), { merge: true });
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `workers/batch_${i}`);
    }
  }
}

export async function deleteWorkerFromFirestore(workerId: string, email?: string, name?: string): Promise<void> {
  const cleanEmail = (email || '').toLowerCase().trim();
  const normName = normalizeWorkerName(name);

  // 1. Delete explicit doc IDs from workers and users
  try {
    await deleteDoc(doc(db, 'workers', workerId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `workers/${workerId}`);
  }
  try {
    await deleteDoc(doc(db, 'users', workerId));
  } catch {}

  // 2. Scan and delete any duplicate matching worker or user docs by ID, email, or name
  try {
    const workersSnap = await getDocs(collection(db, 'workers'));
    const batch = writeBatch(db);
    let count = 0;
    workersSnap.forEach(snap => {
      const data = snap.data() as WorkerItem;
      const wEmail = (data.email || '').toLowerCase().trim();
      const wNorm = normalizeWorkerName(data.name);
      if (
        snap.id === workerId ||
        (cleanEmail && wEmail === cleanEmail) ||
        (normName && wNorm === normName)
      ) {
        batch.delete(snap.ref);
        count++;
      }
    });
    if (count > 0) await batch.commit();
  } catch (err) {
    console.warn('Could not batch delete workers from Firestore:', err);
  }

  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const batch = writeBatch(db);
    let count = 0;
    usersSnap.forEach(snap => {
      const data = snap.data() as UserProfile;
      const uEmail = (data.email || '').toLowerCase().trim();
      const uNorm = normalizeWorkerName(data.displayName);
      if (
        snap.id === workerId ||
        (cleanEmail && uEmail === cleanEmail) ||
        (normName && uNorm === normName)
      ) {
        batch.delete(snap.ref);
        count++;
      }
    });
    if (count > 0) await batch.commit();
  } catch (err) {
    console.warn('Could not batch delete users from Firestore:', err);
  }

  // 3. Mark specifically this ID, email, and normalized name as deleted in Firestore tombstone
  await markUserAsDeletedInFirestore(workerId, email, name);
}

/**
 * Safely purges orphan / secondary duplicate worker documents from Firestore in the background
 */
export async function cleanupDuplicateWorkersInFirestore(duplicateIds: string[]): Promise<void> {
  if (!Array.isArray(duplicateIds) || duplicateIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    duplicateIds.forEach(dupId => {
      if (dupId && !dupId.startsWith('WRK-0') && !dupId.startsWith('WRK-1')) {
        batch.delete(doc(db, 'workers', dupId));
      }
    });
    await batch.commit();
  } catch (err) {
    console.warn('Could not clean up duplicate worker docs in Firestore:', err);
  }
}

/**
 * Clears the workers collection in Firestore (used during full replace import)
 */
export async function clearWorkersCollectionInFirestore(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'workers'));
    const batch = writeBatch(db);
    snap.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  } catch (err) {
    console.warn('Could not clear workers collection in Firestore:', err);
  }
}

// -------------------------------------------------------------
// TECHNICAL AUDIT RECORDS (REMITOS & REPORTES DE CAMPO)
// -------------------------------------------------------------
export function normalizeTechnicalAuditRecord(raw: any): TechnicalAuditRecord {
  if (!raw || typeof raw !== 'object') {
    return {
      id: `AUD-${Date.now()}`,
      remitoId: `#${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      clientName: 'Cliente Sin Asignar',
      siteLocation: '',
      workPoint: '',
      isGuardia: false,
      hoursWorked: 0,
      travelHours: 0,
      distanceKm: 0,
      horaEntrada: '08:00',
      horaSalida: '16:00',
      logisticsCost: 0,
      laborDirectCost: 0,
      operatingCost: 0,
      materialsCost: 0,
      description: '',
      suggestedPrice: 0,
      billedPrice: 0,
      collectedPrice: 0,
      helperPay: 0,
      techPay: 0,
      leadTech: 'Sin Asignar',
      helpers: [],
      status: 'Pasado',
      semaforo: 'neutro'
    };
  }

  const billedPrice = Number(raw.billedPrice ?? raw.billingAmount ?? raw.suggestedPrice ?? 0) || 0;
  const suggestedPrice = Number(raw.suggestedPrice ?? raw.billedPrice ?? raw.billingAmount ?? 0) || 0;
  const collectedPrice = Number(raw.collectedPrice ?? (raw.status === 'Cobrado' ? (billedPrice || suggestedPrice) : 0)) || 0;
  const logisticsCost = Number(raw.logisticsCost ?? 0) || 0;
  const laborDirectCost = Number(raw.laborDirectCost ?? raw.totalDirectCost ?? 0) || 0;
  const materialsCost = Number(raw.materialsCost ?? 0) || 0;
  const operatingCost = Number(raw.operatingCost ?? (logisticsCost + laborDirectCost + materialsCost)) || 0;
  const helperPay = Number(raw.helperPay ?? 0) || 0;
  const techPay = Number(raw.techPay ?? (laborDirectCost > 0 ? Math.round(laborDirectCost * 0.6) : 0)) || 0;
  const capatazCommissionPct = Number(raw.capatazCommissionPct ?? 10) || 10;
  const capatazProfit = Number(raw.capatazProfit ?? Math.round(laborDirectCost * (capatazCommissionPct / 100))) || 0;
  const baseOperational = logisticsCost + techPay + helperPay + materialsCost;
  const honorarios = Number(raw.honorarios !== undefined ? raw.honorarios : (billedPrice > baseOperational ? (billedPrice - baseOperational) : 0)) || 0;

  return {
    ...raw,
    id: String(raw.id || `AUD-${Date.now()}`),
    remitoId: String(raw.remitoId || raw.remitoNumber || (raw.id ? `#${raw.id}` : '#000-2026')),
    remitoPapel: raw.remitoPapel || '',
    date: String(raw.date || new Date().toISOString().split('T')[0]),
    clientName: String(raw.clientName || 'Cliente Sin Asignar'),
    siteLocation: String(raw.siteLocation || raw.site || ''),
    workPoint: String(raw.workPoint || raw.site || raw.description || ''),
    isGuardia: Boolean(raw.isGuardia),
    guardiaType: raw.guardiaType || 'NO_GUARDIA',
    guardiaMode: raw.guardiaMode,
    guardiaAmount: raw.guardiaAmount,
    guardiaSubtype: raw.guardiaSubtype,
    marginPercentage: raw.marginPercentage,
    hoursWorked: Number(raw.hoursWorked ?? (raw.tasks?.length ? raw.tasks.length * 1.5 : 4)) || 0,
    travelHours: Number(raw.travelHours ?? 1.5) || 0,
    viajes: raw.viajes !== undefined ? Number(raw.viajes) : undefined,
    distanceKm: Number(raw.distanceKm ?? 30) || 0,
    horaEntrada: raw.horaEntrada || '08:00',
    horaSalida: raw.horaSalida || '16:00',
    logisticsCost,
    fuelCost: raw.fuelCost,
    seguroCost: raw.seguroCost,
    amortizacionCost: raw.amortizacionCost,
    laborDirectCost,
    operatingCost,
    materialsCost,
    materialsDetails: raw.materialsDetails || '',
    description: raw.description || (Array.isArray(raw.tasks) ? raw.tasks.join(', ') : ''),
    suggestedPrice,
    billedPrice,
    collectedPrice,
    helperPay,
    techPay,
    honorarios,
    leadTech: String(raw.leadTech || raw.responsableTecnico || 'Ing. Matías Calderón'),
    helpers: Array.isArray(raw.helpers) ? raw.helpers : (raw.capataz ? [raw.capataz] : ['MARCELO QUINTEROS']),
    teamMembers: Array.isArray(raw.teamMembers) ? raw.teamMembers : undefined,
    supportStaff: Array.isArray(raw.supportStaff) ? raw.supportStaff : [],
    signatureUrl: raw.signatureUrl || '',
    status: raw.status || 'Pasado',
    semaforo: raw.semaforo || (raw.status === 'Cobrado' ? 'verde' : raw.status === 'Facturado' ? 'verde' : 'naranja'),
    numeroFactura: raw.numeroFactura || '',
    fechaFactura: raw.fechaFactura || '',
    retencionIVA: Number(raw.retencionIVA || 0) || 0,
    retencionIIBB: Number(raw.retencionIIBB || 0) || 0,
    retencionGanancias: Number(raw.retencionGanancias || 0) || 0,
    paymentMethods: Array.isArray(raw.paymentMethods) ? raw.paymentMethods : [],
    fechaCobro: raw.fechaCobro || (raw.status === 'Cobrado' ? raw.date : ''),
    capatazCommissionPct,
    capatazProfit
  };
}

export function subscribeAuditRecords(callback: (records: TechnicalAuditRecord[]) => void): Unsubscribe {
  const auditsCol = collection(db, 'auditRecords');
  return onSnapshot(
    auditsCol,
    snapshot => {
      const list: TechnicalAuditRecord[] = [];
      snapshot.forEach(docSnap => {
        list.push(normalizeTechnicalAuditRecord(docSnap.data()));
      });
      // sort by date descending
      list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      callback(list);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'auditRecords');
    }
  );
}

export async function saveAuditRecordToFirestore(record: TechnicalAuditRecord): Promise<void> {
  const recordDocRef = doc(db, 'auditRecords', record.id);
  try {
    await setDoc(recordDocRef, sanitizeForFirestore(record), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `auditRecords/${record.id}`);
  }
}

export async function saveAuditRecordsBatchToFirestore(records: TechnicalAuditRecord[]): Promise<void> {
  if (!records || records.length === 0) return;
  const chunkSize = 200;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach(r => {
      const ref = doc(db, 'auditRecords', r.id);
      batch.set(ref, sanitizeForFirestore(r), { merge: true });
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `auditRecords/batch_${i}`);
    }
  }
}

export async function deleteAuditRecordFromFirestore(recordId: string): Promise<void> {
  const recordDocRef = doc(db, 'auditRecords', recordId);
  try {
    await deleteDoc(recordDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `auditRecords/${recordId}`);
  }
}

export async function clearAllAuditRecordsInFirestore(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'auditRecords'));
    const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'auditRecords');
  }
}

// -------------------------------------------------------------
// CLIENTS
// -------------------------------------------------------------
export function subscribeClients(callback: (clients: ClientItem[]) => void): Unsubscribe {
  const clientsCol = collection(db, 'clients');
  return onSnapshot(
    clientsCol,
    snapshot => {
      const list: ClientItem[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as ClientItem);
      });
      callback(list);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'clients');
    }
  );
}

export async function saveClientToFirestore(client: ClientItem): Promise<void> {
  const clientDocRef = doc(db, 'clients', client.id);
  try {
    await setDoc(clientDocRef, sanitizeForFirestore(client), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `clients/${client.id}`);
  }
}

export async function saveClientsBatchToFirestore(clients: ClientItem[]): Promise<void> {
  if (!clients || clients.length === 0) return;
  const chunkSize = 200;
  for (let i = 0; i < clients.length; i += chunkSize) {
    const chunk = clients.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach(c => {
      const ref = doc(db, 'clients', c.id);
      batch.set(ref, sanitizeForFirestore(c), { merge: true });
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `clients/batch_${i}`);
    }
  }
}

export async function deleteClientFromFirestore(clientId: string): Promise<void> {
  const clientDocRef = doc(db, 'clients', clientId);
  try {
    await deleteDoc(clientDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `clients/${clientId}`);
  }
}

export async function clearAllClientsInFirestore(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'clients'));
    const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'clients');
  }
}

// -------------------------------------------------------------
// MATERIALS
// -------------------------------------------------------------
export function normalizeMaterialItem(data: any): MaterialItem {
  return {
    id: String(data?.id || `MAT-${Date.now()}`),
    code: String(data?.code || '').trim(),
    name: String(data?.name || 'Material sin nombre').trim(),
    category: data?.category || 'Electricidad',
    stock: Number(data?.stock) || 0,
    unit: String(data?.unit || 'Unidades').trim(),
    minStock: Number(data?.minStock) || 0,
    unitPrice: Number(data?.unitPrice) || 0,
    location: String(data?.location || 'Depósito Central').trim(),
    tenantId: String(data?.tenantId || 'tenant_bandiera_hq'),
    lastUpdated: data?.lastUpdated || new Date().toISOString().split('T')[0]
  };
}

export function subscribeMaterials(callback: (materials: MaterialItem[]) => void): Unsubscribe {
  const materialsCol = collection(db, 'materials');
  return onSnapshot(
    materialsCol,
    snapshot => {
      const list: MaterialItem[] = [];
      snapshot.forEach(docSnap => {
        list.push(normalizeMaterialItem(docSnap.data()));
      });
      callback(list);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'materials');
    }
  );
}

export async function saveMaterialToFirestore(material: MaterialItem): Promise<void> {
  const materialDocRef = doc(db, 'materials', material.id);
  try {
    await setDoc(materialDocRef, sanitizeForFirestore(material), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `materials/${material.id}`);
  }
}

export async function saveMaterialsBatchToFirestore(materials: MaterialItem[]): Promise<void> {
  if (!materials || materials.length === 0) return;
  const chunkSize = 200;
  for (let i = 0; i < materials.length; i += chunkSize) {
    const chunk = materials.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach(m => {
      const ref = doc(db, 'materials', m.id);
      batch.set(ref, sanitizeForFirestore(m), { merge: true });
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `materials/batch_${i}`);
    }
  }
}

export async function deleteMaterialFromFirestore(materialId: string): Promise<void> {
  const materialDocRef = doc(db, 'materials', materialId);
  try {
    await deleteDoc(materialDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `materials/${materialId}`);
  }
}

export async function clearAllMaterialsInFirestore(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'materials'));
    const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'materials');
  }
}

// -------------------------------------------------------------
// FINANCIAL REPORTS (REPORTES FINANCIEROS Y METRICAS)
// -------------------------------------------------------------
export function subscribeFinancialReports(callback: (reports: FinancialMetricRecord[]) => void): Unsubscribe {
  const financialsCol = collection(db, 'financials');
  return onSnapshot(
    financialsCol,
    snapshot => {
      const list: FinancialMetricRecord[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as FinancialMetricRecord);
      });
      callback(list);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'financials');
    }
  );
}

export async function saveFinancialReportToFirestore(report: FinancialMetricRecord): Promise<void> {
  const ref = doc(db, 'financials', report.id);
  try {
    await setDoc(ref, sanitizeForFirestore(report), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `financials/${report.id}`);
  }
}

export async function saveFinancialReportsBatchToFirestore(reports: FinancialMetricRecord[]): Promise<void> {
  if (!reports || reports.length === 0) return;
  const chunkSize = 200;
  for (let i = 0; i < reports.length; i += chunkSize) {
    const chunk = reports.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach(r => {
      const ref = doc(db, 'financials', r.id);
      batch.set(ref, sanitizeForFirestore(r), { merge: true });
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `financials/batch_${i}`);
    }
  }
}

export async function deleteFinancialReportFromFirestore(reportId: string): Promise<void> {
  const ref = doc(db, 'financials', reportId);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `financials/${reportId}`);
  }
}

// -------------------------------------------------------------
// TECHNICAL COST PARAMETERS (VALOR HORA, COMBUSTIBLE, SEGUROS)
// -------------------------------------------------------------
export function subscribeTechnicalParameters(callback: (params: TechnicalCostParameters) => void): Unsubscribe {
  const ref = doc(db, 'technicalParameters', 'global');
  return onSnapshot(
    ref,
    snapshot => {
      if (snapshot.exists()) {
        callback(snapshot.data() as TechnicalCostParameters);
      }
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'technicalParameters/global');
    }
  );
}

export async function saveTechnicalParametersToFirestore(params: TechnicalCostParameters): Promise<void> {
  const ref = doc(db, 'technicalParameters', 'global');
  try {
    await setDoc(ref, sanitizeForFirestore(params), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'technicalParameters/global');
  }
}

// -------------------------------------------------------------
// ARCHIVED RECEIPTS (COMPROBANTES Y RECIBOS)
// -------------------------------------------------------------
export function subscribeArchivedReceipts(callback: (receipts: ArchivedReceipt[]) => void): Unsubscribe {
  const col = collection(db, 'archivedReceipts');
  return onSnapshot(
    col,
    snapshot => {
      const list: ArchivedReceipt[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as ArchivedReceipt);
      });
      callback(list);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'archivedReceipts');
    }
  );
}

export async function saveArchivedReceiptToFirestore(receipt: ArchivedReceipt): Promise<void> {
  const ref = doc(db, 'archivedReceipts', receipt.id);
  try {
    await setDoc(ref, sanitizeForFirestore(receipt), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `archivedReceipts/${receipt.id}`);
  }
}

export async function deleteArchivedReceiptFromFirestore(id: string): Promise<void> {
  const ref = doc(db, 'archivedReceipts', id);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `archivedReceipts/${id}`);
  }
}

// -------------------------------------------------------------
// PROJECTS (OBRAS)
// -------------------------------------------------------------
export function subscribeProjects(callback: (projects: ProjectItem[]) => void): Unsubscribe {
  const col = collection(db, 'projects');
  return onSnapshot(
    col,
    snapshot => {
      const list: ProjectItem[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as ProjectItem);
      });
      callback(list);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'projects');
    }
  );
}

export async function saveProjectToFirestore(project: ProjectItem): Promise<void> {
  const ref = doc(db, 'projects', project.id);
  try {
    await setDoc(ref, sanitizeForFirestore(project), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `projects/${project.id}`);
  }
}

export async function deleteProjectFromFirestore(id: string): Promise<void> {
  const ref = doc(db, 'projects', id);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
  }
}

// -------------------------------------------------------------
// MAINTENANCE SERVICES (MANTENIMIENTO ELECTROMECANICO)
// -------------------------------------------------------------
export function subscribeMaintenanceServices(callback: (services: MaintenanceServiceItem[]) => void): Unsubscribe {
  const col = collection(db, 'maintenanceServices');
  return onSnapshot(
    col,
    snapshot => {
      const list: MaintenanceServiceItem[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as MaintenanceServiceItem);
      });
      callback(list);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'maintenanceServices');
    }
  );
}

export async function saveMaintenanceServiceToFirestore(service: MaintenanceServiceItem): Promise<void> {
  const ref = doc(db, 'maintenanceServices', service.id);
  try {
    await setDoc(ref, sanitizeForFirestore(service), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `maintenanceServices/${service.id}`);
  }
}

export async function deleteMaintenanceServiceFromFirestore(id: string): Promise<void> {
  const ref = doc(db, 'maintenanceServices', id);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `maintenanceServices/${id}`);
  }
}

// -------------------------------------------------------------
// VEHICLES (FLOTA Y AMORTIZACIÓN)
// -------------------------------------------------------------
export function subscribeVehicles(callback: (vehicles: VehicleItem[]) => void): Unsubscribe {
  const col = collection(db, 'vehicles');
  return onSnapshot(
    col,
    snapshot => {
      const list: VehicleItem[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as VehicleItem);
      });
      callback(list);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'vehicles');
    }
  );
}

export async function saveVehicleToFirestore(vehicle: VehicleItem): Promise<void> {
  const ref = doc(db, 'vehicles', vehicle.id);
  try {
    await setDoc(ref, sanitizeForFirestore(vehicle), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `vehicles/${vehicle.id}`);
  }
}

export async function saveVehiclesBatchToFirestore(vehicles: VehicleItem[]): Promise<void> {
  if (!vehicles.length) return;
  const batch = writeBatch(db);
  vehicles.forEach(veh => {
    const ref = doc(db, 'vehicles', veh.id);
    batch.set(ref, sanitizeForFirestore(veh), { merge: true });
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'vehicles');
  }
}

export async function deleteVehicleFromFirestore(id: string): Promise<void> {
  const ref = doc(db, 'vehicles', id);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `vehicles/${id}`);
  }
}

export async function clearAllVehiclesInFirestore(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'vehicles'));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'vehicles');
  }
}

// -------------------------------------------------------------
// VEHICLE EVENTS (HISTORIAL, ODÓMETRO, SERVICES, REPUESTOS)
// -------------------------------------------------------------
export function subscribeVehicleEvents(callback: (events: VehicleEventItem[]) => void): Unsubscribe {
  const col = collection(db, 'vehicleEvents');
  return onSnapshot(
    col,
    snapshot => {
      const list: VehicleEventItem[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as VehicleEventItem);
      });
      callback(list);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'vehicleEvents');
    }
  );
}

export async function saveVehicleEventToFirestore(event: VehicleEventItem): Promise<void> {
  const ref = doc(db, 'vehicleEvents', event.id);
  try {
    await setDoc(ref, sanitizeForFirestore(event), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `vehicleEvents/${event.id}`);
  }
}

export async function saveVehicleEventsBatchToFirestore(events: VehicleEventItem[]): Promise<void> {
  if (!events.length) return;
  const batch = writeBatch(db);
  events.forEach(evt => {
    const ref = doc(db, 'vehicleEvents', evt.id);
    batch.set(ref, sanitizeForFirestore(evt), { merge: true });
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'vehicleEvents');
  }
}

export async function deleteVehicleEventFromFirestore(id: string): Promise<void> {
  const ref = doc(db, 'vehicleEvents', id);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `vehicleEvents/${id}`);
  }
}

export async function clearAllVehicleEventsInFirestore(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'vehicleEvents'));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'vehicleEvents');
  }
}



// -------------------------------------------------------------
// FIELD REPORTS (partes de campo cargados por capataces, sin valores)
// -------------------------------------------------------------
/** Con `authUid` solo pide los partes de esa cuenta: es la consulta que las reglas permiten a un capataz. */
export function subscribeFieldReports(callback: (reports: FieldReport[]) => void, authUid?: string): Unsubscribe {
  const col = collection(db, 'fieldReports');
  return onSnapshot(
    authUid ? query(col, where('submittedByAuthUid', '==', authUid)) : col,
    snapshot => {
      const list: FieldReport[] = [];
      snapshot.forEach(docSnap => list.push(docSnap.data() as FieldReport));
      list.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
      callback(list);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'fieldReports');
    }
  );
}

export async function saveFieldReportToFirestore(report: FieldReport): Promise<void> {
  try {
    await setDoc(doc(db, 'fieldReports', report.id), sanitizeForFirestore(report), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `fieldReports/${report.id}`);
  }
}

// -------------------------------------------------------------
// FIELD CATALOG (nombres sin valores para el capataz)
// -------------------------------------------------------------
export function subscribeFieldCatalog(callback: (catalog: FieldCatalog | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'catalogoCampo', 'actual'),
    snap => callback(snap.exists() ? (snap.data() as FieldCatalog) : null),
    error => {
      handleFirestoreError(error, OperationType.GET, 'catalogoCampo/actual');
    }
  );
}

export async function saveFieldCatalogToFirestore(catalog: FieldCatalog): Promise<void> {
  try {
    await setDoc(doc(db, 'catalogoCampo', 'actual'), sanitizeForFirestore(catalog));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'catalogoCampo/actual');
  }
}

/** Rol de una cuenta (userRoles/{authUid}); cada cuenta puede leer el suyo. */
export async function fetchOwnRole(authUid: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'userRoles', authUid));
    return snap.exists() ? ((snap.data() as { role?: string }).role ?? null) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `userRoles/${authUid}`);
    return null;
  }
}

export interface OwnRoleInfo {
  role: string | null;
  active: boolean;
  mustChangePassword: boolean;
}

/** Rol, estado y marca de clave temporal de la cuenta (userRoles/{authUid}); cada cuenta lee el suyo. */
export async function fetchOwnRoleInfo(authUid: string): Promise<OwnRoleInfo> {
  try {
    const snap = await getDoc(doc(db, 'userRoles', authUid));
    if (!snap.exists()) return { role: null, active: false, mustChangePassword: false };
    const data = snap.data() as { role?: string; active?: boolean; mustChangePassword?: boolean };
    return { role: data.role ?? null, active: data.active === true, mustChangePassword: data.mustChangePassword === true };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `userRoles/${authUid}`);
    return { role: null, active: false, mustChangePassword: false };
  }
}

/** Solo el perfil de la cuenta indicada: es lo único que las reglas dejan leer a un capataz. */
export function subscribeOwnUser(authUid: string, callback: (users: UserProfile[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'users'), where('authUid', '==', authUid)),
    snapshot => {
      const list: UserProfile[] = [];
      snapshot.forEach(docSnap => list.push(docSnap.data() as UserProfile));
      callback(list);
    },
    error => {
      handleFirestoreError(error, OperationType.GET, 'users(own)');
    }
  );
}

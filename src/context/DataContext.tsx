import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { createFieldOutbox, createIdbStorage, newFieldReportId, type OutboxEntry } from '../services/fieldOutbox';
import { describeWriteError } from '../services/syncStatus';
import { useAuth, getDeletedUsersTombstone, unmarkUserAsDeletedLocally, recordDeletedUserLocally } from './AuthContext';
import {
  FinancialMetricRecord,
  ProjectItem,
  MaintenanceServiceItem,
  MaterialItem,
  WorkerItem,
  WorkerCategory,
  UserProfile,
  TechnicalCostParameters,
  TechnicalAuditRecord,
  ArchivedReceipt,
  ClientItem,
  VehicleItem,
  VehicleEventItem,
  FieldReport,
  FieldCatalog
} from '../types';
import {
  INITIAL_FINANCIAL_REPORTS,
  INITIAL_PROJECTS,
  INITIAL_MAINTENANCE_SERVICES,
  INITIAL_MATERIALS,
  INITIAL_WORKERS,
  DEFAULT_TECHNICAL_PARAMETERS,
  INITIAL_TECHNICAL_AUDIT_RECORDS,
  INITIAL_CLIENTS,
  INITIAL_VEHICLES,
  INITIAL_VEHICLE_EVENTS
} from '../data/initialData';
import {
  calculateAuditCosts,
  recalculateAllAuditRecords,
  calculateCapatazProfit,
  roundCurrency,
  isAdministrativeProfile,
  normalizeWorkerName,
  isAuthorizedWorkerOrStaff,
  AUTHORIZED_14_WORKERS_MAP,
  deduplicateWorkersList
} from '../utils/calculationUtils';
import {
  subscribeWorkers,
  saveWorkerToFirestore,
  saveWorkersBatchToFirestore,
  deleteWorkerFromFirestore,
  clearWorkersCollectionInFirestore,
  unmarkUserAsDeletedInFirestore,
  subscribeAuditRecords,
  saveAuditRecordToFirestore,
  saveAuditRecordsBatchToFirestore,
  deleteAuditRecordFromFirestore,
  clearAllAuditRecordsInFirestore,
  subscribeClients,
  saveClientToFirestore,
  saveClientsBatchToFirestore,
  deleteClientFromFirestore,
  clearAllClientsInFirestore,
  subscribeMaterials,
  saveMaterialToFirestore,
  saveMaterialsBatchToFirestore,
  deleteMaterialFromFirestore,
  clearAllMaterialsInFirestore,
  subscribeFinancialReports,
  saveFinancialReportToFirestore,
  saveFinancialReportsBatchToFirestore,
  deleteFinancialReportFromFirestore,
  subscribeTechnicalParameters,
  saveTechnicalParametersToFirestore,
  subscribeArchivedReceipts,
  saveArchivedReceiptToFirestore,
  deleteArchivedReceiptFromFirestore,
  subscribeProjects,
  saveProjectToFirestore,
  deleteProjectFromFirestore,
  subscribeMaintenanceServices,
  saveMaintenanceServiceToFirestore,
  deleteMaintenanceServiceFromFirestore,
  subscribeVehicles,
  saveVehicleToFirestore,
  saveVehiclesBatchToFirestore,
  deleteVehicleFromFirestore,
  clearAllVehiclesInFirestore,
  subscribeVehicleEvents,
  saveVehicleEventToFirestore,
  saveVehicleEventsBatchToFirestore,
  deleteVehicleEventFromFirestore,
  clearAllVehicleEventsInFirestore,
  subscribeSystemStatus,
  subscribeFieldReports,
  saveFieldReportToFirestore,
  subscribeFieldCatalog,
  saveFieldCatalogToFirestore,
  setSystemStatusInFirestore,
  normalizeTechnicalAuditRecord
} from '../services/firestoreSync';

interface MonthlyPerformanceData {
  monthKey: string;     // e.g. "2026-01"
  monthName: string;    // e.g. "Ene"
  monthFullName: string;// e.g. "Enero 2026"
  cargado: number;
  facturado: number;
  cobrado: number;
  pendiente: number;
  efectividadCobro: number; // percentage
  count: number;
}

interface DataContextType {
  financialReports: FinancialMetricRecord[];
  projects: ProjectItem[];
  maintenanceServices: MaintenanceServiceItem[];
  materials: MaterialItem[];
  workers: WorkerItem[];
  technicalParameters: TechnicalCostParameters;
  technicalAuditRecords: TechnicalAuditRecord[];
  
  // Financial Actions
  addFinancialReport: (report: Omit<FinancialMetricRecord, 'id' | 'pendingBalance'>) => void;
  updateFinancialReport: (id: string, updates: Partial<FinancialMetricRecord>) => void;
  deleteFinancialReport: (id: string) => void;

  // Partes de campo (los carga el capataz sin valores; administración los convierte en remitos)
  fieldReports: FieldReport[];
  /** Partes cargados en este dispositivo que todavía no llegaron al servidor (sin señal). */
  unsyncedFieldReportIds: Set<string>;
  /** Copia de seguridad de los partes de este teléfono que el servidor todavía no confirmó (o rechazó). */
  outboxEntries: OutboxEntry[];
  /** Vuelve a enviar un parte que el servidor había rechazado. */
  retryFieldReport: (id: string) => void;
  /** Nombres sin valores para la app del capataz (clientes, personal, materiales). */
  fieldCatalog: FieldCatalog | null;
  addFieldReport: (input: Omit<FieldReport, 'id' | 'status' | 'submittedAt' | 'submittedByUid' | 'submittedByAuthUid' | 'submittedByName'>) => void;
  markFieldReportConverted: (id: string, remitoId: string) => void;
  discardFieldReport: (id: string, reason?: string) => void;

  // Technical Cost Parameters Actions
  updateTechnicalParameters: (updates: Partial<TechnicalCostParameters>) => void;

  // Technical Audit Records Actions
  addTechnicalAuditRecord: (record: Omit<TechnicalAuditRecord, 'id' | 'remitoId' | 'logisticsCost' | 'laborDirectCost' | 'operatingCost' | 'suggestedPrice'> & { remitoId?: string }) => void;
  bulkAddTechnicalAuditRecords: (records: Partial<TechnicalAuditRecord>[]) => void;
  bulkUpdateAuditRecordDescriptions: (updates: { id: string; description: string }[]) => Promise<number>;
  /** Archiva o desarchiva remitos cobrados en una sola operación. Devuelve cuántos cambiaron. */
  bulkSetArchived: (recordIds: string[], archived: boolean) => Promise<number>;
  bulkPassToFacturado: (
    recordIds: string[],
    numeroFactura: string,
    fechaFactura: string,
    billing?: BillingDetailsInput
  ) => Promise<number>;
  updateTechnicalAuditRecord: (id: string, updates: Partial<TechnicalAuditRecord>) => void;
  deleteTechnicalAuditRecord: (id: string) => void;

  // Archived Receipts / Comprobantes Actions
  archivedReceipts: ArchivedReceipt[];
  addArchivedReceipt: (receipt: Omit<ArchivedReceipt, 'id' | 'createdAt'> & { id?: string }) => ArchivedReceipt;
  deleteArchivedReceipt: (id: string) => void;

  // Project Actions
  addProject: (project: Omit<ProjectItem, 'id'>) => void;
  updateProject: (id: string, updates: Partial<ProjectItem>) => void;
  deleteProject: (id: string) => void;

  // Maintenance Actions
  addMaintenanceService: (service: Omit<MaintenanceServiceItem, 'id'>) => void;
  updateMaintenanceService: (id: string, updates: Partial<MaintenanceServiceItem>) => void;
  deleteMaintenanceService: (id: string) => void;

  // Materials Actions
  updateMaterialStock: (id: string, newStock: number) => void;
  addMaterial: (material: Omit<MaterialItem, 'id' | 'lastUpdated'>) => void;
  bulkAddMaterials: (materials: Partial<MaterialItem>[]) => void;
  deleteMaterial: (id: string) => void;

  // Worker Actions
  addWorker: (worker: Omit<WorkerItem, 'id'>) => void;
  updateWorker: (id: string, updates: Partial<WorkerItem>) => void;
  deleteWorker: (id: string) => void;
  bulkAddWorkers: (workers: Omit<WorkerItem, 'id'>[], replaceAll?: boolean) => Promise<{ added: number; updated: number; total: number }>;

  // Clientes Actions (Base de Datos de Clientes)
  clients: ClientItem[];
  addClient: (client: Omit<ClientItem, 'id'> & { id?: string }) => void;
  bulkAddClients: (clients: Partial<ClientItem>[]) => void;
  updateClient: (id: string, updates: Partial<ClientItem>) => void;
  deleteClient: (id: string) => void;

  // Flota de Vehículos & Amortización
  vehicles: VehicleItem[];
  vehicleEvents: VehicleEventItem[];
  addVehicle: (vehicle: Omit<VehicleItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => VehicleItem;
  updateVehicle: (id: string, updates: Partial<VehicleItem>) => void;
  deleteVehicle: (id: string) => void;
  bulkAddVehicles: (vehicles: Partial<VehicleItem>[]) => void;
  addVehicleEvent: (event: Omit<VehicleEventItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => VehicleEventItem;
  updateVehicleEvent: (id: string, updates: Partial<VehicleEventItem>) => void;
  deleteVehicleEvent: (id: string) => void;

  // Aggregated calculations
  monthlyPerformance: MonthlyPerformanceData[];
  totalCargado: number;
  totalFacturado: number;
  totalCobrado: number;
  totalPendiente: number;
  collectionRate: number; // percentage
  resetAllData: () => void;
  clearSystemToZero: (options?: {
    clearAudits?: boolean;
    clearClients?: boolean;
    clearMaterials?: boolean;
    clearFinancials?: boolean;
    clearReceipts?: boolean;
    clearVehicles?: boolean;
  }) => void;
  clearDemoDataOnly: () => Promise<void>;
}

const STORAGE_KEY = 'job_martin_bandiera_master_dataset_v1';
const ZERO_STATE_KEY = 'job_martin_bandiera_is_zero_state';

const isSystemZeroStateActive = (): boolean => {
  try {
    return localStorage.getItem(ZERO_STATE_KEY) === 'true';
  } catch {
    return false;
  }
};

const sortWorkersAlphabetically = (list: WorkerItem[]): WorkerItem[] => {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
};

/** Datos de facturación calculados en el modal "Pasar a Facturado" para el conjunto de remitos. */
export interface BillingDetailsInput {
  montoBaseRemitos: number;
  recargo7Pct: number;
  subtotalNeto: number;
  ivaPct: 21 | 10.5;
  ivaAmount: number;
  totalFacturado: number;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { users, createUser, updateUser, deleteUser, currentUser } = useAuth();
  // El capataz solo carga partes: su sesión no se suscribe a remitos, finanzas, comprobantes ni tarifas.
  const isFieldRole = currentUser?.role === 'Capataz';
  const [fieldReports, setFieldReports] = useState<FieldReport[]>([]);
  const [unsyncedFieldReportIds, setUnsyncedFieldReportIds] = useState<Set<string>>(new Set());
  const outbox = useMemo(
    () => (currentUser?.authUid ? createFieldOutbox(createIdbStorage(), currentUser.authUid) : null),
    [currentUser?.authUid]
  );
  const outboxRef = useRef(outbox);
  outboxRef.current = outbox;
  const [outboxEntries, setOutboxEntries] = useState<OutboxEntry[]>([]);
  useEffect(() => {
    if (!outbox) return;
    setOutboxEntries(outbox.list());
    return outbox.subscribe(() => setOutboxEntries(outbox.list()));
  }, [outbox]);

  /** Envía un parte y deja constancia en la bandeja: se borra al confirmar el servidor, se marca si lo rechaza. */
  const submitFieldReport = (report: FieldReport) => {
    const box = outboxRef.current;
    box?.setInFlight(report.id, true);
    saveFieldReportToFirestore(report)
      .then(() => box?.remove(report.id))
      .catch(error => box?.markFailed(report.id, describeWriteError(error)))
      .finally(() => box?.setInFlight(report.id, false));
  };
  const [fieldCatalog, setFieldCatalog] = useState<FieldCatalog | null>(null);

  // Production-Ready Default States: Empty collections by default so publishing never re-seeds demo data
  const [financialReports, setFinancialReports] = useState<FinancialMetricRecord[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_financials`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [projects, setProjects] = useState<ProjectItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_projects`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [maintenanceServices, setMaintenanceServices] = useState<MaintenanceServiceItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_maintenance`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [materials, setMaterials] = useState<MaterialItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_materials`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [workers, setWorkers] = useState<WorkerItem[]>(() => {
    const { uids: deletedUids, emails: deletedEmails, names: deletedNames } = getDeletedUsersTombstone();
    const filterAndSort = (list: WorkerItem[]) => {
      const valid = list.filter(w => {
        const em = (w.email || '').toLowerCase().trim();
        const norm = normalizeWorkerName(w.name);
        if (deletedUids.has(w.id) || (em && deletedEmails.has(em)) || (norm && deletedNames.has(norm))) return false;
        return isAuthorizedWorkerOrStaff(w);
      });
      const synchronized = valid.map(w => {
        const norm = normalizeWorkerName(w.name);
        const master = AUTHORIZED_14_WORKERS_MAP.get(norm);
        if (master) {
          return {
            ...w,
            role: master.role,
            category: master.category,
            hourlyRate: master.hourlyRate,
            capatazPercentage: master.capatazPercentage
          };
        }
        return w;
      });
      return sortWorkersAlphabetically(synchronized);
    };

    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_workers`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return filterAndSort(parsed);
      }
    } catch {}
    // Sin caché local, el personal se muestra vacío hasta que llegue desde Firestore (no se usan datos de ejemplo del código).
    return [];
  });

  const [technicalParameters, setTechnicalParameters] = useState<TechnicalCostParameters>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_tech_params`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_TECHNICAL_PARAMETERS;
  });

  const [technicalAuditRecords, setTechnicalAuditRecords] = useState<TechnicalAuditRecord[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_tech_audits`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.map(normalizeTechnicalAuditRecord);
      }
    } catch {}
    return [];
  });

  const [archivedReceipts, setArchivedReceipts] = useState<ArchivedReceipt[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_archived_receipts`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [clients, setClients] = useState<ClientItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_clients`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [vehicles, setVehicles] = useState<VehicleItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_vehicles`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [vehicleEvents, setVehicleEvents] = useState<VehicleEventItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_vehicle_events`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Real-time Firestore Cloud Synchronization (Strictly without auto-seeding demo data on publish)
  useEffect(() => {
    let isMounted = true;
    const noop = () => {};

    // 1. System zero-state flag in cloud
    const unsubStatus = subscribeSystemStatus(status => {
      if (!isMounted) return;
      if (status.isZeroState) {
        try {
          localStorage.setItem(ZERO_STATE_KEY, 'true');
        } catch {}
      }
    });

    // 2. Workers synchronization: Cloud-authoritative from Firestore
    const unsubWorkers = isFieldRole ? noop : subscribeWorkers(remoteWorkers => {
      if (!isMounted) return;
      const { uids: deletedUids, emails: deletedEmails, names: deletedNames } = getDeletedUsersTombstone();

      let activeList: WorkerItem[] = [];

      if (remoteWorkers && remoteWorkers.length > 0) {
        // Cloud-authoritative: populate strictly from live Firestore state
        activeList = remoteWorkers.filter(w => {
          if (!w || !w.name) return false;
          const em = (w.email || '').toLowerCase().trim();
          const norm = normalizeWorkerName(w.name);
          if (deletedUids.has(w.id) || (em && deletedEmails.has(em)) || (norm && deletedNames.has(norm))) return false;
          return true;
        });
      }
      // Si Firestore no tiene personal, la lista queda vacía: nunca se rellena con datos de ejemplo del código.

      const deduplicated = deduplicateWorkersList(activeList);
      const validWorkers = sortWorkersAlphabetically(
        deduplicated.map(w => {
          const norm = normalizeWorkerName(w.name);
          const master = AUTHORIZED_14_WORKERS_MAP.get(norm);
          if (master) {
            return {
              ...w,
              role: w.role || master.role,
              category: w.category || master.category,
              hourlyRate: (w.hourlyRate !== undefined && w.hourlyRate > 0) ? w.hourlyRate : master.hourlyRate,
              capatazPercentage: (w.capatazPercentage !== undefined) ? w.capatazPercentage : master.capatazPercentage
            };
          }
          return w;
        })
      );

      setWorkers(validWorkers);
      try {
        localStorage.setItem(`${STORAGE_KEY}_workers`, JSON.stringify(validWorkers));
      } catch {}
    });

    // 3. Technical audit records (remitos) synchronization: Reflects exact database state
    const unsubFieldReports = subscribeFieldReports(
      (remote, unsynced, confirmedByServer) => {
        if (!isMounted) return;
        setFieldReports(remote);
        setUnsyncedFieldReportIds(unsynced);
        // Con una lectura confirmada por el servidor se reconcilia la bandeja: lo recibido se borra y lo perdido se reenvía.
        const box = outboxRef.current;
        if (box && confirmedByServer) {
          const serverIds = new Set(remote.map(r => r.id));
          // La bandeja se lee del disco del teléfono: se espera a que esté cargada antes de comparar.
          box.ready.then(() => {
            const { resubmit } = box.reconcile(serverIds, unsynced);
            resubmit.forEach(report => submitFieldReportRef.current(report));
          });
        }
      },
      isFieldRole ? currentUser?.authUid : undefined
    );
    const unsubCatalog = subscribeFieldCatalog(catalog => { if (isMounted) setFieldCatalog(catalog); });
    const unsubAudits = isFieldRole ? noop : subscribeAuditRecords(remoteAudits => {
      if (!isMounted) return;
      if (remoteAudits && remoteAudits.length > 0) {
        setTechnicalAuditRecords(remoteAudits);
        try {
          localStorage.setItem(`${STORAGE_KEY}_tech_audits`, JSON.stringify(remoteAudits));
        } catch {}
      } else {
        // La base es la única fuente de verdad: si está vacía se muestra vacío.
        // Ya no se reescribe en Firestore lo que haya en la caché del navegador (podía resucitar datos borrados).
        setTechnicalAuditRecords([]);
        try { localStorage.removeItem(`${STORAGE_KEY}_tech_audits`); } catch {}
      }
    });

    // 4. Clients database synchronization: Reflects exact database state
    const unsubClients = isFieldRole ? noop : subscribeClients(remoteClients => {
      if (!isMounted) return;
      if (remoteClients && remoteClients.length > 0) {
        setClients(remoteClients);
        try {
          localStorage.setItem(`${STORAGE_KEY}_clients`, JSON.stringify(remoteClients));
        } catch {}
      } else {
        setClients([]);
        try { localStorage.removeItem(`${STORAGE_KEY}_clients`); } catch {}
      }
    });

    // 5. Materials in cloud: Reflects exact database state
    const unsubMaterials = isFieldRole ? noop : subscribeMaterials(remoteMaterials => {
      if (!isMounted) return;
      if (remoteMaterials && remoteMaterials.length > 0) {
        setMaterials(remoteMaterials);
        try {
          localStorage.setItem(`${STORAGE_KEY}_materials`, JSON.stringify(remoteMaterials));
        } catch {}
      } else {
        setMaterials([]);
        try { localStorage.removeItem(`${STORAGE_KEY}_materials`); } catch {}
      }
    });

    // 6. Financial reports in cloud
    const unsubFinancials = isFieldRole ? noop : subscribeFinancialReports(remoteFinancials => {
      if (!isMounted) return;
      if (remoteFinancials && remoteFinancials.length > 0) {
        setFinancialReports(remoteFinancials);
        try {
          localStorage.setItem(`${STORAGE_KEY}_financials`, JSON.stringify(remoteFinancials));
        } catch {}
      }
    });

    // 7. Technical Cost Parameters in cloud
    const unsubParams = isFieldRole ? noop : subscribeTechnicalParameters(remoteParams => {
      if (!isMounted) return;
      if (remoteParams && remoteParams.dieselPrice) {
        setTechnicalParameters(remoteParams);
        try {
          localStorage.setItem(`${STORAGE_KEY}_tech_params`, JSON.stringify(remoteParams));
        } catch {}
      }
    });

    // 8. Archived Receipts in cloud
    const unsubReceipts = isFieldRole ? noop : subscribeArchivedReceipts(remoteReceipts => {
      if (!isMounted) return;
      if (remoteReceipts && remoteReceipts.length > 0) {
        setArchivedReceipts(remoteReceipts);
        try {
          localStorage.setItem(`${STORAGE_KEY}_archived_receipts`, JSON.stringify(remoteReceipts));
        } catch {}
      }
    });

    // 9. Projects in cloud
    const unsubProjects = isFieldRole ? noop : subscribeProjects(remoteProjects => {
      if (!isMounted) return;
      if (remoteProjects && remoteProjects.length > 0) {
        setProjects(remoteProjects);
        try {
          localStorage.setItem(`${STORAGE_KEY}_projects`, JSON.stringify(remoteProjects));
        } catch {}
      }
    });

    // 10. Maintenance Services in cloud
    const unsubMaintenance = isFieldRole ? noop : subscribeMaintenanceServices(remoteServices => {
      if (!isMounted) return;
      if (remoteServices && remoteServices.length > 0) {
        setMaintenanceServices(remoteServices);
        try {
          localStorage.setItem(`${STORAGE_KEY}_maintenance`, JSON.stringify(remoteServices));
        } catch {}
      }
    });

    // 11. Vehicles in cloud
    const unsubVehicles = isFieldRole ? noop : subscribeVehicles(remoteVehicles => {
      if (!isMounted) return;
      if (remoteVehicles && remoteVehicles.length > 0) {
        setVehicles(remoteVehicles);
        try {
          localStorage.setItem(`${STORAGE_KEY}_vehicles`, JSON.stringify(remoteVehicles));
        } catch {}
      } else {
        setVehicles([]);
        try { localStorage.removeItem(`${STORAGE_KEY}_vehicles`); } catch {}
      }
    });

    // 12. Vehicle Events in cloud
    const unsubVehicleEvents = isFieldRole ? noop : subscribeVehicleEvents(remoteEvents => {
      if (!isMounted) return;
      if (remoteEvents && remoteEvents.length > 0) {
        setVehicleEvents(remoteEvents);
        try {
          localStorage.setItem(`${STORAGE_KEY}_vehicle_events`, JSON.stringify(remoteEvents));
        } catch {}
      } else {
        setVehicleEvents([]);
        try { localStorage.removeItem(`${STORAGE_KEY}_vehicle_events`); } catch {}
      }
    });

    return () => {
      isMounted = false;
      unsubStatus();
      unsubWorkers();
      unsubAudits();
      unsubClients();
      unsubMaterials();
      unsubFinancials();
      unsubParams();
      unsubReceipts();
      unsubProjects();
      unsubMaintenance();
      unsubVehicles();
      unsubVehicleEvents();
      unsubFieldReports();
      unsubCatalog();
    };
  }, []);

  // Keep administrative staff synchronized with users from AuthContext (RBAC database integration)
  // Ensures administrative users (Gastón, Romina, Juan Pablo) appear under Administrativo in workers
  // WITHOUT resurrecting deleted field workers or overriding Firestore workers state.
  useEffect(() => {
    if (!users || users.length === 0) return;
    setWorkers(prevWorkers => {
      const { uids: deletedUids, emails: deletedEmails, names: deletedNames } = getDeletedUsersTombstone();

      // Only pull users who are designated as Administrative / Management
      const administrativeUsers = users.filter(u => {
        if (!u) return false;
        const em = (u.email || '').toLowerCase().trim();
        const uNorm = normalizeWorkerName(u.displayName);
        if (deletedUids.has(u.uid) || (em && deletedEmails.has(em)) || (uNorm && deletedNames.has(uNorm))) return false;
        return isAdministrativeProfile(u) || u.category === 'Administrativo' || u.isAdministrative || ['SuperAdmin', 'Owner', 'Gerente', 'Admin'].includes(u.role);
      });

      // Filter existing workers to ensure no tombstone records remain
      const cleanPrev = prevWorkers.filter(w => {
        const wEmail = (w.email || '').toLowerCase().trim();
        const wNorm = normalizeWorkerName(w.name);
        if (deletedUids.has(w.id)) return false;
        if (wEmail && deletedEmails.has(wEmail)) return false;
        if (wNorm && deletedNames.has(wNorm)) return false;
        return true;
      });

      // Check which administrative users are missing from workers
      const missingAdmWorkers: WorkerItem[] = [];
      administrativeUsers.forEach(u => {
        const uNorm = normalizeWorkerName(u.displayName);
        const uEmail = (u.email || '').toLowerCase().trim();
        const alreadyExists = cleanPrev.some(
          w => w.id === u.uid ||
               (uEmail && (w.email || '').toLowerCase().trim() === uEmail) ||
               (uNorm && normalizeWorkerName(w.name) === uNorm)
        );

        if (!alreadyExists) {
          missingAdmWorkers.push({
            id: u.uid.startsWith('usr_') ? `WRK-${u.uid.replace('usr_', '').toUpperCase()}` : u.uid,
            name: u.displayName.replace(/\s*\(Administración\)\s*/i, '').trim(),
            role: u.role,
            category: 'Administrativo',
            isAdministrative: true,
            specialty: u.specialty || 'Administración & Gestión',
            cargo: u.cargo || u.specialty || 'Personal Administrativo / Gestión',
            email: u.email,
            phone: u.phone || '',
            active: u.active !== false,
            assignedProjectsCount: 1,
            salaryMonthly: u.salaryMonthly || 1200000,
            hourlyRate: 0,
            cuadrilla: u.cuadrilla || 'Administración Central'
          });
        }
      });

      if (missingAdmWorkers.length === 0 && cleanPrev.length === prevWorkers.length) {
        return prevWorkers;
      }

      const deduplicated = deduplicateWorkersList([...cleanPrev, ...missingAdmWorkers]);
      const combined = sortWorkersAlphabetically(deduplicated);
      try {
        localStorage.setItem(`${STORAGE_KEY}_workers`, JSON.stringify(combined));
      } catch {}
      return combined;
    });
  }, [users]);

  // Catálogo del capataz: lo mantiene al día una sesión administrativa (nunca la del capataz) y solo lleva nombres.
  useEffect(() => {
    if (isFieldRole || !currentUser || !['SuperAdmin', 'Owner', 'Gerente', 'Admin'].includes(currentUser.role)) return;
    if (clients.length === 0 && workers.length === 0 && materials.length === 0) return;
    const next: FieldCatalog = {
      clients: clients
        .map(c => ({ id: c.id, razonSocial: c.razonSocial, fincaLocacion: c.fincaLocacion || '' }))
        .sort((a, b) => a.razonSocial.localeCompare(b.razonSocial)),
      workers: workers
        .filter(w => w.active !== false && !w.isAdministrative && w.category !== 'Administrativo')
        .map(w => ({ id: w.id, name: w.name, category: w.category }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      materials: materials
        .map(m => ({ id: m.id, name: m.name, unit: m.unit }))
        .sort((a, b) => a.name.localeCompare(b.name))
    };
    const same = (a: FieldCatalog | null) =>
      a !== null && JSON.stringify({ c: a.clients, w: a.workers, m: a.materials }) === JSON.stringify({ c: next.clients, w: next.workers, m: next.materials });
    if (same(fieldCatalog)) return;
    const timer = window.setTimeout(() => {
      saveFieldCatalogToFirestore({ ...next, updatedAt: new Date().toISOString() });
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [clients, workers, materials, fieldCatalog, currentUser, isFieldRole]);

  // Persist changes
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_financials`, JSON.stringify(financialReports));
      localStorage.setItem(`${STORAGE_KEY}_projects`, JSON.stringify(projects));
      localStorage.setItem(`${STORAGE_KEY}_maintenance`, JSON.stringify(maintenanceServices));
      localStorage.setItem(`${STORAGE_KEY}_materials`, JSON.stringify(materials));
      localStorage.setItem(`${STORAGE_KEY}_workers`, JSON.stringify(workers));
      localStorage.setItem(`${STORAGE_KEY}_tech_params`, JSON.stringify(technicalParameters));
      localStorage.setItem(`${STORAGE_KEY}_tech_audits`, JSON.stringify(technicalAuditRecords));
      localStorage.setItem(`${STORAGE_KEY}_archived_receipts`, JSON.stringify(archivedReceipts));
      localStorage.setItem(`${STORAGE_KEY}_clients`, JSON.stringify(clients));
    } catch {}
  }, [financialReports, projects, maintenanceServices, materials, workers, technicalParameters, technicalAuditRecords, archivedReceipts, clients]);

  // Update Technical Parameters (Saved for new remitos; existing historical remitos remain immutable)
  const updateTechnicalParameters = (updates: Partial<TechnicalCostParameters>) => {
    setTechnicalParameters(prev => {
      const updated: TechnicalCostParameters = {
        ...prev,
        ...updates,
        lastUpdated: new Date().toISOString().split('T')[0]
      };
      saveTechnicalParametersToFirestore(updated).catch(() => {});
      // Note: Existing historical remitos are strictly preserved and never mutated automatically
      return updated;
    });
  };

  // Technical Audit Records Actions
  const submitFieldReportRef = useRef(submitFieldReport);
  submitFieldReportRef.current = submitFieldReport;

  const addFieldReport: DataContextType['addFieldReport'] = input => {
    if (!currentUser) return;
    const report: FieldReport = {
      ...input,
      id: newFieldReportId(),
      status: 'Pendiente',
      submittedAt: new Date().toISOString(),
      submittedByUid: currentUser.uid,
      submittedByAuthUid: currentUser.authUid || '',
      submittedByName: currentUser.displayName
    };
    setFieldReports(prev => [report, ...prev]);
    // Primero la copia duradera en el teléfono y recién después el envío: si la app se cierra de golpe, el parte no se pierde.
    const box = outboxRef.current;
    if (box) box.add(report).finally(() => submitFieldReport(report));
    else submitFieldReport(report);
  };

  const retryFieldReport = (id: string) => {
    const report = outboxRef.current?.retry(id);
    if (report) submitFieldReport(report);
  };

  const patchFieldReport = (id: string, patch: Partial<FieldReport>) => {
    const current = fieldReports.find(r => r.id === id);
    if (!current) return;
    const next = { ...current, ...patch };
    setFieldReports(prev => prev.map(r => (r.id === id ? next : r)));
    saveFieldReportToFirestore(next).catch(() => {});
  };

  const markFieldReportConverted = (id: string, remitoId: string) =>
    patchFieldReport(id, {
      status: 'Convertido',
      remitoId,
      convertedByName: currentUser?.displayName,
      convertedAt: new Date().toISOString()
    });

  const discardFieldReport = (id: string, reason?: string) =>
    patchFieldReport(id, { status: 'Descartado', discardReason: reason || undefined, convertedByName: currentUser?.displayName });

  const addTechnicalAuditRecord = (recordInput: Omit<TechnicalAuditRecord, 'id' | 'remitoId' | 'logisticsCost' | 'laborDirectCost' | 'operatingCost' | 'suggestedPrice'> & { remitoId?: string }) => {
    const id = `AUD-${Date.now().toString().slice(-4)}`;
    
    let remitoId = recordInput.remitoId;
    if (!remitoId) {
      const existingNums = technicalAuditRecords.map(r => {
        const match = r.remitoId.match(/#?(\d+)-2026/);
        return match ? parseInt(match[1], 10) : 0;
      });
      const maxNum = existingNums.length > 0 ? Math.max(...existingNums, 379) : 379;
      remitoId = `#${maxNum + 1}-2026`;
    }

    const costs = calculateAuditCosts(technicalParameters, {
      hoursWorked: recordInput.hoursWorked,
      travelHours: recordInput.travelHours,
      distanceKm: recordInput.distanceKm,
      isGuardia: recordInput.isGuardia,
      guardiaType: recordInput.guardiaType,
      guardiaMode: recordInput.guardiaMode,
      guardiaAmount: recordInput.guardiaAmount,
      guardiaSubtype: recordInput.guardiaSubtype,
      marginPercentage: recordInput.marginPercentage,
      helpersCount: recordInput.helpers?.length || 0,
      materialsCost: recordInput.materialsCost || 0,
      leadTechName: recordInput.leadTech,
      helperNames: recordInput.helpers,
      teamMembers: recordInput.teamMembers,
      workers,
      users
    });

    const effectiveSemaforo = recordInput.semaforo || (
      recordInput.status === 'Cobrado' ? 'verde' :
      recordInput.status === 'Facturado' ? 'naranja' :
      'rojo'
    );

    // Capataz commission calculation strictly on Costo de Servicio / M.O. Directa
    const hasNoCap = !recordInput.leadTech || recordInput.leadTech.trim() === '' || recordInput.leadTech.toLowerCase() === 'sin capataz';
    const matchedWorker = (!hasNoCap && recordInput.leadTech) ? workers.find(w => w.name.toLowerCase() === recordInput.leadTech.toLowerCase()) : undefined;
    const matchedUser = (!hasNoCap && recordInput.leadTech) ? users.find(u => u.displayName.toLowerCase() === recordInput.leadTech.toLowerCase()) : undefined;

    const isCapatazLead = !hasNoCap && Boolean(
      recordInput.leadTech.toLowerCase().includes('capataz') ||
      matchedWorker?.role === 'Capataz' ||
      matchedUser?.role === 'Capataz'
    );

    const configuredCapatazPct = matchedWorker?.capatazPercentage ?? matchedUser?.capatazPercentage ?? 10;

    const capatazCommissionPct = hasNoCap
      ? undefined
      : (recordInput.capatazCommissionPct !== undefined
          ? recordInput.capatazCommissionPct
          : (isCapatazLead ? configuredCapatazPct : undefined));
    const capatazProfit = hasNoCap
      ? undefined
      : (recordInput.capatazProfit !== undefined
          ? recordInput.capatazProfit
          : (capatazCommissionPct !== undefined ? calculateCapatazProfit(costs.laborDirectCost, capatazCommissionPct) : undefined));

    const newRecord: TechnicalAuditRecord = {
      ...recordInput,
      id,
      remitoId,
      semaforo: effectiveSemaforo,
      logisticsCost: costs.logisticsCost,
      laborDirectCost: costs.laborDirectCost,
      operatingCost: costs.operatingCost,
      techPay: costs.techPay,
      helperPay: costs.helperPay,
      suggestedPrice: costs.suggestedPrice,
      billedPrice: recordInput.billedPrice > 0 ? recordInput.billedPrice : costs.suggestedPrice,
      collectedPrice: recordInput.status === 'Cobrado' ? (recordInput.billedPrice || costs.suggestedPrice) : (recordInput.collectedPrice || 0),
      capatazCommissionPct,
      capatazProfit
    };

    setTechnicalAuditRecords(prev => [newRecord, ...prev]);
    saveAuditRecordToFirestore(newRecord).catch(() => {});

    // Also sync to maintenanceServices so services view reflects it immediately
    const maintenanceServiceItem: MaintenanceServiceItem = {
      id: `MNT-${id}`,
      code: remitoId,
      title: `${recordInput.workPoint || 'Mantenimiento Electromecánico'}`,
      client: recordInput.clientName,
      assetType: 'Pozo de Agua',
      priority: recordInput.isGuardia ? 'Urgente' : 'Alta',
      status: recordInput.status === 'Cobrado' ? 'Finalizado' : recordInput.status === 'Facturado' ? 'En Curso' : 'Pendiente',
      assignedTech: recordInput.leadTech || 'Martin Bandiera',
      scheduledDate: recordInput.date,
      estimatedCost: newRecord.operatingCost,
      actualCost: newRecord.operatingCost,
      billedAmount: newRecord.billedPrice,
      collectedAmount: newRecord.collectedPrice,
      notes: `Remito ${remitoId}. ${recordInput.description || ''}. Ayudantes: ${(recordInput.helpers || []).join(', ')}`,
      tenantId: 'tenant_bandiera_hq'
    };
    setMaintenanceServices(prev => [maintenanceServiceItem, ...prev]);

    // Automatically sync with financialReports so Dashboard and Charts reflect the new work immediately!
    const period = recordInput.date ? recordInput.date.slice(0, 7) : '2026-09';
    const monthNames: Record<string, string> = {
      '2026-01': 'Enero 2026',
      '2026-02': 'Febrero 2026',
      '2026-03': 'Marzo 2026',
      '2026-04': 'Abril 2026',
      '2026-05': 'Mayo 2026',
      '2026-06': 'Junio 2026',
      '2026-07': 'Julio 2026',
      '2026-08': 'Agosto 2026',
      '2026-09': 'Septiembre 2026',
      '2026-10': 'Octubre 2026',
      '2026-11': 'Noviembre 2026',
      '2026-12': 'Diciembre 2026'
    };

    const finReport: FinancialMetricRecord = {
      id: `REP-${id}`,
      period,
      periodLabel: monthNames[period] || period,
      clientName: recordInput.clientName,
      projectName: `${recordInput.workPoint || 'Servicio Técnico'} (${remitoId})`,
      code: remitoId,
      cargado: newRecord.operatingCost,
      facturado: newRecord.billedPrice,
      cobrado: newRecord.collectedPrice,
      pendingBalance: Math.max(0, newRecord.billedPrice - newRecord.collectedPrice),
      status: newRecord.status === 'Cobrado' ? 'Cobrado' : newRecord.status === 'Facturado' ? 'Facturado Parcial' : 'En Gestión',
      date: recordInput.date,
      category: 'Mantenimiento',
      createdBy: recordInput.leadTech || 'admin@bandiera.com',
      notes: `${recordInput.description || ''} ${recordInput.isGuardia ? '[TRABAJO DE GUARDIA]' : ''}`
    };

    setFinancialReports(prev => [finReport, ...prev]);
  };

  const updateTechnicalAuditRecord = (id: string, updates: Partial<TechnicalAuditRecord>) => {
    setTechnicalAuditRecords(prev => {
      const newRecords = prev.map(item => {
        if (item.id === id) {
          const updated = { ...item, ...updates };
          if (updates.status === 'Cobrado' && !updates.collectedPrice) {
            updated.collectedPrice = updated.billedPrice;
            if (!updates.semaforo) updated.semaforo = 'verde';
          } else if (updates.status === 'Facturado' && !updates.semaforo) {
            updated.semaforo = 'naranja';
            if (item.status === 'Pasado' && updates.billedPrice === undefined && item.billedPrice > 0) {
              updated.billedPrice = Math.round(item.billedPrice / 1.07);
            }
          } else if (updates.status === 'Pasado') {
            if (!updates.semaforo) updated.semaforo = 'naranja';
            // Del facturado($) en la tabla al pasarlo a pasado se le debe agregar el 7% a ese valor
            if (item.status !== 'Pasado' && updates.billedPrice === undefined) {
              const currentBilled = item.billedPrice > 0 ? item.billedPrice : item.suggestedPrice;
              updated.billedPrice = Math.round(currentBilled * 1.07);
            }
          } else if (updates.status === 'Cargado') {
            if (updates.collectedPrice === undefined) {
              updated.collectedPrice = 0;
            }
            if (item.status === 'Pasado' && updates.billedPrice === undefined && item.billedPrice > 0) {
              updated.billedPrice = Math.round(item.billedPrice / 1.07);
            }
            if (!updates.semaforo) updated.semaforo = 'rojo';
          }

          // Auto-recalculate operator costs by hour if hoursWorked or team changed without explicit cost override
          if ((updates.hoursWorked !== undefined || updates.isGuardia !== undefined || updates.guardiaType !== undefined || updates.guardiaMode !== undefined || updates.guardiaAmount !== undefined || updates.marginPercentage !== undefined || updates.leadTech !== undefined || updates.helpers !== undefined) && updates.laborDirectCost === undefined) {
            const reCalc = calculateAuditCosts(technicalParameters, {
              hoursWorked: updated.hoursWorked ?? 4,
              travelHours: updated.travelHours ?? 1,
              viajes: updated.viajes,
              distanceKm: updated.distanceKm ?? 0,
              isGuardia: Boolean(updated.isGuardia),
              guardiaType: updated.guardiaType,
              guardiaMode: updated.guardiaMode,
              guardiaAmount: updated.guardiaAmount,
              guardiaSubtype: updated.guardiaSubtype,
              marginPercentage: updated.marginPercentage,
              helpersCount: updated.helpers?.length || 0,
              materialsCost: updated.materialsCost || 0,
              leadTechName: updated.leadTech,
              helperNames: updated.helpers,
              teamMembers: updated.teamMembers,
              workers,
              users
            });
            updated.techPay = reCalc.techPay;
            updated.helperPay = reCalc.helperPay;
            updated.laborDirectCost = reCalc.laborDirectCost;
            if (updates.suggestedPrice === undefined) {
              updated.suggestedPrice = reCalc.suggestedPrice;
            }
          }

          // Always ensure operatingCost is consistent: Logistics + Labor + Materials
          if (updates.operatingCost === undefined && (updates.materialsCost !== undefined || updates.laborDirectCost !== undefined || updates.logisticsCost !== undefined || updates.hoursWorked !== undefined)) {
            updated.operatingCost = roundCurrency((Number(updated.logisticsCost) || 0) + (Number(updated.laborDirectCost) || 0) + (Number(updated.materialsCost) || 0));
          }

          // Compute Capataz profit strictly on COSTO DE SERVICIO (laborDirectCost)
          const hasNoCapLead = !updated.leadTech || updated.leadTech.trim() === '' || updated.leadTech.toLowerCase() === 'sin capataz';
          const isCapLead = !hasNoCapLead && Boolean(
            updated.leadTech.toLowerCase().includes('capataz') ||
            workers.some(w => w.name.toLowerCase() === updated.leadTech.toLowerCase() && (w.role === 'Capataz' || w.category === 'Capataz')) ||
            users.some(u => u.displayName.toLowerCase() === updated.leadTech.toLowerCase() && (u.role === 'Capataz' || (u as any).category === 'Capataz'))
          );

          if (hasNoCapLead || !isCapLead) {
            updated.capatazCommissionPct = undefined;
            updated.capatazProfit = undefined;
          } else {
            const commissionPct = updated.capatazCommissionPct !== undefined ? updated.capatazCommissionPct : (item.capatazCommissionPct || 10);
            updated.capatazProfit = calculateCapatazProfit(updated.laborDirectCost, commissionPct);
          }

          return updated;
        }
        return item;
      });

      const updatedRecord = newRecords.find(r => r.id === id);
      if (updatedRecord) {
        saveAuditRecordToFirestore(updatedRecord).catch(() => {});
        setFinancialReports(finReports =>
          finReports.map(f => {
            if (f.code === updatedRecord.remitoId || f.id === `REP-${updatedRecord.id}`) {
              return {
                ...f,
                status: updatedRecord.status === 'Cobrado' ? 'Cobrado' : (updatedRecord.status === 'Facturado' || updatedRecord.status === 'Pasado') ? 'Facturado Parcial' : 'En Gestión',
                cargado: updatedRecord.operatingCost,
                facturado: updatedRecord.billedPrice,
                cobrado: updatedRecord.collectedPrice || 0,
                pendingBalance: Math.max(0, updatedRecord.billedPrice - (updatedRecord.collectedPrice || 0))
              };
            }
            return f;
          })
        );
      }

      return newRecords;
    });
  };

  const bulkAddTechnicalAuditRecords = (recordsInput: Partial<TechnicalAuditRecord>[]) => {
    const formatted: TechnicalAuditRecord[] = recordsInput.map((rec, idx) => {
      const id = rec.id || `AUD-IMP-${Date.now().toString().slice(-4)}-${idx + 1}`;
      const remitoId = rec.remitoId || `R-IMP-${Date.now().toString().slice(-4)}-${idx + 1}`;
      
      const costs = calculateAuditCosts(
        technicalParameters,
        {
          hoursWorked: rec.hoursWorked ?? 4,
          travelHours: rec.travelHours ?? 1,
          viajes: rec.viajes,
          distanceKm: rec.distanceKm ?? 0,
          materialsCost: rec.materialsCost ?? 0,
          isGuardia: rec.isGuardia ?? false,
          guardiaType: rec.guardiaType ?? 'NO_GUARDIA',
          helpersCount: rec.helpers?.length ?? 0,
          leadTechName: rec.leadTech,
          helperNames: rec.helpers,
          workers,
          users
        }
      );

      const status = rec.status || 'Cargado';
      const laborDirectCost = rec.laborDirectCost ?? costs.laborDirectCost;
      const operatingCost = rec.operatingCost ?? roundCurrency((rec.logisticsCost ?? costs.logisticsCost) + laborDirectCost + (rec.materialsCost ?? 0));
      const billedPrice = rec.billedPrice && rec.billedPrice > 0 ? rec.billedPrice : (rec.suggestedPrice ?? costs.suggestedPrice);

      return {
        id,
        remitoId,
        remitoPapel: rec.remitoPapel,
        date: rec.date || new Date().toISOString().split('T')[0],
        clientName: rec.clientName || 'Cliente Importado',
        siteLocation: rec.siteLocation || 'Mendoza / Valle de Uco',
        workPoint: rec.workPoint || 'Pozo / Instalación',
        isGuardia: rec.isGuardia || false,
        guardiaType: rec.guardiaType || 'NO_GUARDIA',
        hoursWorked: rec.hoursWorked ?? 4,
        travelHours: rec.travelHours ?? 1,
        distanceKm: rec.distanceKm ?? 30,
        horaEntrada: rec.horaEntrada || '08:00',
        horaSalida: rec.horaSalida || '12:30',
        logisticsCost: rec.logisticsCost ?? costs.logisticsCost,
        laborDirectCost,
        operatingCost,
        materialsCost: rec.materialsCost ?? 0,
        materialsDetails: rec.materialsDetails,
        description: rec.description || 'Trabajos importados desde Excel',
        suggestedPrice: rec.suggestedPrice ?? costs.suggestedPrice,
        billedPrice,
        collectedPrice: rec.collectedPrice ?? (status === 'Cobrado' ? billedPrice : 0),
        helperPay: costs.helperPay,
        techPay: costs.techPay,
        leadTech: rec.leadTech || 'Ing. Matías Calderón',
        helpers: rec.helpers || [],
        status,
        semaforo: status === 'Cobrado' ? 'verde' : status === 'Facturado' ? 'verde' : status === 'Pasado' ? 'naranja' : 'rojo',
        numeroFactura: rec.numeroFactura,
        fechaFactura: rec.fechaFactura,
        retencionIVA: rec.retencionIVA || 0,
        retencionIIBB: rec.retencionIIBB || 0,
        retencionGanancias: rec.retencionGanancias || 0
      };
    });

    setTechnicalAuditRecords(prev => [...formatted, ...prev]);
    formatted.forEach(r => saveAuditRecordToFirestore(r).catch(() => {}));
  };

  const bulkUpdateAuditRecordDescriptions = async (updates: { id: string; description: string }[]): Promise<number> => {
    if (updates.length === 0) return 0;
    const updateMap = new Map(updates.map(u => [u.id, u.description]));
    
    let updatedRecords: TechnicalAuditRecord[] = [];
    setTechnicalAuditRecords(prev => {
      const next = prev.map(rec => {
        if (updateMap.has(rec.id)) {
          return {
            ...rec,
            description: updateMap.get(rec.id)!
          };
        }
        return rec;
      });
      updatedRecords = next.filter(r => updateMap.has(r.id));
      try {
        localStorage.setItem(`${STORAGE_KEY}_tech_audits`, JSON.stringify(next));
      } catch {}
      return next;
    });

    if (updatedRecords.length > 0) {
      await saveAuditRecordsBatchToFirestore(updatedRecords);
    }
    return updatedRecords.length;
  };

  const bulkSetArchived = async (recordIds: string[], archived: boolean): Promise<number> => {
    if (recordIds.length === 0) return 0;
    const idSet = new Set(recordIds);
    const today = new Date().toISOString().split('T')[0];

    // Solo los cobrados se archivan; el estado sigue siendo "Cobrado", por eso los totales no cambian.
    const changed = technicalAuditRecords
      .filter(r => idSet.has(r.id) && (archived ? r.status === 'Cobrado' : true) && Boolean(r.archivado) !== archived)
      .map(r => ({ ...r, archivado: archived, fechaArchivado: archived ? today : '' }));
    if (changed.length === 0) return 0;

    const byId = new Map(changed.map(r => [r.id, r]));
    setTechnicalAuditRecords(prev => {
      const next = prev.map(r => byId.get(r.id) || r);
      try {
        localStorage.setItem(`${STORAGE_KEY}_tech_audits`, JSON.stringify(next));
      } catch {}
      return next;
    });
    await saveAuditRecordsBatchToFirestore(changed);
    return changed.length;
  };

  const bulkPassToFacturado = async (
    recordIds: string[],
    numeroFactura: string,
    fechaFactura: string,
    billing?: BillingDetailsInput
  ): Promise<number> => {
    if (recordIds.length === 0) return 0;
    const idSet = new Set(recordIds);

    // Reparto de los importes del modal entre los remitos, en proporción a su precio base.
    // El último remito absorbe el redondeo para que la suma coincida exactamente con el total.
    const billingShares = new Map<string, { base: number; recargo: number; iva: number; total: number }>();
    if (billing) {
      const targets = technicalAuditRecords.filter(r => idSet.has(r.id));
      const weights = targets.map(r => Math.max(0, r.billedPrice && r.billedPrice > 0 ? r.billedPrice : r.suggestedPrice || 0));
      const weightSum = weights.reduce((a, b) => a + b, 0);
      const cents = (n: number) => Math.round(n * 100) / 100;
      const used = { base: 0, recargo: 0, iva: 0, total: 0 };
      targets.forEach((r, idx) => {
        const isLast = idx === targets.length - 1;
        const ratio = weightSum > 0 ? weights[idx] / weightSum : 1 / targets.length;
        const share = isLast
          ? {
              base: cents(billing.montoBaseRemitos - used.base),
              recargo: cents(billing.recargo7Pct - used.recargo),
              iva: cents(billing.ivaAmount - used.iva),
              total: cents(billing.totalFacturado - used.total)
            }
          : {
              base: cents(billing.montoBaseRemitos * ratio),
              recargo: cents(billing.recargo7Pct * ratio),
              iva: cents(billing.ivaAmount * ratio),
              total: cents(billing.totalFacturado * ratio)
            };
        used.base += share.base;
        used.recargo += share.recargo;
        used.iva += share.iva;
        used.total += share.total;
        billingShares.set(r.id, share);
      });
    }

    let updatedRecords: TechnicalAuditRecord[] = [];
    setTechnicalAuditRecords(prev => {
      const next = prev.map(rec => {
        if (idSet.has(rec.id)) {
          const updated: TechnicalAuditRecord = {
            ...rec,
            status: 'Facturado',
            semaforo: 'naranja',
            numeroFactura,
            fechaFactura,
            billedPrice: rec.billedPrice && rec.billedPrice > 0 ? rec.billedPrice : (rec.suggestedPrice || 0)
          };
          // Conserva lo que se ingresó en el modal (base, 7%, IVA y total). No cambia billedPrice.
          const share = billingShares.get(rec.id);
          if (billing && share) {
            updated.montoBaseRemito = share.base;
            updated.recargo7Pct = share.recargo;
            updated.ivaPct = billing.ivaPct;
            updated.ivaAmount = share.iva;
            updated.totalFacturado = share.total;
          }
          return updated;
        }
        return rec;
      });
      updatedRecords = next.filter(r => idSet.has(r.id));
      try {
        localStorage.setItem(`${STORAGE_KEY}_tech_audits`, JSON.stringify(next));
      } catch {}
      return next;
    });

    if (updatedRecords.length > 0) {
      setFinancialReports(finReports =>
        finReports.map(f => {
          const matched = updatedRecords.find(r => f.code === r.remitoId || f.id === `REP-${r.id}`);
          if (matched) {
            return {
              ...f,
              status: 'Facturado Parcial',
              cargado: matched.operatingCost,
              facturado: matched.billedPrice,
              cobrado: matched.collectedPrice || 0,
              pendingBalance: Math.max(0, matched.billedPrice - (matched.collectedPrice || 0))
            };
          }
          return f;
        })
      );
      await saveAuditRecordsBatchToFirestore(updatedRecords);
    }
    return updatedRecords.length;
  };

  const deleteTechnicalAuditRecord = (id: string) => {
    deleteAuditRecordFromFirestore(id).catch(() => {});
    const target = technicalAuditRecords.find(r => r.id === id);
    setTechnicalAuditRecords(prev => {
      const updated = prev.filter(item => item.id !== id);
      try {
        localStorage.setItem(`${STORAGE_KEY}_tech_audits`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    if (target) {
      setFinancialReports(prev => prev.filter(f => f.code !== target.remitoId && f.id !== `REP-${target.id}`));
    }
  };

  const addArchivedReceipt = (receiptInput: Omit<ArchivedReceipt, 'id' | 'createdAt'> & { id?: string }): ArchivedReceipt => {
    const newReceipt: ArchivedReceipt = {
      ...receiptInput,
      id: receiptInput.id || `ARC-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString()
    };
    setArchivedReceipts(prev => [newReceipt, ...prev]);
    saveArchivedReceiptToFirestore(newReceipt).catch(() => {});
    return newReceipt;
  };

  const deleteArchivedReceipt = (id: string) => {
    deleteArchivedReceiptFromFirestore(id).catch(() => {});
    setArchivedReceipts(prev => prev.filter(r => r.id !== id));
  };

  // Financial actions
  const addFinancialReport = (report: Omit<FinancialMetricRecord, 'id' | 'pendingBalance'>) => {
    const id = `REP-${Date.now().toString().slice(-5)}`;
    const pendingBalance = Math.max(0, report.facturado - report.cobrado);
    const newRecord: FinancialMetricRecord = {
      ...report,
      id,
      pendingBalance
    };
    setFinancialReports(prev => [newRecord, ...prev]);
    saveFinancialReportToFirestore(newRecord).catch(() => {});
  };

  const updateFinancialReport = (id: string, updates: Partial<FinancialMetricRecord>) => {
    setFinancialReports(prev =>
      prev.map(item => {
        if (item.id === id) {
          const updated = { ...item, ...updates };
          updated.pendingBalance = Math.max(0, updated.facturado - updated.cobrado);
          saveFinancialReportToFirestore(updated).catch(() => {});
          return updated;
        }
        return item;
      })
    );
  };

  const deleteFinancialReport = (id: string) => {
    deleteFinancialReportFromFirestore(id).catch(() => {});
    setFinancialReports(prev => prev.filter(item => item.id !== id));
  };

  // Projects actions
  const addProject = (project: Omit<ProjectItem, 'id'>) => {
    const id = `PRJ-${Date.now().toString().slice(-4)}`;
    const newProject: ProjectItem = { ...project, id };
    setProjects(prev => [{ ...project, id }, ...prev]);
    saveProjectToFirestore(newProject).catch(() => {});
  };

  const updateProject = (id: string, updates: Partial<ProjectItem>) => {
    setProjects(prev => prev.map(p => {
      if (p.id === id) {
        const updated = { ...p, ...updates };
        saveProjectToFirestore(updated).catch(() => {});
        return updated;
      }
      return p;
    }));
  };

  const deleteProject = (id: string) => {
    deleteProjectFromFirestore(id).catch(() => {});
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  // Maintenance actions
  const addMaintenanceService = (service: Omit<MaintenanceServiceItem, 'id'>) => {
    const id = `MNT-${Date.now().toString().slice(-4)}`;
    const newService: MaintenanceServiceItem = { ...service, id };
    setMaintenanceServices(prev => [{ ...service, id }, ...prev]);
    saveMaintenanceServiceToFirestore(newService).catch(() => {});
  };

  const updateMaintenanceService = (id: string, updates: Partial<MaintenanceServiceItem>) => {
    setMaintenanceServices(prev => prev.map(s => {
      if (s.id === id) {
        const updated = { ...s, ...updates };
        saveMaintenanceServiceToFirestore(updated).catch(() => {});
        return updated;
      }
      return s;
    }));
  };

  const deleteMaintenanceService = (id: string) => {
    deleteMaintenanceServiceFromFirestore(id).catch(() => {});
    setMaintenanceServices(prev => prev.filter(s => s.id !== id));
  };

  // Material actions
  const updateMaterialStock = (id: string, newStock: number) => {
    setMaterials(prev => {
      const updatedList = prev.map(m => {
        if (m.id === id) {
          const updated = { ...m, stock: Math.max(0, newStock), lastUpdated: new Date().toISOString().split('T')[0] };
          saveMaterialToFirestore(updated).catch(() => {});
          return updated;
        }
        return m;
      });
      try {
        localStorage.setItem(`${STORAGE_KEY}_materials`, JSON.stringify(updatedList));
      } catch {}
      return updatedList;
    });
  };

  const addMaterial = (material: Omit<MaterialItem, 'id' | 'lastUpdated'>) => {
    const id = `MAT-${Date.now().toString().slice(-4)}`;
    const newMaterial: MaterialItem = {
      ...material,
      id,
      lastUpdated: new Date().toISOString().split('T')[0]
    };
    setMaterials(prev => {
      const updated = [newMaterial, ...prev];
      try {
        localStorage.setItem(`${STORAGE_KEY}_materials`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    saveMaterialToFirestore(newMaterial).catch(() => {});
  };

  const bulkAddMaterials = (newMaterials: Partial<MaterialItem>[]) => {
    const formatted: MaterialItem[] = newMaterials
      .filter(m => (m.name && m.name.trim() !== '') || (m.code && m.code.trim() !== ''))
      .map((m, i) => ({
        id: m.id || `MAT-${Date.now().toString().slice(-4)}-${i + 1}`,
        code: m.code?.trim() || `MAT-GEN-${i + 1}`,
        name: m.name?.trim() || 'Material Sin Nombre',
        category: (m.category as any) || 'Electricidad',
        stock: Number(m.stock) ?? 0,
        unit: m.unit?.trim() || 'Unidades',
        minStock: Number(m.minStock) ?? 0,
        unitPrice: Number(m.unitPrice) ?? 0,
        location: m.location?.trim() || 'Depósito Central',
        tenantId: m.tenantId || 'tenant_bandiera_hq',
        lastUpdated: m.lastUpdated || new Date().toISOString().split('T')[0]
      }));

    setMaterials(prev => {
      const map = new Map<string, MaterialItem>();
      prev.forEach(p => {
        const k = (p.code || p.name).toLowerCase().trim();
        map.set(k, p);
      });

      const updated = [...prev];
      const newlyAdded: MaterialItem[] = [];

      formatted.forEach(item => {
        const key = (item.code || item.name).toLowerCase().trim();
        const existing = map.get(key);
        if (existing) {
          const idx = updated.findIndex(m => m.id === existing.id);
          if (idx !== -1) {
            const merged: MaterialItem = {
              ...updated[idx],
              ...item,
              id: existing.id,
              stock: item.stock !== undefined ? item.stock : updated[idx].stock,
              unitPrice: item.unitPrice > 0 ? item.unitPrice : updated[idx].unitPrice,
              lastUpdated: new Date().toISOString().split('T')[0]
            };
            updated[idx] = merged;
            saveMaterialToFirestore(merged).catch(() => {});
          }
        } else {
          newlyAdded.push(item);
          map.set(key, item);
          saveMaterialToFirestore(item).catch(() => {});
        }
      });

      const finalMaterials = [...newlyAdded, ...updated];
      try {
        localStorage.setItem(`${STORAGE_KEY}_materials`, JSON.stringify(finalMaterials));
      } catch {}
      return finalMaterials;
    });
  };

  const deleteMaterial = (id: string) => {
    deleteMaterialFromFirestore(id).catch(() => {});
    setMaterials(prev => {
      const updated = prev.filter(m => m.id !== id);
      try {
        localStorage.setItem(`${STORAGE_KEY}_materials`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Workers
  const addWorker = (worker: Omit<WorkerItem, 'id'>) => {
    const norm = normalizeWorkerName(worker.name);
    const cleanEmail = (worker.email || '').toLowerCase().trim();

    // Check if worker already exists by normalized name or email in workers
    const existingWorker = workers.find(w =>
      normalizeWorkerName(w.name) === norm ||
      (cleanEmail && (w.email || '').toLowerCase().trim() === cleanEmail)
    );

    // Check if user already exists in users
    const existingUser = users.find(u =>
      normalizeWorkerName(u.displayName) === norm ||
      (cleanEmail && (u.email || '').toLowerCase().trim() === cleanEmail)
    );

    if (existingWorker) {
      // Worker already exists! Update them instead of creating a duplicate!
      const targetId = existingWorker.id;
      unmarkUserAsDeletedLocally(targetId, cleanEmail);
      unmarkUserAsDeletedInFirestore(targetId, cleanEmail).catch(() => {});
      updateWorker(targetId, {
        ...worker,
        phone: worker.phone || existingWorker.phone,
        cuadrilla: worker.cuadrilla || existingWorker.cuadrilla,
        active: worker.active !== undefined ? worker.active : true
      });
      return;
    }

    // Determine ID: If matching user exists, use their uid; otherwise create a canonical WRK ID
    const id = existingUser?.uid || `WRK-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 4)}`;
    const newWorker: WorkerItem = { ...worker, id };

    unmarkUserAsDeletedLocally(newWorker.id, newWorker.email);
    unmarkUserAsDeletedInFirestore(newWorker.id, newWorker.email).catch(() => {});

    setWorkers(prev => {
      const merged = deduplicateWorkersList([newWorker, ...prev]);
      const updated = sortWorkersAlphabetically(merged);
      try {
        localStorage.setItem(`${STORAGE_KEY}_workers`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    saveWorkerToFirestore(newWorker).catch(err => {
      console.warn('Could not save new worker to Firestore:', err);
    });

    // Also sync to users database if not already present
    if (!existingUser) {
      createUser({
        uid: newWorker.id,
        displayName: worker.name,
        email: worker.email || `${norm.replace(/\s+/g, '.')}@bandiera.com`,
        role: worker.role,
        category: worker.category,
        isAdministrative: worker.isAdministrative || worker.category === 'Administrativo',
        specialty: worker.specialty || worker.cargo || (worker.category === 'Administrativo' ? 'Administración & Gestión' : worker.role === 'Capataz' ? 'Capataz de Obra' : 'Ayudante de Cuadrilla'),
        cargo: worker.cargo || worker.specialty,
        capatazPercentage: worker.capatazPercentage,
        hourlyRate: worker.hourlyRate,
        salaryMonthly: worker.salaryMonthly,
        cuadrilla: worker.cuadrilla || (worker.category === 'Administrativo' ? 'Sede Central / Administración' : 'Cuadrilla 1 - Valle de Uco'),
        phone: worker.phone,
        active: worker.active !== false
      });
    }
  };

  const updateWorker = (id: string, updates: Partial<WorkerItem>) => {
    let updatedWorkerRef: WorkerItem | null = null;
    setWorkers(prev => {
      const updatedList = prev.map(w => {
        if (w.id === id) {
          const updated: WorkerItem = { ...w, ...updates };
          if (updates.category === 'Administrativo') {
            updated.isAdministrative = true;
          }
          updatedWorkerRef = updated;
          return updated;
        }
        return w;
      });
      const sortedList = sortWorkersAlphabetically(updatedList);
      try {
        localStorage.setItem(`${STORAGE_KEY}_workers`, JSON.stringify(sortedList));
      } catch {}
      return sortedList;
    });

    if (updatedWorkerRef) {
      saveWorkerToFirestore(updatedWorkerRef).catch(err => {
        console.warn('Could not save updated worker to Firestore:', err);
      });
      unmarkUserAsDeletedLocally((updatedWorkerRef as WorkerItem).id, (updatedWorkerRef as WorkerItem).email);
      unmarkUserAsDeletedInFirestore(
        (updatedWorkerRef as WorkerItem).id,
        (updatedWorkerRef as WorkerItem).email
      ).catch(() => {});
    }

    const targetWorker = updatedWorkerRef || workers.find(w => w.id === id);
    if (targetWorker) {
      const matchingUser = users.find(
        u => u.uid === id ||
             (targetWorker.email && u.email && u.email.toLowerCase().trim() === targetWorker.email.toLowerCase().trim()) ||
             u.displayName.toLowerCase().trim() === targetWorker.name.toLowerCase().trim()
      );
      if (matchingUser) {
        const userUpdates: Partial<UserProfile> = {};
        if (updates.name) userUpdates.displayName = updates.name;
        if (updates.role) userUpdates.role = updates.role;
        if (updates.category) userUpdates.category = updates.category;
        if (updates.isAdministrative !== undefined) userUpdates.isAdministrative = updates.isAdministrative;
        if (updates.category === 'Administrativo') userUpdates.isAdministrative = true;
        if (updates.specialty) userUpdates.specialty = updates.specialty;
        if (updates.cargo) userUpdates.cargo = updates.cargo;
        if (updates.capatazPercentage !== undefined) userUpdates.capatazPercentage = updates.capatazPercentage;
        if (updates.hourlyRate !== undefined) userUpdates.hourlyRate = updates.hourlyRate;
        if (updates.salaryMonthly !== undefined) userUpdates.salaryMonthly = updates.salaryMonthly;
        if (updates.phone !== undefined) userUpdates.phone = updates.phone;
        if (updates.email !== undefined) userUpdates.email = updates.email;
        if (updates.active !== undefined) userUpdates.active = updates.active;
        if (updates.cuadrilla !== undefined) userUpdates.cuadrilla = updates.cuadrilla;
        updateUser(matchingUser.uid, userUpdates);
      }
    }
  };

  const deleteWorker = (id: string) => {
    const targetWorker = workers.find(w => w.id === id);
    const targetNormName = normalizeWorkerName(targetWorker?.name);
    const cleanEmail = (targetWorker?.email || '').toLowerCase().trim();

    // 1. Record permanent local tombstone
    recordDeletedUserLocally(id, cleanEmail, targetNormName);

    // 2. Delete from Firestore in background
    deleteWorkerFromFirestore(id, cleanEmail, targetNormName).catch(err => {
      console.warn('Could not delete worker from Firestore:', err);
    });

    // 3. Immediately filter local state and persistent storage
    setWorkers(prev => {
      const updated = prev.filter(w => {
        if (w.id === id) return false;
        if (cleanEmail && (w.email || '').toLowerCase().trim() === cleanEmail) return false;
        if (targetNormName && normalizeWorkerName(w.name) === targetNormName) return false;
        return true;
      });
      try {
        localStorage.setItem(`${STORAGE_KEY}_workers`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 4. Delete matching user in AuthContext if exists
    if (targetWorker) {
      const matchingUser = users.find(
        u => u.uid === id ||
             (cleanEmail && (u.email || '').toLowerCase().trim() === cleanEmail) ||
             (targetNormName && normalizeWorkerName(u.displayName) === targetNormName)
      );
      const isRootAdmin = (matchingUser?.email || '').toLowerCase().trim() === 'admin@admin.com';
      if (matchingUser && !isRootAdmin) {
        deleteUser(matchingUser.uid);
      }
    }
  };

  const bulkAddWorkers = async (
    newWorkersList: Omit<WorkerItem, 'id'>[],
    replaceAll = false
  ): Promise<{ added: number; updated: number; total: number }> => {
    let finalWorkers: WorkerItem[] = [];
    let addedCount = 0;
    let updatedCount = 0;

    if (replaceAll) {
      await clearWorkersCollectionInFirestore();
      finalWorkers = newWorkersList.map((w, idx) => ({
        ...w,
        id: `WRK-${String(idx + 1).padStart(2, '0')}`
      }));
      addedCount = finalWorkers.length;
    } else {
      // Deduplication check: map existing workers by normalized name and clean email
      const existingByName = new Map<string, WorkerItem>();
      const existingByEmail = new Map<string, WorkerItem>();

      workers.forEach(w => {
        const norm = normalizeWorkerName(w.name);
        if (norm) existingByName.set(norm, w);
        const em = (w.email || '').toLowerCase().trim();
        if (em) existingByEmail.set(em, w);
      });

      const updatedMap = new Map<string, WorkerItem>();
      workers.forEach(w => updatedMap.set(w.id, { ...w }));

      newWorkersList.forEach((incomingWorker, idx) => {
        const normName = normalizeWorkerName(incomingWorker.name);
        const incomingEmail = (incomingWorker.email || '').toLowerCase().trim();

        // 1. Check if employee already exists in database
        const existing =
          (normName ? existingByName.get(normName) : undefined) ||
          (incomingEmail ? existingByEmail.get(incomingEmail) : undefined);

        if (existing) {
          // Employee already exists -> Do NOT create a duplicate record!
          // Merge non-empty fields without altering established ID
          const currentInMap = updatedMap.get(existing.id) || existing;
          const merged: WorkerItem = {
            ...currentInMap,
            name: incomingWorker.name || currentInMap.name,
            role: incomingWorker.role || currentInMap.role,
            category: incomingWorker.category || currentInMap.category,
            cargo: incomingWorker.cargo || currentInMap.cargo,
            specialty: incomingWorker.specialty || currentInMap.specialty,
            cuadrilla: incomingWorker.cuadrilla || currentInMap.cuadrilla,
            phone: incomingWorker.phone || currentInMap.phone,
            email: incomingWorker.email || currentInMap.email,
            hourlyRate: incomingWorker.hourlyRate !== undefined ? incomingWorker.hourlyRate : currentInMap.hourlyRate,
            capatazPercentage: incomingWorker.capatazPercentage !== undefined ? incomingWorker.capatazPercentage : currentInMap.capatazPercentage,
            salaryMonthly: incomingWorker.salaryMonthly !== undefined ? incomingWorker.salaryMonthly : currentInMap.salaryMonthly,
            active: incomingWorker.active !== undefined ? incomingWorker.active : currentInMap.active
          };
          updatedMap.set(existing.id, merged);
          updatedCount++;
        } else {
          // Employee does NOT exist -> Add as a new entry
          const newId = `WRK-${Date.now().toString().slice(-4)}-${idx + 1}`;
          const newEntry: WorkerItem = {
            ...incomingWorker,
            id: newId
          };
          updatedMap.set(newId, newEntry);
          if (normName) existingByName.set(normName, newEntry);
          if (incomingEmail) existingByEmail.set(incomingEmail, newEntry);
          addedCount++;
        }
      });

      finalWorkers = Array.from(updatedMap.values());
    }

    finalWorkers = sortWorkersAlphabetically(finalWorkers);
    setWorkers(finalWorkers);
    try {
      localStorage.setItem(`${STORAGE_KEY}_workers`, JSON.stringify(finalWorkers));
    } catch {}

    await saveWorkersBatchToFirestore(finalWorkers);
    finalWorkers.forEach(w => {
      unmarkUserAsDeletedLocally(w.id, w.email);
      unmarkUserAsDeletedInFirestore(w.id, w.email).catch(() => {});
    });
    return { added: addedCount, updated: updatedCount, total: finalWorkers.length };
  };

  // Clientes Actions (Base de Datos de Clientes)
  const addClient = (clientInput: Omit<ClientItem, 'id'> & { id?: string }) => {
    const id = clientInput.id || `CLI-${Date.now().toString().slice(-4)}`;
    const newClient: ClientItem = {
      ...clientInput,
      id,
      createdAt: clientInput.createdAt || new Date().toISOString()
    };
    setClients(prev => [newClient, ...prev]);
    saveClientToFirestore(newClient).catch(() => {});
  };

  const bulkAddClients = (newClients: Partial<ClientItem>[]) => {
    const formatted: ClientItem[] = newClients
      .filter(c => c.razonSocial && c.razonSocial.trim() !== '')
      .map((c, i) => ({
        id: c.id || `CLI-${Date.now().toString().slice(-4)}-${i + 1}`,
        razonSocial: c.razonSocial?.trim() || 'Cliente Sin Nombre',
        cuit: c.cuit?.trim() || '',
        fincaLocacion: c.fincaLocacion?.trim() || '',
        email: c.email?.trim() || '',
        telefono: c.telefono?.trim() || '',
        direccionFiscal: c.direccionFiscal?.trim() || '',
        latitud: c.latitud,
        longitud: c.longitud,
        distanciaKm: Number(c.distanciaKm) || 0,
        notes: c.notes?.trim() || '',
        createdAt: c.createdAt || new Date().toISOString()
      }));

    setClients(prev => {
      const existingCuits = new Set(prev.map(c => c.cuit).filter(Boolean));
      const existingNames = new Set(prev.map(c => c.razonSocial.toLowerCase().trim()));
      const toAdd = formatted.filter(c => 
        (c.cuit && !existingCuits.has(c.cuit)) || (!c.cuit && !existingNames.has(c.razonSocial.toLowerCase().trim()))
      );
      toAdd.forEach(c => saveClientToFirestore(c).catch(() => {}));
      return [...toAdd, ...prev];
    });
  };

  const updateClient = (id: string, updates: Partial<ClientItem>) => {
    setClients(prev => {
      const updatedList = prev.map(c => {
        if (c.id === id) {
          const updated = { ...c, ...updates };
          saveClientToFirestore(updated).catch(() => {});
          return updated;
        }
        return c;
      });
      return updatedList;
    });
  };

  const deleteClient = (id: string) => {
    deleteClientFromFirestore(id).catch(() => {});
    setClients(prev => prev.filter(c => c.id !== id));
  };

  // -------------------------------------------------------------
  // GESTIÓN DE VEHÍCULOS (AUTONOMÍA POR PATENTE & AMORTIZACIÓN)
  // -------------------------------------------------------------
  const addVehicle = (vehData: Omit<VehicleItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): VehicleItem => {
    const cleanPatente = (vehData.patente || '').trim().toUpperCase();
    const newVehicle: VehicleItem = {
      ...vehData,
      id: vehData.id || `veh_${cleanPatente.replace(/\s+/g, '_').toLowerCase()}_${Date.now().toString().slice(-4)}`,
      patente: cleanPatente,
      currentMileageKm: Number(vehData.currentMileageKm) || Number(vehData.initialMileageKm) || 0,
      initialMileageKm: Number(vehData.initialMileageKm) || 0,
      purchasePrice: Number(vehData.purchasePrice) || 0,
      residualValue: Number(vehData.residualValue) || 0,
      usefulLifeKm: Number(vehData.usefulLifeKm) || 300000,
      usefulLifeYears: Number(vehData.usefulLifeYears) || 5,
      oilChangeIntervalKm: Number(vehData.oilChangeIntervalKm) || 10000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setVehicles(prev => {
      const exists = prev.some(v => v.patente.toUpperCase() === cleanPatente);
      if (exists) {
        return prev.map(v => (v.patente.toUpperCase() === cleanPatente ? { ...v, ...newVehicle } : v));
      }
      return [newVehicle, ...prev];
    });

    saveVehicleToFirestore(newVehicle).catch(() => {});
    return newVehicle;
  };

  const bulkAddVehicles = (newVehicles: Partial<VehicleItem>[]) => {
    const formatted: VehicleItem[] = newVehicles
      .filter(v => v.patente && v.patente.trim() !== '')
      .map((v, i) => {
        const cleanPatente = v.patente!.trim().toUpperCase();
        return {
          id: v.id || `veh_${cleanPatente.replace(/\s+/g, '_').toLowerCase()}_${i + 1}`,
          patente: cleanPatente,
          brand: v.brand?.trim() || 'Genérico',
          model: v.model?.trim() || 'Vehículo de Flota',
          year: Number(v.year) || new Date().getFullYear(),
          type: v.type || 'Camioneta 4x4',
          vin: v.vin?.trim() || '',
          color: v.color?.trim() || '',
          assignedDriver: v.assignedDriver?.trim() || '',
          purchaseDate: v.purchaseDate || new Date().toISOString().slice(0, 10),
          purchasePrice: Number(v.purchasePrice) || 0,
          residualValue: Number(v.residualValue) || 0,
          usefulLifeKm: Number(v.usefulLifeKm) || 300000,
          usefulLifeYears: Number(v.usefulLifeYears) || 5,
          initialMileageKm: Number(v.initialMileageKm) || 0,
          currentMileageKm: Number(v.currentMileageKm) || Number(v.initialMileageKm) || 0,
          oilChangeIntervalKm: Number(v.oilChangeIntervalKm) || 10000,
          lastOilChangeKm: v.lastOilChangeKm ? Number(v.lastOilChangeKm) : undefined,
          lastOilChangeDate: v.lastOilChangeDate,
          status: v.status || 'Operativo',
          insuranceCompany: v.insuranceCompany?.trim() || '',
          policyNumber: v.policyNumber?.trim() || '',
          vtvExpirationDate: v.vtvExpirationDate,
          fuelType: v.fuelType || 'Diesel 500',
          avgConsumptionL100Km: Number(v.avgConsumptionL100Km) || 10,
          notes: v.notes?.trim() || '',
          createdAt: v.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      });

    setVehicles(prev => {
      const existingPatentes = new Set(prev.map(v => v.patente.toUpperCase()));
      const toAdd = formatted.filter(v => !existingPatentes.has(v.patente.toUpperCase()));
      toAdd.forEach(v => saveVehicleToFirestore(v).catch(() => {}));
      return [...toAdd, ...prev];
    });
  };

  const updateVehicle = (id: string, updates: Partial<VehicleItem>) => {
    setVehicles(prev => {
      const updatedList = prev.map(v => {
        if (v.id === id) {
          const updated: VehicleItem = {
            ...v,
            ...updates,
            patente: updates.patente ? updates.patente.trim().toUpperCase() : v.patente,
            updatedAt: new Date().toISOString()
          };
          saveVehicleToFirestore(updated).catch(() => {});
          return updated;
        }
        return v;
      });
      return updatedList;
    });
  };

  const deleteVehicle = (id: string) => {
    deleteVehicleFromFirestore(id).catch(() => {});
    setVehicles(prev => prev.filter(v => v.id !== id));
    // Eliminar también eventos asociados de este vehículo
    setVehicleEvents(prev => {
      const toDelete = prev.filter(e => e.vehicleId === id);
      toDelete.forEach(e => deleteVehicleEventFromFirestore(e.id).catch(() => {}));
      return prev.filter(e => e.vehicleId !== id);
    });
  };

  // -------------------------------------------------------------
  // GESTIÓN DE EVENTOS DE VEHÍCULOS (ODÓMETRO, ACEITE, MECÁNICOS)
  // -------------------------------------------------------------
  const addVehicleEvent = (eventData: Omit<VehicleEventItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): VehicleEventItem => {
    const cleanPatente = (eventData.patente || '').trim().toUpperCase();
    const newEvent: VehicleEventItem = {
      ...eventData,
      id: eventData.id || `evt_${Date.now().toString().slice(-6)}_${Math.random().toString(36).substr(2, 4)}`,
      patente: cleanPatente,
      mileageKm: Number(eventData.mileageKm) || 0,
      cost: Number(eventData.cost) || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setVehicleEvents(prev => [newEvent, ...prev]);
    saveVehicleEventToFirestore(newEvent).catch(() => {});

    // Sincronizar automáticamente el odómetro del vehículo y datos de cambio de aceite
    setVehicles(prev =>
      prev.map(veh => {
        if (veh.id === newEvent.vehicleId || veh.patente.toUpperCase() === cleanPatente) {
          const updates: Partial<VehicleItem> = {
            updatedAt: new Date().toISOString()
          };
          if (newEvent.mileageKm > (veh.currentMileageKm || 0)) {
            updates.currentMileageKm = newEvent.mileageKm;
          }
          if (newEvent.type === 'cambio_aceite') {
            updates.lastOilChangeKm = newEvent.mileageKm;
            updates.lastOilChangeDate = newEvent.date;
          }
          const updatedVeh = { ...veh, ...updates };
          saveVehicleToFirestore(updatedVeh).catch(() => {});
          return updatedVeh;
        }
        return veh;
      })
    );

    return newEvent;
  };

  const updateVehicleEvent = (id: string, updates: Partial<VehicleEventItem>) => {
    setVehicleEvents(prev => {
      const updatedList = prev.map(e => {
        if (e.id === id) {
          const updated: VehicleEventItem = {
            ...e,
            ...updates,
            patente: updates.patente ? updates.patente.trim().toUpperCase() : e.patente,
            mileageKm: updates.mileageKm !== undefined ? Number(updates.mileageKm) : e.mileageKm,
            cost: updates.cost !== undefined ? Number(updates.cost) : e.cost,
            updatedAt: new Date().toISOString()
          };
          saveVehicleEventToFirestore(updated).catch(() => {});

          // Si se actualizó kilometraje o cambio de aceite, refrescar vehículo
          if (updated.mileageKm) {
            setVehicles(prevVehs =>
              prevVehs.map(veh => {
                if (veh.id === updated.vehicleId || veh.patente.toUpperCase() === updated.patente.toUpperCase()) {
                  const vUp: Partial<VehicleItem> = {};
                  if (updated.mileageKm > (veh.currentMileageKm || 0)) {
                    vUp.currentMileageKm = updated.mileageKm;
                  }
                  if (updated.type === 'cambio_aceite') {
                    vUp.lastOilChangeKm = updated.mileageKm;
                    vUp.lastOilChangeDate = updated.date;
                  }
                  if (Object.keys(vUp).length > 0) {
                    const u = { ...veh, ...vUp, updatedAt: new Date().toISOString() };
                    saveVehicleToFirestore(u).catch(() => {});
                    return u;
                  }
                }
                return veh;
              })
            );
          }

          return updated;
        }
        return e;
      });
      return updatedList;
    });
  };

  const deleteVehicleEvent = (id: string) => {
    deleteVehicleEventFromFirestore(id).catch(() => {});
    setVehicleEvents(prev => prev.filter(e => e.id !== id));
  };

  const resetAllData = () => {
    // Carga datos de ejemplo y los escribe en Firestore. Solo existe en la demo:
    // en producción pisaría personal, vehículos y remitos reales.
    if (!__DEMO__) {
      console.warn('[Seguridad] resetAllData está deshabilitado fuera del modo demo.');
      return;
    }
    try {
      localStorage.removeItem(ZERO_STATE_KEY);
      localStorage.removeItem(`${STORAGE_KEY}_tech_audits`);
      localStorage.removeItem(`${STORAGE_KEY}_clients`);
      localStorage.removeItem(`${STORAGE_KEY}_financials`);
      localStorage.removeItem(`${STORAGE_KEY}_archived_receipts`);
      localStorage.removeItem(`${STORAGE_KEY}_vehicles`);
      localStorage.removeItem(`${STORAGE_KEY}_vehicle_events`);
    } catch {}
    setSystemStatusInFirestore({ isZeroState: false, initialized: true }).catch(() => {});
    setFinancialReports(INITIAL_FINANCIAL_REPORTS);
    setProjects(INITIAL_PROJECTS);
    setMaintenanceServices(INITIAL_MAINTENANCE_SERVICES);
    setMaterials(INITIAL_MATERIALS);
    setWorkers(INITIAL_WORKERS);
    setTechnicalParameters(DEFAULT_TECHNICAL_PARAMETERS);
    setTechnicalAuditRecords(INITIAL_TECHNICAL_AUDIT_RECORDS);
    setClients(INITIAL_CLIENTS);
    setVehicles(INITIAL_VEHICLES);
    setVehicleEvents(INITIAL_VEHICLE_EVENTS);
    setArchivedReceipts([]);
    INITIAL_WORKERS.forEach(w => saveWorkerToFirestore(w).catch(() => {}));
    saveVehiclesBatchToFirestore(INITIAL_VEHICLES).catch(() => {});
    saveVehicleEventsBatchToFirestore(INITIAL_VEHICLE_EVENTS).catch(() => {});
  };

  const clearSystemToZero = (options?: {
    clearAudits?: boolean;
    clearClients?: boolean;
    clearMaterials?: boolean;
    clearFinancials?: boolean;
    clearReceipts?: boolean;
    clearVehicles?: boolean;
  }) => {
    const opts = {
      clearAudits: true,
      clearClients: true,
      clearMaterials: true,
      clearFinancials: true,
      clearReceipts: true,
      clearVehicles: true,
      ...options
    };

    try {
      localStorage.setItem(ZERO_STATE_KEY, 'true');
    } catch {}
    setSystemStatusInFirestore({ isZeroState: true, initialized: true }).catch(() => {});

    if (opts.clearAudits) {
      setTechnicalAuditRecords([]);
      clearAllAuditRecordsInFirestore().catch(() => {});
      try { localStorage.setItem(`${STORAGE_KEY}_tech_audits`, '[]'); } catch {}
    }
    if (opts.clearClients) {
      setClients([]);
      clearAllClientsInFirestore().catch(() => {});
      try { localStorage.setItem(`${STORAGE_KEY}_clients`, '[]'); } catch {}
    }
    if (opts.clearMaterials) {
      setMaterials([]);
      clearAllMaterialsInFirestore().catch(() => {});
      try { localStorage.setItem(`${STORAGE_KEY}_materials`, '[]'); } catch {}
    }
    if (opts.clearFinancials) {
      setFinancialReports([]);
      try { localStorage.setItem(`${STORAGE_KEY}_financials`, '[]'); } catch {}
    }
    if (opts.clearReceipts) {
      setArchivedReceipts([]);
      try { localStorage.setItem(`${STORAGE_KEY}_archived_receipts`, '[]'); } catch {}
    }
    if (opts.clearVehicles) {
      setVehicles([]);
      setVehicleEvents([]);
      clearAllVehiclesInFirestore().catch(() => {});
      clearAllVehicleEventsInFirestore().catch(() => {});
      try {
        localStorage.setItem(`${STORAGE_KEY}_vehicles`, '[]');
        localStorage.setItem(`${STORAGE_KEY}_vehicle_events`, '[]');
      } catch {}
    }
    setProjects([]);
    try { localStorage.setItem(`${STORAGE_KEY}_projects`, '[]'); } catch {}
    setMaintenanceServices([]);
    try { localStorage.setItem(`${STORAGE_KEY}_maintenance`, '[]'); } catch {}
  };

  // Permanently cleans only the initial demo data seeds (e.g. from previous test deployments)
  const clearDemoDataOnly = async () => {
    // Borra por identificador los registros de ejemplo del código. Solo en la demo:
    // en producción esos identificadores pueden coincidir con datos reales.
    if (!__DEMO__) {
      console.warn('[Seguridad] clearDemoDataOnly está deshabilitado fuera del modo demo.');
      return;
    }
    const demoAuditIds = new Set(INITIAL_TECHNICAL_AUDIT_RECORDS.map(r => r.id));
    const demoClientIds = new Set(INITIAL_CLIENTS.map(c => c.id));
    const demoMaterialIds = new Set(INITIAL_MATERIALS.map(m => m.id));

    for (const id of demoAuditIds) {
      deleteAuditRecordFromFirestore(id).catch(() => {});
    }
    for (const id of demoClientIds) {
      deleteClientFromFirestore(id).catch(() => {});
    }
    for (const id of demoMaterialIds) {
      deleteMaterialFromFirestore(id).catch(() => {});
    }

    setTechnicalAuditRecords(prev => prev.filter(r => !demoAuditIds.has(r.id)));
    setClients(prev => prev.filter(c => !demoClientIds.has(c.id)));
    setMaterials(prev => prev.filter(m => !demoMaterialIds.has(m.id)));
    setFinancialReports([]);
    setArchivedReceipts(prev => prev.filter(r => r.id !== 'ARC-376'));
    setProjects([]);
    setMaintenanceServices([]);

    try {
      localStorage.setItem(ZERO_STATE_KEY, 'true');
      localStorage.setItem(`${STORAGE_KEY}_financials`, '[]');
      localStorage.setItem(`${STORAGE_KEY}_projects`, '[]');
      localStorage.setItem(`${STORAGE_KEY}_maintenance`, '[]');
      localStorage.setItem(`${STORAGE_KEY}_archived_receipts`, '[]');
    } catch {}

    await setSystemStatusInFirestore({ isZeroState: true, initialized: true }).catch(() => {});
  };

  // Aggregated totals dynamically derived from actual audit records (remitos) or explicit financial reports
  const auditCargado = technicalAuditRecords.filter(r => r.status === 'Cargado').reduce((acc, r) => acc + (r.suggestedPrice || 0), 0);
  const auditFacturado = technicalAuditRecords.filter(r => r.status === 'Facturado' || r.status === 'Cobrado').reduce((acc, r) => acc + (r.billedPrice || 0), 0);
  const auditCobrado = technicalAuditRecords.filter(r => r.status === 'Cobrado').reduce((acc, r) => acc + (r.collectedPrice || r.billedPrice || 0), 0);

  const reportCargado = financialReports.reduce((acc, curr) => acc + (curr.cargado || 0), 0);
  const reportFacturado = financialReports.reduce((acc, curr) => acc + (curr.facturado || 0), 0);
  const reportCobrado = financialReports.reduce((acc, curr) => acc + (curr.cobrado || 0), 0);

  const totalCargado = financialReports.length > 0 ? reportCargado : auditCargado;
  const totalFacturado = financialReports.length > 0 ? reportFacturado : auditFacturado;
  const totalCobrado = financialReports.length > 0 ? reportCobrado : auditCobrado;
  const totalPendiente = Math.max(0, totalFacturado - totalCobrado);
  const collectionRate = totalFacturado > 0 ? (totalCobrado / totalFacturado) * 100 : 0;

  // Calculate monthly timeline metrics
  const monthNamesMap: Record<string, { short: string; full: string }> = {
    '01': { short: 'Ene', full: 'Enero' },
    '02': { short: 'Feb', full: 'Febrero' },
    '03': { short: 'Mar', full: 'Marzo' },
    '04': { short: 'Abr', full: 'Abril' },
    '05': { short: 'May', full: 'Mayo' },
    '06': { short: 'Jun', full: 'Junio' },
    '07': { short: 'Jul', full: 'Julio' },
    '08': { short: 'Ago', full: 'Agosto' },
    '09': { short: 'Sep', full: 'Septiembre' },
    '10': { short: 'Oct', full: 'Octubre' },
    '11': { short: 'Nov', full: 'Noviembre' },
    '12': { short: 'Dic', full: 'Diciembre' }
  };

  const monthlyGroups: Record<string, { cargado: number; facturado: number; cobrado: number; count: number }> = {};

  // Standard months for current period
  ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].forEach(m => {
    monthlyGroups[m] = { cargado: 0, facturado: 0, cobrado: 0, count: 0 };
  });

  if (financialReports.length > 0) {
    financialReports.forEach(r => {
      const p = r.period || '2026-09';
      if (!monthlyGroups[p]) {
        monthlyGroups[p] = { cargado: 0, facturado: 0, cobrado: 0, count: 0 };
      }
      monthlyGroups[p].cargado += r.cargado || 0;
      monthlyGroups[p].facturado += r.facturado || 0;
      monthlyGroups[p].cobrado += r.cobrado || 0;
      monthlyGroups[p].count += 1;
    });
  } else if (technicalAuditRecords.length > 0) {
    technicalAuditRecords.forEach(r => {
      const p = r.date ? r.date.slice(0, 7) : '2026-09';
      if (!monthlyGroups[p]) {
        monthlyGroups[p] = { cargado: 0, facturado: 0, cobrado: 0, count: 0 };
      }
      if (r.status === 'Cargado') {
        monthlyGroups[p].cargado += r.suggestedPrice || 0;
      } else if (r.status === 'Facturado') {
        monthlyGroups[p].facturado += r.billedPrice || 0;
      } else if (r.status === 'Cobrado') {
        monthlyGroups[p].cobrado += r.collectedPrice || r.billedPrice || 0;
        monthlyGroups[p].facturado += r.billedPrice || 0;
      }
      monthlyGroups[p].count += 1;
    });
  }

  const monthlyPerformance: MonthlyPerformanceData[] = Object.keys(monthlyGroups)
    .sort()
    .map(key => {
      const monthNum = key.split('-')[1] || '01';
      const year = key.split('-')[0] || '2026';
      const mInfo = monthNamesMap[monthNum] || { short: monthNum, full: `Mes ${monthNum}` };
      const d = monthlyGroups[key];
      const pendiente = Math.max(0, d.facturado - d.cobrado);
      const efectividadCobro = d.facturado > 0 ? (d.cobrado / d.facturado) * 100 : 0;
      return {
        monthKey: key,
        monthName: `${mInfo.short} ${year.slice(2)}`,
        monthFullName: `${mInfo.full} ${year}`,
        cargado: d.cargado,
        facturado: d.facturado,
        cobrado: d.cobrado,
        pendiente,
        efectividadCobro,
        count: d.count
      };
    });

  return (
    <DataContext.Provider
      value={{
        financialReports,
        projects,
        maintenanceServices,
        materials,
        workers,
        technicalParameters,
        technicalAuditRecords,
        archivedReceipts,
        addArchivedReceipt,
        deleteArchivedReceipt,
        updateTechnicalParameters,
        fieldReports,
        unsyncedFieldReportIds,
        outboxEntries,
        retryFieldReport,
        fieldCatalog,
        addFieldReport,
        markFieldReportConverted,
        discardFieldReport,
        addTechnicalAuditRecord,
        bulkAddTechnicalAuditRecords,
        bulkUpdateAuditRecordDescriptions,
        bulkPassToFacturado,
        bulkSetArchived,
        updateTechnicalAuditRecord,
        deleteTechnicalAuditRecord,
        addFinancialReport,
        updateFinancialReport,
        deleteFinancialReport,
        addProject,
        updateProject,
        deleteProject,
        addMaintenanceService,
        updateMaintenanceService,
        deleteMaintenanceService,
        updateMaterialStock,
        addMaterial,
        bulkAddMaterials,
        deleteMaterial,
        addWorker,
        updateWorker,
        deleteWorker,
        bulkAddWorkers,
        clients,
        addClient,
        bulkAddClients,
        updateClient,
        deleteClient,
        vehicles,
        vehicleEvents,
        addVehicle,
        updateVehicle,
        deleteVehicle,
        bulkAddVehicles,
        addVehicleEvent,
        updateVehicleEvent,
        deleteVehicleEvent,
        monthlyPerformance,
        totalCargado,
        totalFacturado,
        totalCobrado,
        totalPendiente,
        collectionRate,
        resetAllData,
        clearSystemToZero,
        clearDemoDataOnly
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

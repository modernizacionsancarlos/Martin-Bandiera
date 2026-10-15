import {
  ArchivedReceipt,
  ClientItem,
  FinancialMetricRecord,
  MaintenanceServiceItem,
  MaterialItem,
  ProjectItem,
  TechnicalAuditRecord,
  TechnicalCostParameters,
  UserProfile,
  VehicleEventItem,
  VehicleItem,
  WorkerItem
} from '../types';

/**
 * Formato del respaldo en archivo JSON. Es compatible con los archivos
 * "Punto_Restauracion_Bandiera_*.json" que generaba la versión anterior.
 */
export interface BackupPayload {
  exportTimestamp: string;
  dateFormatted: string;
  systemName: string;
  formatVersion: number;
  users: Omit<UserProfile, 'password'>[];
  technicalParameters?: TechnicalCostParameters;
  technicalAuditRecords: TechnicalAuditRecord[];
  financialReports: FinancialMetricRecord[];
  projects: ProjectItem[];
  maintenanceServices: MaintenanceServiceItem[];
  materials: MaterialItem[];
  workers: WorkerItem[];
  clients: ClientItem[];
  vehicles: VehicleItem[];
  vehicleEvents: VehicleEventItem[];
  archivedReceipts: ArchivedReceipt[];
}

export const BACKUP_SYSTEM_NAME = 'JOB Martin Bandiera - Ecosistema SaaS V5.0';
export const BACKUP_FORMAT_VERSION = 2;

export interface BackupSource {
  users: UserProfile[];
  technicalParameters?: TechnicalCostParameters;
  technicalAuditRecords: TechnicalAuditRecord[];
  financialReports: FinancialMetricRecord[];
  projects: ProjectItem[];
  maintenanceServices: MaintenanceServiceItem[];
  materials: MaterialItem[];
  workers: WorkerItem[];
  clients: ClientItem[];
  vehicles: VehicleItem[];
  vehicleEvents: VehicleEventItem[];
  archivedReceipts: ArchivedReceipt[];
}

/** Arma el contenido del respaldo. Nunca incluye contraseñas. */
export function buildBackupPayload(source: BackupSource): BackupPayload {
  const now = new Date();
  return {
    exportTimestamp: now.toISOString(),
    dateFormatted: now.toLocaleString('es-AR'),
    systemName: BACKUP_SYSTEM_NAME,
    formatVersion: BACKUP_FORMAT_VERSION,
    users: (source.users || []).map(({ password: _password, ...rest }) => rest),
    technicalParameters: source.technicalParameters,
    technicalAuditRecords: source.technicalAuditRecords || [],
    financialReports: source.financialReports || [],
    projects: source.projects || [],
    maintenanceServices: source.maintenanceServices || [],
    materials: source.materials || [],
    workers: source.workers || [],
    clients: source.clients || [],
    vehicles: source.vehicles || [],
    vehicleEvents: source.vehicleEvents || [],
    archivedReceipts: source.archivedReceipts || []
  };
}

/** Descarga el respaldo como archivo JSON. `label` se agrega al nombre del archivo. */
export function downloadBackup(payload: BackupPayload, label = 'respaldo'): string {
  const day = new Date().toISOString().split('T')[0];
  const time = new Date().toTimeString().slice(0, 5).replace(':', '-');
  const fileName = `Bandiera_${label}_${day}_${time}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return fileName;
}

export interface BackupCounts {
  users: number;
  workers: number;
  technicalAuditRecords: number;
  clients: number;
  materials: number;
  financialReports: number;
  projects: number;
  maintenanceServices: number;
  vehicles: number;
  vehicleEvents: number;
  archivedReceipts: number;
  hasTechnicalParameters: boolean;
}

const asList = (value: unknown): any[] => (Array.isArray(value) ? value : []);

/** Revisa que el archivo sea un respaldo de Bandiera y cuenta lo que contiene. */
export function inspectBackup(
  json: any
): { ok: true; payload: BackupPayload; counts: BackupCounts } | { ok: false; error: string } {
  if (!json || typeof json !== 'object') {
    return { ok: false, error: 'El archivo no contiene un objeto JSON válido.' };
  }
  if (!json.systemName || !String(json.systemName).includes('Bandiera')) {
    return { ok: false, error: 'El archivo no es un respaldo del sistema Bandiera (falta systemName).' };
  }
  const payload: BackupPayload = {
    exportTimestamp: json.exportTimestamp || '',
    dateFormatted: json.dateFormatted || json.exportTimestamp || '',
    systemName: json.systemName,
    formatVersion: Number(json.formatVersion) || 1,
    users: asList(json.users),
    technicalParameters: json.technicalParameters,
    technicalAuditRecords: asList(json.technicalAuditRecords),
    financialReports: asList(json.financialReports),
    projects: asList(json.projects),
    maintenanceServices: asList(json.maintenanceServices),
    materials: asList(json.materials),
    workers: asList(json.workers),
    clients: asList(json.clients),
    vehicles: asList(json.vehicles),
    vehicleEvents: asList(json.vehicleEvents),
    archivedReceipts: asList(json.archivedReceipts)
  };
  const counts: BackupCounts = {
    users: payload.users.length,
    workers: payload.workers.length,
    technicalAuditRecords: payload.technicalAuditRecords.length,
    clients: payload.clients.length,
    materials: payload.materials.length,
    financialReports: payload.financialReports.length,
    projects: payload.projects.length,
    maintenanceServices: payload.maintenanceServices.length,
    vehicles: payload.vehicles.length,
    vehicleEvents: payload.vehicleEvents.length,
    archivedReceipts: payload.archivedReceipts.length,
    hasTechnicalParameters: Boolean(payload.technicalParameters && payload.technicalParameters.dieselPrice)
  };
  const total = Object.values(counts).reduce<number>((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
  if (total === 0 && !counts.hasTechnicalParameters) {
    return { ok: false, error: 'El respaldo no contiene registros para restaurar.' };
  }
  return { ok: true, payload, counts };
}

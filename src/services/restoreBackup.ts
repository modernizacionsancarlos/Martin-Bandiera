import {
  saveArchivedReceiptToFirestore,
  saveAuditRecordsBatchToFirestore,
  saveClientsBatchToFirestore,
  saveFinancialReportsBatchToFirestore,
  saveMaintenanceServiceToFirestore,
  saveMaterialsBatchToFirestore,
  saveProjectToFirestore,
  saveTechnicalParametersToFirestore,
  saveUsersBatchToFirestore,
  saveVehicleEventsBatchToFirestore,
  saveVehiclesBatchToFirestore,
  saveWorkersBatchToFirestore
} from './firestoreSync';
import { syncStatus } from './syncStatus';
import { BackupPayload } from '../utils/backupUtils';

export interface RestoreResult {
  /** Escrituras que el servidor rechazó durante la restauración. */
  failedWrites: number;
}

/**
 * Restaura un respaldo en la base de datos. Solo agrega o actualiza registros por su id:
 * nunca borra nada de lo que ya existe.
 */
export async function restoreBackupToFirestore(
  payload: BackupPayload,
  onStep?: (label: string) => void
): Promise<RestoreResult> {
  const failedBefore = syncStatus.getSnapshot().failedCount;
  const step = async (label: string, run: () => Promise<unknown>) => {
    onStep?.(label);
    await run();
  };

  if (payload.technicalParameters?.dieselPrice) {
    await step('Costos fijos', () => saveTechnicalParametersToFirestore(payload.technicalParameters!));
  }
  if (payload.workers.length) await step('Personal', () => saveWorkersBatchToFirestore(payload.workers));
  if (payload.clients.length) await step('Clientes', () => saveClientsBatchToFirestore(payload.clients));
  if (payload.materials.length) await step('Materiales', () => saveMaterialsBatchToFirestore(payload.materials));
  if (payload.technicalAuditRecords.length) {
    await step('Remitos', () => saveAuditRecordsBatchToFirestore(payload.technicalAuditRecords));
  }
  if (payload.financialReports.length) {
    await step('Reportes financieros', () => saveFinancialReportsBatchToFirestore(payload.financialReports));
  }
  if (payload.vehicles.length) await step('Vehículos', () => saveVehiclesBatchToFirestore(payload.vehicles));
  if (payload.vehicleEvents.length) {
    await step('Eventos de vehículos', () => saveVehicleEventsBatchToFirestore(payload.vehicleEvents));
  }
  if (payload.projects.length) {
    await step('Proyectos', async () => {
      for (const item of payload.projects) await saveProjectToFirestore(item);
    });
  }
  if (payload.maintenanceServices.length) {
    await step('Mantenimiento', async () => {
      for (const item of payload.maintenanceServices) await saveMaintenanceServiceToFirestore(item);
    });
  }
  if (payload.archivedReceipts.length) {
    await step('Comprobantes', async () => {
      for (const item of payload.archivedReceipts) await saveArchivedReceiptToFirestore(item);
    });
  }
  if (payload.users.length) await step('Perfiles de usuario', () => saveUsersBatchToFirestore(payload.users as any));

  return { failedWrites: syncStatus.getSnapshot().failedCount - failedBefore };
}

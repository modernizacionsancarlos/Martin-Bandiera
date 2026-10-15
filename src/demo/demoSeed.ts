/**
 * Contenido inicial de la base de la demo, agrupado por colección de Firestore.
 */
import {
  DEMO_ACCOUNTS,
  DEMO_ARCHIVED_RECEIPTS,
  DEMO_AUDIT_RECORDS,
  DEMO_CLIENTS,
  DEMO_FINANCIAL_REPORTS,
  DEMO_MAINTENANCE_SERVICES,
  DEMO_MATERIALS,
  DEMO_PROJECTS,
  DEMO_TECHNICAL_PARAMETERS,
  DEMO_USERS,
  DEMO_VEHICLE_EVENTS,
  DEMO_VEHICLES,
  DEMO_WORKERS
} from './demoData';

export { DEMO_ACCOUNTS };

const byId = <T extends { id: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map(item => [item.id, item]));

export const DEMO_COLLECTIONS: Record<string, Record<string, any>> = {
  users: Object.fromEntries(DEMO_USERS.map(u => [u.uid, u])),
  workers: byId(DEMO_WORKERS),
  auditRecords: byId(DEMO_AUDIT_RECORDS),
  clients: byId(DEMO_CLIENTS),
  materials: byId(DEMO_MATERIALS),
  projects: byId(DEMO_PROJECTS),
  maintenanceServices: byId(DEMO_MAINTENANCE_SERVICES),
  vehicles: byId(DEMO_VEHICLES),
  vehicleEvents: byId(DEMO_VEHICLE_EVENTS),
  archivedReceipts: byId(DEMO_ARCHIVED_RECEIPTS),
  financials: byId(DEMO_FINANCIAL_REPORTS),
  technicalParameters: { global: DEMO_TECHNICAL_PARAMETERS },
  catalogoCampo: {
    actual: {
      clients: DEMO_CLIENTS.map(c => ({ id: c.id, razonSocial: c.razonSocial, fincaLocacion: c.fincaLocacion })),
      workers: DEMO_WORKERS.filter(w => w.active !== false && !w.isAdministrative).map(w => ({ id: w.id, name: w.name, category: w.category })),
      materials: DEMO_MATERIALS.map(m => ({ id: m.id, name: m.name, unit: m.unit }))
    }
  },
  systemSettings: { status: { isZeroState: false, initialized: true } },
  userRoles: Object.fromEntries(
    DEMO_ACCOUNTS.map(a => {
      const profile = DEMO_USERS.find(u => u.uid === a.uid)!;
      return [a.authUid, { role: profile.role, email: a.email, active: true }];
    })
  )
};

/**
 * Reemplazo de src/data/initialData.ts para el MODO DEMO (ver alias en vite.config.ts).
 * Exporta los mismos nombres que el módulo original, pero con datos ficticios, de modo que
 * ningún dato real del cliente se incluya en el paquete de la demo.
 */
import { DEFAULT_ROLE_PERMISSIONS } from '../utils/permissionUtils';
import {
  DEMO_AUDIT_RECORDS,
  DEMO_AVAILABLE_HELPERS,
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

export const SUPERADMIN_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS.SuperAdmin;
export const OWNER_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS.Owner;
export const GERENTE_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS.Gerente;
export const ADMIN_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS.Admin;
export const CAPATAZ_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS.Capataz;
export const EMPLEADO_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS.Empleado;

export const INITIAL_USERS = DEMO_USERS;
export const INITIAL_FINANCIAL_REPORTS = DEMO_FINANCIAL_REPORTS;
export const INITIAL_PROJECTS = DEMO_PROJECTS;
export const INITIAL_MAINTENANCE_SERVICES = DEMO_MAINTENANCE_SERVICES;
export const INITIAL_MATERIALS = DEMO_MATERIALS;
export const INITIAL_WORKERS = DEMO_WORKERS;
export const DEFAULT_TECHNICAL_PARAMETERS = DEMO_TECHNICAL_PARAMETERS;
export const AVAILABLE_HELPERS = DEMO_AVAILABLE_HELPERS;
export const INITIAL_CLIENTS = DEMO_CLIENTS;
export const INITIAL_CLIENT_SITES = DEMO_CLIENTS.map(c => ({
  name: c.razonSocial,
  location: c.fincaLocacion,
  cuit: c.cuit,
  distanciaKm: c.distanciaKm
}));
export const INITIAL_TECHNICAL_AUDIT_RECORDS = DEMO_AUDIT_RECORDS;
export const INITIAL_VEHICLES = DEMO_VEHICLES;
export const INITIAL_VEHICLE_EVENTS = DEMO_VEHICLE_EVENTS;

export const FIRESTORE_RULES_TEXT = `// MODO DEMO: no hay reglas de Firestore. Los datos viven solo en este navegador.`;

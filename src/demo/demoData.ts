/**
 * Datos FICTICIOS para el modo demo. Ninguna persona, empresa, patente ni monto corresponde
 * a información real del cliente. Los valores se generan con una semilla fija para que la demo
 * se vea igual cada vez.
 */
import {
  ArchivedReceipt,
  ClientItem,
  FinancialMetricRecord,
  MaintenanceServiceItem,
  MaterialItem,
  ProjectItem,
  RemitoStatus,
  TechnicalAuditRecord,
  TechnicalCostParameters,
  UserProfile,
  VehicleEventItem,
  VehicleItem,
  WorkerItem
} from '../types';

// ---------------------------------------------------------------- utilidades
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260615);
const pick = <T,>(list: T[]): T => list[Math.floor(rand() * list.length)];
const round = (n: number, step = 1) => Math.round(n / step) * step;
const pad = (n: number, size = 3) => String(n).padStart(size, '0');

const TODAY = new Date();
const isoDay = (daysAgo: number) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};
const YEAR = TODAY.getFullYear();

export const DEMO_COMPANY = 'Servicios Demo S.A.';
export const DEMO_PASSWORD = 'Demo2026!';

// ---------------------------------------------------------------- parámetros
export const DEMO_TECHNICAL_PARAMETERS: TechnicalCostParameters = {
  dieselPrice: 1650,
  horaBase: 9000,
  horaOficial: 9000,
  seguroViaje: 1200,
  amortizacionViaje: 7000,
  consumoLKm: 0.13,
  guardiaMultiplier: 1.5,
  pagoAyudanteHora: 6000,
  defaultMarginPercentage: 35,
  lastUpdated: isoDay(7)
};

// ---------------------------------------------------------------- personal
export const DEMO_WORKERS: WorkerItem[] = [
  { id: 'WRK-D01', name: 'NICOLAS HERRERA', role: 'Capataz', category: 'Capataz', specialty: 'Electromecánica de pozos', cargo: 'Capataz', capatazPercentage: 10, cuadrilla: 'Cuadrilla Norte', email: 'nicolas.herrera@demo.invalid', phone: '261 555-0101', active: true, assignedProjectsCount: 2, salaryMonthly: 1500000, hourlyRate: 9000 },
  { id: 'WRK-D02', name: 'SERGIO ACOSTA', role: 'Capataz', category: 'Capataz', specialty: 'Tableros e instalaciones', cargo: 'Capataz', capatazPercentage: 10, cuadrilla: 'Cuadrilla Sur', email: 'sergio.acosta@demo.invalid', phone: '261 555-0102', active: true, assignedProjectsCount: 1, salaryMonthly: 1480000, hourlyRate: 9000 },
  { id: 'WRK-D03', name: 'TOMAS GIMENEZ', role: 'Empleado', category: 'Oficial', specialty: 'Bombeo', cargo: 'Oficial', capatazPercentage: 0, cuadrilla: 'Cuadrilla Norte', email: 'tomas.gimenez@demo.invalid', phone: '261 555-0103', active: true, assignedProjectsCount: 2, salaryMonthly: 1200000, hourlyRate: 9000 },
  { id: 'WRK-D04', name: 'DIEGO LEDESMA', role: 'Empleado', category: 'Oficial', specialty: 'Tableros', cargo: 'Oficial', capatazPercentage: 0, cuadrilla: 'Cuadrilla Sur', email: 'diego.ledesma@demo.invalid', phone: '261 555-0104', active: true, assignedProjectsCount: 1, salaryMonthly: 1190000, hourlyRate: 9000 },
  { id: 'WRK-D05', name: 'BRUNO CACERES', role: 'Empleado', category: 'Ayudante', specialty: 'Ayudante general', cargo: 'Ayudante', capatazPercentage: 0, cuadrilla: 'Cuadrilla Norte', email: 'bruno.caceres@demo.invalid', phone: '261 555-0105', active: true, assignedProjectsCount: 2, salaryMonthly: 900000, hourlyRate: 6000 },
  { id: 'WRK-D06', name: 'EMILIANO TORRES', role: 'Empleado', category: 'Ayudante', specialty: 'Ayudante general', cargo: 'Ayudante', capatazPercentage: 0, cuadrilla: 'Cuadrilla Norte', email: 'emiliano.torres@demo.invalid', phone: '261 555-0106', active: true, assignedProjectsCount: 1, salaryMonthly: 890000, hourlyRate: 6000 },
  { id: 'WRK-D07', name: 'CAMILA SUAREZ', role: 'Empleado', category: 'Ayudante', specialty: 'Ayudante general', cargo: 'Ayudante', capatazPercentage: 0, cuadrilla: 'Cuadrilla Sur', email: 'camila.suarez@demo.invalid', phone: '261 555-0107', active: true, assignedProjectsCount: 1, salaryMonthly: 890000, hourlyRate: 6000 },
  { id: 'WRK-D08', name: 'FRANCO MEDINA', role: 'Empleado', category: 'Ayudante', specialty: 'Ayudante general', cargo: 'Ayudante', capatazPercentage: 0, cuadrilla: 'Cuadrilla Sur', email: 'franco.medina@demo.invalid', phone: '261 555-0108', active: true, assignedProjectsCount: 1, salaryMonthly: 880000, hourlyRate: 6000 }
];

export interface DemoAccount {
  authUid: string;
  uid: string; // id del perfil en /users
  email: string;
  password: string;
  label: string;
}

const baseProfile = (
  uid: string,
  displayName: string,
  email: string,
  role: UserProfile['role'],
  extra: Partial<UserProfile> = {}
): UserProfile => ({
  uid,
  email,
  displayName,
  role,
  companyName: DEMO_COMPANY,
  active: true,
  createdAt: isoDay(200),
  ...extra
});

export const DEMO_USERS: UserProfile[] = [
  baseProfile('usr_demo_admin', 'Administrador Demo', 'demo.admin@bandiera.demo', 'SuperAdmin', {
    category: 'Administrativo', isAdministrative: true, specialty: 'Dirección General', cuadrilla: 'Dirección', phone: '261 555-0100', authUid: 'demo_auth_admin'
  }),
  baseProfile('usr_demo_gerente', 'Lucía Paredes', 'lucia.paredes@bandiera.demo', 'Gerente', {
    category: 'Administrativo', isAdministrative: true, specialty: 'Gerencia de Operaciones', cuadrilla: 'Dirección', phone: '261 555-0110', authUid: 'demo_auth_gerente'
  }),
  baseProfile('usr_demo_fact', 'Valeria Ríos', 'valeria.rios@bandiera.demo', 'Admin', {
    category: 'Administrativo', isAdministrative: true, specialty: 'Facturación y Cobranzas', cuadrilla: 'Oficina', phone: '261 555-0111', authUid: 'demo_auth_fact'
  }),
  baseProfile('WRK-D01', 'Nicolás Herrera', 'nicolas.herrera@demo.invalid', 'Capataz', {
    category: 'Capataz', specialty: 'Electromecánica de pozos', cuadrilla: 'Cuadrilla Norte', phone: '261 555-0101', authUid: 'demo_auth_capataz'
  }),
  baseProfile('WRK-D05', 'Bruno Cáceres', 'bruno.caceres@demo.invalid', 'Empleado', {
    category: 'Ayudante', specialty: 'Ayudante general', cuadrilla: 'Cuadrilla Norte', phone: '261 555-0105', authUid: 'demo_auth_empleado'
  })
];

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { authUid: 'demo_auth_admin', uid: 'usr_demo_admin', email: 'demo.admin@bandiera.demo', password: DEMO_PASSWORD, label: 'Administrador' },
  { authUid: 'demo_auth_gerente', uid: 'usr_demo_gerente', email: 'lucia.paredes@bandiera.demo', password: DEMO_PASSWORD, label: 'Gerente' },
  { authUid: 'demo_auth_fact', uid: 'usr_demo_fact', email: 'valeria.rios@bandiera.demo', password: DEMO_PASSWORD, label: 'Facturación' },
  { authUid: 'demo_auth_capataz', uid: 'WRK-D01', email: 'nicolas.herrera@demo.invalid', password: DEMO_PASSWORD, label: 'Capataz' },
  { authUid: 'demo_auth_empleado', uid: 'WRK-D05', email: 'bruno.caceres@demo.invalid', password: DEMO_PASSWORD, label: 'Empleado' }
];

// ---------------------------------------------------------------- clientes
const clientSeed: Array<[string, string, string, number]> = [
  ['Bodega Los Álamos S.A.', 'Finca Los Álamos', 'Luján de Cuyo', 22],
  ['Finca El Mirador S.R.L.', 'El Mirador', 'Tupungato', 68],
  ['Agroindustrial Valle Verde S.A.', 'Planta Valle Verde', 'San Carlos', 85],
  ['Viñedos del Sol S.A.', 'Viñedo Sector 4', 'Tunuyán', 72],
  ['Frutícola Cuyo S.R.L.', 'Packing Central', 'Maipú', 18],
  ['Cooperativa La Esperanza', 'Pozo Comunal', 'Rivadavia', 90],
  ['Bodega Piedra Azul S.A.', 'Bodega y Finca', 'Agrelo', 30],
  ['Olivícola Monte Alto S.A.', 'Olivar Norte', 'San Martín', 45]
];

export const DEMO_CLIENTS: ClientItem[] = clientSeed.map(([razonSocial, fincaLocacion, localidad, distanciaKm], i) => ({
  id: `CLI-D${pad(i + 1)}`,
  razonSocial,
  cuit: `30-0000000${i + 1}-0`,
  fincaLocacion,
  email: `administracion${i + 1}@demo.invalid`,
  telefono: `261 555-02${pad(i + 1, 2)}`,
  direccionFiscal: `Ruta Provincial ${i + 10}, ${localidad}`,
  latitud: -33.0 - i * 0.12,
  longitud: -68.8 - i * 0.1,
  distanciaKm,
  notes: 'Cliente de demostración',
  createdAt: isoDay(240)
}));

// ---------------------------------------------------------------- materiales, proyectos, servicios
export const DEMO_MATERIALS: MaterialItem[] = [
  ['Cable subterráneo 4x16 mm²', 'Electricidad', 220, 'm', 100, 4200, 'Depósito A-1'],
  ['Contactor tripolar 40 A', 'Electricidad', 14, 'u', 6, 38500, 'Depósito A-2'],
  ['Guardamotor 25-32 A', 'Electricidad', 9, 'u', 5, 52000, 'Depósito A-2'],
  ['Caño PVC 110 mm (6 m)', 'Cañerías y Válvulas', 30, 'u', 12, 21500, 'Playón B'],
  ['Válvula esclusa 3"', 'Cañerías y Válvulas', 4, 'u', 5, 96000, 'Depósito B-3'],
  ['Casco de seguridad', 'Seguridad', 18, 'u', 10, 8500, 'Depósito C-1'],
  ['Guantes dieléctricos clase 0', 'Seguridad', 6, 'par', 4, 64000, 'Depósito C-1'],
  ['Aceite hidráulico ISO 68 (20 L)', 'Químicos y Fluidos', 7, 'bidón', 3, 78000, 'Depósito C-2']
].map(([name, category, stock, unit, minStock, unitPrice, location], i) => ({
  id: `MAT-D${pad(i + 1)}`,
  code: `MAT-${pad(i + 1)}`,
  name: name as string,
  category: category as MaterialItem['category'],
  stock: stock as number,
  unit: unit as string,
  minStock: minStock as number,
  unitPrice: unitPrice as number,
  location: location as string,
  tenantId: 'demo',
  lastUpdated: isoDay(10 + i)
}));

export const DEMO_PROJECTS: ProjectItem[] = [
  { id: 'PRJ-D001', code: 'OBR-001', title: 'Reacondicionamiento de pozo y tablero de bombeo', client: DEMO_CLIENTS[0].razonSocial, description: 'Reemplazo de bomba sumergible, tablero de arranque y tendido de cable.', location: 'Luján de Cuyo', status: 'En Ejecución', budget: 18500000, spent: 9400000, progress: 55, startDate: isoDay(60), endDate: isoDay(-30), leadEngineer: 'Nicolás Herrera', tenantId: 'demo' },
  { id: 'PRJ-D002', code: 'OBR-002', title: 'Montaje de subestación y tablero general', client: DEMO_CLIENTS[2].razonSocial, description: 'Instalación de transformador y tablero principal de planta.', location: 'San Carlos', status: 'Planificación', budget: 32000000, spent: 1200000, progress: 8, startDate: isoDay(10), endDate: isoDay(-120), leadEngineer: 'Sergio Acosta', tenantId: 'demo' },
  { id: 'PRJ-D003', code: 'OBR-003', title: 'Red de riego presurizado - Sector 4', client: DEMO_CLIENTS[3].razonSocial, description: 'Tendido de cañerías y válvulas de sectorización.', location: 'Tunuyán', status: 'Completado', budget: 12400000, spent: 11800000, progress: 100, startDate: isoDay(150), endDate: isoDay(30), leadEngineer: 'Nicolás Herrera', tenantId: 'demo' }
];

export const DEMO_MAINTENANCE_SERVICES: MaintenanceServiceItem[] = [
  { id: 'SRV-D001', code: 'MNT-001', title: 'Mantenimiento preventivo de bomba centrífuga', client: DEMO_CLIENTS[4].razonSocial, assetType: 'Bomba Centrífuga', priority: 'Media', status: 'En Curso', assignedTech: 'Tomás Giménez', scheduledDate: isoDay(-3), estimatedCost: 650000, actualCost: 420000, billedAmount: 0, collectedAmount: 0, tenantId: 'demo', notes: 'Revisión de sellos y rodamientos.' },
  { id: 'SRV-D002', code: 'MNT-002', title: 'Diagnóstico de falla en tablero industrial', client: DEMO_CLIENTS[6].razonSocial, assetType: 'Tablero Industrial', priority: 'Alta', status: 'En Diagnóstico', assignedTech: 'Diego Ledesma', scheduledDate: isoDay(-1), estimatedCost: 380000, actualCost: 0, billedAmount: 0, collectedAmount: 0, tenantId: 'demo', notes: 'Disparos intermitentes del guardamotor.' },
  { id: 'SRV-D003', code: 'MNT-003', title: 'Limpieza y control de pozo', client: DEMO_CLIENTS[5].razonSocial, assetType: 'Pozo de Agua', priority: 'Baja', status: 'Finalizado', assignedTech: 'Nicolás Herrera', scheduledDate: isoDay(25), estimatedCost: 900000, actualCost: 860000, billedAmount: 1100000, collectedAmount: 1100000, tenantId: 'demo', notes: 'Cerrado sin observaciones.' },
  { id: 'SRV-D004', code: 'MNT-004', title: 'Revisión de red hidráulica', client: DEMO_CLIENTS[7].razonSocial, assetType: 'Red Hidráulica', priority: 'Urgente', status: 'Pendiente', assignedTech: 'Sergio Acosta', scheduledDate: isoDay(-5), estimatedCost: 520000, actualCost: 0, billedAmount: 0, collectedAmount: 0, tenantId: 'demo', notes: 'Pérdida detectada en tramo principal.' }
];

// ---------------------------------------------------------------- vehículos
export const DEMO_VEHICLES: VehicleItem[] = [
  { id: 'veh_d01', patente: 'DEM 101', brand: 'Marca A', model: 'Pick-up 4x4 Doble Cabina', year: 2022, type: 'Camioneta 4x4', color: 'Blanco', assignedDriver: 'Nicolás Herrera', purchaseDate: '2022-04-10', purchasePrice: 30000000, residualValue: 10000000, usefulLifeKm: 300000, usefulLifeYears: 5, initialMileageKm: 0, currentMileageKm: 88000, oilChangeIntervalKm: 10000, lastOilChangeKm: 82000, lastOilChangeDate: isoDay(40), status: 'Operativo', insuranceCompany: 'Seguros Demo', policyNumber: 'POL-DEMO-101', vtvExpirationDate: isoDay(-150), fuelType: 'Diesel 500', avgConsumptionL100Km: 11, notes: 'Cuadrilla Norte', createdAt: '2022-04-10T10:00:00.000Z', updatedAt: isoDay(5) + 'T12:00:00.000Z' },
  { id: 'veh_d02', patente: 'DEM 102', brand: 'Marca B', model: 'Pick-up 4x2 Cabina Simple', year: 2021, type: 'Camioneta 4x2', color: 'Gris', assignedDriver: 'Sergio Acosta', purchaseDate: '2021-09-01', purchasePrice: 22000000, residualValue: 7000000, usefulLifeKm: 250000, usefulLifeYears: 5, initialMileageKm: 0, currentMileageKm: 121000, oilChangeIntervalKm: 10000, lastOilChangeKm: 115000, lastOilChangeDate: isoDay(70), status: 'Mantenimiento Pendiente', insuranceCompany: 'Seguros Demo', policyNumber: 'POL-DEMO-102', vtvExpirationDate: isoDay(-60), fuelType: 'Diesel 500', avgConsumptionL100Km: 9.5, notes: 'Cuadrilla Sur', createdAt: '2021-09-01T10:00:00.000Z', updatedAt: isoDay(3) + 'T12:00:00.000Z' },
  { id: 'veh_d03', patente: 'DEM 103', brand: 'Marca C', model: 'Furgón utilitario', year: 2020, type: 'Utilitario / Furgón', color: 'Blanco', assignedDriver: 'Tomás Giménez', purchaseDate: '2020-02-20', purchasePrice: 18000000, residualValue: 5000000, usefulLifeKm: 250000, usefulLifeYears: 6, initialMileageKm: 0, currentMileageKm: 165000, oilChangeIntervalKm: 10000, lastOilChangeKm: 160000, lastOilChangeDate: isoDay(20), status: 'Operativo', insuranceCompany: 'Seguros Demo', policyNumber: 'POL-DEMO-103', vtvExpirationDate: isoDay(-200), fuelType: 'Nafta Súper', avgConsumptionL100Km: 12, notes: 'Traslado de materiales', createdAt: '2020-02-20T10:00:00.000Z', updatedAt: isoDay(2) + 'T12:00:00.000Z' }
];

export const DEMO_VEHICLE_EVENTS: VehicleEventItem[] = [
  { id: 'evt_d001', vehicleId: 'veh_d01', patente: 'DEM 101', type: 'cambio_aceite', date: isoDay(40), mileageKm: 82000, title: 'Cambio de aceite y filtros', cost: 180000, description: 'Aceite sintético, filtros de aceite y aire.', responsible: 'Nicolás Herrera', provider: 'Lubricentro Demo', invoiceNumber: 'FAC-B-0001-0001', oilChangeDetails: { oilType: '5W30', oilBrand: 'Marca Demo', filterReplaced: true, airFilterReplaced: true, fuelFilterReplaced: false, nextChangeKm: 92000 }, createdAt: isoDay(40) + 'T11:00:00.000Z' },
  { id: 'evt_d002', vehicleId: 'veh_d01', patente: 'DEM 101', type: 'kilometraje', date: isoDay(5), mileageKm: 88000, title: 'Registro de odómetro', cost: 0, responsible: 'Nicolás Herrera', createdAt: isoDay(5) + 'T09:00:00.000Z' },
  { id: 'evt_d003', vehicleId: 'veh_d02', patente: 'DEM 102', type: 'mecanico', date: isoDay(30), mileageKm: 118000, title: 'Cambio de pastillas de freno', cost: 95000, description: 'Pastillas delanteras.', responsible: 'Sergio Acosta', provider: 'Taller Demo', invoiceNumber: 'FAC-B-0002-0010', mechanicalDetails: { workshopName: 'Taller Demo', hoursInWorkshop: 3, laborDescription: 'Cambio y rectificado' }, createdAt: isoDay(30) + 'T10:00:00.000Z' },
  { id: 'evt_d004', vehicleId: 'veh_d02', patente: 'DEM 102', type: 'repuesto', date: isoDay(18), mileageKm: 119500, title: 'Batería nueva', cost: 140000, responsible: 'Sergio Acosta', provider: 'Repuestos Demo', partsDetails: { partsList: 'Batería 12V 75Ah', quantity: 1, warrantyMonths: 12 }, createdAt: isoDay(18) + 'T10:00:00.000Z' },
  { id: 'evt_d005', vehicleId: 'veh_d03', patente: 'DEM 103', type: 'cambio_aceite', date: isoDay(20), mileageKm: 160000, title: 'Service de 160.000 km', cost: 150000, responsible: 'Tomás Giménez', provider: 'Lubricentro Demo', oilChangeDetails: { oilType: '10W40', filterReplaced: true, airFilterReplaced: false, fuelFilterReplaced: false, nextChangeKm: 170000 }, createdAt: isoDay(20) + 'T10:00:00.000Z' },
  { id: 'evt_d006', vehicleId: 'veh_d03', patente: 'DEM 103', type: 'mantenimiento_gral', date: isoDay(8), mileageKm: 164000, title: 'Revisión general', cost: 60000, responsible: 'Tomás Giménez', provider: 'Taller Demo', createdAt: isoDay(8) + 'T10:00:00.000Z' }
];

// ---------------------------------------------------------------- remitos (auditoría técnica)
const WORK_POINTS = ['Pozo N° 2', 'Tablero general', 'Sala de bombas', 'Pozo N° 5', 'Sector de riego 3', 'Subestación', 'Planta de packing', 'Cuadro de maniobras'];
const DESCRIPTIONS = [
  'Revisión y ajuste de conexiones en tablero de arranque. Medición de consumos y corrección de parámetros.',
  'Reemplazo de contactor y guardamotor. Prueba de funcionamiento bajo carga.',
  'Extracción de bomba, inspección de rodamientos y reinstalación. Verificación de caudal.',
  'Tendido y empalme de cable subterráneo. Medición de aislación.',
  'Diagnóstico de disparos de protección. Se reemplazan bornes y se ajusta la térmica.',
  'Mantenimiento preventivo de sala de bombas. Limpieza, lubricación y control de presión.'
];

// Los remitos más antiguos son los que ya se cobraron; los más nuevos todavía están cargados.
const STATUS_PLAN: RemitoStatus[] = [
  ...Array(14).fill('Cobrado'),
  ...Array(6).fill('Pasado'),
  ...Array(12).fill('Facturado'),
  ...Array(12).fill('Cargado')
];

const fieldCrew = DEMO_WORKERS;
const leads = fieldCrew.filter(w => w.category === 'Capataz');
const officials = fieldCrew.filter(w => w.category === 'Oficial');
const helpersPool = fieldCrew.filter(w => w.category === 'Ayudante');

function buildAuditRecords(): TechnicalAuditRecord[] {
  const p = DEMO_TECHNICAL_PARAMETERS;
  const total = STATUS_PLAN.length;
  return STATUS_PLAN.map((status, i): TechnicalAuditRecord => {
    const client = DEMO_CLIENTS[i % DEMO_CLIENTS.length];
    const lead = leads[i % leads.length];
    const crewHelpers = [pick(helpersPool), pick(helpersPool)].filter((w, idx, arr) => arr.findIndex(x => x.id === w.id) === idx);
    const useOfficial = rand() > 0.6;
    const official = useOfficial ? pick(officials) : undefined;
    const daysAgo = Math.round(((total - i) / total) * 110) + 2;
    const date = isoDay(daysAgo);
    const hoursWorked = round(2 + rand() * 7, 0.5);
    const viajes = rand() > 0.75 ? 2 : 1;
    const travelHours = round((client.distanciaKm / 55) * viajes, 0.5);
    const isGuardia = rand() > 0.88;
    const horaEntrada = pad(7 + Math.floor(rand() * 2), 2) + ':00';
    const exitHour = 7 + Math.floor(rand() * 2) + Math.round(hoursWorked);
    const horaSalida = pad(Math.min(exitHour, 22), 2) + ':00';

    const fuelCost = round(client.distanciaKm * 2 * viajes * p.consumoLKm * p.dieselPrice);
    const seguroCost = round(p.seguroViaje * viajes);
    const amortizacionCost = round(p.amortizacionViaje * viajes);
    const logisticsCost = fuelCost + seguroCost + amortizacionCost;
    const laborDirectCost = round(hoursWorked * p.horaBase * (isGuardia ? p.guardiaMultiplier : 1));
    const helperPay = round(hoursWorked * p.pagoAyudanteHora * crewHelpers.length);
    const techPay = round(laborDirectCost + (official ? hoursWorked * p.horaBase * 0.5 : 0));
    const materialsCost = rand() > 0.5 ? round(20000 + rand() * 180000, 500) : 0;
    const operatingCost = logisticsCost + laborDirectCost + materialsCost;
    const marginPercentage = p.defaultMarginPercentage || 35;
    const suggestedPrice = round(operatingCost * (1 + marginPercentage / 100));

    const invoiced = status !== 'Cargado';
    const collected = status === 'Cobrado';
    const ivaPct = 21;
    const montoBaseRemito = invoiced ? suggestedPrice : 0;
    const ivaAmount = round(montoBaseRemito * (ivaPct / 100));
    const totalFacturado = montoBaseRemito + ivaAmount;
    const invoiceDate = isoDay(Math.max(daysAgo - 6, 1));
    const collectDate = isoDay(Math.max(daysAgo - 20, 0));

    const teamMembers = [
      { name: lead.name, role: 'Capataz' },
      ...(official ? [{ name: official.name, role: 'Oficial' }] : []),
      ...crewHelpers.map(h => ({ name: h.name, role: 'Ayudante' }))
    ];

    return {
      id: `demo_aud_${pad(i + 1)}`,
      remitoId: `R-D${pad(i + 1)}-${YEAR}`,
      remitoPapel: `0001-${pad(4000 + i, 7)}`,
      date,
      clientName: client.razonSocial,
      siteLocation: client.fincaLocacion,
      workPoint: pick(WORK_POINTS),
      isGuardia,
      guardiaType: isGuardia ? 'GUARDIA_50' : 'NO_GUARDIA',
      marginPercentage,
      hoursWorked,
      travelHours,
      viajes,
      distanceKm: client.distanciaKm,
      horaEntrada,
      horaSalida,
      logisticsCost,
      fuelCost,
      seguroCost,
      amortizacionCost,
      laborDirectCost,
      operatingCost,
      materialsCost,
      materialsDetails: materialsCost > 0 ? 'Materiales eléctricos varios' : undefined,
      description: pick(DESCRIPTIONS),
      suggestedPrice,
      billedPrice: invoiced ? montoBaseRemito : 0,
      collectedPrice: collected ? totalFacturado : 0,
      helperPay,
      techPay,
      leadTech: lead.name,
      helpers: [...(official ? [official.name] : []), ...crewHelpers.map(h => h.name)],
      teamMembers,
      status,
      semaforo: status === 'Cobrado' ? 'verde' : status === 'Cargado' ? 'naranja' : 'neutro',
      numeroFactura: invoiced ? `A-0001-${pad(1000 + i, 8)}` : undefined,
      fechaFactura: invoiced ? invoiceDate : undefined,
      montoBaseRemito: invoiced ? montoBaseRemito : undefined,
      ivaPct: invoiced ? ivaPct : undefined,
      ivaAmount: invoiced ? ivaAmount : undefined,
      totalFacturado: invoiced ? totalFacturado : undefined,
      paymentMethods: collected
        ? [{ id: `pay_demo_${pad(i + 1)}`, method: 'Transferencia', amount: totalFacturado, reference: `TRF-${pad(5000 + i, 6)}`, bank: 'Banco Demo', paymentDate: collectDate }]
        : undefined,
      fechaCobro: collected ? collectDate : undefined,
      capatazCommissionPct: lead.capatazPercentage || 10,
      capatazProfit: round(laborDirectCost * ((lead.capatazPercentage || 10) / 100))
    };
  });
}

export const DEMO_AUDIT_RECORDS: TechnicalAuditRecord[] = buildAuditRecords();

// ---------------------------------------------------------------- comprobantes y finanzas
export const DEMO_ARCHIVED_RECEIPTS: ArchivedReceipt[] = (() => {
  const collectedByClient = new Map<string, TechnicalAuditRecord[]>();
  DEMO_AUDIT_RECORDS.filter(r => r.status === 'Cobrado').forEach(r => {
    collectedByClient.set(r.clientName, [...(collectedByClient.get(r.clientName) || []), r]);
  });
  return Array.from(collectedByClient.entries()).map(([clientName, records], i): ArchivedReceipt => {
    const totalAmount = records.reduce((acc, r) => acc + (r.collectedPrice || 0), 0);
    return {
      id: `rec_demo_${pad(i + 1)}`,
      receiptNumber: `REC-D${pad(i + 1)}-${YEAR}`,
      remitoIds: records.map(r => r.id),
      clientName,
      date: records[records.length - 1].fechaCobro || isoDay(10),
      totalAmount,
      paymentMethods: [{ id: `pay_rec_${pad(i + 1)}`, method: 'Transferencia', amount: totalAmount, reference: `TRF-${pad(7000 + i, 6)}`, bank: 'Banco Demo', paymentDate: records[records.length - 1].fechaCobro || isoDay(10) }],
      invoiceNumber: records[0].numeroFactura,
      type: 'RECIBO_COBRADO',
      notes: 'Comprobante de demostración',
      createdAt: new Date().toISOString()
    };
  });
})();

export const DEMO_FINANCIAL_REPORTS: FinancialMetricRecord[] = DEMO_PROJECTS.map((prj, i) => {
  const facturado = Math.round(prj.spent * 1.3);
  const cobrado = prj.status === 'Completado' ? facturado : Math.round(facturado * 0.4);
  const period = isoDay(30 * (i + 1)).slice(0, 7);
  return {
    id: `REP-D${pad(i + 1)}`,
    period,
    periodLabel: period,
    clientName: prj.client,
    projectName: prj.title,
    code: `FAC-D${pad(i + 1)}`,
    cargado: prj.spent,
    facturado,
    cobrado,
    pendingBalance: facturado - cobrado,
    status: cobrado >= facturado ? 'Cobrado' : 'Facturado Parcial',
    date: isoDay(30 * (i + 1)),
    category: i % 2 === 0 ? 'Mantenimiento' : 'Obras',
    createdBy: 'demo.admin@bandiera.demo',
    notes: 'Registro de demostración'
  };
});

export const DEMO_AVAILABLE_HELPERS: string[] = helpersPool.map(w => w.name);

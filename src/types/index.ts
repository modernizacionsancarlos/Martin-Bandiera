export type UserRole = 'SuperAdmin' | 'Owner' | 'Gerente' | 'Admin' | 'Capataz' | 'Empleado';

export interface RolePermissions {
  viewDashboard: boolean;
  viewFinancials: boolean;
  manageAudits: boolean;
  manageBilling: boolean;       // Facturado & Pasado
  manageCollections: boolean;   // Cobrado & Comprobantes
  manageLiquidations: boolean;  // Liquidaciones de cuadrillas
  manageClients: boolean;       // Clientes y fincas
  manageProjects: boolean;
  manageMaterials: boolean;
  manageVehicles: boolean;      // Flota, amortización y eventos de vehículos
  manageFixedCosts: boolean;    // Tarifas diesel, hora base, seguros
  manageUsers: boolean;         // Crear/editar/eliminar usuarios y roles
  resetSystem: boolean;         // Poner sistema en 0
  exportExcel: boolean;         // Descargar reportes en Excel
  createRemito: boolean;        // Crear nuevos reportes técnicos / remitos
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  category?: WorkerCategory;
  isAdministrative?: boolean;
  tenantId: string;
  companyName: string;
  avatarUrl?: string;
  phone?: string;
  password?: string;
  specialty?: string;
  cargo?: string;
  capatazPercentage?: number; // % que gana el capataz sobre ganancia / M.O. Directa de obra
  cuadrilla?: string;
  hourlyRate?: number; // Tarifa por hora base para cálculo técnico ($/h)
  salaryMonthly?: number; // Sueldo mensual de referencia
  active?: boolean;
  createdAt?: string;
  customPermissions?: Partial<RolePermissions>;
}

export interface FinancialMetricRecord {
  id: string;
  period: string; // e.g. "2026-01", "2026-02"
  periodLabel: string; // e.g. "Enero 2026"
  clientName: string;
  projectName: string;
  code: string;
  cargado: number;   // Monto cargado / costos operativos presupuestados
  facturado: number; // Monto efectivamente facturado
  cobrado: number;   // Monto efectivamente cobrado/percibido
  pendingBalance: number; // facturado - cobrado
  status: 'Cobrado' | 'Facturado Parcial' | 'Pendiente' | 'En Gestión';
  date: string;
  category: 'Obras' | 'Mantenimiento' | 'Logística' | 'Asistencia Técnica';
  createdBy: string;
  notes?: string;
}

export interface ProjectItem {
  id: string;
  code: string;
  title: string;
  client: string;
  description: string;
  location: string;
  status: 'Planificación' | 'En Ejecución' | 'En Pausa' | 'Completado';
  budget: number;
  spent: number;
  progress: number; // 0 to 100
  startDate: string;
  endDate: string;
  leadEngineer: string;
  tenantId: string;
}

export interface MaintenanceServiceItem {
  id: string;
  code: string;
  title: string;
  client: string;
  assetType: 'Pozo de Agua' | 'Subestación Eléctrica' | 'Bomba Centrífuga' | 'Tablero Industrial' | 'Red Hidráulica';
  priority: 'Baja' | 'Media' | 'Alta' | 'Urgente';
  status: 'Pendiente' | 'En Diagnóstico' | 'En Curso' | 'Finalizado';
  assignedTech: string;
  scheduledDate: string;
  estimatedCost: number;
  actualCost: number;
  billedAmount: number;
  collectedAmount: number;
  tenantId: string;
  notes: string;
}

export interface MaterialItem {
  id: string;
  code: string;
  name: string;
  category: 'Electricidad' | 'Cañerías y Válvulas' | 'Herramientas' | 'Químicos y Fluidos' | 'Seguridad';
  stock: number;
  unit: string;
  minStock: number;
  unitPrice: number;
  location: string;
  tenantId: string;
  lastUpdated: string;
}

export type WorkerCategory = 'Oficial' | 'Ayudante' | 'Capataz' | 'Administrativo';

export interface WorkerItem {
  id: string;
  name: string;
  role: UserRole;
  category?: WorkerCategory; // 'Oficial' | 'Ayudante' | 'Capataz' | 'Administrativo'
  isAdministrative?: boolean;
  specialty: string;
  cargo?: string;
  capatazPercentage?: number; // % ganancia capataz sobre costo de servicio / M.O.
  cuadrilla?: string;
  email: string;
  phone: string;
  active: boolean;
  assignedProjectsCount: number;
  salaryMonthly: number;
  hourlyRate?: number; // Tarifa por hora base para cálculo técnico ($/h)
}

export interface ClientItem {
  id: string;
  razonSocial: string;      // e.g. "TechCorp S.A."
  cuit: string;             // e.g. "30-12345678-9"
  fincaLocacion: string;    // e.g. "Sede Central"
  email: string;            // e.g. "adm@cliente.com"
  telefono: string;         // e.g. "2614556677"
  direccionFiscal: string;  // e.g. "Calle Principal 1"
  latitud?: number;         // e.g. -32.8895
  longitud?: number;        // e.g. -68.8451
  distanciaKm: number;      // e.g. 15.5
  notes?: string;
  createdAt?: string;
}

export interface TechnicalCostParameters {
  dieselPrice: number;       // e.g. 2399 ($/L)
  horaBase: number;          // e.g. 9400 ($/hora - Oficial / Técnico Base)
  horaOficial?: number;      // e.g. 9400 ($/hora Oficial)
  seguroViaje: number;       // e.g. 1318.78 ($/viaje)
  amortizacionViaje: number; // e.g. 7587.88 ($/viaje)
  consumoLKm: number;        // e.g. 0.13 (L/km)
  guardiaMultiplier: number; // e.g. 1.5 (50% recargo)
  pagoAyudanteHora: number;  // e.g. 5500 ($/hora Ayudante)
  defaultMarginPercentage?: number; // Margen comercial sugerido estándar (ej: 35%)
  lastUpdated: string;
}

export type RemitoStatus = 'Cargado' | 'Facturado' | 'Pasado' | 'Cobrado';
export type GuardiaType = 'NO_GUARDIA' | 'GUARDIA_50' | 'GUARDIA_100';

export interface TeamMemberAssigned {
  name: string;
  role: 'Oficial' | 'Ayudante' | 'Capataz' | string;
  rate?: number;
}

export interface PaymentEntry {
  id: string;
  method: 'Transferencia' | 'Cheque' | 'Efectivo' | 'E-Cheq' | 'Depósito' | 'Otro';
  amount: number;
  reference?: string; // Nº transacción / comprobante
  bank?: string;      // Entidad bancaria
  paymentDate: string;
  notes?: string;
}

export interface ArchivedReceipt {
  id: string;
  receiptNumber: string; // e.g. REC-380-2026 o FAC-A-0001
  remitoIds: string[];
  clientName: string;
  date: string;
  totalAmount: number;
  paymentMethods: PaymentEntry[];
  invoiceNumber?: string;
  retencionIVA?: number;
  retencionIIBB?: number;
  retencionGanancias?: number;
  type: 'RECIBO_COBRADO' | 'REMITO_PASADO';
  pdfDataUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface TechnicalAuditRecord {
  id: string;
  remitoId: string;          // e.g. "R-1510-2026" o "#380-2026"
  remitoPapel?: string;
  date: string;              // YYYY-MM-DD
  clientName: string;        // e.g. "1 AGRODAY SA", "1 AGUSTIN CASTILLO"
  siteLocation: string;      // e.g. "PASO DE LAS CARRETAS", "PAREDITAS"
  workPoint: string;         // e.g. "TABLERO PRINCIPAL, POZO SECTOR NORTE"
  isGuardia: boolean;
  guardiaType?: GuardiaType; // NO_GUARDIA | GUARDIA_50 | GUARDIA_100
  guardiaMode?: 'fijo' | 'por_hora'; // Modalidad de cálculo de guardia manual
  guardiaAmount?: number; // Monto fijo o tarifa por hora ingresada manualmente
  guardiaSubtype?: 'adicional' | 'plano'; // 'adicional' = suma a horas base | 'plano' = tarifa cerrada
  marginPercentage?: number; // % Margen de facturación personalizado editable
  hoursWorked: number;       // e.g. 4.5
  travelHours: number;       // e.g. 1.5
  viajes?: number;           // Cantidad de viajes realizados (e.g. 1, 2, 3)
  distanceKm: number;        // e.g. 45
  horaEntrada: string;       // "08:00"
  horaSalida: string;        // "14:30"
  logisticsCost: number;     // calculated
  fuelCost?: number;         // Combustible desglosado
  seguroCost?: number;       // Seguros desglosado
  amortizacionCost?: number; // Amortización desglosada
  laborDirectCost: number;   // calculated (Costo de Servicio directo)
  operatingCost: number;     // logistics + labor + materials
  materialsCost: number;
  materialsDetails?: string;
  description: string;
  suggestedPrice: number;
  billedPrice: number;
  collectedPrice: number;
  helperPay: number;         // Pago ayudantes (M.O. Ayudante)
  techPay: number;           // Pago técnico responsable / oficial (M.O. Capataz)
  honorarios?: number;       // Costo Honorarios (valor puesto como ganancia)
  leadTech: string;          // Responsable técnico
  helpers: string[];         // Names of helpers
  teamMembers?: TeamMemberAssigned[]; // Equipo con asignación Oficial vs Ayudante
  supportStaff?: string[];
  signatureUrl?: string;     // Canvas drawing data
  status: RemitoStatus;
  semaforo?: 'verde' | 'naranja' | 'rojo' | 'neutro';

  // Mensajes & Notificaciones
  message?: string;          // Mensaje o nota operativa persistente
  messageRead?: boolean;     // Estado de lectura (true: deja de titilar)
  messageDate?: string;      // Fecha del mensaje

  // Facturación & Retenciones
  numeroFactura?: string;    // Puede ser la misma para múltiples remitos
  fechaFactura?: string;
  montoBaseRemito?: number;  // Subtotal base acordado/editado antes del 7%
  recargo7Pct?: number;      // Monto del 7% aplicado
  ivaPct?: number;           // 21 | 10.5
  ivaAmount?: number;        // Monto del IVA discriminado
  totalFacturado?: number;   // Monto total final a facturar con IVA
  retencionIVA?: number;     // Carga manual
  retencionIIBB?: number;    // Carga manual (Ingresos Brutos)
  retencionGanancias?: number; // Carga manual (Ganancias)

  // Cobro & Pagos múltiples
  paymentMethods?: PaymentEntry[];
  fechaCobro?: string;

  // Ganancia Capataz (calculada estrictamente sobre Costo de Servicio / M.O.)
  capatazCommissionPct?: number; // e.g. 10
  capatazProfit?: number;        // laborDirectCost * pct

  // Carga desde la app de campo (sin montos): el sistema calcula los costos al abrirlo un administrador
  origenCampo?: boolean;
  costosPendientes?: boolean;
  cargadoPor?: string;
  cargadoEn?: string;
  fieldMaterials?: { name: string; qty: number }[];
  // Field remitos: who has it now, hand-overs between capataces and edits from the phone.
  cargadoPorNombre?: string;
  asignadoA?: string;
  asignadoNombre?: string;
  transferido?: boolean;
  transferencias?: { de: string; a: string; fecha: string; nota?: string | null; deEmail?: string; aEmail?: string }[];
  editadoEnCampo?: string;
  editadoPor?: string;
  edicionesCampo?: number;
}

export type ColorTheme = 'cyan' | 'blue' | 'emerald' | 'amber' | 'slate';

export interface WorkerLiquidationDetail {
  name: string;
  role: string;
  cargo: string;
  isCapataz: boolean;
  capatazPercentage: number;
  cuadrilla?: string;
  phone?: string;
  email?: string;
  totalServices: number;
  totalHours: number;
  hoursAsLead: number;
  hoursAsHelper: number;
  guardiasCount: number;
  payAsLead: number;
  payAsHelper: number;
  capatazProfitTotal: number;
  totalPay: number;
  records: TechnicalAuditRecord[];
}

// -------------------------------------------------------------
// FLOTA DE VEHÍCULOS & AMORTIZACIÓN POR PATENTE
// -------------------------------------------------------------
export type VehicleEventType =
  | 'kilometraje'
  | 'cambio_aceite'
  | 'mecanico'
  | 'repuesto'
  | 'mantenimiento_gral';

export type VehicleStatus = 'Operativo' | 'En Taller' | 'Mantenimiento Pendiente' | 'Fuera de Servicio';

export type VehicleCategory =
  | 'Camioneta 4x4'
  | 'Camioneta 4x2'
  | 'Utilitario / Furgón'
  | 'Camión con Grúa'
  | 'Automóvil'
  | 'Otro';

export interface VehicleEventItem {
  id: string;
  vehicleId: string;
  patente: string;
  type: VehicleEventType;
  date: string; // YYYY-MM-DD
  mileageKm: number; // Odómetro al momento del evento
  title: string;
  cost: number; // Costo en pesos ($)
  description?: string;
  responsible?: string; // Chofer o responsable a cargo
  performedBy?: string; // Chofer o responsable (alias)
  provider?: string; // Taller / Lubricentro / Proveedor
  workshopOrProvider?: string; // Taller / Lubricentro / Proveedor (alias)
  invoiceNumber?: string; // Factura / remito / comprobante

  // Detalles específicos por tipo
  oilChangeDetails?: {
    oilType?: string; // e.g. "15W40 Sintético", "5W30"
    oilBrand?: string; // e.g. "Total", "Shell Rimula", "YPF Elaion"
    filterReplaced?: boolean;
    filterChanged?: boolean;
    airFilterReplaced?: boolean;
    airFilterChanged?: boolean;
    fuelFilterReplaced?: boolean;
    fuelFilterChanged?: boolean;
    nextChangeKm?: number;
  };
  partsDetails?: {
    partsList?: string;
    quantity?: number;
    warrantyMonths?: number;
  };
  mechanicalDetails?: {
    workshopName?: string;
    hoursInWorkshop?: number;
    laborDescription?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface VehicleItem {
  id: string;
  patente: string; // Identificador clave único (e.g. "AF 382 PL")
  brand: string; // e.g. "Toyota"
  model: string; // e.g. "Hilux 4x4 2.8 D/C DX"
  year: number; // e.g. 2023
  type: VehicleCategory;
  vin?: string; // Chasis / Motor
  color?: string;
  assignedDriver?: string; // Chofer habitual de cuadrilla

  // Parámetros de Amortización y Vida Útil
  purchaseDate: string; // YYYY-MM-DD
  purchasePrice: number; // Valor de compra / adquisición ($)
  residualValue: number; // Valor residual estimado al final de vida ($)
  usefulLifeKm: number; // Vida útil proyectada en Km (ej: 300.000)
  usefulLifeYears?: number; // Vida útil proyectada en años (ej: 5)

  // Odómetro y Kilometraje
  initialMileageKm: number; // Kilometraje inicial de ingreso
  currentMileageKm: number; // Odómetro actual sincronizado

  // Intervalos de Servicio
  oilChangeIntervalKm: number; // e.g. 10000 km
  lastOilChangeKm?: number;
  lastOilChangeDate?: string;

  status: VehicleStatus;
  insuranceCompany?: string;
  policyNumber?: string;
  vtvExpirationDate?: string; // Vencimiento RTO / VTV
  fuelType?: 'Diesel 500' | 'Infinia Diesel / Grado 3' | 'Nafta Súper' | 'Nafta Premium' | 'GNC';
  avgConsumptionL100Km?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}


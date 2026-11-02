import { UserRole, RolePermissions, UserProfile } from '../types';

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  SuperAdmin: {
    viewDashboard: true,
    viewFinancials: true,
    manageAudits: true,
    manageBilling: true,
    manageCollections: true,
    manageLiquidations: true,
    manageClients: true,
    manageProjects: true,
    manageMaterials: true,
    manageVehicles: true,
    manageFixedCosts: true,
    manageUsers: true,
    resetSystem: true,
    exportExcel: true,
    createRemito: true,
  },
  Owner: {
    viewDashboard: true,
    viewFinancials: true,
    manageAudits: true,
    manageBilling: true,
    manageCollections: true,
    manageLiquidations: true,
    manageClients: true,
    manageProjects: true,
    manageMaterials: true,
    manageVehicles: true,
    manageFixedCosts: true,
    manageUsers: true,
    resetSystem: false,
    exportExcel: true,
    createRemito: true,
  },
  Gerente: {
    viewDashboard: true,
    viewFinancials: true,
    manageAudits: true,
    manageBilling: true,
    manageCollections: true,
    manageLiquidations: true,
    manageClients: true,
    manageProjects: true,
    manageMaterials: true,
    manageVehicles: true,
    manageFixedCosts: false,
    manageUsers: true,
    resetSystem: false,
    exportExcel: true,
    createRemito: true,
  },
  Admin: {
    viewDashboard: true,
    viewFinancials: false, // Strict: Administrativo de campo no ve métricas globales de utilidad neta
    manageAudits: true,
    manageBilling: true,
    manageCollections: true,
    manageLiquidations: true,
    manageClients: true,
    manageProjects: true,
    manageMaterials: true,
    manageVehicles: true,
    manageFixedCosts: true, // Panel de Configuración y Costos Fijos
    manageUsers: true,
    resetSystem: false,
    exportExcel: true,
    createRemito: true,
  },
  Capataz: {
    viewDashboard: false, // Capataz va directo a sus remitos y cuadrilla
    viewFinancials: false, // Sin acceso financiero
    manageAudits: true,    // Carga y audita remitos de su cuadrilla
    manageBilling: false,  // Sin acceso a facturación privada
    manageCollections: false, // Sin acceso a cobros bancarios
    manageLiquidations: true, // Ve su liquidación de comisión M.O.
    manageClients: false,  // Ve destino en remito, no administra base
    manageProjects: true,
    manageMaterials: true,
    manageVehicles: true,  // Puede registrar odómetro y services de su camioneta
    manageFixedCosts: false,
    manageUsers: false,
    resetSystem: false,
    exportExcel: false,
    createRemito: true,    // Carga de partes diarios de obra
  },
  Empleado: {
    viewDashboard: false,
    viewFinancials: false,
    manageAudits: false,
    manageBilling: false,
    manageCollections: false,
    manageLiquidations: false,
    manageClients: false,
    manageProjects: true,  // Ve proyectos asignados
    manageMaterials: false,
    manageVehicles: false,
    manageFixedCosts: false,
    manageUsers: false,
    resetSystem: false,
    exportExcel: false,
    createRemito: false,
  }
};

export const PERMISSION_DEFINITIONS: {
  key: keyof RolePermissions;
  label: string;
  category: 'General' | 'Operaciones' | 'Finanzas y Cobranzas' | 'Configuración y Sistema';
  description: string;
}[] = [
  {
    key: 'viewDashboard',
    label: 'Tablero Principal (Dashboard)',
    category: 'General',
    description: 'Acceso a la pantalla general de inicio con indicadores de estado y gráficos.'
  },
  {
    key: 'createRemito',
    label: 'Cargar Nuevos Remitos Diarios',
    category: 'Operaciones',
    description: 'Permiso para emitir partes técnicos y remitos de campo.'
  },
  {
    key: 'manageAudits',
    label: 'Auditoría Técnica (Remitos Cargados)',
    category: 'Operaciones',
    description: 'Visualizar, editar horas, calcular logística, M.O. y cambiar estados de remitos.'
  },
  {
    key: 'manageBilling',
    label: 'Solapas Facturado y Pasado',
    category: 'Finanzas y Cobranzas',
    description: 'Cargar números de factura, retenciones impositivas y generar remitos pasados.'
  },
  {
    key: 'manageCollections',
    label: 'Solapa Cobrado & Recibos',
    category: 'Finanzas y Cobranzas',
    description: 'Asignar medios de cobro (transferencia, cheque) y archivar comprobantes.'
  },
  {
    key: 'viewFinancials',
    label: 'Métricas Financieras & Rentabilidad',
    category: 'Finanzas y Cobranzas',
    description: 'Visualización de márgenes, utilidad bruta, costos operativos globales y balances.'
  },
  {
    key: 'manageLiquidations',
    label: 'Liquidación de Cuadrillas',
    category: 'Operaciones',
    description: 'Cálculo del porcentaje de mano de obra directa para capataces y cuadrillas.'
  },
  {
    key: 'manageClients',
    label: 'Base de Clientes & Fincas',
    category: 'Operaciones',
    description: 'Alta, edición, búsqueda y georreferenciación de clientes de la empresa.'
  },
  {
    key: 'manageProjects',
    label: 'Proyectos & Obras',
    category: 'Operaciones',
    description: 'Supervisión de obras en curso, avances y tareas asignadas.'
  },
  {
    key: 'manageMaterials',
    label: 'Materiales & Depósito',
    category: 'Operaciones',
    description: 'Control de stock y asignación de insumos a remitos.'
  },
  {
    key: 'manageVehicles',
    label: 'Flota & Amortización de Vehículos',
    category: 'Operaciones',
    description: 'Administrar vehículos por patente, kilometraje, mecánicos, cambios de aceite y amortización.'
  },
  {
    key: 'exportExcel',
    label: 'Exportar Datos a Excel (.xlsx)',
    category: 'General',
    description: 'Descargar planillas de auditoría, facturación, cobranzas y clientes.'
  },
  {
    key: 'manageFixedCosts',
    label: 'Parámetros y Costos Fijos',
    category: 'Configuración y Sistema',
    description: 'Modificar valor diesel ($/L), hora base técnica, seguro y amortización.'
  },
  {
    key: 'manageUsers',
    label: 'Gestión de Usuarios y Roles',
    category: 'Configuración y Sistema',
    description: 'Crear, editar, suspender usuarios y modificar sus jerarquías de permisos.'
  },
  {
    key: 'resetSystem',
    label: 'Poner Todo el Sistema en 0',
    category: 'Configuración y Sistema',
    description: 'Permiso crítico para vaciar base de datos y preparar importaciones limpias.'
  }
];

export const EMPTY_PERMISSIONS: RolePermissions = {
  viewDashboard: false,
  viewFinancials: false,
  manageAudits: false,
  manageBilling: false,
  manageCollections: false,
  manageLiquidations: false,
  manageClients: false,
  manageProjects: false,
  manageMaterials: false,
  manageVehicles: false,
  manageFixedCosts: false,
  manageUsers: false,
  resetSystem: false,
  exportExcel: false,
  createRemito: false,
};

export function getEffectivePermissions(user?: UserProfile | null): RolePermissions {
  if (!user) {
    return { ...EMPTY_PERMISSIONS };
  }
  const cleanEmail = (user.email || '').toLowerCase().trim();

  // SuperAdmin ALWAYS has 100% of all permissions unconditionally.
  // No customPermissions or role downgrade can ever remove SuperAdmin capabilities.
  if (
    user.role === 'SuperAdmin' ||
    ['admin@admin.com', 'admin@bandiera.com', 'valenkoreinmolina@gmail.com', 'martin@iipsa.com.ar'].includes(cleanEmail)
  ) {
    return { ...DEFAULT_ROLE_PERMISSIONS.SuperAdmin };
  }

  // Admin users (Gastón Villalobos, Romina, etc.) ALWAYS have full operational admin permissions including fixed costs
  if (
    user.role === 'Admin' ||
    ['gastonvillalobos2019@gmail.com', 'rominabromeo@yahoo.com.ar'].includes(cleanEmail)
  ) {
    const adminBase: RolePermissions = {
      ...DEFAULT_ROLE_PERMISSIONS.Admin,
      manageFixedCosts: true,
      manageBilling: true,
      manageUsers: true,
      manageAudits: true,
      manageCollections: true,
      manageLiquidations: true,
      manageClients: true,
      manageProjects: true,
      manageMaterials: true,
      manageVehicles: true,
      createRemito: true,
      exportExcel: true,
      viewDashboard: true
    };
    return {
      ...adminBase,
      ...(user.customPermissions || {})
    };
  }

  const basePermissions = DEFAULT_ROLE_PERMISSIONS[user.role] || DEFAULT_ROLE_PERMISSIONS.Empleado;
  if (!user.customPermissions) {
    return { ...basePermissions };
  }
  return {
    ...basePermissions,
    ...user.customPermissions
  };
}

export function isAdministrativeUser(user?: UserProfile | null): boolean {
  if (!user) return false;
  const cleanEmail = (user.email || '').toLowerCase().trim();
  if (['SuperAdmin', 'Owner', 'Gerente', 'Admin', 'Directivo'].includes(user.role)) return true;
  if (user.isAdministrative) return true;
  if (user.category === 'Administrativo') return true;
  if (['gastonvillalobos2019@gmail.com', 'rominabromeo@yahoo.com.ar', 'martin@iipsa.com.ar', 'admin@admin.com'].includes(cleanEmail)) return true;
  const permissions = getEffectivePermissions(user);
  if (permissions.manageUsers || permissions.manageLiquidations || permissions.manageFixedCosts) return true;
  return false;
}

export function getRoleBadgeConfig(role: UserRole) {
  switch (role) {
    case 'SuperAdmin':
      return {
        label: 'SuperAdmin',
        title: 'Super Administrador',
        bg: 'bg-purple-100 dark:bg-purple-950/60',
        text: 'text-purple-700 dark:text-purple-300',
        border: 'border-purple-300 dark:border-purple-800',
        accent: 'from-purple-600 to-indigo-700',
        description: 'Control total de la plataforma, base de datos y usuarios.'
      };
    case 'Owner':
      return {
        label: 'Dueño / Socio',
        title: 'Dirección & Propiedad',
        bg: 'bg-rose-100 dark:bg-rose-950/60',
        text: 'text-rose-700 dark:text-rose-300',
        border: 'border-rose-300 dark:border-rose-800',
        accent: 'from-rose-600 to-red-700',
        description: 'Supervisión ejecutiva, finanzas, cobranzas y clientes.'
      };
    case 'Gerente':
      return {
        label: 'Gerente',
        title: 'Gerente de Operaciones',
        bg: 'bg-cyan-100 dark:bg-cyan-950/60',
        text: 'text-cyan-700 dark:text-cyan-300',
        border: 'border-cyan-300 dark:border-cyan-800',
        accent: 'from-cyan-600 to-blue-700',
        description: 'Gestión técnica, auditoría de remitos, facturación y clientes.'
      };
    case 'Admin':
      return {
        label: 'Administrativo',
        title: 'Administración & Facturación',
        bg: 'bg-emerald-100 dark:bg-emerald-950/60',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-300 dark:border-emerald-800',
        accent: 'from-emerald-600 to-teal-700',
        description: 'Carga y seguimiento de facturas, recibos y archivo digital.'
      };
    case 'Capataz':
      return {
        label: 'Capataz',
        title: 'Jefe de Cuadrilla de Campo',
        bg: 'bg-amber-100 dark:bg-amber-950/60',
        text: 'text-amber-800 dark:text-amber-300',
        border: 'border-amber-300 dark:border-amber-800',
        accent: 'from-amber-500 to-orange-600',
        description: 'Carga de remitos diarios, horas de cuadrilla y su liquidación.'
      };
    case 'Empleado':
    default:
      return {
        label: 'Técnico / Empleado',
        title: 'Personal Técnico Operativo',
        bg: 'bg-slate-100 dark:bg-slate-800/80',
        text: 'text-slate-700 dark:text-slate-300',
        border: 'border-slate-300 dark:border-slate-700',
        accent: 'from-slate-600 to-slate-800',
        description: 'Consulta de trabajos asignados y registro de partes de horas.'
      };
  }
}

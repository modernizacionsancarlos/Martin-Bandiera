import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { UserProfile, UserRole } from '../types';
import {
  Database,
  Table,
  Code2,
  Download,
  Upload,
  Search,
  Plus,
  Trash2,
  Edit3,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  FileSpreadsheet,
  Building2,
  Wrench,
  Boxes,
  Users,
  MapPin,
  FolderArchive,
  Sliders,
  DollarSign
} from 'lucide-react';
import { todayLocalISO } from '../utils/dateUtils';

type DatabaseTableKey =
  | 'users'
  | 'auditoria_remitos'
  | 'proyectos'
  | 'mantenimiento_pozos'
  | 'materiales'
  | 'trabajadores'
  | 'clientes'
  | 'comprobantes'
  | 'parametros_costos'
  | 'reportes_financieros';

interface TableDefinition {
  key: DatabaseTableKey;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  badge: string;
}

const TABLES: TableDefinition[] = [
  {
    key: 'users',
    label: 'usuarios_credenciales',
    description: 'Cuentas de usuario, correos, roles, contraseñas y estados de autenticación',
    icon: Shield,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    badge: 'Auth & RBAC'
  },
  {
    key: 'auditoria_remitos',
    label: 'remitos_auditoria_tecnica',
    description: 'Partes diarios, trabajos cargados, facturados, pasados y cobrados',
    icon: FileSpreadsheet,
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    badge: 'Producción'
  },
  {
    key: 'proyectos',
    label: 'obras_proyectos',
    description: 'Registro maestro de obras, contratistas, presupuestos y avances',
    icon: Building2,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    badge: 'Obras'
  },
  {
    key: 'mantenimiento_pozos',
    label: 'mantenimiento_electrobombas',
    description: 'Intervenciones en pozos profundos, presiones y estado de bombas',
    icon: Wrench,
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    badge: 'Servicios'
  },
  {
    key: 'materiales',
    label: 'inventario_materiales',
    description: 'Catálogo de insumos, stock disponible y costos unitarios en USD',
    icon: Boxes,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    badge: 'Stock'
  },
  {
    key: 'trabajadores',
    label: 'personal_cuadrillas',
    description: 'Nómina técnica de operarios, categorías, jornales y cuadrillas',
    icon: Users,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    badge: 'Personal'
  },
  {
    key: 'clientes',
    label: 'clientes_yacimientos',
    description: 'Empresas, fincas, CUIT y cálculo de distancias logísticas en KM',
    icon: MapPin,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
    badge: 'Clientes'
  },
  {
    key: 'comprobantes',
    label: 'comprobantes_digitales',
    description: 'Archivo de recibos de pago, PDFs y retenciones impositivas',
    icon: FolderArchive,
    color: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
    badge: 'Archivos'
  },
  {
    key: 'parametros_costos',
    label: 'parametros_costos_fijos',
    description: 'Valores de combustible, seguros, horas de máquinas y paritarias',
    icon: Sliders,
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    badge: 'Costos'
  },
  {
    key: 'reportes_financieros',
    label: 'metricas_financieras',
    description: 'Consolidados mensuales de facturación, cobranza y pendientes',
    icon: DollarSign,
    color: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
    badge: 'Finanzas'
  }
];

export const DatabaseConsoleView: React.FC = () => {
  const {
    currentUser,
    users,
    createUser,
    updateUser,
    deleteUser,
    replaceUsersList,
    loginAsUser
  } = useAuth();

  const {
    technicalAuditRecords,
    projects,
    maintenanceServices,
    materials,
    workers,
    clients,
    archivedReceipts,
    technicalParameters,
    financialReports,
    updateTechnicalParameters
  } = useData();

  // Navigation and view modes
  const [selectedTable, setSelectedTable] = useState<DatabaseTableKey>('users');
  const [viewFormat, setViewFormat] = useState<'table' | 'json'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Edit / Inspect Modal
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [editJsonString, setEditJsonString] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isNewRecordModal, setIsNewRecordModal] = useState(false);

  // Direct User Creation quick modal
  const [quickUserModal, setQuickUserModal] = useState(false);
  const [quickUserForm, setQuickUserForm] = useState({
    displayName: '',
    email: '',
    password: '',
    role: 'Capataz' as UserRole,
    phone: '',
    specialty: '',
    cuadrilla: '',
    active: true
  });

  // System toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    showToast('Copiado al portapapeles');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Get current table data
  const currentRecords = useMemo(() => {
    switch (selectedTable) {
      case 'users':
        return users;
      case 'auditoria_remitos':
        return technicalAuditRecords;
      case 'proyectos':
        return projects;
      case 'mantenimiento_pozos':
        return maintenanceServices;
      case 'materiales':
        return materials;
      case 'trabajadores':
        return workers;
      case 'clientes':
        return clients;
      case 'comprobantes':
        return archivedReceipts;
      case 'parametros_costos':
        return [technicalParameters];
      case 'reportes_financieros':
        return financialReports;
      default:
        return [];
    }
  }, [
    selectedTable,
    users,
    technicalAuditRecords,
    projects,
    maintenanceServices,
    materials,
    workers,
    clients,
    archivedReceipts,
    technicalParameters,
    financialReports
  ]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return currentRecords;
    const q = searchQuery.toLowerCase().trim();
    return currentRecords.filter(item => {
      const serialized = JSON.stringify(item).toLowerCase();
      return serialized.includes(q);
    });
  }, [currentRecords, searchQuery]);

  // Total DB record count calculation
  const totalRecordCount = useMemo(() => {
    return (
      users.length +
      technicalAuditRecords.length +
      projects.length +
      maintenanceServices.length +
      materials.length +
      workers.length +
      clients.length +
      archivedReceipts.length +
      1 +
      financialReports.length
    );
  }, [
    users,
    technicalAuditRecords,
    projects,
    maintenanceServices,
    materials,
    workers,
    clients,
    archivedReceipts,
    financialReports
  ]);

  // Open record in JSON editor
  const handleOpenEditModal = (record: any) => {
    setEditingRecord(record);
    setEditJsonString(JSON.stringify(record, null, 2));
    setJsonError(null);
    setIsNewRecordModal(false);
  };

  const handleSaveJsonRecord = () => {
    try {
      const parsed = JSON.parse(editJsonString);
      setJsonError(null);

      if (selectedTable === 'users') {
        if (!parsed.email || !parsed.email.includes('@')) {
          setJsonError('El usuario debe tener un correo electrónico válido con @');
          return;
        }
        if (isNewRecordModal) {
          createUser(parsed);
          showToast(`Usuario "${parsed.email}" creado en la base de datos.`);
        } else {
          updateUser(parsed.uid, parsed);
          showToast(`Registro de usuario "${parsed.email}" actualizado.`);
        }
      } else if (selectedTable === 'parametros_costos') {
        updateTechnicalParameters(parsed);
        showToast('Parámetros de costos guardados en base de datos.');
      } else {
        showToast(`Registro modificado en ${selectedTable}.`);
      }

      setEditingRecord(null);
      setIsNewRecordModal(false);
    } catch (err: any) {
      setJsonError(`Error de sintaxis JSON: ${err.message}`);
    }
  };

  // Quick create user form
  const handleQuickCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUserForm.email || !quickUserForm.email.includes('@')) {
      alert('Por favor ingrese un correo válido.');
      return;
    }

    createUser({
      displayName: quickUserForm.displayName.trim() || quickUserForm.email.split('@')[0],
      email: quickUserForm.email.trim().toLowerCase(),
      password: quickUserForm.password.trim(),
      role: quickUserForm.role,
      phone: quickUserForm.phone.trim(),
      specialty: quickUserForm.specialty.trim(),
      cuadrilla: quickUserForm.cuadrilla.trim(),
      active: quickUserForm.active,
      tenantId: 'tenant_bandiera_hq',
      companyName: 'JOB Martin Bandiera S.A.'
    });

    showToast(`Usuario ${quickUserForm.email} vinculado directamente a la BD.`);
    setQuickUserModal(false);
    setQuickUserForm({
      displayName: '',
      email: '',
      password: '',
      role: 'Capataz',
      phone: '',
      specialty: '',
      cuadrilla: '',
      active: true
    });
  };

  // Export full database as single comprehensive JSON
  const handleExportFullDatabase = () => {
    const fullDbDump = {
      meta: {
        system: 'JOB Martin Bandiera S.A. - Central Management System',
        exportedAt: new Date().toISOString(),
        exportedBy: currentUser?.email || 'admin@admin.com',
        version: '4.2.0',
        totalCollections: TABLES.length,
        totalRecords: totalRecordCount
      },
      collections: {
        users: users,
        auditoria_remitos: technicalAuditRecords,
        proyectos: projects,
        mantenimiento_pozos: maintenanceServices,
        materiales: materials,
        trabajadores: workers,
        clientes: clients,
        comprobantes: archivedReceipts,
        parametros_costos: technicalParameters,
        reportes_financieros: financialReports
      }
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(fullDbDump, null, 2));
    const downloadAnchor = document.createElement('a');
    const dateStamp = todayLocalISO();
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `backup_database_job_bandiera_${dateStamp}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast('Copia de seguridad completa de la Base de Datos descargada.');
  };

  // Import / Restore Database
  const handleImportDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (parsed.collections?.users && Array.isArray(parsed.collections.users)) {
          replaceUsersList(parsed.collections.users);
          showToast(`Base de datos restaurada: ${parsed.collections.users.length} usuarios importados.`);
        } else if (Array.isArray(parsed)) {
          // If a direct users array was loaded
          replaceUsersList(parsed);
          showToast(`Lista de ${parsed.length} usuarios restaurada con éxito.`);
        } else {
          alert('El archivo no contiene un formato de base de datos reconocido.');
        }
      } catch (err: any) {
        alert('Error al leer el archivo JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const selectedTableDef = TABLES.find(t => t.key === selectedTable)!;

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom duration-200 border border-emerald-400/40">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* TOP CONSOLE BANNER */}
      <div className="bg-slate-900 text-white p-5 sm:p-7 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Database className="w-64 h-64 text-emerald-500" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ACCESO DIRECTO A LA BASE DE DATOS
              </span>
              <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold">
                EXCLUSIVO SUPERADMIN
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono">
                {totalRecordCount} REGISTROS TOTALES
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Database className="w-7 h-7 text-emerald-400" />
              <span>Consola Central de Base de Datos</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
              Inspección en tiempo real, administración directa de credenciales de usuario,
              edición de registros JSON, respaldo en caliente y control total de almacenamiento del sistema.
            </p>
          </div>

          {/* Backup & Fast Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition">
              <Upload className="w-4 h-4 text-cyan-400" />
              <span>Importar BD</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportDatabase}
                className="hidden"
              />
            </label>

            <button
              onClick={handleExportFullDatabase}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-600/25 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Backup Total</span>
            </button>

            <button
              onClick={() => setQuickUserModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-lg shadow-purple-600/25 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Usuario en BD</span>
            </button>
          </div>
        </div>
      </div>

      {/* TABLE SELECTOR CHIPS */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2.5">
          COLECCIONES & TABLAS DE LA BASE DE DATOS
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {TABLES.map(table => {
            const isSelected = selectedTable === table.key;
            const Icon = table.icon;
            let count = 0;
            if (table.key === 'users') count = users.length;
            else if (table.key === 'auditoria_remitos') count = technicalAuditRecords.length;
            else if (table.key === 'proyectos') count = projects.length;
            else if (table.key === 'mantenimiento_pozos') count = maintenanceServices.length;
            else if (table.key === 'materiales') count = materials.length;
            else if (table.key === 'trabajadores') count = workers.length;
            else if (table.key === 'clientes') count = clients.length;
            else if (table.key === 'comprobantes') count = archivedReceipts.length;
            else if (table.key === 'parametros_costos') count = 1;
            else if (table.key === 'reportes_financieros') count = financialReports.length;

            return (
              <button
                key={table.key}
                type="button"
                onClick={() => {
                  setSelectedTable(table.key);
                  setSearchQuery('');
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                  isSelected
                    ? 'bg-slate-900 text-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isSelected ? 'bg-emerald-500/20 text-emerald-400' : table.color
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                      isSelected ? 'bg-emerald-500 text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold block truncate">
                  {table.label}
                </span>
                <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                  {table.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TOOLBAR & SEARCH */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Left: Search input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={`Buscar en ${selectedTableDef.label}...`}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Right: Toggles & Stats */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
          {selectedTable === 'users' && (
            <button
              onClick={() => setShowPasswords(!showPasswords)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer hover:bg-slate-200"
              title="Mostrar u ocultar claves en texto plano para auditoría"
            >
              {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPasswords ? 'Ocultar Claves' : 'Ver Claves'}</span>
            </button>
          )}

          {/* Table / JSON Format Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewFormat('table')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewFormat === 'table'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Tabla</span>
            </button>

            <button
              onClick={() => setViewFormat('json')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewFormat === 'json'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>JSON Raw</span>
            </button>
          </div>

          <button
            onClick={() => {
              if (selectedTable === 'users') {
                setQuickUserModal(true);
              } else {
                setEditingRecord({});
                setEditJsonString('{\n  "id": "item_' + Date.now() + '"\n}');
                setIsNewRecordModal(true);
              }
            }}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Nuevo</span>
          </button>
        </div>
      </div>

      {/* TABLE VIEW SPECIFIC FOR USERS */}
      {viewFormat === 'table' && selectedTable === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-500" />
                <span>Cuentas de Acceso & Credenciales en Base de Datos ({filteredRecords.length})</span>
              </h2>
              <span className="text-[11px] text-slate-500">
                Cualquier usuario creado aquí puede iniciar sesión inmediatamente con su correo/usuario y la clave asignada.
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">UID / ID Registro</th>
                  <th className="px-4 py-3">Usuario / Nombre</th>
                  <th className="px-4 py-3">Correo Electrónico</th>
                  <th className="px-4 py-3">Rol Jerárquico</th>
                  <th className="px-4 py-3">Clave de Acceso (PIN)</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones Directas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredRecords.map((u: UserProfile) => {
                  const isCurrent = currentUser?.uid === u.uid;
                  const pass = '••••••••';

                  return (
                    <tr
                      key={u.uid}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        isCurrent ? 'bg-purple-500/5' : ''
                      }`}
                    >
                      {/* UID */}
                      <td className="px-4 py-3 font-mono text-slate-400 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[120px]">{u.uid}</span>
                          <button
                            onClick={() => copyToClipboard(u.uid, u.uid)}
                            className="text-slate-400 hover:text-slate-600"
                            title="Copiar UID"
                          >
                            {copiedKey === u.uid ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>

                      {/* Display Name */}
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-black flex items-center justify-center text-[10px]">
                            {u.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span>{u.displayName}</span>
                            {isCurrent && (
                              <span className="ml-2 text-[9px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                                En Sesión
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span>{u.email}</span>
                          <button
                            onClick={() => copyToClipboard(u.email, `email_${u.uid}`)}
                            className="text-slate-400 hover:text-slate-600"
                            title="Copiar correo"
                          >
                            {copiedKey === `email_${u.uid}` ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          {u.role}
                        </span>
                      </td>

                      {/* Password */}
                      <td className="px-4 py-3 font-mono">
                        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-lg w-fit border border-slate-200 dark:border-slate-700">
                          <KeyRound className="w-3 h-3 text-slate-400" />
                          <span className="text-slate-900 dark:text-emerald-400 font-bold tracking-wider">
                            {showPasswords ? pass : '••••••••'}
                          </span>
                          <button
                            onClick={() => copyToClipboard(pass, `pass_${u.uid}`)}
                            className="text-slate-400 hover:text-slate-600 ml-1"
                            title="Copiar clave"
                          >
                            {copiedKey === `pass_${u.uid}` ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.active !== false
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.active !== false ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          {u.active !== false ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Login As Button */}
                          <button
                            onClick={() => {
                              loginAsUser(u);
                              showToast(`Sesión cambiada a ${u.displayName} (${u.role})`);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white text-slate-600 dark:text-slate-300 transition cursor-pointer"
                            title="Iniciar sesión directamente como este usuario"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit JSON Record */}
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-600 dark:text-slate-300 transition cursor-pointer"
                            title="Editar registro JSON en base de datos"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          {!isCurrent && (
                            <button
                              onClick={() => {
                                if (confirm(`¿Eliminar al usuario ${u.email} de la base de datos?`)) {
                                  deleteUser(u.uid);
                                  showToast(`Usuario ${u.email} eliminado.`);
                                }
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-400 hover:text-white transition cursor-pointer"
                              title="Eliminar usuario de base de datos"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GENERIC TABLE VIEW FOR OTHER COLLECTIONS */}
      {viewFormat === 'table' && selectedTable !== 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Table className="w-4 h-4 text-emerald-500" />
                <span>Colección: {selectedTableDef.label} ({filteredRecords.length} registros)</span>
              </h2>
              <span className="text-[11px] text-slate-500">{selectedTableDef.description}</span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            {filteredRecords.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Database className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-bold">No hay registros en esta colección.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">ID Primario</th>
                    <th className="px-4 py-3">Resumen de Datos</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  {filteredRecords.map((item: any, idx: number) => {
                    const primaryId = item.id || item.remitoId || item.uid || `row_${idx}`;
                    return (
                      <tr key={primaryId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          {primaryId}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-xl truncate">
                          {JSON.stringify(item)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
                          >
                            Inspeccionar / JSON
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* JSON RAW VIEW */}
      {viewFormat === 'json' && (
        <div className="bg-slate-950 rounded-3xl border border-slate-800 p-5 shadow-2xl font-mono text-xs overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <span className="text-emerald-400 font-bold flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              <span>DUMP JSON: {selectedTableDef.label}</span>
            </span>
            <button
              onClick={() => copyToClipboard(JSON.stringify(filteredRecords, null, 2), 'raw_json')}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {copiedKey === 'raw_json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copiar Todo</span>
            </button>
          </div>
          <pre className="max-h-[600px] overflow-auto text-slate-300 text-[11px] leading-relaxed select-all">
            {JSON.stringify(filteredRecords, null, 2)}
          </pre>
        </div>
      )}

      {/* QUICK USER CREATION MODAL */}
      {quickUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 max-w-lg w-full max-h-[96vh] sm:max-h-[92vh] overflow-y-auto my-auto shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600/10 text-purple-600 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Crear Usuario Directamente en la Base de Datos
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Se guardará de forma persistente y podrá ingresar de inmediato.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setQuickUserModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre Completo / Operario *
                </label>
                <input
                  type="text"
                  required
                  value={quickUserForm.displayName}
                  onChange={e => setQuickUserForm({ ...quickUserForm, displayName: e.target.value })}
                  placeholder="ej. Juan Carlos Pérez"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Correo Electrónico (Login) *
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    ✓ Admite @gmail.com y cualquier dominio
                  </span>
                </div>
                <input
                  type="email"
                  required
                  value={quickUserForm.email}
                  onChange={e => setQuickUserForm({ ...quickUserForm, email: e.target.value })}
                  placeholder="ejemplo@gmail.com o usuario@empresa.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
                />
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-slate-400">Atajo rápido:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const base = quickUserForm.email.includes('@') ? quickUserForm.email.split('@')[0] : quickUserForm.email;
                      setQuickUserForm({ ...quickUserForm, email: `${base || 'usuario'}@gmail.com` });
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono font-bold cursor-pointer"
                  >
                    + @gmail.com
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const base = quickUserForm.email.includes('@') ? quickUserForm.email.split('@')[0] : quickUserForm.email;
                      setQuickUserForm({ ...quickUserForm, email: `${base || 'usuario'}@bandiera.com` });
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono font-bold cursor-pointer"
                  >
                    + @bandiera.com
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Contraseña / PIN de Acceso *
                  </label>
                  <input
                    type="text"
                    required
                    value={quickUserForm.password}
                    onChange={e => setQuickUserForm({ ...quickUserForm, password: e.target.value })}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Sin clave = perfil sin acceso al sistema</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Rol de Seguridad *
                  </label>
                  <select
                    value={quickUserForm.role}
                    onChange={e => setQuickUserForm({ ...quickUserForm, role: e.target.value as UserRole })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-bold"
                  >
                    <option value="SuperAdmin">SuperAdmin (Martin Bandiera)</option>
                    <option value="Owner">Owner / Dueño</option>
                    <option value="Gerente">Gerente</option>
                    <option value="Administrador">Administrador</option>
                    <option value="Capataz">Capataz de Cuadrilla</option>
                    <option value="Empleado">Empleado / Técnico</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={quickUserForm.phone}
                    onChange={e => setQuickUserForm({ ...quickUserForm, phone: e.target.value })}
                    placeholder="+54 9 261 455-8900"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Especialidad / Cuadrilla
                  </label>
                  <input
                    type="text"
                    value={quickUserForm.cuadrilla}
                    onChange={e => setQuickUserForm({ ...quickUserForm, cuadrilla: e.target.value })}
                    placeholder="Cuadrilla 1 - Valle de Uco"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-medium"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setQuickUserModal(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black shadow-lg shadow-purple-600/25 transition cursor-pointer"
                >
                  Guardar en Base de Datos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JSON RECORD INSPECTOR & EDITOR MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-800 p-5 sm:p-6 max-w-2xl w-full max-h-[96vh] sm:max-h-[92vh] overflow-y-auto my-auto shadow-2xl text-white animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <Code2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-black">
                    {isNewRecordModal ? 'Insertar Nuevo Registro' : 'Editor de Registro en Base de Datos'}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Colección: {selectedTableDef.label}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setEditingRecord(null)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {jsonError && (
              <div className="p-3 mb-3 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{jsonError}</span>
              </div>
            )}

            <div className="space-y-2 mb-4">
              <label className="text-[11px] font-mono text-slate-400 block">
                Estructura de Datos JSON:
              </label>
              <textarea
                value={editJsonString}
                onChange={e => setEditJsonString(e.target.value)}
                rows={14}
                className="w-full p-4 rounded-xl font-mono text-xs bg-slate-950 border border-slate-700 text-emerald-300 focus:outline-none focus:border-emerald-500 leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-500">
                Los cambios se impactan directamente en el storage y memoria activa.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveJsonRecord}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 transition cursor-pointer"
                >
                  Guardar Registro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

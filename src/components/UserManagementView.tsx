import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  UserCheck,
  Phone,
  Mail,
  Briefcase,
  Layers,
  RotateCcw,
  Check,
  X,
  AlertTriangle,
  Lock,
  Eye,
  KeyRound,
  FileCheck2,
  DollarSign,
  Database,
  Copy
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { UserProfile, UserRole, RolePermissions } from '../types';
import { isAdministrativeProfile, normalizeWorkerName } from '../utils/calculationUtils';
import {
  PERMISSION_DEFINITIONS,
  DEFAULT_ROLE_PERMISSIONS,
  getRoleBadgeConfig,
  getEffectivePermissions
} from '../utils/permissionUtils';

const ALL_ROLES: UserRole[] = ['SuperAdmin', 'Owner', 'Gerente', 'Admin', 'Capataz', 'Empleado'];

export const UserManagementView: React.FC = () => {
  const {
    currentUser,
    users,
    createUser,
    updateUser,
    deleteUser,
    changeUserRole,
    toggleUserStatus,
    resetUsersToDefaults,
    loginAsUser,
    isSuperAdmin,
    canManageUsers
  } = useAuth();
  const { workers } = useData();

  const [activeSubTab, setActiveSubTab] = useState<'usuarios' | 'matriz'>('usuarios');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Quick Standalone Permissions Modal State
  const [permissionsModalUser, setPermissionsModalUser] = useState<UserProfile | null>(null);
  const [userPermissionsDraft, setUserPermissionsDraft] = useState<RolePermissions>({
    ...DEFAULT_ROLE_PERMISSIONS.Empleado
  });

  // Modal State for Add / Edit User
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'datos' | 'permisos'>('datos');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    displayName: string;
    email: string;
    phone: string;
    role: UserRole;
    specialty: string;
    cuadrilla: string;
    password: string;
    active: boolean;
    customPermissions: RolePermissions;
  }>({
    displayName: '',
    email: '',
    phone: '',
    role: 'Empleado' as UserRole,
    specialty: '',
    cuadrilla: '',
    password: '',
    active: true,
    customPermissions: { ...DEFAULT_ROLE_PERMISSIONS.Empleado }
  });
  const [formError, setFormError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const search = searchTerm.toLowerCase().trim();
      const normSearch = normalizeWorkerName(searchTerm);
      const normName = normalizeWorkerName(user.displayName);
      const normSpec = normalizeWorkerName(user.specialty);
      const normCuad = normalizeWorkerName(user.cuadrilla);
      const cleanEmail = (user.email || '').toLowerCase().trim();

      const matchSearch =
        !search ||
        normName.includes(normSearch) ||
        (cleanEmail && cleanEmail.includes(search)) ||
        normSpec.includes(normSearch) ||
        normCuad.includes(normSearch) ||
        (user.phone && user.phone.includes(search));

      const matchRole = selectedRoleFilter === 'all' || user.role === selectedRoleFilter;
      const matchStatus =
        selectedStatusFilter === 'all' ||
        (selectedStatusFilter === 'active' && user.active !== false) ||
        (selectedStatusFilter === 'inactive' && user.active === false);

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchTerm, selectedRoleFilter, selectedStatusFilter]);

  // Statistics
  const totalUsers = users.length;
  const adminUsers = users.filter(u => ['SuperAdmin', 'Owner', 'Gerente', 'Admin'].includes(u.role)).length;
  const capatazUsers = users.filter(u => u.role === 'Capataz').length;
  const empleadoUsers = users.filter(u => u.role === 'Empleado').length;
  const activeUsers = users.filter(u => u.active !== false).length;

  const handleOpenCreateModal = () => {
    setModalTab('datos');
    setEditingUserId(null);
    setFormData({
      displayName: '',
      email: '',
      phone: '',
      role: 'Empleado',
      specialty: '',
      cuadrilla: 'Cuadrilla 1 - Valle de Uco',
      password: '',
      active: true,
      customPermissions: { ...DEFAULT_ROLE_PERMISSIONS.Empleado }
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: UserProfile) => {
    setModalTab('datos');
    setEditingUserId(user.uid);
    setFormData({
      displayName: user.displayName,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      specialty: user.specialty || '',
      cuadrilla: user.cuadrilla || '',
      password: user.password || '',
      active: user.active !== false,
      customPermissions: getEffectivePermissions(user)
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenDirectPermissions = (user: UserProfile) => {
    setPermissionsModalUser(user);
    setUserPermissionsDraft(getEffectivePermissions(user));
  };

  const handleSaveDirectPermissions = () => {
    if (!permissionsModalUser) return;
    updateUser(permissionsModalUser.uid, {
      customPermissions: userPermissionsDraft
    });
    showToast(`Permisos personalizados para "${permissionsModalUser.displayName}" actualizados en base de datos.`);
    setPermissionsModalUser(null);
  };

  const handleToggleFormPermission = (key: keyof RolePermissions) => {
    setFormData(prev => ({
      ...prev,
      customPermissions: {
        ...prev.customPermissions,
        [key]: !prev.customPermissions[key]
      }
    }));
  };

  const handleResetFormPermissionsToRole = () => {
    const base = DEFAULT_ROLE_PERMISSIONS[formData.role] || DEFAULT_ROLE_PERMISSIONS.Empleado;
    setFormData(prev => ({
      ...prev,
      customPermissions: { ...base }
    }));
    showToast(`Permisos restablecidos a los valores por defecto del rol ${formData.role}.`);
  };

  const handleSetAllFormPermissions = (value: boolean) => {
    const updated = { ...formData.customPermissions };
    PERMISSION_DEFINITIONS.forEach(p => {
      updated[p.key] = value;
    });
    setFormData(prev => ({
      ...prev,
      customPermissions: updated
    }));
  };

  const handleToggleDraftPermission = (key: keyof RolePermissions) => {
    setUserPermissionsDraft(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleResetDraftPermissionsToRole = () => {
    if (!permissionsModalUser) return;
    const base = DEFAULT_ROLE_PERMISSIONS[permissionsModalUser.role] || DEFAULT_ROLE_PERMISSIONS.Empleado;
    setUserPermissionsDraft({ ...base });
    showToast(`Permisos restablecidos a los valores estándar de ${permissionsModalUser.role}.`);
  };

  const handleSetAllDraftPermissions = (value: boolean) => {
    const updated = { ...userPermissionsDraft };
    PERMISSION_DEFINITIONS.forEach(p => {
      updated[p.key] = value;
    });
    setUserPermissionsDraft(updated);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.displayName.trim()) {
      setFormError('El nombre y apellido es obligatorio.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setFormError('Ingrese un correo electrónico válido.');
      return;
    }

    const isAdmRole = isAdministrativeProfile({ role: formData.role, specialty: formData.specialty });
    const effectivePermissions = formData.role === 'SuperAdmin'
      ? { ...DEFAULT_ROLE_PERMISSIONS.SuperAdmin }
      : formData.customPermissions;

    if (editingUserId) {
      const targetPassword = (formData.password || '').trim();
      updateUser(editingUserId, {
        displayName: formData.displayName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        role: formData.role,
        isAdministrative: isAdmRole,
        category: isAdmRole ? 'Administrativo' : undefined,
        specialty: formData.specialty.trim(),
        cuadrilla: formData.cuadrilla.trim(),
        password: targetPassword,
        active: formData.active,
        customPermissions: effectivePermissions
      });
      showToast(`Usuario "${formData.displayName}" y sus permisos guardados en Firestore.`);
    } else {
      // Check duplicate email or name
      const cleanEmail = formData.email.trim().toLowerCase();
      const normName = normalizeWorkerName(formData.displayName);
      const exists = users.some(
        u => u.email.toLowerCase().trim() === cleanEmail ||
             (normName && normalizeWorkerName(u.displayName) === normName)
      );
      if (exists) {
        setFormError('Ya existe un usuario registrado con este correo electrónico o nombre.');
        return;
      }
      const matchingWorker = workers.find(
        w => (w.email && w.email.toLowerCase().trim() === cleanEmail) ||
             (normName && normalizeWorkerName(w.name) === normName)
      );
      const createdPass = (formData.password || '').trim();
      createUser({
        uid: matchingWorker?.id,
        displayName: formData.displayName.trim(),
        email: cleanEmail,
        phone: formData.phone.trim(),
        role: formData.role,
        isAdministrative: isAdmRole,
        category: isAdmRole ? 'Administrativo' : undefined,
        specialty: formData.specialty.trim(),
        cuadrilla: formData.cuadrilla.trim(),
        password: createdPass,
        active: formData.active,
        customPermissions: effectivePermissions,
        tenantId: 'tenant_bandiera_hq',
        companyName: 'JOB Martin Bandiera S.A.'
      });
      showToast(`Usuario creado en BD con permisos: ${cleanEmail} | Clave: ${createdPass}`);
    }

    setIsModalOpen(false);
  };

  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const handleDeleteUser = async (uid: string) => {
    try {
      setIsDeletingUser(true);
      const res = await deleteUser(uid);
      if (!res.success) {
        showToast(res.message || 'No se puede eliminar este usuario.');
      } else {
        showToast('Usuario eliminado permanentemente del sistema y de la base de datos.');
      }
    } catch (err: any) {
      showToast(`Error al eliminar usuario: ${err?.message || 'Error desconocido'}`);
    } finally {
      setIsDeletingUser(false);
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="text-xs font-bold">{successToast}</span>
        </div>
      )}

      {/* TOP HEADER & ACTIONS */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
              SEGURIDAD & CONTROL DE ACCESOS (RBAC)
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <span>Gestión de Usuarios y Permisos por Roles</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Cree usuarios para su cuadrilla y personal de administración, asigne roles jerárquicos y configure los permisos para cada módulo del sistema.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={resetUsersToDefaults}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            title="Restaurar lista de usuarios predeterminados de demostración"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restaurar Demo</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-600/25 transition cursor-pointer active:scale-98"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ CREAR NUEVO USUARIO</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">TOTAL USUARIOS</span>
          <span className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
            {totalUsers}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">{activeUsers} activos en el sistema</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold text-purple-500 block uppercase">DIRECCIÓN & ADMIN</span>
          <span className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono mt-0.5 block">
            {adminUsers}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">SuperAdmin, Owner, Gerente, Admin</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold text-amber-500 block uppercase">CAPATACES DE OBRA</span>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5 block">
            {capatazUsers}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Jefes de Cuadrilla</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-bold text-slate-500 block uppercase">TÉCNICOS / OPERARIOS</span>
          <span className="text-2xl font-black text-slate-700 dark:text-slate-300 font-mono mt-0.5 block">
            {empleadoUsers}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Personal de campo</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-emerald-500 block uppercase">SESIÓN ACTUAL</span>
          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 truncate block mt-1">
            {currentUser?.displayName || 'SuperAdmin'}
          </span>
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">
            Rol: {currentUser?.role || 'SuperAdmin'}
          </span>
        </div>
      </div>

      {/* SUB-TABS: USUARIOS vs MATRIZ DE PERMISOS */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('usuarios')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
            activeSubTab === 'usuarios'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>LISTADO DE USUARIOS ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('matriz')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
            activeSubTab === 'matriz'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>MATRIZ DE PERMISOS POR ROL</span>
        </button>
      </div>

      {/* TAB 1: LISTADO DE USUARIOS */}
      {activeSubTab === 'usuarios' && (
        <div className="space-y-4">
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, correo, teléfono o especialidad..."
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                <Filter className="w-3.5 h-3.5" />
                <span>Rol:</span>
              </div>
              <select
                value={selectedRoleFilter}
                onChange={e => setSelectedRoleFilter(e.target.value)}
                className="text-xs font-bold py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="all">Todos los Roles</option>
                {ALL_ROLES.map(r => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatusFilter}
                onChange={e => setSelectedStatusFilter(e.target.value)}
                className="text-xs font-bold py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="all">Todos los Estados</option>
                <option value="active">Solo Activos</option>
                <option value="inactive">Solo Inactivos</option>
              </select>
            </div>
          </div>

          {/* USERS TABLE */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-black uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3.5 px-4">Usuario</th>
                    <th className="py-3.5 px-4">Rol Asignado</th>
                    <th className="py-3.5 px-4 text-center">Permisos (RBAC)</th>
                    <th className="py-3.5 px-4">Especialidad / Cuadrilla</th>
                    <th className="py-3.5 px-4">Contacto</th>
                    <th className="py-3.5 px-4">Clave / PIN</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
                    <th className="py-3.5 px-4 text-center">Simular Sesión</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm font-bold">No se encontraron usuarios coincidentes</p>
                        <p className="text-xs mt-0.5">Pruebe ajustando los filtros o cree un nuevo usuario.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(user => {
                      const badge = getRoleBadgeConfig(user.role);
                      const isCurrentSession = currentUser ? user.uid === currentUser.uid : false;

                      return (
                        <tr
                          key={user.uid}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                            isCurrentSession ? 'bg-purple-50/30 dark:bg-purple-950/20' : ''
                          }`}
                        >
                          {/* User Avatar & Name */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white bg-gradient-to-br ${badge.accent} shadow-sm shrink-0`}
                              >
                                {user.displayName.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                                  <span>{user.displayName}</span>
                                  {isCurrentSession && (
                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                                      Tú
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{user.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role Selector */}
                          <td className="py-3.5 px-4">
                            {isSuperAdmin ? (
                              <select
                                value={user.role}
                                onChange={e => changeUserRole(user.uid, e.target.value as UserRole)}
                                className={`text-[11px] font-black py-1 px-2 rounded-lg border cursor-pointer focus:outline-none ${badge.bg} ${badge.text} ${badge.border}`}
                              >
                                {ALL_ROLES.map(r => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${badge.bg} ${badge.text} ${badge.border}`}
                              >
                                {badge.label}
                              </span>
                            )}
                          </td>

                          {/* Granular Permissions (RBAC) */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {(() => {
                              const eff = getEffectivePermissions(user);
                              const activeCount = Object.values(eff).filter(Boolean).length;
                              const hasCustom = Boolean(user.customPermissions && Object.keys(user.customPermissions).length > 0);

                              return (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDirectPermissions(user)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black border transition cursor-pointer ${
                                    hasCustom
                                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800 hover:bg-purple-200'
                                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                                  }`}
                                  title="Haga clic para editar y personalizar los permisos de este usuario más allá del rol"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                  <span>{hasCustom ? `Personalizado (${activeCount}/14)` : `Por Rol (${activeCount}/14)`}</span>
                                </button>
                              );
                            })()}
                          </td>

                          {/* Specialty / Crew */}
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-xs">
                              {user.specialty || 'General'}
                            </div>
                            {user.cuadrilla && (
                              <div className="text-[10px] text-slate-400 truncate">
                                {user.cuadrilla}
                              </div>
                            )}
                          </td>

                          {/* Contact */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {user.phone ? (
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{user.phone}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          {/* Credentials / Key */}
                          <td className="py-3.5 px-4 font-mono text-[11px]">
                            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg w-fit border border-slate-200 dark:border-slate-700">
                              <KeyRound className="w-3 h-3 text-slate-400" />
                              <span className="font-bold text-slate-800 dark:text-emerald-400">
                                {'••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  showToast('Las claves no se pueden ver. Para cambiarla, edite el usuario.');
                                }}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-white ml-1 cursor-pointer"
                                title="Copiar clave"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => toggleUserStatus(user.uid)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black cursor-pointer transition ${
                                user.active !== false
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 hover:bg-emerald-200'
                                  : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 hover:bg-rose-200'
                              }`}
                              title="Haga clic para alternar estado Activo / Inactivo"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  user.active !== false ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                                }`}
                              />
                              <span>{user.active !== false ? 'Activo' : 'Inactivo'}</span>
                            </button>
                          </td>

                          {/* Quick Switch */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                loginAsUser(user);
                                showToast(`Sesión cambiada a ${user.displayName} (${user.role})`);
                              }}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                                isCurrentSession
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 cursor-default'
                                  : 'bg-slate-100 hover:bg-purple-600 hover:text-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                              title={`Cambiar a sesión de ${user.displayName} para probar permisos de ${user.role}`}
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>{isCurrentSession ? 'En uso' : 'Probar'}</span>
                            </button>
                          </td>

                          {/* Actions: Permissions, Edit & Delete */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Granular Permissions Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenDirectPermissions(user)}
                                className="p-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition cursor-pointer"
                                title="Configurar permisos granulares para este usuario"
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(user)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                title="Editar datos del usuario"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {/* Delete button (protected only for root admin admin@admin.com) */}
                              {(user.email || '').toLowerCase().trim() !== 'admin@admin.com' && (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(user.uid)}
                                  className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                  title={`Eliminar usuario "${user.displayName}"`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MATRIZ DE PERMISOS POR ROL */}
      {activeSubTab === 'matriz' && (
        <div className="space-y-6">
          {/* Roles Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {ALL_ROLES.map(role => {
              const cfg = getRoleBadgeConfig(role);
              const count = users.filter(u => u.role === role).length;

              return (
                <div
                  key={role}
                  className={`p-4 rounded-2xl border ${cfg.border} bg-white dark:bg-slate-900 shadow-sm space-y-1.5`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-400">{count} u.</span>
                  </div>
                  <h4 className="font-black text-slate-900 dark:text-white text-xs">{cfg.title}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    {cfg.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Detailed Permission Matrix Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span>Matriz Comparativa de Capacidades por Rol</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visualice de manera transparente qué módulos y acciones están permitidos para cada tipo de cuenta en la empresa.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-black uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3.5 px-4 w-72">Módulo o Función del Sistema</th>
                    <th className="py-3.5 px-4">Categoría</th>
                    {ALL_ROLES.map(role => {
                      const cfg = getRoleBadgeConfig(role);
                      return (
                        <th key={role} className="py-3.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black ${cfg.bg} ${cfg.text}`}>
                            {cfg.label}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {PERMISSION_DEFINITIONS.map(perm => (
                    <tr key={perm.key} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{perm.label}</div>
                        <div className="text-[11px] text-slate-400 leading-snug">{perm.description}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {perm.category}
                        </span>
                      </td>

                      {/* Checkboxes for each role */}
                      {ALL_ROLES.map(role => {
                        const isAllowed = DEFAULT_ROLE_PERMISSIONS[role][perm.key];
                        return (
                          <td key={role} className="py-3.5 px-3 text-center">
                            {isAllowed ? (
                              <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-300 dark:border-emerald-800">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 flex items-center justify-center mx-auto">
                                <X className="w-3.5 h-3.5 stroke-[2]" />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREAR / EDITAR USUARIO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl relative max-h-[96vh] sm:max-h-[92vh] overflow-y-auto my-auto">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute right-5 top-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-start gap-3.5 mb-5">
              <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 shrink-0">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  {editingUserId ? 'ACTUALIZAR CUENTA' : 'NUEVO USUARIO'}
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  {editingUserId ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Complete los datos de la cuenta y asigne el rol de seguridad correspondiente.
                </p>
              </div>
            </div>

            {/* Tab selector for Add / Edit User */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setModalTab('datos')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 ${
                  modalTab === 'datos'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>1. Datos de Cuenta</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('permisos')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 ${
                  modalTab === 'permisos'
                    ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>2. Permisos Granulares ({Object.values(formData.customPermissions).filter(Boolean).length}/14)</span>
              </button>
            </div>

            {/* Form Error */}
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              {modalTab === 'datos' ? (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nombre Completo y Apellido *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.displayName}
                      onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                      placeholder="ej. Daniel Bandiera o Ing. Matías Calderón"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-bold text-slate-700 dark:text-slate-300">
                          Correo Electrónico *
                        </label>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                          ✓ Admite @gmail.com
                        </span>
                      </div>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder="ejemplo@gmail.com o usuario@empresa.com"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-purple-500"
                      />
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[10px] text-slate-400">Atajo:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const base = formData.email.includes('@') ? formData.email.split('@')[0] : formData.email;
                            setFormData({ ...formData, email: `${base || 'usuario'}@gmail.com` });
                          }}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono font-bold cursor-pointer"
                        >
                          + @gmail.com
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const base = formData.email.includes('@') ? formData.email.split('@')[0] : formData.email;
                            setFormData({ ...formData, email: `${base || 'usuario'}@bandiera.com` });
                          }}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono font-bold cursor-pointer"
                        >
                          + @bandiera.com
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Teléfono / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+54 9 261 455-8900"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  {/* Role Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">
                        Rol y Jerarquía de Seguridad *
                      </label>
                      <button
                        type="button"
                        onClick={handleResetFormPermissionsToRole}
                        className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-bold"
                      >
                        Sincronizar permisos con este rol
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {ALL_ROLES.map(role => {
                        const cfg = getRoleBadgeConfig(role);
                        const isSelected = formData.role === role;

                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                role,
                                customPermissions: { ...DEFAULT_ROLE_PERMISSIONS[role] }
                              }));
                            }}
                            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                              isSelected
                                ? `${cfg.border} ${cfg.bg} ring-2 ring-purple-500`
                                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <span className={`text-[10px] font-black uppercase block ${cfg.text}`}>
                              {cfg.label}
                            </span>
                            <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                              {cfg.title}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {isAdministrativeProfile({ role: formData.role, specialty: formData.specialty }) && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-900 dark:text-blue-200 text-[11px] flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span><strong>Perfil Administrativo / Oficina:</strong> Este usuario no figurará en la lista de operarios ni ayudantes de los Reportes de Campo, manteniendo los remitos limpios y exclusivos para personal operativo.</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Especialidad / Puesto
                      </label>
                      <input
                        type="text"
                        value={formData.specialty}
                        onChange={e => setFormData({ ...formData, specialty: e.target.value })}
                        placeholder="ej. Mantenimiento Bombas / Media Tensión"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Cuadrilla / Sector
                      </label>
                      <input
                        type="text"
                        value={formData.cuadrilla}
                        onChange={e => setFormData({ ...formData, cuadrilla: e.target.value })}
                        placeholder="ej. Cuadrilla 1 - Valle de Uco"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-slate-700 dark:text-slate-300">
                        Nueva clave de acceso (mín. 8 caracteres)
                      </label>
                      <span className="text-[10px] text-slate-400">
                        Vacío = no cambiar
                      </span>
                    </div>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Dejar vacío para no cambiar"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500 font-bold"
                      />
                    </div>
                  </div>

                  {/* Active Switch */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">
                        Estado de la Cuenta
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        Los usuarios inactivos no pueden ingresar al sistema.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, active: !formData.active })}
                      className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                        formData.active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          formData.active ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </>
              ) : (
                /* Tab 2: Granular Permissions List */
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-xl">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        Permisos individuales para este usuario
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Puede activar o desactivar cualquier permiso sin cambiar el rol base ({formData.role}).
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleResetFormPermissionsToRole}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] hover:bg-slate-50 transition cursor-pointer"
                      >
                        Reset a {formData.role}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllFormPermissions(true)}
                        className="px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] hover:bg-emerald-200 transition cursor-pointer"
                      >
                        Todos SÍ
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllFormPermissions(false)}
                        className="px-2 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-bold text-[10px] hover:bg-rose-200 transition cursor-pointer"
                      >
                        Todos NO
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {PERMISSION_DEFINITIONS.map(perm => {
                      const isGranted = Boolean(formData.customPermissions[perm.key]);

                      return (
                        <div
                          key={perm.key}
                          onClick={() => handleToggleFormPermission(perm.key)}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                            isGranted
                              ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/80 hover:bg-purple-50'
                              : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                isGranted
                                  ? 'bg-purple-600 text-white shadow-xs'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                              }`}
                            >
                              {isGranted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <X className="w-3.5 h-3.5" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {perm.label}
                                </span>
                                <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                  {perm.category}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {perm.description}
                              </p>
                            </div>
                          </div>

                          <div
                            className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
                              isGranted ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          >
                            <div
                              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                                isGranted ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-600/20 transition cursor-pointer active:scale-98"
                >
                  {editingUserId ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE DIALOG */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl text-center space-y-4 max-h-[96vh] sm:max-h-[92vh] overflow-y-auto my-auto">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-800">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                ¿Eliminar este usuario?
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Esta acción removerá el perfil y sus credenciales de acceso al sistema.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={() => handleDeleteUser(deleteConfirmId)}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 transition cursor-pointer"
              >
                {isDeletingUser ? 'Eliminando...' : 'Confirmar Eliminación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STANDALONE PERMISSIONS MODAL (RBAC) */}
      {permissionsModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl relative max-h-[96vh] sm:max-h-[92vh] overflow-y-auto my-auto space-y-5">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setPermissionsModalUser(null)}
              className="absolute right-5 top-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  MATRIZ DE PERMISOS GRANULARES (RBAC)
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                  <span>{permissionsModalUser.displayName}</span>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${getRoleBadgeConfig(permissionsModalUser.role).border} ${getRoleBadgeConfig(permissionsModalUser.role).bg} ${getRoleBadgeConfig(permissionsModalUser.role).text}`}>
                    {permissionsModalUser.role}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Ajuste qué acciones y módulos específicos puede ver, editar o administrar este usuario en tiempo real.
                </p>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Total habilitados:
                </span>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                  {Object.values(userPermissionsDraft).filter(Boolean).length} / 14
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetDraftPermissionsToRole}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                >
                  Restablecer a {permissionsModalUser.role}
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllDraftPermissions(true)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-xs hover:bg-emerald-200 transition cursor-pointer"
                >
                  Conceder Todo
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllDraftPermissions(false)}
                  className="px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-bold text-xs hover:bg-rose-200 transition cursor-pointer"
                >
                  Denegar Todo
                </button>
              </div>
            </div>

            {/* Permissions Grid */}
            <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
              {PERMISSION_DEFINITIONS.map(perm => {
                const isGranted = Boolean(userPermissionsDraft[perm.key]);

                return (
                  <div
                    key={perm.key}
                    onClick={() => handleToggleDraftPermission(perm.key)}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition select-none ${
                      isGranted
                        ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/80 shadow-2xs'
                        : 'bg-slate-50/40 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isGranted
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                        }`}
                      >
                        {isGranted ? <Check className="w-4 h-4 stroke-[3]" /> : <X className="w-4 h-4 stroke-[2]" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-xs text-slate-900 dark:text-white">
                            {perm.label}
                          </span>
                          <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {perm.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          {perm.description}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
                        isGranted ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <div
                        className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${
                          isGranted ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPermissionsModalUser(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveDirectPermissions}
                className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-600/20 transition cursor-pointer active:scale-98 flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Guardar Permisos en Base de Datos</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

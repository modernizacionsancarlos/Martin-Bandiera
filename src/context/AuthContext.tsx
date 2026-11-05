import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { UserProfile, UserRole, RolePermissions } from '../types';
import { INITIAL_USERS, ADMIN_PERMISSIONS, SUPERADMIN_PERMISSIONS } from '../data/initialData';
import { getEffectivePermissions, DEFAULT_ROLE_PERMISSIONS } from '../utils/permissionUtils';
import { isAuthorizedWorkerOrStaff, normalizeWorkerName } from '../utils/calculationUtils';
import {
  subscribeUsers,
  saveUserToFirestore,
  saveWorkerToFirestore,
  saveUsersBatchToFirestore,
  deleteUserFromFirestore,
  subscribeDeletedUsers,
  unmarkUserAsDeletedInFirestore
} from '../services/firestoreSync';
import { supabase } from '../services/supabase';
import { pendingWriteCount } from '../services/docstore';
import { todayLocalISO } from '../utils/dateUtils';

interface AuthAccount {
  userId: string;
  email: string;
  role: UserRole;
  profileUid: string | null;
  // Name from the account's own users doc: field roles cannot load the users list.
  displayName?: string;
}

export interface FirebaseConnectionConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  connected: boolean;
  statusMessage: string;
}

interface AuthContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  users: UserProfile[];
  availableUsers: UserProfile[];
  loginAsUser: (user: UserProfile) => void;
  isPreviewingOtherUser: boolean;
  exitPreview: () => void;
  loginWithCredentials: (identifier: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  authReady: boolean;
  
  // User Management CRUD
  createUser: (userData: Omit<UserProfile, 'uid'> & { uid?: string }) => UserProfile;
  updateUser: (uid: string, updates: Partial<UserProfile>) => void;
  deleteUser: (uid: string) => Promise<{ success: boolean; message?: string }> | { success: boolean; message?: string };
  changeUserRole: (uid: string, newRole: UserRole) => void;
  toggleUserStatus: (uid: string) => void;
  resetUsersToDefaults: () => void;
  replaceUsersList: (newUsers: UserProfile[]) => void;

  // Role Checks
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  isGerente: boolean;
  isCapataz: boolean;
  isEmpleado: boolean;

  // Granular Permissions
  permissions: RolePermissions;
  canViewDashboard: boolean;
  canViewFinancials: boolean;
  canManageAudits: boolean;
  canManageBilling: boolean;
  canManageCollections: boolean;
  canManageLiquidations: boolean;
  canManageClients: boolean;
  canManageProjects: boolean;
  canManageMaterials: boolean;
  canManageVehicles: boolean;
  canManageFixedCosts: boolean;
  canManageUsers: boolean;
  canResetSystem: boolean;
  canExportExcel: boolean;
  canCreateRemito: boolean;

  // Firebase state
  firebaseConfig: FirebaseConnectionConfig;
  updateFirebaseConfig: (cfg: Partial<FirebaseConnectionConfig>) => void;
  testFirebaseConnection: () => Promise<boolean>;
}

const DEFAULT_FIREBASE_CONFIG: FirebaseConnectionConfig = {
  // Legacy panel only. Data now lives in Supabase; no Firebase keys ship to the browser.
  apiKey: '',
  authDomain: '',
  projectId: 'supabase',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
  connected: true,
  statusMessage: 'Conectado a la base de datos en la nube (Supabase)'
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'job_martin_bandiera_auth_user_v4';
const AUTH_ACCOUNT_CACHE_KEY = 'bandiera_auth_account_v1';
const USERS_STORAGE_KEY = 'job_martin_bandiera_users_list_v4';
const FIREBASE_CONFIG_KEY = 'job_martin_bandiera_firebase_config';
export const DELETED_USERS_STORAGE_KEY = 'job_martin_bandiera_deleted_users_v1';

const ALL_STORAGE_KEYS = [
  'job_martin_bandiera_users_list_v4',
  'job_martin_bandiera_users_list_v3',
  'job_martin_bandiera_users_list_v2',
  'job_martin_bandiera_users_list',
  'bandiera_users'
];

export const CANONICAL_PROTECTED_EMAILS = new Set([
  'admin@admin.com'
]);

export const CANONICAL_PROTECTED_UIDS = new Set([
  'usr_super_01'
]);

export function getDeletedUsersTombstone(): { uids: Set<string>; emails: Set<string>; names: Set<string> } {
  const uids = new Set<string>();
  const emails = new Set<string>();
  const names = new Set<string>();
  try {
    const raw = localStorage.getItem(DELETED_USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.uids)) {
        parsed.uids.forEach((id: string) => {
          if (id && !CANONICAL_PROTECTED_UIDS.has(id)) uids.add(id);
        });
      }
      if (Array.isArray(parsed.emails)) {
        parsed.emails.forEach((em: string) => {
          const clean = em ? em.toLowerCase().trim() : '';
          if (clean && !CANONICAL_PROTECTED_EMAILS.has(clean)) emails.add(clean);
        });
      }
      if (Array.isArray(parsed.names)) {
        parsed.names.forEach((nm: string) => {
          const clean = nm ? normalizeWorkerName(nm) : '';
          if (clean) names.add(clean);
        });
      }
    }
  } catch {}
  return { uids, emails, names };
}

export function recordDeletedUserLocally(uid?: string, email?: string, name?: string) {
  try {
    const { uids, emails, names } = getDeletedUsersTombstone();
    if (uid && !CANONICAL_PROTECTED_UIDS.has(uid)) uids.add(uid);
    const cleanEmail = (email || '').toLowerCase().trim();
    if (cleanEmail && !CANONICAL_PROTECTED_EMAILS.has(cleanEmail)) emails.add(cleanEmail);
    const normName = normalizeWorkerName(name);
    if (normName) names.add(normName);

    localStorage.setItem(
      DELETED_USERS_STORAGE_KEY,
      JSON.stringify({ uids: Array.from(uids), emails: Array.from(emails), names: Array.from(names) })
    );

    // Clean from all user storage keys
    ALL_STORAGE_KEYS.forEach(key => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((u: any) => {
              if (!u) return false;
              if (uid && u.uid === uid) return false;
              if (cleanEmail && (u.email || '').toLowerCase().trim() === cleanEmail) return false;
              if (normName && normalizeWorkerName(u.displayName || u.name) === normName) return false;
              return true;
            });
            localStorage.setItem(key, JSON.stringify(filtered));
          }
        }
      } catch {}
    });

    // Clean from sessionStorage
    try {
      const raw = sessionStorage.getItem(USERS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((u: any) => {
            if (!u) return false;
            if (uid && u.uid === uid) return false;
            if (cleanEmail && (u.email || '').toLowerCase().trim() === cleanEmail) return false;
            if (normName && normalizeWorkerName(u.displayName || u.name) === normName) return false;
            return true;
          });
          sessionStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(filtered));
        }
      }
    } catch {}

    // Clean from workers local cache as well
    try {
      const workerKeys = [
        'job_martin_bandiera_master_dataset_v1_workers',
        'job_martin_bandiera_db_v4_workers',
        'job_martin_bandiera_workers',
        'bandiera_workers',
        'job_bandiera_prod_v2_workers'
      ];
      workerKeys.forEach(wKey => {
        const raw = localStorage.getItem(wKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((w: any) => {
              if (!w) return false;
              if (uid && w.id === uid) return false;
              if (cleanEmail && (w.email || '').toLowerCase().trim() === cleanEmail) return false;
              if (normName && normalizeWorkerName(w.name) === normName) return false;
              return true;
            });
            localStorage.setItem(wKey, JSON.stringify(filtered));
          }
        }
      });
    } catch {}
  } catch {}
}

export function unmarkUserAsDeletedLocally(uid?: string, email?: string, name?: string) {
  try {
    const { uids, emails, names } = getDeletedUsersTombstone();
    if (uid) uids.delete(uid);
    const cleanEmail = (email || '').toLowerCase().trim();
    if (cleanEmail) emails.delete(cleanEmail);
    const normName = normalizeWorkerName(name);
    if (normName) names.delete(normName);
    localStorage.setItem(
      DELETED_USERS_STORAGE_KEY,
      JSON.stringify({ uids: Array.from(uids), emails: Array.from(emails), names: Array.from(names) })
    );
  } catch {}
}

// Helper to aggregate and recover users, strictly respecting deleted tombstone
function loadAllPersistedUsers(): UserProfile[] {
  const { uids: deletedUids, emails: deletedEmails, names: deletedNames } = getDeletedUsersTombstone();
  const map = new Map<string, UserProfile>();

  // 1. Always load canonical users (respecting tombstone by id, email, and normalized name)
  INITIAL_USERS.forEach(u => {
    const em = u.email.toLowerCase().trim();
    const norm = normalizeWorkerName(u.displayName);
    if (!deletedUids.has(u.uid) && !deletedEmails.has(em) && !deletedNames.has(norm)) {
      map.set(u.uid, u);
    }
  });

  // 2. Scan storage keys from oldest to newest, respecting tombstone and authorized staff/workers
  for (let i = ALL_STORAGE_KEYS.length - 1; i >= 0; i--) {
    const key = ALL_STORAGE_KEYS[i];
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((u: UserProfile) => {
            if (u && (u.uid || u.email)) {
              const email = (u.email || '').toLowerCase().trim();
              const norm = normalizeWorkerName(u.displayName);
              const uid = u.uid || email;
              if (
                !deletedUids.has(u.uid) &&
                !deletedEmails.has(email) &&
                !deletedNames.has(norm) &&
                isAuthorizedWorkerOrStaff(u)
              ) {
                const prev = map.get(uid) || (email ? Array.from(map.values()).find(x => x.email.toLowerCase() === email) : undefined);
                map.set(uid, {
                  ...(prev || {}),
                  ...u,
                  uid: uid,
                  email: email || prev?.email || '',
                  password: (u.password && u.password.trim()) || (prev?.password) || '',
                  active: u.active !== undefined ? u.active : true
                });
              }
            }
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Ensure canonical initial users are present only if not explicitly deleted
  INITIAL_USERS.forEach(u => {
    const em = u.email.toLowerCase().trim();
    const norm = normalizeWorkerName(u.displayName);
    if (!deletedUids.has(u.uid) && !deletedEmails.has(em) && !deletedNames.has(norm) && !map.has(u.uid)) {
      map.set(u.uid, u);
    }
  });

  // Guarantee canonical admin users are present and correctly configured
  // 1. Juan Pablo (SuperAdmin)
  if (!deletedEmails.has('admin@admin.com') && !deletedUids.has('usr_super_01')) {
    const existingAdmin = map.get('usr_super_01') || map.get('admin@admin.com');
    map.set('usr_super_01', {
      ...(existingAdmin || {}),
      uid: 'usr_super_01',
      email: 'admin@admin.com',
      displayName: 'Juan Pablo',
      role: 'SuperAdmin',
      category: 'Administrativo',
      isAdministrative: true,
      password: existingAdmin?.password || 'admin',
      tenantId: existingAdmin?.tenantId || 'tenant_bandiera_hq',
      companyName: 'JOB Martin Bandiera S.A.',
      phone: '+54 9 2622 50-5195',
      specialty: 'Dirección General & Consultoría de Obras',
      cuadrilla: 'Dirección Ejecutiva',
      active: true,
      customPermissions: { ...SUPERADMIN_PERMISSIONS }
    });
  }

  // 2. Martin Bandiera (SuperAdmin)
  if (!deletedEmails.has('martin@iipsa.com.ar') && !deletedUids.has('usr_super_alias')) {
    const existingMartin = map.get('usr_super_alias') || map.get('martin@iipsa.com.ar');
    map.set('usr_super_alias', {
      ...(existingMartin || {}),
      uid: 'usr_super_alias',
      email: 'martin@iipsa.com.ar',
      displayName: 'Martin Bandiera',
      role: 'SuperAdmin',
      category: 'Administrativo',
      isAdministrative: true,
      password: existingMartin?.password || '',
      tenantId: existingMartin?.tenantId || 'tenant_bandiera_hq',
      companyName: 'JOB Martin Bandiera S.A.',
      phone: '+54 9 2622 50-5195',
      specialty: 'Dirección General & Consultoría de Obras',
      cuadrilla: 'Dirección Ejecutiva',
      active: true,
      customPermissions: { ...SUPERADMIN_PERMISSIONS }
    });
  }

  // 3. Gastón Villalobos (Admin)
  if (!deletedEmails.has('gastonvillalobos2019@gmail.com') && !deletedUids.has('usr_adm_gaston')) {
    const existingGaston = map.get('usr_adm_gaston') || map.get('gastonvillalobos2019@gmail.com');
    map.set('usr_adm_gaston', {
      ...(existingGaston || {}),
      uid: 'usr_adm_gaston',
      email: 'gastonvillalobos2019@gmail.com',
      displayName: 'Gastón Villalobos (Administración)',
      role: 'Admin',
      category: 'Administrativo',
      isAdministrative: true,
      password: existingGaston?.password || '',
      tenantId: existingGaston?.tenantId || 'tenant_bandiera_hq',
      companyName: 'JOB Martin Bandiera S.A.',
      phone: '+54 9 261 330-1127',
      specialty: 'Logística, Operaciones y Flota',
      cuadrilla: 'Administración Central',
      active: true,
      customPermissions: {
        ...ADMIN_PERMISSIONS,
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
      }
    });
  }

  // 4. Romina (Admin)
  if (!deletedEmails.has('rominabromeo@yahoo.com.ar') && !deletedUids.has('usr_adm_romina')) {
    const existingRomina = map.get('usr_adm_romina') || map.get('rominabromeo@yahoo.com.ar');
    map.set('usr_adm_romina', {
      ...(existingRomina || {}),
      uid: 'usr_adm_romina',
      email: 'rominabromeo@yahoo.com.ar',
      displayName: 'Romina (Administración)',
      role: 'Admin',
      category: 'Administrativo',
      isAdministrative: true,
      password: existingRomina?.password || '',
      tenantId: existingRomina?.tenantId || 'tenant_bandiera_hq',
      companyName: 'JOB Martin Bandiera S.A.',
      phone: '+54 9 261 411-2288',
      specialty: 'Facturación, Remitos y Cobranzas',
      cuadrilla: 'Administración Central',
      active: true,
      customPermissions: {
        ...ADMIN_PERMISSIONS,
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
      }
    });
  }

  // Ensure WRK-14 worker does not conflict with Gastón's admin profile
  if (map.has('WRK-14')) {
    const wrk14 = map.get('WRK-14')!;
    if (wrk14.email === 'gastonvillalobos2019@gmail.com') {
      wrk14.email = 'cgv@bandiera.com';
    }
  }

  const list = Array.from(map.values());
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(list));
  } catch {}
  return list;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Users List (loaded from all versions & merged)
  const [users, setUsers] = useState<UserProfile[]>(() => {
    return loadAllPersistedUsers();
  });

  // 2. Current User & Authentication Status
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authAccount, setAuthAccount] = useState<AuthAccount | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // 3. Firebase Config
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConnectionConfig>(() => {
    try {
      const saved = localStorage.getItem(FIREBASE_CONFIG_KEY);
      if (saved) {
        return { ...DEFAULT_FIREBASE_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_FIREBASE_CONFIG;
  });

  // 4. Real-time Firestore Users Subscription
  useEffect(() => {
    let isMounted = true;

    // A. Keep deleted users tombstone synchronized in real-time
    const unsubscribeDeleted = subscribeDeletedUsers(deletedData => {
      if (!isMounted) return;
      if (deletedData && (deletedData.uids.length > 0 || deletedData.emails.length > 0 || (deletedData.names && deletedData.names.length > 0))) {
        const { uids: localUids, emails: localEmails, names: localNames } = getDeletedUsersTombstone();
        deletedData.uids.forEach(id => id && localUids.add(id));
        deletedData.emails.forEach(em => em && localEmails.add(em.toLowerCase().trim()));
        if (Array.isArray(deletedData.names)) {
          deletedData.names.forEach(nm => {
            const clean = nm ? normalizeWorkerName(nm) : '';
            if (clean) localNames.add(clean);
          });
        }
        try {
          localStorage.setItem(
            DELETED_USERS_STORAGE_KEY,
            JSON.stringify({ uids: Array.from(localUids), emails: Array.from(localEmails), names: Array.from(localNames) })
          );
        } catch {}

        // Immediately purge deleted users from current memory state
        setUsers(prev => {
          const filtered = prev.filter(u => {
            const em = (u.email || '').toLowerCase().trim();
            const norm = normalizeWorkerName(u.displayName);
            return !localUids.has(u.uid) && !localEmails.has(em) && !localNames.has(norm);
          });
          try {
            localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(filtered));
          } catch {}
          return filtered;
        });
      }
    });

    // B. Real-time subscription to Firestore users collection
    const unsubscribeUsers = subscribeUsers(remoteUsers => {
      if (!isMounted) return;
      const { uids: deletedUids, emails: deletedEmails, names: deletedNames } = getDeletedUsersTombstone();

      // Case 1: Firestore has users stored (normal cloud-authoritative operation)
      const validUsersMap = new Map<string, UserProfile>();

      if (remoteUsers && remoteUsers.length > 0) {
        // Cloud-authoritative: populate strictly from live Firestore state
        remoteUsers.forEach(u => {
          if (!u || !u.email) return;
          const em = u.email.toLowerCase().trim();
          const norm = normalizeWorkerName(u.displayName);
          if (deletedUids.has(u.uid) || (em && deletedEmails.has(em)) || (norm && deletedNames.has(norm))) return;
          if (!isAuthorizedWorkerOrStaff(u)) return;

          const key = u.uid || em;
          validUsersMap.set(key, u);
        });
      } else {
        // Fallback only if Firestore is completely empty
        INITIAL_USERS.forEach(u => {
          const em = u.email.toLowerCase().trim();
          const norm = normalizeWorkerName(u.displayName);
          if (!deletedUids.has(u.uid) && !deletedEmails.has(em) && !deletedNames.has(norm)) {
            validUsersMap.set(u.uid, u);
          }
        });
      }

      // Always guarantee canonical admins are present with full configuration
      // 1. Juan Pablo (SuperAdmin)
      const adminSuper = validUsersMap.get('usr_super_01') || INITIAL_USERS[0];
      validUsersMap.set('usr_super_01', {
        ...adminSuper,
        uid: 'usr_super_01',
        email: 'admin@admin.com',
        displayName: 'Juan Pablo',
        role: 'SuperAdmin',
        category: 'Administrativo',
        isAdministrative: true,
        password: adminSuper.password || 'admin',
        tenantId: adminSuper.tenantId || 'tenant_bandiera_hq',
        companyName: 'JOB Martin Bandiera S.A.',
        phone: '+54 9 2622 50-5195',
        specialty: 'Dirección General & Consultoría de Obras',
        cuadrilla: 'Dirección Ejecutiva',
        active: true,
        customPermissions: { ...SUPERADMIN_PERMISSIONS }
      });

      // 2. Martin Bandiera (SuperAdmin)
      const martinUser = validUsersMap.get('usr_super_alias') ||
                         Array.from(validUsersMap.values()).find(u => (u.email || '').toLowerCase().trim() === 'martin@iipsa.com.ar') ||
                         INITIAL_USERS.find(u => u.uid === 'usr_super_alias')!;
      if (martinUser) {
        validUsersMap.set('usr_super_alias', {
          ...martinUser,
          uid: 'usr_super_alias',
          email: 'martin@iipsa.com.ar',
          displayName: 'Martin Bandiera',
          role: 'SuperAdmin',
          category: 'Administrativo',
          isAdministrative: true,
          active: true,
          customPermissions: { ...SUPERADMIN_PERMISSIONS }
        });
      }

      // 3. Gastón Villalobos (Admin)
      const gastonUser = validUsersMap.get('usr_adm_gaston') ||
                         Array.from(validUsersMap.values()).find(u => (u.email || '').toLowerCase().trim() === 'gastonvillalobos2019@gmail.com') ||
                         INITIAL_USERS.find(u => u.uid === 'usr_adm_gaston')!;
      if (gastonUser) {
        validUsersMap.set('usr_adm_gaston', {
          ...gastonUser,
          uid: 'usr_adm_gaston',
          email: 'gastonvillalobos2019@gmail.com',
          displayName: 'Gastón Villalobos (Administración)',
          role: 'Admin',
          category: 'Administrativo',
          isAdministrative: true,
          specialty: 'Logística, Operaciones y Flota',
          cuadrilla: 'Administración Central',
          active: true,
          password: gastonUser.password || '',
          customPermissions: {
            ...ADMIN_PERMISSIONS,
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
          }
        });
      }

      // 4. Romina (Admin)
      const rominaUser = validUsersMap.get('usr_adm_romina') ||
                         Array.from(validUsersMap.values()).find(u => (u.email || '').toLowerCase().trim() === 'rominabromeo@yahoo.com.ar') ||
                         INITIAL_USERS.find(u => u.uid === 'usr_adm_romina')!;
      if (rominaUser) {
        validUsersMap.set('usr_adm_romina', {
          ...rominaUser,
          uid: 'usr_adm_romina',
          email: 'rominabromeo@yahoo.com.ar',
          displayName: 'Romina (Administración)',
          role: 'Admin',
          category: 'Administrativo',
          isAdministrative: true,
          active: true,
          password: rominaUser.password || '',
          customPermissions: {
            ...ADMIN_PERMISSIONS,
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
          }
        });
      }

      const validUsers = Array.from(validUsersMap.values());

      setUsers(validUsers);
      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(validUsers));
      } catch {}

    });

    return () => {
      isMounted = false;
      unsubscribeDeleted();
      unsubscribeUsers();
    };
  }, []);

  // Persist Users locally whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch {
      // ignore
    }
  }, [users]);

  // Session -> authoritative account (role comes only from app_roles in Supabase)
  // Last verified account, so field users stay signed in without signal.
  // Data access is still enforced by RLS once the device is back online.
  const readCachedAccount = (): AuthAccount | null => {
    try {
      const raw = localStorage.getItem(AUTH_ACCOUNT_CACHE_KEY);
      const hasStoredSession = Object.keys(localStorage).some(k => /^sb-.*-auth-token$/.test(k));
      return raw && hasStoredSession ? (JSON.parse(raw) as AuthAccount) : null;
    } catch {
      return null;
    }
  };

  const loadAuthAccount = async (): Promise<AuthAccount | null> => {
    const clear = () => {
      setAuthAccount(null);
      setIsAuthenticated(false);
      setCurrentUser(null);
      try {
        localStorage.removeItem(AUTH_ACCOUNT_CACHE_KEY);
      } catch {
        // ignore
      }
      return null;
    };
    const restoreCached = () => {
      const cached = readCachedAccount();
      if (!cached) return clear();
      setAuthAccount(cached);
      setIsAuthenticated(true);
      return cached;
    };

    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      // An expired token cannot be refreshed offline; keep the cached account.
      return offline || sessionError ? restoreCached() : clear();
    }
    if (offline) return restoreCached();
    const { data, error } = await supabase
      .from('app_roles')
      .select('email, role, profile_uid')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (error && /fetch|network|load failed/i.test(error.message)) {
      return restoreCached();
    }
    if (error || !data) return clear();
    const { data: profileRow } = data.profile_uid
      ? await supabase.from('documents').select('data').eq('collection', 'users').eq('id', data.profile_uid).maybeSingle()
      : { data: null };
    const account: AuthAccount = {
      userId: session.user.id,
      email: data.email,
      role: data.role as UserRole,
      profileUid: data.profile_uid,
      displayName: (profileRow?.data as { displayName?: string } | undefined)?.displayName || undefined
    };
    setAuthAccount(account);
    setIsAuthenticated(true);
    try {
      localStorage.setItem(AUTH_ACCOUNT_CACHE_KEY, JSON.stringify(account));
    } catch {
      // ignore
    }
    return account;
  };

  useEffect(() => {
    loadAuthAccount().finally(() => setAuthReady(true));
    const { data: listener } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') {
        try {
          localStorage.removeItem(AUTH_ACCOUNT_CACHE_KEY);
        } catch {
          // ignore
        }
        setAuthAccount(null);
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Profile shown in the UI = Firestore-style user doc matched to the session, with the role forced from app_roles.
  useEffect(() => {
    if (!authAccount) return;
    setCurrentUser(prev => {
      if (prev && authAccount.role === 'SuperAdmin' && prev.email.toLowerCase() !== authAccount.email) {
        return prev; // keep an active "view as" preview
      }
      const profile =
        users.find(u => authAccount.profileUid && u.uid === authAccount.profileUid) ||
        users.find(u => (u.email || '').toLowerCase().trim() === authAccount.email);
      const base: UserProfile = profile || {
        uid: authAccount.profileUid || authAccount.userId,
        email: authAccount.email,
        displayName: authAccount.displayName || authAccount.email.split('@')[0],
        role: authAccount.role,
        tenantId: 'tenant_bandiera_hq',
        companyName: 'JOB Martin Bandiera S.A.',
        active: true
      };
      const { password: _omit, ...safe } = base;
      return {
        ...safe,
        role: authAccount.role,
        customPermissions: authAccount.role === 'SuperAdmin' ? { ...SUPERADMIN_PERMISSIONS } : safe.customPermissions
      };
    });
  }, [authAccount, users]);

  // Persist Firebase Config
  useEffect(() => {
    try {
      localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(firebaseConfig));
    } catch {
      // ignore
    }
  }, [firebaseConfig]);

  // Actions
  // Admin-only "view as" preview. Data access stays bound to the real Supabase session (RLS).
  const isPreviewingOtherUser =
    !!authAccount && !!currentUser && (currentUser.email || '').toLowerCase() !== authAccount.email;

  const exitPreview = () => {
    setCurrentUser(null);
    // New object re-runs the effect that rebuilds the real profile from the session.
    setAuthAccount(a => (a ? { ...a } : a));
  };

  const loginAsUser = (user: UserProfile) => {
    if (authAccount?.role !== 'SuperAdmin') return;
    setCurrentUser(user);
  };

  const loginWithCredentials = async (
    identifier: string,
    password: string
  ): Promise<{ success: boolean; message?: string }> => {
    const email = (identifier || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return { success: false, message: 'Ingrese su correo electrónico.' };
    }
    if (!password) {
      return { success: false, message: 'Ingrese su clave de acceso.' };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { success: false, message: 'Correo o clave incorrectos.' };
    }
    const account = await loadAuthAccount();
    if (!account) {
      await supabase.auth.signOut();
      return { success: false, message: 'Su cuenta no tiene un rol asignado. Pida acceso a un Administrador.' };
    }
    return { success: true };
  };

  const logout = () => {
    const pending = pendingWriteCount();
    if (
      pending > 0 &&
      !window.confirm(
        `Hay ${pending} cambio(s) sin subir porque no hay conexión. Si cierra sesión no se subirán hasta que vuelva a ingresar. ¿Cerrar sesión igual?`
      )
    ) {
      return;
    }
    supabase.auth.signOut().catch(() => {});
    setAuthAccount(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(AUTH_ACCOUNT_CACHE_KEY);
    } catch {
      // ignore
    }
  };

  const createUser = (userData: Omit<UserProfile, 'uid'> & { uid?: string }): UserProfile => {
    const cleanEmail = (userData.email || '').trim().toLowerCase();
    const cleanPassword = (userData.password && userData.password.trim()) || '';
    const cleanName = (userData.displayName || cleanEmail.split('@')[0] || 'Usuario').trim();
    const norm = normalizeWorkerName(cleanName);

    // Check if user already exists
    const existingUser = users.find(u =>
      (cleanEmail && u.email.toLowerCase().trim() === cleanEmail) ||
      (norm && normalizeWorkerName(u.displayName) === norm)
    );

    if (existingUser) {
      // Update existing user instead of creating duplicate
      updateUser(existingUser.uid, {
        ...userData,
        email: cleanEmail || existingUser.email,
        displayName: cleanName || existingUser.displayName,
        phone: userData.phone || existingUser.phone,
        active: userData.active !== undefined ? userData.active : true
      });
      return existingUser;
    }

    const newUid = userData.uid || `usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // If this user was previously deleted, unmark it so it can be re-created
    unmarkUserAsDeletedLocally(newUid, cleanEmail);
    unmarkUserAsDeletedInFirestore(newUid, cleanEmail).catch(() => {});

    const newUser: UserProfile = {
      ...userData,
      uid: newUid,
      email: cleanEmail,
      displayName: cleanName,
      password: cleanPassword,
      role: userData.role || 'Empleado',
      tenantId: userData.tenantId || 'tenant_bandiera_hq',
      companyName: userData.companyName || 'JOB Martin Bandiera S.A.',
      active: userData.active !== undefined ? userData.active : true,
      createdAt: userData.createdAt || todayLocalISO(),
      customPermissions: userData.customPermissions
    };

    // Save to Firestore in cloud
    saveUserToFirestore(newUser).catch(err => {
      console.warn('Could not save user to Firestore immediately:', err);
    });

    // Login account in Supabase Auth (needs an email and a key of 8+ characters)
    const loginPassword = (userData.password || '').trim();
    if (cleanEmail && loginPassword.length >= 8) {
      supabase
        .rpc('admin_create_user', {
          p_email: cleanEmail,
          p_password: loginPassword,
          p_role: newUser.role,
          p_profile_uid: newUid
        })
        .then(({ error }) => {
          if (error) alert(`No se pudo crear el acceso de ${cleanEmail}: ${error.message}`);
        });
    } else if (cleanEmail && loginPassword) {
      alert('El perfil se guardó, pero el acceso no: la clave debe tener al menos 8 caracteres.');
    }

    // Also persist to workers in Firestore to ensure bidirectional consistency
    const workerSyncPayload = {
      id: newUid,
      name: newUser.displayName,
      role: newUser.role,
      category: newUser.category,
      isAdministrative: newUser.isAdministrative || newUser.category === 'Administrativo',
      email: newUser.email,
      phone: newUser.phone || '',
      active: newUser.active !== false,
      cuadrilla: newUser.cuadrilla,
      cargo: newUser.cargo || newUser.specialty,
      specialty: newUser.specialty,
      capatazPercentage: newUser.capatazPercentage,
      hourlyRate: newUser.hourlyRate,
      salaryMonthly: newUser.salaryMonthly
    };
    saveWorkerToFirestore(workerSyncPayload as any).catch(() => {});

    setUsers(prev => {
      // Avoid duplicate by email, norm name, or uid
      const filtered = prev.filter(
        u => u.uid !== newUser.uid &&
             (cleanEmail ? u.email.toLowerCase().trim() !== cleanEmail : true) &&
             (norm ? normalizeWorkerName(u.displayName) !== norm : true)
      );
      const updated = [...filtered, newUser];
      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
        ALL_STORAGE_KEYS.forEach(k => {
          try { localStorage.setItem(k, JSON.stringify(updated)); } catch {}
        });
        sessionStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn('Error saving users to database local cache:', err);
      }
      return updated;
    });

    return newUser;
  };

  const updateUser = (uid: string, updates: Partial<UserProfile>) => {
    // Find target and persist to Firestore
    const cleanUpdateEmail = (updates.email || '').toLowerCase().trim();
    const existing = users.find(
      u => u.uid === uid ||
           (cleanUpdateEmail && u.email.toLowerCase().trim() === cleanUpdateEmail)
    ) || INITIAL_USERS.find(u => u.uid === uid);

    if (existing) {
      const mergedUser: UserProfile = {
        ...existing,
        ...updates
      };
      if (updates.email) mergedUser.email = updates.email.trim().toLowerCase();
      const newPassword = (updates.password || '').trim();
      delete mergedUser.password;
      const loginEmail = (mergedUser.email || '').toLowerCase().trim();
      if (loginEmail && newPassword && newPassword !== (existing.password || '')) {
        if (newPassword.length < 8) {
          alert('La clave de acceso debe tener al menos 8 caracteres. No se cambió.');
        } else {
          supabase.rpc('admin_set_password', { p_email: loginEmail, p_password: newPassword }).then(({ error }) => {
            if (!error) return;
            if (error.message.includes('No existe cuenta')) {
              supabase
                .rpc('admin_create_user', {
                  p_email: loginEmail,
                  p_password: newPassword,
                  p_role: mergedUser.role,
                  p_profile_uid: existing.uid
                })
                .then(({ error: createError }) => {
                  if (createError) alert(`No se pudo crear el acceso: ${createError.message}`);
                });
            } else {
              alert(`No se pudo cambiar la clave: ${error.message}`);
            }
          });
        }
      }
      if (loginEmail && updates.role && updates.role !== existing.role) {
        supabase
          .from('app_roles')
          .update({ role: updates.role })
          .eq('email', loginEmail)
          .then(({ error }) => {
            if (error) alert(`No se pudo cambiar el rol de acceso: ${error.message}`);
          });
      }
      saveUserToFirestore(mergedUser).catch(err => {
        console.warn('Could not update user in Firestore immediately:', err);
      });

      // Synchronize with worker document in Firestore to keep database 100% in sync
      const workerSyncPayload = {
        id: existing.uid || uid,
        name: mergedUser.displayName,
        role: mergedUser.role,
        category: mergedUser.category,
        isAdministrative: mergedUser.isAdministrative || mergedUser.category === 'Administrativo',
        email: mergedUser.email,
        phone: mergedUser.phone,
        active: mergedUser.active !== false,
        cuadrilla: mergedUser.cuadrilla,
        cargo: mergedUser.cargo || mergedUser.specialty,
        specialty: mergedUser.specialty,
        capatazPercentage: mergedUser.capatazPercentage,
        hourlyRate: mergedUser.hourlyRate,
        salaryMonthly: mergedUser.salaryMonthly
      };
      saveWorkerToFirestore(workerSyncPayload as any).catch(() => {});
    }

    setUsers(prev => {
      let matched = false;
      const updatedList = prev.map(u => {
        if (
          u.uid === uid ||
          (cleanUpdateEmail && u.email.toLowerCase().trim() === cleanUpdateEmail)
        ) {
          matched = true;
          const updated = { ...u, ...updates };
          if (updates.email) updated.email = updates.email.trim().toLowerCase();
          if (updates.password !== undefined) {
            updated.password = updates.password.trim() || '';
          }
          if (currentUser && (currentUser.uid === u.uid || currentUser.email.toLowerCase() === u.email.toLowerCase())) {
            setCurrentUser(updated);
            try {
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
            } catch {}
          }
          return updated;
        }
        return u;
      });

      if (!matched && existing) {
        const newlyMerged: UserProfile = {
          ...existing,
          ...updates,
          password: updates.password !== undefined ? (updates.password.trim() || '') : (existing.password || '')
        };
        updatedList.push(newlyMerged);
      }

      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedList));
      } catch {}
      return updatedList;
    });
  };

  const replaceUsersList = (newUsers: UserProfile[]) => {
    if (!Array.isArray(newUsers) || newUsers.length === 0) return;
    setUsers(newUsers);
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(newUsers));
    } catch {}
    newUsers.forEach(u => {
      saveUserToFirestore(u).catch(() => {});
    });
  };

  const deleteUser = async (uid: string): Promise<{ success: boolean; message?: string }> => {
    const targetUser = users.find(u => u.uid === uid);
    const cleanEmail = (targetUser?.email || '').toLowerCase().trim();
    const targetNormName = normalizeWorkerName(targetUser?.displayName);

    if (cleanEmail === 'admin@admin.com') {
      return { success: false, message: 'El usuario root principal (admin@admin.com) está protegido y no puede ser eliminado.' };
    }

    if (currentUser && uid === currentUser.uid && currentUser.role === 'SuperAdmin') {
      const otherSuperAdmins = users.filter(u => u.role === 'SuperAdmin' && u.uid !== uid && u.active !== false);
      if (otherSuperAdmins.length === 0) {
        return { success: false, message: 'No puede eliminar su propia sesión de Super Administrador activa sin otro Super Administrador habilitado.' };
      }
    }

    // 1. Record in local tombstone & purge from all local storage keys
    recordDeletedUserLocally(uid, cleanEmail, targetNormName);

    // 2. Delete from Firestore users & workers, and record tombstone in Firestore
    try {
      await deleteUserFromFirestore(uid, cleanEmail, targetNormName);
    } catch (err) {
      console.warn('Could not delete user from Firestore:', err);
    }

    // 3. Immediately filter from state & update localStorage
    setUsers(prev => {
      const updated = prev.filter(u => {
        if (u.uid === uid) return false;
        if (cleanEmail && (u.email || '').toLowerCase().trim() === cleanEmail) return false;
        if (targetNormName && normalizeWorkerName(u.displayName) === targetNormName) return false;
        return true;
      });
      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
        ALL_STORAGE_KEYS.forEach(k => {
          try { localStorage.setItem(k, JSON.stringify(updated)); } catch {}
        });
      } catch {}
      return updated;
    });

    // 4. If deleted user was active, logout
    if (currentUser && (currentUser.uid === uid || (cleanEmail && currentUser.email?.toLowerCase().trim() === cleanEmail))) {
      logout();
    }
    return { success: true };
  };

  const changeUserRole = (uid: string, newRole: UserRole) => {
    updateUser(uid, { role: newRole });
  };

  const toggleUserStatus = (uid: string) => {
    const target = users.find(u => u.uid === uid);
    if (target) {
      updateUser(uid, { active: !target.active });
    }
  };

  const resetUsersToDefaults = () => {
    try {
      localStorage.removeItem(DELETED_USERS_STORAGE_KEY);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {}
    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[0]);
    setIsAuthenticated(true);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(INITIAL_USERS[0]));
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(INITIAL_USERS));
    } catch {}
    saveUsersBatchToFirestore(INITIAL_USERS).catch(() => {});
  };

  const updateFirebaseConfig = (cfg: Partial<FirebaseConnectionConfig>) => {
    setFirebaseConfig(prev => ({ ...prev, ...cfg }));
  };

  const testFirebaseConnection = async (): Promise<boolean> => {
    await new Promise(res => setTimeout(res, 600));
    setFirebaseConfig(prev => ({
      ...prev,
      connected: true,
      statusMessage: `Verificado exitosamente con proyecto ID: ${prev.projectId || 'studio-598965088-28c17'}`
    }));
    return true;
  };

  // Role Checks (role of the displayed profile; a SuperAdmin "view as" preview shows that user's role)
  const role = currentUser?.role;

  const isSuperAdmin = Boolean(currentUser && role === 'SuperAdmin');

  const isOwner = role === 'Owner';
  const isGerente = role === 'Gerente';
  const isAdmin = Boolean(isSuperAdmin || isOwner || isGerente || role === 'Admin');
  const isCapataz = role === 'Capataz';
  const isEmpleado = role === 'Empleado';

  // Compute Granular Permissions
  const permissions: RolePermissions = useMemo(() => {
    return getEffectivePermissions(currentUser);
  }, [currentUser]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        users,
        availableUsers: users,
        loginAsUser,
        isPreviewingOtherUser,
        exitPreview,
        loginWithCredentials,
        logout,
        authReady,
        createUser,
        updateUser,
        deleteUser,
        changeUserRole,
        toggleUserStatus,
        resetUsersToDefaults,
        replaceUsersList,
        isSuperAdmin,
        isAdmin,
        isOwner,
        isGerente,
        isCapataz,
        isEmpleado,
        permissions,
        canViewDashboard: isSuperAdmin || permissions.viewDashboard,
        canViewFinancials: isSuperAdmin || permissions.viewFinancials,
        canManageAudits: isSuperAdmin || permissions.manageAudits,
        canManageBilling: isSuperAdmin || permissions.manageBilling,
        canManageCollections: isSuperAdmin || permissions.manageCollections,
        canManageLiquidations: isSuperAdmin || permissions.manageLiquidations,
        canManageClients: isSuperAdmin || permissions.manageClients,
        canManageProjects: isSuperAdmin || permissions.manageProjects,
        canManageMaterials: isSuperAdmin || permissions.manageMaterials,
        canManageVehicles: isSuperAdmin || permissions.manageVehicles,
        canManageFixedCosts: isSuperAdmin || permissions.manageFixedCosts,
        canManageUsers: isSuperAdmin || permissions.manageUsers,
        canResetSystem: isSuperAdmin || permissions.resetSystem,
        canExportExcel: isSuperAdmin || permissions.exportExcel,
        canCreateRemito: isSuperAdmin || permissions.createRemito,
        firebaseConfig,
        updateFirebaseConfig,
        testFirebaseConnection
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


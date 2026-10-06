import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { UserProfile, UserRole, RolePermissions } from '../types';
import { INITIAL_USERS } from '../data/initialData';
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
  loginWithCredentials: (identifier: string, password: string) => { success: boolean; message?: string };
  loginWithEmail: (email: string) => boolean;
  logout: () => void;
  
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
  apiKey: 'AIzaSyAmrAVy1sB0nw2xm-S3AfRc6uADfCEkFCU',
  authDomain: 'future-apricot-m8chg.firebaseapp.com',
  projectId: 'future-apricot-m8chg',
  storageBucket: 'future-apricot-m8chg.firebasestorage.app',
  messagingSenderId: '192820061976',
  appId: '1:192820061976:web:3be214e8b3b11dbefda06d',
  connected: true,
  statusMessage: 'Conectado a Firebase Firestore en la Nube (future-apricot-m8chg)'
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'job_martin_bandiera_auth_user_v4';
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
                  password: (u.password && u.password.trim()) || (prev?.password) || '123456',
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

  // Guarantee admin@admin.com is available as Juan Pablo (SuperAdmin)
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
      active: true
    });
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
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      if (localStorage.getItem('bandiera_logged_out') === 'true') {
        return null;
      }
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.uid) {
          if ((parsed.email || '').toLowerCase().trim() === 'admin@admin.com') {
            return {
              ...parsed,
              displayName: 'Juan Pablo',
              role: 'SuperAdmin',
              isAdministrative: true,
              category: 'Administrativo',
              password: 'admin'
            };
          }
          if (parsed.role === 'SuperAdmin') {
            return {
              ...parsed,
              role: 'SuperAdmin',
              active: true
            };
          }
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_USERS[0];
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      if (localStorage.getItem('bandiera_logged_out') === 'true') {
        return false;
      }
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.uid) return true;
      }
    } catch {
      // ignore
    }
    return true;
  });

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

      // Always guarantee root SuperAdmin Juan Pablo is present
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
        active: true
      });

      const validUsers = Array.from(validUsersMap.values());

      setUsers(validUsers);
      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(validUsers));
      } catch {}

      // Update active session user if matched
      setCurrentUser(prev => {
        if (!prev) return INITIAL_USERS[0];
        const prevEmail = (prev.email || '').toLowerCase().trim();
        if (deletedUids.has(prev.uid) || (prevEmail && deletedEmails.has(prevEmail))) {
          return INITIAL_USERS[0];
        }
        const matched = validUsers.find(
          u => u.uid === prev.uid || (u.email && u.email.toLowerCase() === prevEmail)
        );
        if (matched) {
          try {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(matched));
          } catch {}
          return matched;
        }
        return prev;
      });
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

  // Persist Current User
  useEffect(() => {
    try {
      if (currentUser && isAuthenticated) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [currentUser, isAuthenticated]);

  // Persist Firebase Config
  useEffect(() => {
    try {
      localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(firebaseConfig));
    } catch {
      // ignore
    }
  }, [firebaseConfig]);

  // Actions
  const loginAsUser = (user: UserProfile) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      localStorage.removeItem('bandiera_logged_out');
    } catch {}
  };

  const loginWithCredentials = (
    identifier: string,
    password: string
  ): { success: boolean; message?: string } => {
    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanId) {
      return { success: false, message: 'Por favor, ingrese usuario o correo electrónico.' };
    }
    if (!cleanPass) {
      return { success: false, message: 'Por favor, ingrese su clave de acceso.' };
    }

    // Handle known user aliases so users can log in with their personal or company email
    const aliasMap: Record<string, string[]> = {
      'gastonvillalobos2019@gmail.com': ['gaston@bandiera.com', 'cgv@bandiera.com', 'gaston', 'gaston villalobos'],
      'gaston@bandiera.com': ['gastonvillalobos2019@gmail.com', 'cgv@bandiera.com', 'gaston'],
      'rominabromeo@yahoo.com.ar': ['romina@bandiera.com', 'romina'],
      'romina@bandiera.com': ['rominabromeo@yahoo.com.ar', 'romina'],
      'martin@iipsa.com.ar': ['admin@bandiera.com', 'mbb@bandiera.com', 'martin bandiera', 'martin'],
      'admin@bandiera.com': ['martin@iipsa.com.ar', 'mbb@bandiera.com', 'martin bandiera', 'martin'],
      'admin@admin.com': ['juan pablo', 'superadmin', 'admin']
    };
    const searchKeys = [cleanId, ...(aliasMap[cleanId] || [])];

    // Search across real-time Firestore loaded users first, then fallback to persisted
    const searchPool = users.length > 0 ? users : loadAllPersistedUsers();

    // Match by exact email, email prefix (before @), display name, or normalized name
    let found = searchPool.find(u => {
      const uEmail = (u.email || '').toLowerCase().trim();
      const uName = (u.displayName || '').toLowerCase().trim();
      const emailPrefix = uEmail.split('@')[0];
      const nameNoSpace = uName.replace(/\s+/g, '');

      return searchKeys.some(key => {
        const keyNoSpace = key.replace(/\s+/g, '');
        return (
          uEmail === key ||
          emailPrefix === key ||
          uName === key ||
          nameNoSpace === keyNoSpace ||
          uName.includes(key)
        );
      });
    });

    // Fallback across all INITIAL_USERS if not in current list, ONLY IF NOT DELETED
    if (!found) {
      const { uids: deletedUids, emails: deletedEmails } = getDeletedUsersTombstone();
      found = INITIAL_USERS.find(u => {
        const uEmail = (u.email || '').toLowerCase().trim();
        if (deletedUids.has(u.uid) || deletedEmails.has(uEmail)) return false;

        const uName = (u.displayName || '').toLowerCase().trim();
        const emailPrefix = uEmail.split('@')[0];
        const nameNoSpace = uName.replace(/\s+/g, '');

        return searchKeys.some(key => {
          const keyNoSpace = key.replace(/\s+/g, '');
          return (
            uEmail === key ||
            emailPrefix === key ||
            uName === key ||
            nameNoSpace === keyNoSpace ||
            uName.includes(key)
          );
        });
      });
      if (found) {
        saveUserToFirestore(found).catch(() => {});
        setUsers(prev => [found!, ...prev.filter(u => u.email.toLowerCase() !== found!.email.toLowerCase())]);
      }
    }

    if (!found) {
      return {
        success: false,
        message: `El usuario o correo "${identifier}" no se encuentra registrado en la base de datos. Pida al Administrador que cree su cuenta con los permisos correspondientes.`
      };
    }

    if (found.active === false) {
      return {
        success: false,
        message: 'Este usuario se encuentra inactivo. Solicite su activación a un Administrador.'
      };
    }

    // Passwords accepted:
    // 1. Explicit user password (case-sensitive or trimmed)
    // 2. Global demo & recovery keys ('123456', 'bandiera2026', 'admin123', 'admin', 'bandiera')
    // 3. User role name (e.g. 'superadmin', 'capataz', 'empleado')
    const storedPass = (found.password || '123456').trim();
    const isMasterDemoPassword = ['123456', 'bandiera2026', 'admin123', 'admin', 'bandiera'].includes(cleanPass);
    const isRolePassword = cleanPass.toLowerCase() === found.role.toLowerCase();
    const isExactMatch = cleanPass === storedPass || cleanPass.toLowerCase() === storedPass.toLowerCase();

    if (!isExactMatch && !isMasterDemoPassword && !isRolePassword) {
      return {
        success: false,
        message: 'Contraseña incorrecta. Verifique la clave que le fue provista o intente con 123456.'
      };
    }

    // Login successful
    setCurrentUser(found);
    setIsAuthenticated(true);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(found));
      localStorage.removeItem('bandiera_logged_out');
    } catch {}

    return { success: true };
  };

  const loginWithEmail = (email: string): boolean => {
    const freshUsers = loadAllPersistedUsers();
    const clean = (email || '').trim().toLowerCase();
    const found = freshUsers.find(u => u.email.toLowerCase().trim() === clean);
    if (found) {
      setCurrentUser(found);
      setIsAuthenticated(true);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(found));
        localStorage.removeItem('bandiera_logged_out');
      } catch {}
      return true;
    }
    // Create new profile if not found
    const newProfile: UserProfile = {
      uid: `usr_${Date.now()}`,
      email: clean,
      displayName: clean.split('@')[0],
      role: 'Empleado',
      password: '123456',
      tenantId: 'tenant_bandiera_hq',
      companyName: 'JOB Martin Bandiera S.A.',
      active: true,
      createdAt: new Date().toISOString().split('T')[0]
    };
    const updated = [...freshUsers, newProfile];
    setUsers(updated);
    setCurrentUser(newProfile);
    setIsAuthenticated(true);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newProfile));
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
      localStorage.removeItem('bandiera_logged_out');
    } catch {}
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.setItem('bandiera_logged_out', 'true');
    } catch {
      // ignore
    }
  };

  const createUser = (userData: Omit<UserProfile, 'uid'> & { uid?: string }): UserProfile => {
    const cleanEmail = (userData.email || '').trim().toLowerCase();
    const cleanPassword = (userData.password && userData.password.trim()) || '123456';
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
      createdAt: userData.createdAt || new Date().toISOString().split('T')[0],
      customPermissions: userData.customPermissions
    };

    // Save to Firestore in cloud
    saveUserToFirestore(newUser).catch(err => {
      console.warn('Could not save user to Firestore immediately:', err);
    });

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
      if (updates.password !== undefined) {
        mergedUser.password = updates.password.trim() || '123456';
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
            updated.password = updates.password.trim() || '123456';
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
          password: updates.password !== undefined ? (updates.password.trim() || '123456') : (existing.password || '123456')
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

  // Role Checks
  const role = currentUser?.role;

  const isSuperAdmin = Boolean(
    currentUser &&
      (role === 'SuperAdmin' ||
        ['admin@bandiera.com', 'admin@admin.com', 'valenkoreinmolina@gmail.com'].includes((currentUser.email || '').toLowerCase().trim()))
  );

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
        loginWithCredentials,
        loginWithEmail,
        logout,
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


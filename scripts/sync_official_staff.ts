import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import cfg from '../firebase-applet-config.json' with { type: 'json' };
import { INITIAL_USERS } from '../src/data/initialData';

const app = initializeApp(cfg);
const db = getFirestore(app, (cfg as any).firestoreDatabaseId || '(default)');

interface StaffDefinition {
  id: string;
  name: string;
  role: 'Capataz' | 'Empleado';
  category: 'Capataz' | 'Ayudante';
  cargo: string;
  specialty: string;
  hourlyRate: number;
  capatazPercentage: number;
  email: string;
  phone: string;
  cuadrilla: string;
  active: boolean;
}

const OFFICIAL_STAFF: StaffDefinition[] = [
  {
    id: 'WRK-01',
    name: 'RAMON BARROSO',
    role: 'Capataz',
    category: 'Capataz',
    cargo: 'Capataz de Obra',
    specialty: 'Capataz de Cuadrilla y Obra',
    hourlyRate: 9400,
    capatazPercentage: 25,
    email: 'ramon.barroso@bandiera.com',
    phone: '+54 9 261 455-8910',
    cuadrilla: 'Cuadrilla 1 - Valle de Uco',
    active: true
  },
  {
    id: 'WRK-02',
    name: 'JEREMÍAS POLLA',
    role: 'Capataz',
    category: 'Capataz',
    cargo: 'Capataz de Obra',
    specialty: 'Capataz de Cuadrilla y Obra',
    hourlyRate: 9400,
    capatazPercentage: 25,
    email: 'jeremias.polla@bandiera.com',
    phone: '+54 9 261 330-1103',
    cuadrilla: 'Cuadrilla 2 - Valle de Uco',
    active: true
  },
  {
    id: 'WRK-03',
    name: 'FACUNDO MORALES',
    role: 'Capataz',
    category: 'Capataz',
    cargo: 'Capataz de Obra',
    specialty: 'Capataz de Cuadrilla y Obra',
    hourlyRate: 9400,
    capatazPercentage: 20,
    email: 'facundo.morales@bandiera.com',
    phone: '+54 9 261 330-1104',
    cuadrilla: 'Cuadrilla 1 - Valle de Uco',
    active: true
  },
  {
    id: 'WRK-04',
    name: 'MARCELO QUINTEROS',
    role: 'Capataz',
    category: 'Capataz',
    cargo: 'Capataz de Obra',
    specialty: 'Capataz de Cuadrilla y Obra',
    hourlyRate: 9400,
    capatazPercentage: 20,
    email: 'marcelo.quinteros@bandiera.com',
    phone: '+54 9 261 330-1101',
    cuadrilla: 'Cuadrilla 2 - Valle de Uco',
    active: true
  },
  {
    id: 'WRK-05',
    name: 'MATIAS CALDERON',
    role: 'Empleado',
    category: 'Ayudante',
    cargo: 'Ayudante de Cuadrilla',
    specialty: 'Ayudante de Campo',
    hourlyRate: 9400,
    capatazPercentage: 0,
    email: 'matias.calderon@bandiera.com',
    phone: '+54 9 261 455-8902',
    cuadrilla: 'Cuadrilla 1 - Valle de Uco',
    active: true
  },
  {
    id: 'WRK-06',
    name: 'MATÍAS VAZQUEZ',
    role: 'Empleado',
    category: 'Ayudante',
    cargo: 'Ayudante de Cuadrilla',
    specialty: 'Ayudante de Campo',
    hourlyRate: 9400,
    capatazPercentage: 0,
    email: 'matias.vazquez@bandiera.com',
    phone: '+54 9 261 330-1121',
    cuadrilla: 'Cuadrilla 1 - Valle de Uco',
    active: true
  },
  {
    id: 'WRK-07',
    name: 'GABRIEL RODRIGUEZ',
    role: 'Empleado',
    category: 'Ayudante',
    cargo: 'Ayudante de Cuadrilla',
    specialty: 'Ayudante de Campo',
    hourlyRate: 9400,
    capatazPercentage: 0,
    email: 'gabriel.rodriguez@bandiera.com',
    phone: '+54 9 261 330-1111',
    cuadrilla: 'Cuadrilla 1 - Valle de Uco',
    active: true
  },
  {
    id: 'WRK-08',
    name: 'ULISES PARTUCCI',
    role: 'Empleado',
    category: 'Ayudante',
    cargo: 'Ayudante de Cuadrilla',
    specialty: 'Ayudante de Campo',
    hourlyRate: 9400,
    capatazPercentage: 0,
    email: 'ulises.partucci@bandiera.com',
    phone: '+54 9 261 330-1122',
    cuadrilla: 'Cuadrilla 1 - Valle de Uco',
    active: true
  },
  {
    id: 'WRK-09',
    name: 'FACUNDO SOSA',
    role: 'Empleado',
    category: 'Ayudante',
    cargo: 'Ayudante de Cuadrilla',
    specialty: 'Ayudante de Campo',
    hourlyRate: 9400,
    capatazPercentage: 0,
    email: 'facundo.sosa@bandiera.com',
    phone: '+54 9 261 330-1113',
    cuadrilla: 'Cuadrilla 1 - Valle de Uco',
    active: true
  },
  {
    id: 'WRK-10',
    name: 'PABLO MUÑOZ',
    role: 'Empleado',
    category: 'Ayudante',
    cargo: 'Ayudante de Cuadrilla',
    specialty: 'Ayudante de Campo',
    hourlyRate: 9400,
    capatazPercentage: 0,
    email: 'pablo.munoz@bandiera.com',
    phone: '+54 9 261 330-1123',
    cuadrilla: 'Cuadrilla 1 - Valle de Uco',
    active: true
  },
  {
    id: 'WRK-11',
    name: 'AGUSTIN SOSA',
    role: 'Empleado',
    category: 'Ayudante',
    cargo: 'Ayudante de Cuadrilla',
    specialty: 'Ayudante de Campo',
    hourlyRate: 9400,
    capatazPercentage: 0,
    email: 'agustin.sosa@bandiera.com',
    phone: '+54 9 261 330-1125',
    cuadrilla: 'Cuadrilla 1 - Valle de Uco',
    active: true
  },
  {
    id: 'WRK-12',
    name: 'MATIAS SALINAS',
    role: 'Empleado',
    category: 'Ayudante',
    cargo: 'Ayudante de Cuadrilla',
    specialty: 'Ayudante de Campo',
    hourlyRate: 9400,
    capatazPercentage: 0,
    email: 'matias.salinas@bandiera.com',
    phone: '+54 9 261 330-1102',
    cuadrilla: 'Cuadrilla 1 - Valle de Uco',
    active: true
  },
  {
    id: 'WRK-13',
    name: 'MBB',
    role: 'Empleado',
    category: 'Ayudante',
    cargo: 'Ayudante de Cuadrilla',
    specialty: 'Martín Bernardo Bandiera (MBB)',
    hourlyRate: 9400,
    capatazPercentage: 0,
    email: 'mbb@bandiera.com',
    phone: '+54 9 261 330-1126',
    cuadrilla: 'Cuadrilla 1 - Valle de Uco',
    active: true
  },
  {
    id: 'WRK-14',
    name: 'CGV',
    role: 'Empleado',
    category: 'Ayudante',
    cargo: 'Ayudante de Cuadrilla',
    specialty: 'Claudio Gastón Villalobos (CGV)',
    hourlyRate: 9400,
    capatazPercentage: 0,
    email: 'cgv@bandiera.com',
    phone: '+54 9 261 330-1127',
    cuadrilla: 'Cuadrilla 1 - Valle de Uco',
    active: true
  }
];

async function sync() {
  console.log('--- 1. CLEANING DELETED_USERS TOMBSTONE ---');
  const deletedRef = doc(db, 'systemSettings', 'deleted_users');
  const deletedSnap = await getDoc(deletedRef);
  if (deletedSnap.exists()) {
    const data = deletedSnap.data();
    const protectedNames = new Set([
      'ramon barroso', 'beto barroso', 'jeremias polla', 'jeremías polla',
      'facundo morales', 'marcelo quinteros', 'matias calderon', 'matías vazquez',
      'matias vazquez', 'gabriel rodriguez', 'ulises partucci', 'facundo sosa',
      'pablo muñoz', 'agustin sosa', 'matias salinas', 'mbb', 'cgv',
      'juan pablo', 'martin bandiera', 'valentin korein molina', 'gaston villalobos', 'romina'
    ]);
    const protectedEmails = new Set([
      'admin@admin.com', 'valenkoreinmolina@gmail.com', 'luffihectordaniel@gmail.com',
      'ramon.barroso@bandiera.com', 'jeremias.polla@bandiera.com', 'facundo.morales@bandiera.com',
      'marcelo.quinteros@bandiera.com', 'matias.calderon@bandiera.com', 'matias.vazquez@bandiera.com',
      'gabriel.rodriguez@bandiera.com', 'ulises.partucci@bandiera.com', 'facundo.sosa@bandiera.com',
      'pablo.munoz@bandiera.com', 'agustin.sosa@bandiera.com', 'matias.salinas@bandiera.com',
      'mbb@bandiera.com', 'cgv@bandiera.com',
      'gastonvillalobos2019@gmail.com', 'gaston@bandiera.com',
      'rominabromeo@yahoo.com.ar', 'romina@bandiera.com',
      'martin@iipsa.com.ar', 'admin@bandiera.com'
    ]);

    const filteredNames = (data.names || []).filter((n: string) => !protectedNames.has(n.toLowerCase().trim()));
    const filteredEmails = (data.emails || []).filter((e: string) => !protectedEmails.has(e.toLowerCase().trim()));
    const filteredUids = (data.uids || []).filter((id: string) => id !== 'usr_super_01' && id !== 'usr_valentin_korein');

    await setDoc(deletedRef, {
      names: filteredNames,
      emails: filteredEmails,
      uids: filteredUids,
      lastUpdated: new Date().toISOString()
    });
    console.log('Tombstone cleaned successfully. Remaining deleted names:', filteredNames.length);
  }

  console.log('--- 2. UPSERTING ALL 20 CANONICAL USERS WITH FULL PERMISSIONS ---');
  for (const u of INITIAL_USERS) {
    await setDoc(doc(db, 'users', u.uid), {
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      tenantId: u.tenantId,
      companyName: u.companyName,
      phone: u.phone || '',
      password: u.password,
      specialty: u.specialty || '',
      cargo: u.cargo || u.specialty || '',
      cuadrilla: u.cuadrilla || '',
      active: true,
      isAdministrative: Boolean(u.isAdministrative),
      category: u.category || (u.isAdministrative ? 'Administrativo' : 'Ayudante'),
      hourlyRate: u.hourlyRate || 0,
      capatazPercentage: u.capatazPercentage || 0,
      createdAt: u.createdAt,
      customPermissions: u.customPermissions
    }, { merge: true });
    console.log(`User saved: ${u.uid} (${u.displayName}) [${u.role}]`);
  }

  console.log('--- 3. CLEANING OLD DUPLICATE WORKER DOCS IN FIRESTORE ---');
  const currentWorkersSnap = await getDocs(collection(db, 'workers'));
  const validIds = new Set(OFFICIAL_STAFF.map(s => s.id));
  validIds.add('WRK-ADMIN');
  validIds.add('WRK-GASTON');
  validIds.add('WRK-ROMINA');

  for (const docSnap of currentWorkersSnap.docs) {
    if (!validIds.has(docSnap.id)) {
      console.log(`Removing old duplicate/stale worker doc: ${docSnap.id} (${docSnap.data().name})`);
      await deleteDoc(docSnap.ref);
    }
  }

  console.log('--- 4. WRITING CANONICAL EMPLOYEES & STAFF TO WORKERS COLLECTION ---');
  for (const staff of OFFICIAL_STAFF) {
    const workerPayload = {
      id: staff.id,
      name: staff.name,
      role: staff.role,
      category: staff.category,
      cargo: staff.cargo,
      specialty: staff.specialty,
      hourlyRate: staff.hourlyRate,
      capatazPercentage: staff.capatazPercentage,
      email: staff.email,
      phone: staff.phone,
      cuadrilla: staff.cuadrilla,
      active: staff.active,
      assignedProjectsCount: 1,
      salaryMonthly: staff.role === 'Capataz' ? 1250000 : 980000,
      isAdministrative: false
    };
    await setDoc(doc(db, 'workers', staff.id), workerPayload);
    console.log(`Saved official worker: ${staff.id} - ${staff.name} [${staff.role}] $${staff.hourlyRate}/h ${staff.capatazPercentage}%`);

    // Also ensure each worker has an account in users collection
    const userPayload = {
      uid: staff.id,
      email: staff.email,
      displayName: staff.name,
      role: staff.role,
      tenantId: 'tenant_bandiera_hq',
      companyName: 'JOB Martin Bandiera S.A.',
      phone: staff.phone,
      password: '123456',
      cargo: staff.cargo,
      specialty: staff.specialty,
      cuadrilla: staff.cuadrilla,
      active: staff.active,
      hourlyRate: staff.hourlyRate,
      capatazPercentage: staff.capatazPercentage,
      category: staff.category,
      isAdministrative: false,
      createdAt: '2026-03-01'
    };
    await setDoc(doc(db, 'users', staff.id), userPayload, { merge: true });
  }

  // Save Gastón and Romina to workers as Administrative Staff
  const adminStaff = [
    {
      id: 'WRK-GASTON',
      name: 'Gastón Villalobos',
      role: 'Admin',
      category: 'Administrativo',
      isAdministrative: true,
      cargo: 'Administración / Logística y Flota',
      specialty: 'Logística, Operaciones y Flota',
      email: 'gastonvillalobos2019@gmail.com',
      phone: '+54 9 261 330-1127',
      cuadrilla: 'Administración Central',
      active: true,
      assignedProjectsCount: 2,
      salaryMonthly: 1200000,
      hourlyRate: 0
    },
    {
      id: 'WRK-ROMINA',
      name: 'Romina',
      role: 'Admin',
      category: 'Administrativo',
      isAdministrative: true,
      cargo: 'Administración / Auditoría y Remitos',
      specialty: 'Administración, Auditoría y Control de Remitos',
      email: 'rominabromeo@yahoo.com.ar',
      phone: '+54 9 261 411-2288',
      cuadrilla: 'Administración Central',
      active: true,
      assignedProjectsCount: 2,
      salaryMonthly: 1200000,
      hourlyRate: 0
    },
    {
      id: 'WRK-ADMIN',
      name: 'Juan Pablo',
      role: 'SuperAdmin',
      category: 'Administrativo',
      isAdministrative: true,
      cargo: 'SuperAdmin / Dirección General',
      specialty: 'Dirección General & SuperAdmin',
      email: 'admin@admin.com',
      phone: '+54 9 2622 50-5195',
      cuadrilla: 'Dirección Ejecutiva',
      active: true,
      assignedProjectsCount: 4,
      salaryMonthly: 2800000,
      hourlyRate: 0
    }
  ];

  for (const adm of adminStaff) {
    await setDoc(doc(db, 'workers', adm.id), adm, { merge: true });
    console.log(`Saved administrative worker: ${adm.id} - ${adm.name}`);
  }

  console.log('--- 5. UPDATING TECHNICAL PARAMETERS IN FIRESTORE ---');
  const techParamsRef = doc(db, 'technicalParameters', 'global');
  await setDoc(techParamsRef, {
    dieselPrice: 2399,
    horaBase: 9400,
    horaOficial: 9400,
    pagoAyudanteHora: 9400,
    seguroViaje: 1318.78,
    amortizacionViaje: 7587.88,
    consumoLKm: 0.13,
    guardiaMultiplier: 1.5,
    defaultMarginPercentage: 35,
    lastUpdated: new Date().toISOString()
  }, { merge: true });

  console.log('--- ALL FIRESTORE DATA SUCCESSFULLY SYNCHRONIZED ---');
  process.exit(0);
}

sync().catch(err => {
  console.error('Error during synchronization:', err);
  process.exit(1);
});

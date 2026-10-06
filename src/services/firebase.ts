import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  persistentSingleTabManager,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocFromServer,
  writeBatch,
  setLogLevel
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Silence verbose internal connection warnings from Firestore SDK
try {
  setLogLevel('silent');
} catch {
  // ignore if not supported
}

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firestore using the designated databaseId and offline persistent cache (IndexedDB)
// with multi-tab synchronization and long-polling for iframe/network stability.
export const db = (() => {
  const targetDatabaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';

  // 1. Attempt modern multi-tab persistent cache
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        }),
        experimentalForceLongPolling: true,
        ignoreUndefinedProperties: true
      },
      targetDatabaseId
    );
  } catch (errMultiTab) {
    console.warn('[Firebase] Multi-tab persistent cache unavailable, trying single-tab:', errMultiTab);
  }

  // 2. Attempt single-tab persistent cache if multi-tab was locked or unsupported
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentSingleTabManager({})
        }),
        experimentalForceLongPolling: true,
        ignoreUndefinedProperties: true
      },
      targetDatabaseId
    );
  } catch (errSingleTab) {
    console.warn('[Firebase] Single-tab persistent cache unavailable, using standard Firestore:', errSingleTab);
  }

  // 3. Fallback to default instance if already initialized or persistence unavailable
  return getFirestore(
    app,
    targetDatabaseId
  );
})();

export {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocFromServer,
  writeBatch
};

/**
 * Validates connectivity to the Firestore instance
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Client is currently offline or reconnecting.');
    }
    return false;
  }
}

// Test connection at app startup safely
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Please check your Firebase configuration or internet connection.');
    }
  }
}

testConnection().catch(() => {});

export default app;


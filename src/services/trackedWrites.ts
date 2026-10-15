/**
 * Versiones de setDoc, deleteDoc y writeBatch que informan a `syncStatus`.
 *
 * firestoreSync.ts las usa en lugar de las funciones originales. El resultado de cada
 * operación no cambia: solo se registra cuándo el servidor confirma la escritura o la rechaza.
 * Mientras no hay conexión, la promesa de Firestore queda abierta y la escritura figura como pendiente.
 */
import {
  setDoc as rawSetDoc,
  deleteDoc as rawDeleteDoc,
  writeBatch as rawWriteBatch
} from 'firebase/firestore';
import { syncStatus } from './syncStatus';

function track<T>(operation: Promise<T>): Promise<T> {
  syncStatus.begin();
  return operation.then(
    value => {
      syncStatus.succeed();
      return value;
    },
    error => {
      syncStatus.fail(error);
      throw error;
    }
  );
}

export const setDoc = ((...args: Parameters<typeof rawSetDoc>) =>
  track((rawSetDoc as any)(...args))) as typeof rawSetDoc;

export const deleteDoc = ((...args: Parameters<typeof rawDeleteDoc>) =>
  track((rawDeleteDoc as any)(...args))) as typeof rawDeleteDoc;

export const writeBatch = ((...args: Parameters<typeof rawWriteBatch>) => {
  const batch = (rawWriteBatch as any)(...args);
  const rawCommit = batch.commit.bind(batch);
  batch.commit = () => track(rawCommit());
  return batch;
}) as typeof rawWriteBatch;

// Pruebas de la bandeja de salida de partes (src/services/fieldOutbox.ts). Ejecutar: npx tsx scripts/outbox.test.ts
import { createFieldOutbox, newFieldReportId, type OutboxStorage } from '../src/services/fieldOutbox';
import type { FieldReport } from '../src/types';

let failed = 0;
const expect = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(ok ? '  ok   ' : '  FALLA', name, ok ? '' : detail);
};

/** Almacén en memoria con una demora, como un disco real: sirve para probar el orden y la durabilidad. */
const memory = (delayMs = 0): OutboxStorage & { data: Map<string, string>; saves: number } => {
  const data = new Map<string, string>();
  const store = {
    data,
    saves: 0,
    load: async (k: string) => (await new Promise(r => setTimeout(r, delayMs)), data.get(k) ?? null),
    save: async (k: string, v: string) => {
      await new Promise(r => setTimeout(r, delayMs));
      store.saves++;
      data.set(k, v);
    }
  };
  return store;
};
const open = async (storage: OutboxStorage, owner = 'a1') => {
  const box = createFieldOutbox(storage, owner);
  await box.ready;
  return box;
};
const report = (id: string): FieldReport => ({
  id, date: '2026-10-17', clientName: 'C', siteLocation: '', workPoint: 'P', isGuardia: false, horaEntrada: '08:00', horaSalida: '12:00',
  viajes: 1, crew: [], materials: [], description: 'd', submittedByUid: 'u', submittedByAuthUid: 'a1', submittedByName: 'N',
  submittedAt: '2026-10-17T10:00:00Z', status: 'Pendiente'
});

console.log('Alta y baja');
const store = memory(2);
const box = await open(store);
await box.add(report('P1'));
await box.add(report('P2'));
expect('guarda los partes enviados', box.list().length === 2);
await box.add(report('P1'));
expect('enviar dos veces el mismo parte no lo duplica', box.list().length === 2);
await box.remove('P1');
expect('al confirmar el servidor se borra', box.list().map(e => e.report.id).join() === 'P2');
expect('sobrevive a cerrar y abrir la app (lee lo guardado en el disco)', (await open(store)).list().length === 1);
expect('cada usuario tiene su propia bandeja', (await open(store, 'otro')).list().length === 0);

console.log('Durabilidad');
const slow = memory(30);
const boxSlow = await open(slow);
const pendingAdd = boxSlow.add(report('D1'));
expect('el parte se ve en pantalla al instante, antes de que termine de escribirse', boxSlow.list().length === 1 && slow.data.size === 0);
await pendingAdd;
expect('add se resuelve recién cuando el disco confirmó la escritura', slow.data.size === 1);
const burst = memory(5);
const boxBurst = await open(burst);
await Promise.all(['B1', 'B2', 'B3', 'B4'].map(id => boxBurst.add(report(id))));
expect('varios partes cargados seguidos no se pisan entre sí', (await open(burst)).list().length === 4, String((await open(burst)).list().length));

console.log('Rechazo del servidor y reintento');
await box.markFailed('P2', 'No tiene permiso para guardar este cambio.');
expect('un parte rechazado queda guardado con el motivo', box.list()[0].failed === 'No tiene permiso para guardar este cambio.');
const again = box.retry('P2');
expect('reintentar devuelve el parte, borra el motivo y cuenta el intento', again?.id === 'P2' && box.list()[0].failed === undefined && box.list()[0].attempts === 2);
expect('reintentar un parte inexistente no rompe', box.retry('NOPE') === null);

console.log('Reconciliación con lo que confirmó el servidor');
const r = await open(memory(), 'a1');
for (const id of ['A', 'B', 'C', 'D', 'E']) await r.add(report(id));
await r.markFailed('E', 'rechazado');
r.setInFlight('D', true);
const res = r.reconcile(new Set(['A']), new Set(['B']));
expect('el que el servidor ya tiene se confirma y se borra', res.confirmed.join() === 'A' && !r.list().some(e => e.report.id === 'A'));
expect('el que sigue pendiente de enviar en el teléfono no se reenvía', !res.resubmit.some(x => x.id === 'B'));
expect('el que no está en el servidor ni figura pendiente se perdió: se reenvía', res.resubmit.map(x => x.id).join() === 'C');
expect('el que se está enviando ahora no se reenvía', !res.resubmit.some(x => x.id === 'D'));
expect('el rechazado no se reenvía solo (decide la persona)', !res.resubmit.some(x => x.id === 'E'));
expect('todo lo no confirmado sigue en la bandeja', r.list().map(e => e.report.id).sort().join() === 'B,C,D,E');
const none = r.reconcile(new Set(['A', 'B', 'C', 'D', 'E']), new Set());
expect('cuando el servidor confirma todo, la bandeja queda vacía (también el que había fallado y ya llegó)', none.confirmed.length === 4 && r.list().length === 0, JSON.stringify(none.confirmed));

console.log('Datos dañados y avisos');
const bad = memory();
bad.data.set('job_campo_outbox_v1:a1', '{no es json');
expect('una bandeja dañada se lee como vacía', (await open(bad)).list().length === 0);
let calls = 0;
const watched = await open(memory());
const off = watched.subscribe(() => calls++);
await watched.add(report('X'));
await watched.markFailed('X', 'm');
await watched.remove('X');
off();
await watched.add(report('Y'));
expect('avisa a la pantalla en cada cambio y deja de avisar al desuscribirse', calls === 3, String(calls));
const full: OutboxStorage = { load: async () => null, save: async () => { throw new Error('QuotaExceeded'); } };
let threw = false;
try { await (await open(full)).add(report('Z')); } catch { threw = true; }
expect('si el teléfono no tiene espacio no rompe la carga del parte', !threw);
const broken: OutboxStorage = { load: async () => { throw new Error('disco ilegible'); }, save: async () => {} };
expect('si no se puede leer el disco, arranca con la bandeja vacía', (await open(broken)).list().length === 0);

console.log('Identificadores');
const ids = new Set(Array.from({ length: 2000 }, () => newFieldReportId()));
expect('2000 identificadores generados sin repetirse', ids.size === 2000);
expect('formato estable PC-...', [...ids].every(i => /^PC-[0-9A-Z]+-[0-9A-F]{8}$/.test(i)));

console.log(failed === 0 ? 'TODAS LAS PRUEBAS PASARON' : failed + ' PRUEBA(S) FALLARON');
process.exit(failed === 0 ? 0 : 1);

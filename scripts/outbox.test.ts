// Pruebas de la bandeja de salida de partes (src/services/fieldOutbox.ts). Ejecutar: npx tsx scripts/outbox.test.ts
import { createFieldOutbox, newFieldReportId, type OutboxStorage } from '../src/services/fieldOutbox';
import type { FieldReport } from '../src/types';

let failed = 0;
const expect = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(ok ? '  ok   ' : '  FALLA', name, ok ? '' : detail);
};

const memory = (): OutboxStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
const report = (id: string): FieldReport => ({
  id, date: '2026-10-17', clientName: 'C', siteLocation: '', workPoint: 'P', isGuardia: false, horaEntrada: '08:00', horaSalida: '12:00',
  viajes: 1, crew: [], materials: [], description: 'd', submittedByUid: 'u', submittedByAuthUid: 'a1', submittedByName: 'N',
  submittedAt: '2026-10-17T10:00:00Z', status: 'Pendiente'
});

console.log('Alta y baja');
const store = memory();
const box = createFieldOutbox(store, 'a1');
box.add(report('P1'));
box.add(report('P2'));
expect('guarda los partes enviados', box.list().length === 2);
box.add(report('P1'));
expect('enviar dos veces el mismo parte no lo duplica', box.list().length === 2);
box.remove('P1');
expect('al confirmar el servidor se borra', box.list().map(e => e.report.id).join() === 'P2');
expect('sobrevive a cerrar y abrir la app (misma clave de almacenamiento)', createFieldOutbox(store, 'a1').list().length === 1);
expect('cada usuario tiene su propia bandeja', createFieldOutbox(store, 'otro').list().length === 0);

console.log('Rechazo del servidor y reintento');
box.markFailed('P2', 'No tiene permiso para guardar este cambio.');
expect('un parte rechazado queda guardado con el motivo', box.list()[0].failed === 'No tiene permiso para guardar este cambio.');
const again = box.retry('P2');
expect('reintentar devuelve el parte, borra el motivo y cuenta el intento', again?.id === 'P2' && box.list()[0].failed === undefined && box.list()[0].attempts === 2);
expect('reintentar un parte inexistente no rompe', box.retry('NOPE') === null);

console.log('Reconciliación con lo que confirmó el servidor');
const r = createFieldOutbox(memory(), 'a1');
['A', 'B', 'C', 'D', 'E'].forEach(id => r.add(report(id)));
r.markFailed('E', 'rechazado');
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
bad.setItem('job_campo_outbox_v1:a1', '{no es json');
expect('una bandeja dañada se lee como vacía', createFieldOutbox(bad, 'a1').list().length === 0);
let calls = 0;
const watched = createFieldOutbox(memory(), 'a1');
const off = watched.subscribe(() => calls++);
watched.add(report('X'));
watched.markFailed('X', 'm');
watched.remove('X');
off();
watched.add(report('Y'));
expect('avisa a la pantalla en cada cambio y deja de avisar al desuscribirse', calls === 3, String(calls));
const full: OutboxStorage = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } };
let threw = false;
try { createFieldOutbox(full, 'a1').add(report('Z')); } catch { threw = true; }
expect('si el teléfono no tiene espacio no rompe la carga del parte', !threw);

console.log('Identificadores');
const ids = new Set(Array.from({ length: 2000 }, () => newFieldReportId()));
expect('2000 identificadores generados sin repetirse', ids.size === 2000);
expect('formato estable PC-...', [...ids].every(i => /^PC-[0-9A-Z]+-[0-9A-F]{8}$/.test(i)));

console.log(failed === 0 ? 'TODAS LAS PRUEBAS PASARON' : failed + ' PRUEBA(S) FALLARON');
process.exit(failed === 0 ? 0 : 1);

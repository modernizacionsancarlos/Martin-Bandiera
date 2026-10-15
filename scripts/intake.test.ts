// Pruebas de src/utils/remitoIntake.ts (lectura de fotos de remitos -> parte de campo). Ejecutar: npx tsx scripts/intake.test.ts
import {
  sanitizeExtraction,
  buildFieldReportFromExtraction,
  bestMatch,
  normalizeName,
  reportIdForSource,
  summarizeForSender,
  isSamePerson
} from '../src/utils/remitoIntake';
import type { FieldCatalog } from '../src/types';

let failed = 0;
const expect = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(ok ? '  ok   ' : '  FALLA', name, ok ? '' : detail);
};

const catalog: FieldCatalog = {
  clients: [
    { id: 'c1', razonSocial: 'Bodega Los Álamos S.A.', fincaLocacion: 'Finca Los Álamos' },
    { id: 'c2', razonSocial: 'Bodega Los Almendros S.A.', fincaLocacion: 'Finca Almendros' },
    { id: 'c3', razonSocial: 'Finca El Mirador S.R.L.', fincaLocacion: 'El Mirador' }
  ],
  workers: [
    { id: 'w1', name: 'BRUNO CACERES' },
    { id: 'w2', name: 'CAMILA SUAREZ' },
    { id: 'w3', name: 'NICOLAS HERRERA' }
  ],
  materials: [
    { id: 'm1', name: 'Contactor 25A' },
    { id: 'm2', name: 'Cable subterráneo 4x16 mm²' }
  ]
};
const ctx = {
  channel: 'whatsapp' as const,
  catalog,
  submittedBy: { uid: 'u-cap', authUid: 'a-cap', name: 'Nicolás Herrera' },
  sourceRef: 'wamid.ABC123',
  today: '2026-10-14',
  now: new Date('2026-10-14T12:00:00Z')
};

console.log('Validación de la respuesta de la IA');
const dirty = sanitizeExtraction({
  fecha: '14/10/2026',
  horaEntrada: '25:99',
  horaSalida: '13:30',
  horasTrabajadas: '4,5',
  kilometros: -5,
  viajes: 'abc',
  esGuardia: 'si',
  cliente: '  Bodega   Los Alamos  ',
  cuadrilla: [{ nombre: 'bruno caceres', rol: 'oficial' }, { rol: 'x' }, null],
  materiales: [{ descripcion: 'contactor 25a', cantidad: '2' }, { descripcion: '' }],
  confianzaLectura: 250
});
expect('fecha inválida se descarta', dirty.fecha === undefined);
expect('hora inválida se descarta y la válida se conserva', dirty.horaEntrada === undefined && dirty.horaSalida === '13:30');
expect('número con coma se interpreta', dirty.horasTrabajadas === 4.5);
expect('valores fuera de rango se descartan', dirty.kilometros === undefined && dirty.confianzaLectura === undefined);
expect('texto y booleano inválidos se descartan', dirty.viajes === undefined && dirty.esGuardia === undefined);
expect('espacios del cliente se normalizan', dirty.cliente === 'Bodega Los Alamos');
expect('personal sin nombre se descarta', dirty.cuadrilla?.length === 1);
expect('material sin descripción se descarta', dirty.materiales?.length === 1 && dirty.materiales[0].cantidad === 2);
expect('basura total no rompe', Object.keys(sanitizeExtraction('texto')).length > 0 && sanitizeExtraction(null).cuadrilla?.length === 0);

console.log('Coincidencia con el catálogo');
expect('ignora tildes y forma legal', normalizeName('Bodega Los Álamos S.A.') === 'bodega los alamos');
expect('encuentra el cliente con errores de letra', bestMatch('Bodega Los Alamos', catalog.clients, c => c.razonSocial)?.id === 'c1');
expect('no inventa un cliente que no existe', bestMatch('Finca La Consulta', catalog.clients, c => c.razonSocial) === null);
const twins = [{ n: 'Finca Pino 1' }, { n: 'Finca Pino 2' }];
expect('no elige entre dos nombres igual de parecidos', bestMatch('Finca Pino', twins, t => t.n) === null);
expect('con una diferencia clara sí elige', bestMatch('Finca Pino 2', twins, t => t.n)?.n === 'Finca Pino 2');

console.log('Armado del parte');
const good = buildFieldReportFromExtraction(
  sanitizeExtraction({
    remitoPapel: '0001-0004523',
    fecha: '2026-10-13',
    cliente: 'Bodega Los Alamos',
    puntoTrabajo: 'Pozo 2',
    descripcion: 'Cambio de contactor.',
    horaEntrada: '08:00',
    horaSalida: '12:30',
    viajes: 1,
    cuadrilla: [{ nombre: 'Nicolas Herrera', rol: 'oficial' }, { nombre: 'bruno caceres', rol: 'oficial' }, { nombre: 'Bruno Caceres' }],
    materiales: [{ descripcion: 'contactor 25 A', cantidad: 1 }],
    confianzaLectura: 92
  }),
  ctx
);
expect('cliente tomado del catálogo y finca completada', good.clientName === 'Bodega Los Álamos S.A.' && good.siteLocation === 'Finca Los Álamos');
expect('el capataz no se repite en la cuadrilla y no hay duplicados', good.crew.length === 1 && good.crew[0].name === 'BRUNO CACERES' && good.crew[0].role === 'Oficial');
expect('material con nombre del catálogo', good.materials[0].name === 'Contactor 25A');
expect('lectura clara no genera revisiones', good.revisar === undefined);
expect('entra como Pendiente con su canal y su capataz', good.status === 'Pendiente' && good.origen === 'whatsapp' && good.submittedByAuthUid === 'a-cap');
expect('conserva el número de papel y la confianza', good.remitoPapel === '0001-0004523' && good.confianza === 92);
expect('no lleva ningún precio', !('billedPrice' in good) && !('suggestedPrice' in good));

const doubtful = buildFieldReportFromExtraction(
  sanitizeExtraction({ cliente: 'Finca La Consulta', cuadrilla: [{ nombre: 'Facundo' }], materiales: [{ descripcion: 'fusible raro', cantidad: 3 }], confianzaLectura: 55 }),
  ctx
);
expect('lectura dudosa queda marcada para revisar', (doubtful.revisar?.length ?? 0) >= 5);
expect('cliente desconocido se conserva como texto', doubtful.clientName === 'Finca La Consulta');
expect('personal desconocido se conserva en mayúsculas', doubtful.crew[0].name === 'FACUNDO');
expect('sin fecha usa la de hoy y lo avisa', doubtful.date === '2026-10-14' && doubtful.revisar!.some(r => r.includes('fecha')));
expect('sin horario completa y lo avisa', doubtful.horaEntrada === '08:00' && doubtful.revisar!.some(r => r.includes('Horario')));

const empty = buildFieldReportFromExtraction(sanitizeExtraction({}), ctx);
expect('lectura vacía igual genera un parte revisable', empty.clientName === 'CLIENTE SIN IDENTIFICAR' && empty.revisar!.length >= 3);

console.log('Remito real (transcripción de una foto de un talonario)');
const realCatalog: FieldCatalog = {
  clients: [{ id: 'r1', razonSocial: 'El Magistral', fincaLocacion: 'Los Pintados' }],
  workers: [{ id: 'r2', name: 'FACUNDO PEREZ' }, { id: 'r3', name: 'MATIAS VEGA' }],
  materials: []
};
const realRemito = sanitizeExtraction({
  remitoPapel: '0002-00010966',
  fecha: '2026-08-03',
  cliente: 'El Magistral',
  ubicacion: 'Los Pintados',
  puntoTrabajo: 'Cabaña, galpón, sala de riego',
  descripcion: 'Se realiza en cabaña el cambio de disyuntor que era chico, se cambió a uno de 40A. En galpón se realizó el cambio de un fotocontrol y en sala de riego se cambian dos fotocontroles ya que los que estaban se encontraban dañados.',
  horaEntrada: '13:30',
  horaSalida: '17:00',
  viajes: 1,
  cantidadPersonal: 2,
  tecnicoLider: 'Facundo',
  cuadrilla: [{ nombre: 'Facundo' }, { nombre: 'Matías V' }],
  materiales: [],
  confianzaLectura: 70
});
const realCtx = {
  channel: 'whatsapp' as const,
  catalog: realCatalog,
  submittedBy: { uid: 'u', authUid: 'a', name: 'Facundo Pérez' },
  sourceRef: 'x',
  today: '2026-08-04'
};
const real = buildFieldReportFromExtraction(realRemito, realCtx);
expect('el cliente y la finca salen del catálogo', real.clientName === 'El Magistral' && real.siteLocation === 'Los Pintados');
expect('"Facundo" del papel es el capataz que mandó la foto: no se duplica', !real.crew.some(c => c.name.includes('FACUNDO')));
expect('"Matías V" queda como único acompañante', real.crew.length === 1, JSON.stringify(real.crew));
expect('"Matías V" (nombre abreviado) no se adivina: se conserva y se marca', real.crew[0]?.name === 'MATÍAS V' && real.revisar?.some(r => r.includes('Matías V')) === true, JSON.stringify(real.crew));
expect('el casillero PERS (2) coincide con las personas leídas', !real.revisar?.some(r => r.includes('persona(s)')));
expect('sin materiales en el papel: avisa que se completen', real.revisar?.some(r => r.includes('no los detalla')) === true);
expect('la fecha reciente no se marca', !real.revisar?.some(r => r.includes('fecha del remito')));
const lateReal = buildFieldReportFromExtraction(realRemito, { ...realCtx, today: '2026-10-14' });
expect('si llega meses después, la fecha se confirma (8 y 9 se confunden)', lateReal.revisar?.some(r => r.includes('hace 72 días')) === true);
const wrongCount = buildFieldReportFromExtraction({ ...realRemito, cantidadPersonal: 3 }, realCtx);
expect('si PERS no coincide con los nombres leídos, se marca', wrongCount.revisar?.some(r => r.includes('3 persona(s)')) === true);
const future = buildFieldReportFromExtraction({ ...realRemito, fecha: '2026-09-03' }, realCtx);
expect('fecha posterior a la llegada de la foto se marca', future.revisar?.some(r => r.includes('posterior')) === true);
expect('mismo nombre de pila con apellido es la misma persona', isSamePerson('Facundo', 'Facundo Pérez') && !isSamePerson('Facundo', 'Facundo') === false && !isSamePerson('Facundo', 'Federico Pérez'));

console.log('Identificadores y respuesta');
expect('mismo mensaje, mismo identificador', reportIdForSource('whatsapp', 'wamid.ABC123') === reportIdForSource('whatsapp', 'wamid.ABC123'));
expect('identificador distinto por canal', reportIdForSource('whatsapp', 'x1') !== reportIdForSource('drive', 'x1'));
expect('identificador sin caracteres peligrosos', !/[/. ]/.test(reportIdForSource('drive', '../../a b/c').slice(3)));
const msg = summarizeForSender(good);
expect('respuesta resume cliente, personal y materiales', /Bodega Los Álamos/.test(msg) && /BRUNO CACERES/.test(msg) && /Contactor 25A/.test(msg));
expect('respuesta avisa si hay datos a revisar', /revisar algunos datos/.test(summarizeForSender(doubtful)));

console.log(failed === 0 ? 'TODAS LAS PRUEBAS PASARON' : failed + ' PRUEBA(S) FALLARON');
process.exit(failed === 0 ? 0 : 1);

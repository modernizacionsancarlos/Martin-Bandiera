import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, DatabaseBackup, Download, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import * as XLSX from 'xlsx';
import { AuditAccess, AuditRow, BackupRun, backupNow, describeDevice, downloadBackup, listAccess, listAudit, listBackups } from '../services/auditLog';
import { todayLocalISO } from '../utils/dateUtils';

const ACTIONS: Record<string, { label: string; tone: string }> = {
  ingreso: { label: 'Ingreso', tone: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300' },
  cierre: { label: 'Cierre de sesión', tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  crear: { label: 'Alta', tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
  editar: { label: 'Edición', tone: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
  borrar: { label: 'Borrado', tone: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' },
  cambio_clave: { label: 'Cambio de clave', tone: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300' },
  cambio_rol: { label: 'Cambio de rol', tone: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300' },
  cuenta_creada: { label: 'Cuenta creada', tone: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300' },
  cuenta_borrada: { label: 'Cuenta borrada', tone: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' }
};

const GROUPS = [
  { value: '', label: 'Todo' },
  { value: 'ingreso,cierre', label: 'Ingresos y cierres' },
  { value: 'crear,editar,borrar', label: 'Altas, ediciones y borrados' },
  { value: 'borrar', label: 'Solo borrados' },
  { value: 'cambio_clave,cambio_rol,cuenta_creada,cuenta_borrada', label: 'Cuentas, claves y roles' }
];

const COLLECTIONS: Record<string, string> = {
  auditRecords: 'Remito', archivedReceipts: 'Comprobante', clients: 'Cliente', materials: 'Material', vehicles: 'Vehículo',
  vehicleEvents: 'Evento de vehículo', projects: 'Proyecto', maintenanceServices: 'Mantenimiento', users: 'Usuario', workers: 'Personal',
  technicalParameters: 'Parámetros de costos', systemSettings: 'Configuración', financials: 'Reporte', acceso: 'Acceso', cuenta: 'Cuenta'
};

const FIELDS: Record<string, string> = {
  status: 'Estado', billedPrice: 'Precio', suggestedPrice: 'Precio sugerido', collectedPrice: 'Cobrado', honorarios: 'Honorarios',
  logisticsCost: 'Logística', techPay: 'M.O. capataz', helperPay: 'M.O. ayudante', laborDirectCost: 'Mano de obra', materialsCost: 'Materiales',
  operatingCost: 'Costo operativo', marginPercentage: 'Margen %', hoursWorked: 'Horas', viajes: 'Viajes', distanceKm: 'Distancia (km)',
  date: 'Fecha', clientName: 'Cliente', siteLocation: 'Sede', workPoint: 'Punto de trabajo', description: 'Descripción', remitoPapel: 'Nº papel',
  remitoId: 'Nº remito', numeroFactura: 'Nº factura', fechaFactura: 'Fecha factura', fechaCobro: 'Fecha cobro', leadTech: 'Capataz', helpers: 'Ayudantes',
  teamMembers: 'Equipo', semaforo: 'Semáforo', totalFacturado: 'Total facturado', recargo7Pct: 'Recargo 7%', ivaAmount: 'IVA', montoBaseRemito: 'Base factura',
  retencionIVA: 'Ret. IVA', retencionIIBB: 'Ret. IIBB', retencionGanancias: 'Ret. ganancias', paymentMethods: 'Formas de pago', signatureUrl: 'Firma',
  razonSocial: 'Razón social', cuit: 'CUIT', distanciaKm: 'Distancia (km)', stock: 'Stock', unitPrice: 'Precio unitario', role: 'Rol', active: 'Activo',
  customPermissions: 'Permisos', hourlyRate: 'Valor hora', message: 'Nota', asignadoNombre: 'A cargo de', transferencias: 'Transferencias'
};

const show = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return 'vacío';
  if (typeof v === 'number') return v.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (Array.isArray(v) && v.every(x => typeof x !== 'object')) return v.length ? v.join(', ') : 'vacío';
  return typeof v === 'string' ? v : JSON.stringify(v);
};

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'medium' }) : 'nunca');

const inputClass = 'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white';
const PAGE = 100;
const changesOf = (r: AuditRow): [string, { antes: unknown; despues: unknown }][] => (r.changes ? Object.entries(r.changes) : []);

// Logins and changes of every user. The database only answers to the account set as viewer.
export const AuditControlView: React.FC = () => {
  const [tab, setTab] = useState<'movimientos' | 'usuarios' | 'copias'>('movimientos');
  const [backups, setBackups] = useState<BackupRun[] | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [actors, setActors] = useState<string[]>([]);
  const [access, setAccess] = useState<AuditAccess[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(
    async (before?: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = await listAudit({ actor, action, from, to, search, before, limit: PAGE });
        setRows(prev => (before ? [...prev, ...result.rows] : result.rows));
        setActors(result.actors);
        setHasMore(result.rows.length === PAGE);
        if (!before) setAccess(await listAccess());
      } catch {
        setError('No se pudo leer el registro. Revise la conexión e intente de nuevo.');
      } finally {
        setLoading(false);
      }
    },
    [actor, action, from, to, search]
  );

  useEffect(() => {
    const t = setTimeout(() => void load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  const runBackupTask = async (task: () => Promise<void>, failure: string) => {
    setBackupBusy(true);
    setError(null);
    try {
      await task();
      setBackups(await listBackups());
    } catch {
      setError(failure);
    } finally {
      setBackupBusy(false);
    }
  };

  useEffect(() => {
    listBackups().then(setBackups).catch(() => setBackups(null));
  }, []);

  // The copy runs every night: a day and a half without one means it stopped.
  const backupLate = backups !== null && (backups.length === 0 || Date.now() - new Date(backups[0].at).getTime() > 36 * 3600 * 1000);

  const exportExcel = () => {
    const sheet = XLSX.utils.json_to_sheet(
      rows.map(r => ({
        Fecha: when(r.at),
        Usuario: r.actor,
        Rol: r.actor_role || '',
        Acción: ACTIONS[r.action]?.label || r.action,
        Tipo: COLLECTIONS[r.collection || ''] || r.collection || '',
        Elemento: r.label || '',
        Detalle: r.detail || '',
        Cambios: changesOf(r).map(([k, c]) => `${FIELDS[k] || k}: ${show(c.antes)} > ${show(c.despues)}`).join(' | '),
        Dispositivo: describeDevice(r.device, r.origin),
        IP: r.ip || ''
      }))
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Movimientos');
    XLSX.writeFile(book, `Control_Movimientos_${todayLocalISO()}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-cyan-700 text-white flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-black text-slate-900 dark:text-white">Control de accesos y cambios</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Solo su usuario puede ver esta pantalla.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </button>
            <button type="button" onClick={exportExcel} disabled={rows.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold cursor-pointer">
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
          </div>
        </div>
        <div className="flex gap-1.5" role="tablist" aria-label="Vista">
          {([
            ['movimientos', 'Movimientos'],
            ['usuarios', `Usuarios (${access.length})`],
            ['copias', 'Copias']
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer ${
                tab === value ? 'bg-cyan-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'movimientos' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input aria-label="Buscar" className={`${inputClass} pl-9`} placeholder="Nº remito, cliente…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select aria-label="Usuario" className={inputClass} value={actor} onChange={e => setActor(e.target.value)}>
              <option value="">Todos los usuarios</option>
              {actors.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select aria-label="Tipo de movimiento" className={inputClass} value={action} onChange={e => setAction(e.target.value)}>
              {GROUPS.map(g => (
                <option key={g.label} value={g.value}>{g.label}</option>
              ))}
            </select>
            <input aria-label="Desde" type="date" className={inputClass} value={from} onChange={e => setFrom(e.target.value)} />
            <input aria-label="Hasta" type="date" className={inputClass} value={to} onChange={e => setTo(e.target.value)} />
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold">{error}</p>
      )}

      {backupLate && (
        <p role="alert" className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold">
          No hay copia de seguridad de las últimas 36 horas. Haga una en la solapa Copias y avise a soporte.
        </p>
      )}

      {tab === 'copias' ? (
        <div className="space-y-2">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl">
              Se hace una copia cada noche a las 3:00 y se guardan 90 días. Las copias están dentro de Supabase: descargue una cada tanto y guárdela fuera.
            </p>
            <button
              type="button"
              disabled={backupBusy}
              onClick={() => void runBackupTask(backupNow, 'No se pudo hacer la copia. Intente de nuevo.')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
            >
              <DatabaseBackup className="w-3.5 h-3.5" /> {backupBusy ? 'Trabajando…' : 'Hacer copia ahora'}
            </button>
          </div>
          <ul className="space-y-1.5">
            {(backups || []).map(b => (
              <li key={b.id} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-800 dark:text-slate-100">
                  <strong>{when(b.at)}</strong> · {b.kind === 'manual' ? 'manual' : 'automática'} · {b.documents} documentos, {b.remitos} remitos
                </span>
                <button
                  type="button"
                  disabled={backupBusy}
                  onClick={() => void runBackupTask(() => downloadBackup(b), 'No se pudo descargar la copia.')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : tab === 'movimientos' ? (
        <>
          {!loading && rows.length === 0 && !error && (
            <p className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-sm text-slate-500 dark:text-slate-400">
              No hay movimientos con esos filtros.
            </p>
          )}
          <ul className="space-y-1.5">
            {rows.map(r => {
              const changes = changesOf(r);
              const open = openId === r.id;
              const tone = ACTIONS[r.action] || { label: r.action, tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };
              return (
                <li key={r.id} className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : r.id)}
                    aria-expanded={open}
                    className="w-full p-3 flex flex-col sm:flex-row sm:items-center gap-2 text-left cursor-pointer"
                  >
                    <span className="shrink-0 sm:w-36 font-mono text-[11px] text-slate-500 dark:text-slate-400">{when(r.at)}</span>
                    <span className={`shrink-0 w-fit px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${tone.tone}`}>{tone.label}</span>
                    <span className="flex-1 min-w-0 text-xs text-slate-800 dark:text-slate-100">
                      <strong className="block truncate">{r.actor}</strong>
                      <span className="block truncate text-slate-500 dark:text-slate-400">
                        {r.collection === 'acceso'
                          ? `${describeDevice(r.device, r.origin)}${r.ip ? ` · IP ${r.ip}` : ''}`
                          : `${COLLECTIONS[r.collection || ''] || r.collection || ''} ${r.label || ''}${r.detail ? ` · ${r.detail}` : ''}`}
                      </span>
                    </span>
                    <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {changes.length > 0 ? `${changes.length} ${changes.length === 1 ? 'campo' : 'campos'}` : 'Detalle'}
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </span>
                  </button>
                  {open && (
                    <div className="px-3 pb-3 space-y-2 text-xs border-t border-slate-100 dark:border-slate-800 pt-2">
                      {changes.length > 0 && (
                        <dl className="space-y-1">
                          {changes.map(([key, c]) => (
                            <div key={key} className="grid grid-cols-1 sm:grid-cols-[10rem_1fr_1fr] gap-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                              <dt className="font-bold text-slate-700 dark:text-slate-200">{FIELDS[key] || key}</dt>
                              <dd className="min-w-0 break-words text-rose-700 dark:text-rose-300">Antes: {show(c.antes)}</dd>
                              <dd className="min-w-0 break-words text-emerald-700 dark:text-emerald-300">Después: {show(c.despues)}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 break-words">
                        {r.actor_role ? `Rol ${r.actor_role} · ` : ''}
                        {describeDevice(r.device, r.origin)}
                        {r.ip ? ` · IP ${r.ip}` : ''}
                        {r.doc_id ? ` · ID ${r.doc_id}` : ''}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {hasMore && (
            <button type="button" onClick={() => void load(rows[rows.length - 1]?.id)} disabled={loading} className="w-full py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50 cursor-pointer">
              {loading ? 'Cargando…' : 'Ver más'}
            </button>
          )}
        </>
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {access.map(u => (
            <li key={u.login} className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-black text-sm text-slate-900 dark:text-white truncate">{u.name || u.login}</p>
                  <p className="text-slate-500 dark:text-slate-400 truncate">{u.login} · {u.role}</p>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                    u.sessions.length > 0
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {u.sessions.length > 0 ? `${u.sessions.length} ${u.sessions.length === 1 ? 'sesión abierta' : 'sesiones abiertas'}` : u.lastSignIn ? 'Sin sesión' : 'Nunca entró'}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Último ingreso: <strong>{when(u.lastSignIn)}</strong> · {u.logins} ingresos y {u.changes} cambios registrados
                {u.mustChangePassword ? ' · debe cambiar la clave' : ''}
              </p>
              {u.sessions.map((s, i) => (
                <p key={i} className="text-[11px] text-slate-500 dark:text-slate-400 break-words">
                  {describeDevice(s.device)}{s.ip ? ` · IP ${s.ip}` : ''} · desde {when(s.since)} · último uso {when(s.lastUse)}
                </p>
              ))}
              <button
                type="button"
                onClick={() => {
                  setActor(u.login);
                  setTab('movimientos');
                }}
                className="text-xs font-bold text-cyan-700 dark:text-cyan-400 cursor-pointer"
              >
                Ver sus movimientos
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

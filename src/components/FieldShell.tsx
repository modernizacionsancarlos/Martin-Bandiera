import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PlusCircle, LogOut, CheckCircle2, CloudUpload, AlertTriangle, Sun, Moon, RefreshCw, Pencil, ArrowRightLeft, Lock, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { OUTBOX_EVENT, SYNC_ERROR_EVENT } from '../services/docstore';
import {
  FieldDirectory,
  FieldReportItem,
  FieldReportPayload,
  cachedDirectory,
  cachedMine,
  loadDirectory,
  loadMine,
  markFailed,
  mergedReports,
  pendingFieldIds,
  sentHistory,
  submitFieldReport,
  transferFieldReport,
  updateFieldReport
} from '../services/fieldReports';
import { FieldRemitoForm } from './FieldRemitoForm';

type Capataz = { id: string; name: string; cuadrilla?: string | null; hasAccount?: boolean };

// The whole app for Capataz and Empleado: load, edit and hand over remitos. No amounts anywhere.
export const FieldShell: React.FC = () => {
  const { currentUser, logout, isPreviewingOtherUser, exitPreview } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const [directory, setDirectory] = useState<FieldDirectory>(() => cachedDirectory());
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [history, setHistory] = useState(() => sentHistory());
  const [pending, setPending] = useState(() => pendingFieldIds());
  const [mine, setMine] = useState(() => cachedMine());
  const [justSent, setJustSent] = useState<string | null>(null);
  const [editing, setEditing] = useState<FieldReportItem | null>(null);
  const [transferring, setTransferring] = useState<FieldReportItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setHistory(sentHistory());
    setPending(pendingFieldIds());
    setMine(cachedMine());
  }, []);

  const reloadMine = useCallback(() => {
    void loadMine().then(list => {
      setMine(list);
      setPending(pendingFieldIds());
    });
  }, []);

  useEffect(() => {
    void loadDirectory().then(setDirectory);
    reloadMine();
    const onOnline = () => {
      void loadDirectory().then(setDirectory);
      reloadMine();
    };
    const onError = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const path = String(detail.path || '');
      const id = path.startsWith('auditRecords/') ? path.slice('auditRecords/'.length) : '';
      // Already on the server: an edit or transfer was rejected (e.g. administration closed it).
      if (id && cachedMine().some(r => r.id === id)) {
        setNotice(
          /cerrado/i.test(String(detail.message || ''))
            ? 'Administración ya cerró ese remito: el cambio no se guardó.'
            : 'No se pudo guardar un cambio de remito. Revíselo y vuelva a intentar.'
        );
      } else if (id) {
        markFailed(id);
      }
      refresh();
      reloadMine();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener(OUTBOX_EVENT, refresh);
    window.addEventListener(`${OUTBOX_EVENT}:flushed`, reloadMine);
    window.addEventListener(SYNC_ERROR_EVENT, onError);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener(OUTBOX_EVENT, refresh);
      window.removeEventListener(`${OUTBOX_EVENT}:flushed`, reloadMine);
      window.removeEventListener(SYNC_ERROR_EVENT, onError);
    };
  }, [refresh, reloadMine]);

  const isCapataz = currentUser?.role === 'Capataz';
  const firstName = (currentUser?.displayName || '').split(' ')[0];
  const items = useMemo(
    () => mergedReports(mine, history, pending, currentUser?.email || ''),
    [mine, history, pending, currentUser?.email]
  );
  const otherCapataces = useMemo(
    () =>
      directory.capataces.filter(
        (c): c is Capataz =>
          !!c.id && c.id !== currentUser?.uid && c.name !== currentUser?.displayName
      ),
    [directory.capataces, currentUser?.uid, currentUser?.displayName]
  );

  const flash = (message: string) => {
    setJustSent(message);
    window.scrollTo({ top: 0 });
    setTimeout(() => setJustSent(null), 6000);
  };
  const offline = () => navigator.onLine === false;

  const handleSubmit = async (payload: FieldReportPayload) => {
    if (editing) {
      await updateFieldReport(editing.id, payload);
      setEditing(null);
      refresh();
      setFormOpen(false);
      flash(offline() ? 'Cambios guardados. Se van a enviar solos cuando vuelva la señal.' : 'Cambios guardados en el sistema.');
      return;
    }
    await submitFieldReport(payload);
    refresh();
    setFormOpen(false);
    flash(offline() ? 'Remito guardado. Se va a enviar solo cuando vuelva la señal.' : 'Remito guardado. Ya se envió al sistema.');
  };

  const handleTransfer = async (to: Capataz, nota: string) => {
    if (!transferring) return;
    await transferFieldReport(transferring.id, to, nota);
    setTransferring(null);
    refresh();
    flash(`Remito transferido a ${to.name}.${offline() ? ' Se envía cuando vuelva la señal.' : ''}`);
  };

  const retry = async (id: string) => {
    const item = sentHistory().find(r => r.id === id);
    if (!item) return;
    await submitFieldReport(item.payload, id).catch(() => markFailed(id));
    refresh();
  };

  const openForm = (item?: FieldReportItem) => {
    setEditing(item || null);
    setFormKey(k => k + 1);
    setFormOpen(true);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-20 bg-slate-900 text-white">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-black">JB</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black truncate">
              {formOpen ? (editing ? `Editar ${editing.remitoId || 'remito'}` : 'Nuevo remito') : `Hola${firstName ? `, ${firstName}` : ''}`}
            </p>
            <p className="text-[11px] text-slate-400 truncate">{isCapataz ? 'Capataz' : 'Personal de campo'} · JOB Bandiera</p>
          </div>
          <button type="button" onClick={toggleDarkMode} className="p-2 rounded-lg hover:bg-slate-800 cursor-pointer" title={darkMode ? 'Modo claro' : 'Modo oscuro'}>
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>
          <button type="button" onClick={logout} className="p-2 rounded-lg hover:bg-slate-800 cursor-pointer" title="Cerrar sesión">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {isPreviewingOtherUser && (
        <div className="bg-purple-600 text-white text-xs font-bold">
          <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">Vista previa como {currentUser?.displayName}</span>
            <button type="button" onClick={exitPreview} className="shrink-0 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 cursor-pointer">
              Volver a mi cuenta
            </button>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-4">
        {formOpen ? (
          <FieldRemitoForm
            key={formKey}
            directory={directory}
            defaultLeadTech={isCapataz ? currentUser?.displayName || '' : ''}
            initial={editing?.payload}
            onSubmit={handleSubmit}
            onCancel={() => {
              setFormOpen(false);
              setEditing(null);
            }}
          />
        ) : (
          <div className="space-y-4">
            {justSent && (
              <div role="status" className="p-4 rounded-2xl bg-emerald-600 text-white flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-bold">{justSent}</p>
              </div>
            )}

            {notice && (
              <div role="alert" className="p-4 rounded-2xl bg-rose-600 text-white flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="flex-1 text-sm font-bold">{notice}</p>
                <button type="button" onClick={() => setNotice(null)} className="p-1 cursor-pointer" title="Cerrar aviso">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => openForm()}
              className="w-full flex items-center justify-center gap-3 py-6 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-lg font-black shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              <PlusCircle className="w-7 h-7" />
              Cargar remito
            </button>

            {directory.clients.length === 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-sm flex items-start gap-3">
                <RefreshCw className="w-5 h-5 shrink-0 mt-0.5" />
                <p>
                  Todavía no se descargó la lista de clientes y personal. Conéctese a internet una vez para tenerla disponible sin señal.
                </p>
              </div>
            )}

            <section>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Mis remitos</h2>
              {items.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
                  Todavía no tiene remitos cargados.
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map(r => (
                    <li key={r.id} className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">
                            {r.remitoId && <span className="font-mono text-cyan-700 dark:text-cyan-400 mr-1.5">{r.remitoId}</span>}
                            {r.payload.clientName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {(r.payload.date || '').split('-').reverse().join('/')}
                            {r.payload.remitoPapel ? ` · Papel ${r.payload.remitoPapel}` : ''}
                            {r.payload.workPoint ? ` · ${r.payload.workPoint}` : ''}
                          </p>
                          {r.receivedFrom && (
                            <p className="text-[11px] font-bold text-violet-700 dark:text-violet-300 truncate">Recibido de {r.receivedFrom}</p>
                          )}
                        </div>
                        <StatusChip item={r} onRetry={() => void retry(r.id)} />
                      </div>
                      {r.editable && !r.failed && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openForm(r)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Editar
                          </button>
                          {isCapataz && (
                            <button
                              type="button"
                              onClick={() => setTransferring(r)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-200 text-xs font-bold cursor-pointer"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" /> Transferir
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>

      {transferring && (
        <TransferDialog item={transferring} capataces={otherCapataces} onCancel={() => setTransferring(null)} onConfirm={handleTransfer} />
      )}
    </div>
  );
};

const chip = 'shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold';

const StatusChip: React.FC<{ item: FieldReportItem; onRetry: () => void }> = ({ item, onRetry }) => {
  if (item.failed)
    return (
      <button type="button" onClick={onRetry} className={`${chip} bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 cursor-pointer`}>
        <AlertTriangle className="w-3.5 h-3.5" /> Reintentar
      </button>
    );
  if (item.pending)
    return (
      <span className={`${chip} bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300`}>
        <CloudUpload className="w-3.5 h-3.5" /> Pendiente
      </span>
    );
  if (item.transferredTo)
    return (
      <span className={`${chip} max-w-[45%] bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-200`}>
        <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">A {item.transferredTo}</span>
      </span>
    );
  if (item.closed && item.remitoId)
    return (
      <span className={`${chip} bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300`}>
        <Lock className="w-3.5 h-3.5" /> Cerrado
      </span>
    );
  return (
    <span className={`${chip} bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300`}>
      <CheckCircle2 className="w-3.5 h-3.5" /> Enviado
    </span>
  );
};

const TransferDialog: React.FC<{
  item: FieldReportItem;
  capataces: Capataz[];
  onCancel: () => void;
  onConfirm: (to: Capataz, nota: string) => Promise<void>;
}> = ({ item, capataces, onCancel, onConfirm }) => {
  const [toId, setToId] = useState('');
  const [nota, setNota] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldClass = 'w-full px-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800';

  const confirm = async () => {
    const to = capataces.find(c => c.id === toId && c.hasAccount !== false);
    if (!to) return setError('Elija el capataz que sigue el trabajo.');
    setSending(true);
    try {
      await onConfirm(to, nota.trim());
    } catch {
      setError('No se pudo transferir. Intente de nuevo.');
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="transfer-title">
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
      >
        <div>
          <h2 id="transfer-title" className="text-base font-black">Transferir remito</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {item.remitoId ? `${item.remitoId} · ` : ''}
            {item.payload.clientName}. El otro capataz lo va a poder completar y editar. Usted deja de tenerlo a cargo.
          </p>
        </div>
        <div>
          <label htmlFor="transfer-to" className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
            Capataz que sigue el trabajo
          </label>
          <select id="transfer-to" value={toId} onChange={e => setToId(e.target.value)} className={fieldClass}>
            <option value="">Elegir…</option>
            {capataces.map(c => (
              <option key={c.id} value={c.id} disabled={c.hasAccount === false}>
                {c.name}
                {c.cuadrilla ? ` · ${c.cuadrilla}` : ''}
                {c.hasAccount === false ? ' (sin usuario)' : ''}
              </option>
            ))}
          </select>
          {!capataces.some(c => c.hasAccount !== false) && (
            <p className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-300">
              Ningún otro capataz tiene usuario todavía. Administración debe crearlo en Usuarios y Permisos.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="transfer-note" className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
            Nota para el otro capataz y administración (opcional)
          </label>
          <textarea
            id="transfer-note"
            rows={3}
            value={nota}
            onChange={e => setNota(e.target.value)}
            placeholder="Qué falta hacer, por qué se transfiere…"
            className={fieldClass}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm font-bold text-rose-600">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="px-5 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold cursor-pointer">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={sending}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-black disabled:opacity-60 cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4" /> {sending ? 'Transfiriendo…' : 'Transferir'}
          </button>
        </div>
      </div>
    </div>
  );
};

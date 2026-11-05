import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TrashItem, listTrash, purgeTrashItem, restoreTrashItem } from '../services/trash';
import { formatCurrency } from '../utils/calculationUtils';

const COLLECTION_LABELS: Record<string, string> = {
  auditRecords: 'Remito',
  archivedReceipts: 'Comprobante',
  clients: 'Cliente',
  materials: 'Material',
  vehicles: 'Vehículo',
  vehicleEvents: 'Evento de vehículo',
  projects: 'Proyecto',
  financialReports: 'Reporte',
  maintenanceServices: 'Mantenimiento'
};

const labelOf = (collection: string) => COLLECTION_LABELS[collection] || collection;

// Deleted remitos and documents, ready to be restored.
export const TrashView: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [purging, setPurging] = useState<TrashItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listTrash());
    } catch {
      setError('No se pudo leer la papelera. Revise la conexión e intente de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const types = useMemo(() => Array.from(new Set(items.map(i => i.collection))), [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i => {
      if (typeFilter !== 'ALL' && i.collection !== typeFilter) return false;
      return !q || `${i.title} ${i.subtitle || ''} ${i.deletedBy || ''}`.toLowerCase().includes(q);
    });
  }, [items, search, typeFilter]);

  const restore = async (item: TrashItem) => {
    setBusyId(item.trashId);
    setError(null);
    try {
      await restoreTrashItem(item.trashId);
      setItems(prev => prev.filter(i => i.trashId !== item.trashId));
      setNotice(`${labelOf(item.collection)} ${item.title} recuperado.`);
    } catch (err) {
      setError(
        err instanceof Error && /ya existe/i.test(err.message)
          ? `${item.title} no se recuperó: ya hay uno activo con ese identificador.`
          : `No se pudo recuperar ${item.title}.`
      );
    } finally {
      setBusyId(null);
    }
  };

  const purge = async () => {
    if (!purging) return;
    const item = purging;
    setBusyId(item.trashId);
    setError(null);
    try {
      await purgeTrashItem(item.trashId);
      setItems(prev => prev.filter(i => i.trashId !== item.trashId));
      setNotice(`${item.title} se borró definitivamente.`);
    } catch {
      setError(`No se pudo borrar ${item.title}.`);
    } finally {
      setBusyId(null);
      setPurging(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">Papelera</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Lo eliminado queda acá hasta que lo recupere. Empleados y usuarios no pasan por la papelera.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_14rem] gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Buscar en la papelera"
              placeholder="Buscar por remito, cliente o usuario…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
            />
          </div>
          <select
            aria-label="Tipo de documento"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
          >
            <option value="ALL">Todos los tipos ({items.length})</option>
            {types.map(t => (
              <option key={t} value={t}>{labelOf(t)}</option>
            ))}
          </select>
        </div>
      </div>

      {notice && (
        <div role="status" className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="cursor-pointer" title="Cerrar aviso">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold">
          {error}
        </p>
      )}

      {!loading && visible.length === 0 ? (
        <p className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-sm text-slate-500 dark:text-slate-400">
          {items.length === 0 ? 'La papelera está vacía.' : 'Nada coincide con la búsqueda.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map(item => (
            <li key={item.trashId} className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                  <span className="mr-2 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">
                    {labelOf(item.collection)}
                  </span>
                  {item.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {[
                    item.subtitle,
                    item.date ? item.date.split('-').reverse().join('/') : '',
                    typeof item.amount === 'number' && item.amount > 0 ? `$${formatCurrency(item.amount)}` : ''
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="text-[11px] text-slate-400">
                  Eliminado {new Date(item.deletedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                  {item.deletedBy ? ` por ${item.deletedBy}` : ''}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void restore(item)}
                  disabled={busyId === item.trashId}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Recuperar
                </button>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setPurging(item)}
                    disabled={busyId === item.trashId}
                    className="p-2 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 disabled:opacity-50 cursor-pointer"
                    title="Borrar definitivamente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {purging && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="purge-title">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-3">
            <h3 id="purge-title" className="text-base font-black text-slate-900 dark:text-white">¿Borrar definitivamente?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {labelOf(purging.collection)} {purging.title} no se va a poder recuperar.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPurging(null)} className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                Cancelar
              </button>
              <button type="button" onClick={() => void purge()} className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-black cursor-pointer">
                Borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

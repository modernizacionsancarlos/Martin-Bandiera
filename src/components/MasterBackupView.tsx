import React, { useState } from 'react';
import {
  Database,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Server,
  Info
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useSyncStatus } from '../services/syncStatus';
import { restoreBackupToFirestore } from '../services/restoreBackup';
import {
  BackupCounts,
  BackupPayload,
  buildBackupPayload,
  downloadBackup,
  inspectBackup
} from '../utils/backupUtils';
import firebaseAppletConfig from '../../firebase-applet-config.json';

const COUNT_LABELS: Array<[keyof BackupCounts, string]> = [
  ['technicalAuditRecords', 'Remitos'],
  ['clients', 'Clientes'],
  ['workers', 'Personal'],
  ['users', 'Perfiles de usuario'],
  ['materials', 'Materiales'],
  ['financialReports', 'Reportes financieros'],
  ['archivedReceipts', 'Comprobantes'],
  ['projects', 'Proyectos'],
  ['maintenanceServices', 'Mantenimiento'],
  ['vehicles', 'Vehículos'],
  ['vehicleEvents', 'Eventos de vehículos']
];

export const MasterBackupView: React.FC = () => {
  const {
    financialReports,
    projects,
    maintenanceServices,
    materials,
    workers,
    technicalParameters,
    technicalAuditRecords,
    clients,
    vehicles,
    vehicleEvents,
    archivedReceipts
  } = useData();

  const { users } = useAuth();
  const sync = useSyncStatus();

  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [pendingRestore, setPendingRestore] = useState<{ fileName: string; payload: BackupPayload; counts: BackupCounts } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const currentBackup = () =>
    buildBackupPayload({
      users,
      technicalParameters,
      technicalAuditRecords,
      financialReports,
      projects,
      maintenanceServices,
      materials,
      workers,
      clients,
      vehicles,
      vehicleEvents,
      archivedReceipts
    });

  const handleExport = () => {
    const fileName = downloadBackup(currentBackup(), 'respaldo');
    setFeedback({ text: `Respaldo descargado: ${fileName}. Guárdelo fuera de este equipo (por ejemplo, en Drive).`, type: 'success' });
  };

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFeedback(null);
    setConfirmed(false);
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const result = inspectBackup(JSON.parse(String(event.target?.result)));
        if (result.ok === false) {
          setPendingRestore(null);
          setFeedback({ text: result.error, type: 'error' });
          return;
        }
        setPendingRestore({ fileName: file.name, payload: result.payload, counts: result.counts });
      } catch {
        setPendingRestore(null);
        setFeedback({ text: 'No se pudo leer el archivo. Verifique que sea un JSON íntegro.', type: 'error' });
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    if (!pendingRestore || !confirmed) return;
    // Antes de escribir, se descarga una copia de lo que hay hoy.
    const safetyCopy = downloadBackup(currentBackup(), 'antes_de_restaurar');
    try {
      const result = await restoreBackupToFirestore(pendingRestore.payload, label => setRestoring(label));
      setRestoring(null);
      setPendingRestore(null);
      setConfirmed(false);
      setFeedback(
        result.failedWrites === 0
          ? {
              text: `Restauración completa. Los datos del archivo se agregaron o actualizaron en la base. Copia previa descargada: ${safetyCopy}.`,
              type: 'success'
            }
          : {
              text: `La restauración terminó con ${result.failedWrites} escritura(s) rechazada(s). Revise el aviso de error y repita la restauración. Copia previa descargada: ${safetyCopy}.`,
              type: 'error'
            }
      );
    } catch (err: any) {
      setRestoring(null);
      setFeedback({ text: `La restauración se interrumpió: ${err?.message || 'error desconocido'}.`, type: 'error' });
    }
  };

  const liveCounts: Array<[string, number]> = [
    ['Remitos', technicalAuditRecords.length],
    ['Clientes', clients.length],
    ['Personal', workers.length],
    ['Usuarios', users.length]
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-500" />
            Respaldo y Restauración
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Exporte todos los datos a un archivo y restáurelos cuando haga falta. Restaurar nunca borra datos existentes.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          Los datos viven en Firestore
        </span>
      </div>

      {feedback && (
        <div
          role="status"
          className={`p-4 rounded-2xl text-xs font-bold border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : feedback.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex gap-3">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-cyan-500" />
        <p>
          Los antiguos "puntos de restauración" se guardaban solo en este navegador y desaparecían al cambiar la dirección
          web, por eso fueron retirados. Un respaldo real es el archivo JSON que se descarga aquí, guardado fuera de este
          equipo, más los respaldos automáticos de Firestore configurados en la consola de Firebase.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Exportar */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">Exportar respaldo completo (JSON)</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Remitos, clientes, personal, usuarios (sin contraseñas), costos fijos, vehículos, proyectos y comprobantes.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 space-y-1">
            {liveCounts.map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span>{label}:</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{value}</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleExport}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-black bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-md shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>DESCARGAR RESPALDO</span>
          </button>
        </div>

        {/* Restaurar */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 lg:col-span-2">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">Restaurar desde un respaldo</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Elija un archivo de respaldo. Se muestra qué contiene antes de escribir nada. Los registros se agregan o
              actualizan por su identificador; no se borra nada. Antes de restaurar se descarga una copia de los datos actuales.
            </p>
          </div>

          {!pendingRestore && (
            <label className="w-full py-2.5 px-4 rounded-xl text-xs font-black bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>ELEGIR ARCHIVO DE RESPALDO</span>
              <input type="file" accept=".json,application/json" onChange={handleFileChosen} className="hidden" />
            </label>
          )}

          {pendingRestore && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
                <p className="font-black flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Archivo: {pendingRestore.fileName}
                  {pendingRestore.payload.dateFormatted ? ` · generado el ${pendingRestore.payload.dateFormatted}` : ''}
                </p>
                <ul className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                  {COUNT_LABELS.filter(([key]) => (pendingRestore.counts[key] as number) > 0).map(([key, label]) => (
                    <li key={key} className="flex justify-between gap-2">
                      <span>{label}</span>
                      <span className="font-black">{pendingRestore.counts[key] as number}</span>
                    </li>
                  ))}
                  {pendingRestore.counts.hasTechnicalParameters && (
                    <li className="flex justify-between gap-2">
                      <span>Costos fijos</span>
                      <span className="font-black">sí</span>
                    </li>
                  )}
                </ul>
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded cursor-pointer"
                />
                <span>
                  Entiendo que los registros del archivo reemplazarán a los que tengan el mismo identificador en la base.
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleRestore}
                  disabled={!confirmed || restoring !== null}
                  className="py-2.5 px-4 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{restoring ? `Restaurando: ${restoring}…` : 'RESTAURAR AHORA'}</span>
                </button>
                <button
                  onClick={() => {
                    setPendingRestore(null);
                    setConfirmed(false);
                  }}
                  disabled={restoring !== null}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer disabled:opacity-40"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Estado real de la base */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 sm:col-span-2 lg:col-span-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">Estado de la conexión con la base de datos</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Datos reales, tomados de las escrituras de esta sesión.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
              <div className="text-[10px] font-bold uppercase text-slate-400">Conexión</div>
              <div className={`font-black ${sync.online ? 'text-emerald-500' : 'text-amber-500'}`}>
                {sync.online ? 'En línea' : 'Sin conexión'}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
              <div className="text-[10px] font-bold uppercase text-slate-400">Cambios sin sincronizar</div>
              <div className={`font-black ${sync.pending > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{sync.pending}</div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
              <div className="text-[10px] font-bold uppercase text-slate-400">Escrituras rechazadas (sesión)</div>
              <div className={`font-black ${sync.failedCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{sync.failedCount}</div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
              <div className="text-[10px] font-bold uppercase text-slate-400">Última confirmación del servidor</div>
              <div className="font-black text-slate-700 dark:text-slate-200">
                {sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleTimeString('es-AR') : 'Sin escrituras aún'}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono break-all">
            {__DEMO__
              ? 'Demo local · sin conexión a la base real'
              : `Proyecto: ${firebaseAppletConfig.projectId} · Base: ${firebaseAppletConfig.firestoreDatabaseId || '(default)'}`}
          </p>
        </div>
      </div>
    </div>
  );
};

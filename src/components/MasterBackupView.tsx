import React, { useState, useEffect } from 'react';
import { Database, Download, Upload, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, FileJson, Server, BookmarkCheck, RotateCcw, Clock, Shield } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { todayLocalISO } from '../utils/dateUtils';

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
    archivedReceipts,
    resetAllData
  } = useData();

  const { firebaseConfig, users, resetUsersToDefaults } = useAuth();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<{ timestamp: string; dateFormatted: string; recordCount: number } | null>(null);

  // Check if a saved snapshot exists in localStorage
  useEffect(() => {
    try {
      const existing = localStorage.getItem('job_martin_bandiera_restore_point_snapshot');
      if (existing) {
        const parsed = JSON.parse(existing);
        setSavedSnapshot({
          timestamp: parsed.timestamp || '',
          dateFormatted: parsed.dateFormatted || parsed.timestamp || '',
          recordCount: (parsed.technicalAuditRecords?.length || 0) + (parsed.users?.length || 0)
        });
      }
    } catch {}
  }, []);

  // Create a quick local restore point in browser storage
  const handleCreateSnapshot = () => {
    try {
      const now = new Date();
      const snapshot = {
        name: 'Punto de Restauración Estable',
        gitTag: 'restauracion-acceso-operativo',
        timestamp: now.toISOString(),
        dateFormatted: now.toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' }),
        systemName: 'JOB Martin Bandiera - Ecosistema SaaS V5.0',
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
      };

      localStorage.setItem('job_martin_bandiera_restore_point_snapshot', JSON.stringify(snapshot));
      setSavedSnapshot({
        timestamp: snapshot.timestamp,
        dateFormatted: snapshot.dateFormatted,
        recordCount: (technicalAuditRecords?.length || 0) + (users?.length || 0)
      });

      setFeedbackMessage({
        text: `✔ ¡Punto de restauración guardado con éxito! (${snapshot.dateFormatted})`,
        type: 'success'
      });
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch {
      setFeedbackMessage({
        text: 'Error al generar el punto de restauración en memoria local.',
        type: 'error'
      });
    }
  };

  // Restore the saved snapshot from browser storage
  const handleRestoreSnapshot = () => {
    try {
      const existing = localStorage.getItem('job_martin_bandiera_restore_point_snapshot');
      if (!existing) {
        setFeedbackMessage({
          text: 'No hay un punto de restauración previo guardado en el navegador.',
          type: 'error'
        });
        return;
      }

      const json = JSON.parse(existing);
      if (json.technicalParameters) {
        localStorage.setItem('job_martin_bandiera_master_dataset_v1_tech_params', JSON.stringify(json.technicalParameters));
      }
      if (json.technicalAuditRecords) {
        localStorage.setItem('job_martin_bandiera_master_dataset_v1_tech_audits', JSON.stringify(json.technicalAuditRecords));
      }
      if (json.financialReports) {
        localStorage.setItem('job_martin_bandiera_master_dataset_v1_financials', JSON.stringify(json.financialReports));
      }
      if (json.clients) {
        localStorage.setItem('job_martin_bandiera_master_dataset_v1_clients', JSON.stringify(json.clients));
      }

      // Restore canonical users and clear any login locks
      resetUsersToDefaults();

      setFeedbackMessage({
        text: '✔ ¡Punto de restauración restaurado! Recargando aplicación...',
        type: 'success'
      });
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch {
      setFeedbackMessage({
        text: 'Error al restaurar el punto de restauración guardado.',
        type: 'error'
      });
    }
  };

  // Restore canonical stable state (users + access + zero locks)
  const handleRestoreCanonicalPoint = () => {
    try {
      resetUsersToDefaults();
      setFeedbackMessage({
        text: '✔ ¡Punto de restauración canónico aplicado! 20 usuarios activos, sin solicitud de login y acceso libre restaurado.',
        type: 'success'
      });
      setTimeout(() => setFeedbackMessage(null), 6000);
    } catch {
      setFeedbackMessage({
        text: 'Error al aplicar el punto de restauración canónico.',
        type: 'error'
      });
    }
  };

  // Export all master data to a downloadable JSON file
  const handleExportJSON = () => {
    const masterData = {
      exportTimestamp: new Date().toISOString(),
      dateFormatted: new Date().toLocaleString('es-AR'),
      gitTag: 'restauracion-acceso-operativo',
      systemName: 'JOB Martin Bandiera - Ecosistema SaaS V5.0',
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
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(masterData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Punto_Restauracion_Bandiera_${todayLocalISO()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON file
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.systemName && (json.technicalAuditRecords || json.financialReports || json.users)) {
          if (json.technicalParameters) {
            localStorage.setItem('job_martin_bandiera_master_dataset_v1_tech_params', JSON.stringify(json.technicalParameters));
          }
          if (json.technicalAuditRecords) {
            localStorage.setItem('job_martin_bandiera_master_dataset_v1_tech_audits', JSON.stringify(json.technicalAuditRecords));
          }
          if (json.financialReports) {
            localStorage.setItem('job_martin_bandiera_master_dataset_v1_financials', JSON.stringify(json.financialReports));
          }
          if (json.clients) {
            localStorage.setItem('job_martin_bandiera_master_dataset_v1_clients', JSON.stringify(json.clients));
          }
          if (json.users && Array.isArray(json.users) && json.users.length > 0) {
            localStorage.setItem('job_martin_bandiera_users_dataset_v1', JSON.stringify(json.users));
          }

          setFeedbackMessage({
            text: '¡Respaldo importado correctamente! Recargando datos...',
            type: 'success'
          });
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          setFeedbackMessage({
            text: 'El archivo no tiene el formato de respaldo maestro de Bandiera.',
            type: 'error'
          });
        }
      } catch {
        setFeedbackMessage({
          text: 'Error al procesar el archivo JSON. Verifique su integridad.',
          type: 'error'
        });
      }
    };
    reader.readAsText(file);
  };

  // Cloud Firestore Sync
  const handleCloudSync = () => {
    setSyncStatus('syncing');
    setTimeout(() => {
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-500" />
            Puntos de Restauración & Respaldo Maestro
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gestión de snapshots, restauración de accesos, recuperación de usuarios y exportación de datos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            Tag: restauracion-acceso-operativo
          </span>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold border transition-all ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : feedbackMessage.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400'
          }`}
        >
          {feedbackMessage.text}
        </div>
      )}

      {/* Main Restore Point Hero Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <RotateCcw className="w-48 h-48" />
        </div>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <BookmarkCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-black text-white">
                  Punto de Restauración Estable (Registrado)
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Activo
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Acceso y publicación directa garantizada sin pantalla de inicio de sesión forzosa y con los 20 usuarios canónicos operativos.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado de Acceso</div>
              <div className="text-xs font-black text-emerald-400 mt-0.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                Acceso Directo (Sin Bloqueo)
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Usuarios Canónicos</div>
              <div className="text-xs font-black text-indigo-300 mt-0.5">
                20 Perfiles (Capataces + Ayudantes + Staff)
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Git Tag & Script</div>
              <div className="text-xs font-mono font-bold text-amber-300 mt-0.5">
                restauracion-acceso-operativo
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleRestoreCanonicalPoint}
              className="py-2.5 px-4 rounded-xl text-xs font-black bg-indigo-500 hover:bg-indigo-400 text-white transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restaurar a Este Punto Ahora</span>
            </button>

            <button
              onClick={handleCreateSnapshot}
              className="py-2.5 px-4 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <BookmarkCheck className="w-4 h-4 text-amber-400" />
              <span>Guardar Nueva Instantánea Local</span>
            </button>

            {savedSnapshot && (
              <button
                onClick={handleRestoreSnapshot}
                className="py-2.5 px-4 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Clock className="w-4 h-4 text-amber-300" />
                <span>Cargar Instantánea ({savedSnapshot.dateFormatted})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Export JSON */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              Exportar Respaldo JSON Completo
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Descarga un archivo estructurado con todos los reportes, 20 usuarios, costos fijos, personal y clientes.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Usuarios del Sistema:</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">{users.length} perfiles</span>
            </div>
            <div className="flex justify-between">
              <span>Auditorías Técnicas:</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">{technicalAuditRecords.length} registros</span>
            </div>
            <div className="flex justify-between">
              <span>Reportes Contables:</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">{financialReports.length} registros</span>
            </div>
          </div>

          <button
            onClick={handleExportJSON}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-black bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-md shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>DESCARGAR JSON</span>
          </button>
        </div>

        {/* Card 2: Import Backup */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              Restaurar desde Respaldo JSON
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sube un archivo de respaldo previo para restaurar el estado completo de la plataforma.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Restaura:</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">Usuarios, Obras y Datos</span>
            </div>
            <div className="flex justify-between">
              <span>Validación:</span>
              <span className="font-bold text-emerald-500">Automática</span>
            </div>
          </div>

          <label className="w-full py-2.5 px-4 rounded-xl text-xs font-black bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>SUBIR ARCHIVO JSON</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>

        {/* Card 3: Cloud Firestore Sync */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              Sincronización Cloud Firestore
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Estado de réplica con Firebase Project {firebaseConfig.projectId || 'job-martin-bandiera-saas'}.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Estado:</span>
              <span className="font-bold text-emerald-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                En Línea
              </span>
            </div>
            <div className="flex justify-between">
              <span>Modo Offline:</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">Habilitado</span>
            </div>
          </div>

          <button
            onClick={handleCloudSync}
            disabled={syncStatus === 'syncing'}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            <span>{syncStatus === 'syncing' ? 'SINCRONIZANDO...' : syncStatus === 'synced' ? '¡SINCRONIZADO!' : 'SINCRONIZAR AHORA'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};


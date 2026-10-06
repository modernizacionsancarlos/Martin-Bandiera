import React, { useState } from 'react';
import {
  X,
  Database,
  Shield,
  CheckCircle,
  Key,
  Copy,
  Check,
  RefreshCw,
  FileCode,
  HardDrive,
  Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { FIRESTORE_RULES_TEXT } from '../data/initialData';

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({ isOpen, onClose }) => {
  const { firebaseConfig, updateFirebaseConfig, testFirebaseConnection } = useAuth();
  const { themeClasses } = useTheme();

  const [activeTab, setActiveTab] = useState<'config' | 'rules'>('config');
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Local form inputs
  const [projectId, setProjectId] = useState(firebaseConfig.projectId);
  const [apiKey, setApiKey] = useState(firebaseConfig.apiKey);
  const [authDomain, setAuthDomain] = useState(firebaseConfig.authDomain);
  const [storageBucket, setStorageBucket] = useState(firebaseConfig.storageBucket);

  if (!isOpen) return null;

  const handleTest = async () => {
    setTesting(true);
    await testFirebaseConnection();
    setTesting(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateFirebaseConfig({
      projectId,
      apiKey,
      authDomain,
      storageBucket,
      connected: true
    });
    onClose();
  };

  const copyRules = () => {
    navigator.clipboard.writeText(FIRESTORE_RULES_TEXT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-2xl w-full p-5 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 max-h-[96vh] sm:max-h-[92vh] overflow-y-auto my-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                Configuración de Firebase Firestore & Storage
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Base de datos, autenticación y reglas de aislamiento multi-tenant.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-6 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'config'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Conexión & Credenciales
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'rules'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Reglas de Seguridad (firestore.rules)
          </button>
        </div>

        {activeTab === 'config' ? (
          <form onSubmit={handleSave} className="space-y-4">
            {/* Status callout */}
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                    {firebaseConfig.statusMessage}
                  </p>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400 mt-0.5">
                    Colecciones sincronizadas: users, projects, maintenanceServices, materials, financialReports.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-emerald-300 dark:border-emerald-700 hover:bg-slate-50 transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Probando...' : 'Verificar'}</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Project ID de Firebase
              </label>
              <input
                type="text"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="w-full font-mono px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                API Key (Web Client)
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="w-full font-mono px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Auth Domain
                </label>
                <input
                  type="text"
                  value={authDomain}
                  onChange={e => setAuthDomain(e.target.value)}
                  className="w-full font-mono px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Storage Bucket
                </label>
                <input
                  type="text"
                  value={storageBucket}
                  onChange={e => setStorageBucket(e.target.value)}
                  className="w-full font-mono px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-500 flex items-start gap-2">
              <Shield className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
              <span>
                El sistema almacena las transacciones con sincronización reactiva local continua, permitiendo operar tanto con emulador como con credenciales reales de Google Cloud.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="submit"
                className={`px-5 py-2 text-xs font-bold rounded-xl ${themeClasses.buttonClass} cursor-pointer`}
              >
                Guardar Configuración
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Reglas vigentes de Cloud Firestore</span>
              <button
                onClick={copyRules}
                className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 hover:underline cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '¡Copiado al portapapeles!' : 'Copiar firestore.rules'}</span>
              </button>
            </div>
            <div className="bg-slate-950 p-4 rounded-2xl text-slate-200 font-mono text-[11px] max-h-80 overflow-y-auto border border-slate-800">
              <pre className="whitespace-pre">{FIRESTORE_RULES_TEXT}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

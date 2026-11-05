import React, { useState } from 'react';
import {
  FileCheck2,
  Users,
  Database,
  Wrench,
  Shield,
  User,
  Sliders,
  FileCode,
  Lock,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Plus,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  Trash2
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { FIRESTORE_RULES_TEXT } from '../data/initialData';
import { UserRole } from '../types';

import { FixedCostBanner } from './FixedCostBanner';
import { TechnicalAuditTable } from './TechnicalAuditTable';
import { FieldReportModal } from './FieldReportModal';
import { LiquidationEmployeesView } from './LiquidationEmployeesView';
import { FixedCostsView } from './FixedCostsView';
import { MasterBackupView } from './MasterBackupView';
import { ManualWorksView } from './ManualWorksView';
import { UserProfileView } from './UserProfileView';
import { FacturadoView } from './FacturadoView';
import { PasadoView } from './PasadoView';
import { CobradoView } from './CobradoView';
import { ArchivoComprobantesView } from './ArchivoComprobantesView';
import { TrashView } from './TrashView';
import { ExcelImportModal } from './ExcelImportModal';
import { UserManagementView } from './UserManagementView';
import { AdminOperativaHeader } from './AdminOperativaHeader';

interface AdminViewProps {
  onOpenFirebaseModal: () => void;
}

type AdminTab =
  | 'auditoria'
  | 'facturado'
  | 'pasado'
  | 'cobrado'
  | 'archivo'
  | 'papelera'
  | 'liquidacion'
  | 'costos'
  | 'respaldo'
  | 'trabajos'
  | 'accesos'
  | 'perfil';

export const AdminView: React.FC<AdminViewProps> = ({ onOpenFirebaseModal }) => {
  const { workers, updateWorker, resetAllData } = useData();
  const { currentUser, isSuperAdmin, isAdmin, firebaseConfig } = useAuth();
  const { themeClasses } = useTheme();

  const [activeTab, setActiveTab] = useState<AdminTab>('auditoria');
  const [isFieldReportOpen, setIsFieldReportOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);

  const copyRulesToClipboard = () => {
    navigator.clipboard.writeText(FIRESTORE_RULES_TEXT);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2000);
  };

  const handleRoleChange = (workerId: string, newRole: UserRole) => {
    updateWorker(workerId, { role: newRole });
  };

  const tabs: { id: AdminTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'auditoria', label: 'AUDITORÍA TÉCNICA (CARGADOS)', icon: FileCheck2 },
    { id: 'facturado', label: 'FACTURADO', icon: FileSpreadsheet },
    { id: 'pasado', label: 'PASADO', icon: FileText },
    { id: 'cobrado', label: 'COBRADO', icon: CheckCircle2 },
    { id: 'archivo', label: 'ARCHIVO', icon: FolderArchive },
    { id: 'papelera', label: 'PAPELERA', icon: Trash2 },
    { id: 'liquidacion', label: 'LIQUIDACIÓN EMPLEADOS', icon: Users },
    { id: 'costos', label: 'COSTOS FIJOS', icon: Sliders },
    { id: 'respaldo', label: 'RESPALDO MAESTRO', icon: Database },
    { id: 'trabajos', label: 'TRABAJOS MANUALES', icon: Wrench },
    { id: 'accesos', label: 'USUARIOS Y ROLES', icon: Shield },
    { id: 'perfil', label: 'PERFIL', icon: User }
  ];

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-300">
      
      {/* Top Header */}
      <AdminOperativaHeader
        onOpenNewReport={() => setIsFieldReportOpen(true)}
        onOpenImportExcel={() => setIsExcelImportOpen(true)}
      />

      {/* Navigation Tabs - Horizontal Scroll on Mobile */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar shadow-xs">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: AUDITORÍA TÉCNICA */}
      {activeTab === 'auditoria' && (
        <div className="space-y-5">
          {/* Editable Fixed Costs Banner from Image 4 */}
          <FixedCostBanner />

          {/* Master Table from Image 5 */}
          <TechnicalAuditTable onOpenNewReport={() => setIsFieldReportOpen(true)} />
        </div>
      )}

      {/* SOLAPA FACTURADO */}
      {activeTab === 'facturado' && (
        <FacturadoView />
      )}

      {/* SOLAPA PASADO */}
      {activeTab === 'pasado' && (
        <PasadoView />
      )}

      {/* SOLAPA COBRADO */}
      {activeTab === 'cobrado' && (
        <CobradoView onNavigateToArchive={() => setActiveTab('archivo')} />
      )}

      {/* SOLAPA ARCHIVO DE COMPROBANTES */}
      {activeTab === 'archivo' && (
        <ArchivoComprobantesView />
      )}

      {/* TAB 2: LIQUIDACIÓN EMPLEADOS */}
      {activeTab === 'papelera' && <TrashView />}

      {activeTab === 'liquidacion' && (
        <LiquidationEmployeesView />
      )}

      {/* TAB 3: COSTOS FIJOS */}
      {activeTab === 'costos' && (
        <FixedCostsView />
      )}

      {/* TAB 4: RESPALDO MAESTRO */}
      {activeTab === 'respaldo' && (
        <MasterBackupView />
      )}

      {/* TAB 5: TRABAJOS MANUALES */}
      {activeTab === 'trabajos' && (
        <ManualWorksView />
      )}

      {/* TAB 6: ACCESOS, USUARIOS Y PERMISOS */}
      {activeTab === 'accesos' && (
        <div className="space-y-6">
          <UserManagementView />

          {/* Firestore Rules Reference */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-amber-500" />
                  Reglas de Seguridad Firestore Configuradas (firestore.rules)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Define funciones de pertenencia multi-tenant y exclusión de acceso financiero para capataces y empleados.
                </p>
              </div>

              <button
                onClick={copyRulesToClipboard}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
              >
                {copiedRules ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedRules ? '¡Copiado!' : 'Copiar Reglas'}</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto max-h-96 border border-slate-800">
              <pre className="whitespace-pre">{FIRESTORE_RULES_TEXT}</pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: PERFIL */}
      {activeTab === 'perfil' && (
        <UserProfileView />
      )}

      {/* Field Technical Report Modal (matching Image 3) */}
      <FieldReportModal
        isOpen={isFieldReportOpen}
        onClose={() => setIsFieldReportOpen(false)}
      />

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
      />
    </div>
  );
};

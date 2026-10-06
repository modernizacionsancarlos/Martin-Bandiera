import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { LoginPage } from './components/LoginPage';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { FacturadoView } from './components/FacturadoView';
import { PasadoView } from './components/PasadoView';
import { CobradoView } from './components/CobradoView';
import { ArchivoComprobantesView } from './components/ArchivoComprobantesView';
import { ClientesView } from './components/ClientesView';
import { FixedCostBanner } from './components/FixedCostBanner';
import { TechnicalAuditTable } from './components/TechnicalAuditTable';
import { LiquidationEmployeesView } from './components/LiquidationEmployeesView';
import { EmployeesManagementTab } from './components/EmployeesManagementTab';
import { ProjectsView } from './components/ProjectsView';
import { MaintenanceView } from './components/MaintenanceView';
import { MaterialsView } from './components/MaterialsView';
import { VehicleAmortizationView } from './components/VehicleAmortizationView';
import { FinancialReportsView } from './components/FinancialReportsView';
import { AdminView } from './components/AdminView';
import { AdminOperativaHeader } from './components/AdminOperativaHeader';
import { FieldReportModal } from './components/FieldReportModal';
import { NewReportModal } from './components/NewReportModal';
import { FirebaseConfigModal } from './components/FirebaseConfigModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { ResetSystemModal } from './components/ResetSystemModal';
import { UserManagementView } from './components/UserManagementView';
import { DatabaseConsoleView } from './components/DatabaseConsoleView';
import { SandboxView } from './components/SandboxView';
import { UserManualView } from './components/UserManualView';
import { isAdministrativeUser } from './utils/permissionUtils';
import { Database, Menu, ShieldAlert, ArrowRight, Users, ShieldCheck, BookOpen } from 'lucide-react';

interface AccessDeniedNoticeProps {
  moduleName: string;
  userRole: string;
  onReturn: () => void;
}

const AccessDeniedNotice: React.FC<AccessDeniedNoticeProps> = ({
  moduleName,
  userRole,
  onReturn
}) => (
  <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center max-w-lg mx-auto my-12 shadow-xl shadow-slate-200/50 dark:shadow-none animate-in fade-in zoom-in-95 duration-200">
    <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-4">
      <ShieldAlert className="w-7 h-7" />
    </div>
    <h2 className="text-xl font-black text-slate-900 dark:text-white">Acceso Restringido</h2>
    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
      El módulo <strong className="text-slate-700 dark:text-slate-200">{moduleName}</strong> no está disponible para su rol actual (<span className="font-bold text-rose-600 dark:text-rose-400 uppercase font-mono">{userRole}</span>).
    </p>
    <div className="mt-6 flex justify-center">
      <button
        onClick={onReturn}
        className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-cyan-500 text-white dark:text-slate-950 font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 hover:opacity-90 transition-all cursor-pointer shadow-md"
      >
        <span>Ir a mis módulos autorizados</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const { isAuthenticated, currentUser, permissions } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [showFieldReportModal, setShowFieldReportModal] = useState(false);
  const [showNewReportModal, setShowNewReportModal] = useState(false);
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelModalTab, setExcelModalTab] = useState<'remitos' | 'clientes' | 'materiales'>('clientes');
  const [showResetModal, setShowResetModal] = useState(false);

  // Automatically guide users to their primary authorized tab if their role cannot view dashboard
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    if (!permissions.viewDashboard && activeTab === 'dashboard') {
      if (permissions.manageAudits) {
        setActiveTab('auditoria');
      } else if (permissions.manageProjects) {
        setActiveTab('proyectos');
      } else if (permissions.manageBilling) {
        setActiveTab('facturado');
      } else if (permissions.manageLiquidations) {
        setActiveTab('liquidacion');
      } else if (permissions.manageMaterials) {
        setActiveTab('materiales');
      }
    }
  }, [isAuthenticated, currentUser, permissions.viewDashboard, permissions.manageAudits, permissions.manageProjects, permissions.manageBilling, permissions.manageLiquidations, permissions.manageMaterials, activeTab]);

  // Authentication gate: if user is not authenticated, show LoginPage
  if (!isAuthenticated || !currentUser) {
    return <LoginPage />;
  }

  const handleNavigate = (tab: string) => {
    if (tab === 'reportes') {
      setActiveTab('finanzas');
    } else if (tab === 'admin') {
      setActiveTab('administracion');
    } else {
      setActiveTab(tab);
    }
  };

  const getFallbackTab = () => {
    if (permissions.viewDashboard) return 'dashboard';
    if (permissions.manageAudits) return 'auditoria';
    if (permissions.manageProjects) return 'proyectos';
    if (permissions.manageBilling) return 'facturado';
    if (permissions.manageLiquidations) return 'liquidacion';
    if (permissions.manageMaterials) return 'materiales';
    return 'proyectos';
  };

  return (
    <div className="min-h-screen flex bg-slate-50/70 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200 relative">
      
      {/* Mobile Floating Toggle for Sidebar */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden fixed top-3.5 left-3.5 z-30 p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-cyan-400 border border-slate-700 shadow-xl backdrop-blur-md transition-all cursor-pointer"
          title="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-30 transition-opacity"
        />
      )}

      {/* Primary Sidebar (Barra Lateral Única) */}
      <Sidebar
        currentTab={activeTab}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onOpenNewReport={() => setShowFieldReportModal(true)}
        onOpenFirebaseModal={() => setShowFirebaseModal(true)}
        onOpenResetModal={() => setShowResetModal(true)}
        onOpenImportExcel={() => setShowExcelModal(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* SuperAdmin Direct DB Fast-Bar */}
        {currentUser?.role === 'SuperAdmin' && (
          <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-8 py-2.5 flex items-center justify-between text-xs select-none">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                SUPERADMIN: {currentUser.displayName}
              </span>
              <span className="text-slate-400 hidden lg:inline text-[11px]">
                Base de Datos y Usuarios Sincronizados
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('database')}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer text-xs ${
                  activeTab === 'database'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30'
                }`}
                title="Acceso directo a la Base de Datos del Sistema"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Base de Datos</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('usuarios')}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer text-xs ${
                  activeTab === 'usuarios'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
                title="Gestión de Usuarios y Roles"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Usuarios</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('manual')}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer text-xs ${
                  activeTab === 'manual'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-[#00c2ff] border border-cyan-500/30'
                }`}
                title="Manual de Uso Oficial y Guía en PDF"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Manual</span>
              </button>
            </div>
          </header>
        )}

        {/* Main Body View - Expande automáticamente al minimizar barra lateral para ver más columnas */}
        <main
          className={`flex-1 w-full mx-auto transition-all duration-300 ${
            sidebarOpen
              ? 'max-w-[1720px] px-3 sm:px-6 lg:px-8 py-5 sm:py-7'
              : 'max-w-full px-2 sm:px-4 lg:px-6 py-5 sm:py-7'
          }`}
        >
          
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            permissions.viewDashboard ? (
              <DashboardView
                onNavigate={handleNavigate}
                onNavigateTab={handleNavigate}
                onOpenNewReport={() => setShowFieldReportModal(true)}
                onOpenFirebaseModal={() => setShowFirebaseModal(true)}
                onOpenResetModal={() => setShowResetModal(true)}
                onOpenImportExcel={() => setShowExcelModal(true)}
              />
            ) : (
              <AccessDeniedNotice
                moduleName="Dashboard Ejecutivo & Métricas de Empresa"
                userRole={currentUser.role}
                onReturn={() => setActiveTab(getFallbackTab())}
              />
            )
          )}

          {/* TAB: AUDITORÍA TÉCNICA (REMITOS CARGADOS) */}
          {activeTab === 'auditoria' && (
            permissions.manageAudits ? (
              <div className="space-y-5">
                {/* Header Banner - Consola de Gestión & Auditoría Maestra */}
                <AdminOperativaHeader
                  onOpenNewReport={() => setShowFieldReportModal(true)}
                  onOpenImportExcel={() => {
                    setExcelModalTab('remitos');
                    setShowExcelModal(true);
                  }}
                />
                <FixedCostBanner />
                <TechnicalAuditTable onOpenNewReport={() => setShowFieldReportModal(true)} />
              </div>
            ) : (
              <AccessDeniedNotice
                moduleName="Auditoría Técnica & Remitos de Campo"
                userRole={currentUser.role}
                onReturn={() => setActiveTab(getFallbackTab())}
              />
            )
          )}

          {/* SOLAPA: FACTURADO */}
          {activeTab === 'facturado' && (
            permissions.manageBilling ? (
              <FacturadoView />
            ) : (
              <AccessDeniedNotice
                moduleName="Gestión de Trabajos Facturados"
                userRole={currentUser.role}
                onReturn={() => setActiveTab(getFallbackTab())}
              />
            )
          )}

          {/* SOLAPA: PASADO */}
          {activeTab === 'pasado' && (
            permissions.manageBilling ? (
              <PasadoView />
            ) : (
              <AccessDeniedNotice
                moduleName="Trabajos Pasados a Cobro"
                userRole={currentUser.role}
                onReturn={() => setActiveTab(getFallbackTab())}
              />
            )
          )}

          {/* SOLAPA: COBRADO */}
          {activeTab === 'cobrado' && (
            permissions.manageCollections ? (
              <CobradoView onNavigateToArchive={() => setActiveTab('archivo')} />
            ) : (
              <AccessDeniedNotice
                moduleName="Gestión de Trabajos Cobrados"
                userRole={currentUser.role}
                onReturn={() => setActiveTab(getFallbackTab())}
              />
            )
          )}

          {/* SOLAPA: ARCHIVO DE COMPROBANTES */}
          {activeTab === 'archivo' && (
            (permissions.manageCollections || permissions.manageBilling) ? (
              <ArchivoComprobantesView />
            ) : (
              <AccessDeniedNotice
                moduleName="Archivo de Comprobantes de Pago"
                userRole={currentUser.role}
                onReturn={() => setActiveTab(getFallbackTab())}
              />
            )
          )}

          {/* TAB: BASE DE CLIENTES */}
          {activeTab === 'clientes' && (
            permissions.manageClients ? (
              <ClientesView onOpenImportExcel={() => { setExcelModalTab('clientes'); setShowExcelModal(true); }} />
            ) : (
              <AccessDeniedNotice
                moduleName="Base de Clientes & Yacimientos"
                userRole={currentUser.role}
                onReturn={() => setActiveTab(getFallbackTab())}
              />
            )
          )}

          {/* TAB: GESTIÓN DE PERSONAL */}
          {activeTab === 'personal' && (
            (isAdministrativeUser(currentUser) || permissions.manageLiquidations || permissions.manageUsers) ? (
              <div className="space-y-5">
                <EmployeesManagementTab />
              </div>
            ) : (
              <AccessDeniedNotice
                moduleName="Gestión de Nómina & Tarifas de Personal"
                userRole={currentUser.role}
                onReturn={() => setActiveTab(getFallbackTab())}
              />
            )
          )}

          {/* TAB: LIQUIDACIÓN CUADRILLAS */}
          {activeTab === 'liquidacion' && (
            permissions.manageLiquidations ? (
              <LiquidationEmployeesView />
            ) : (
              <AccessDeniedNotice
                moduleName="Liquidación de Mano de Obra & Cuadrillas"
                userRole={currentUser.role}
                onReturn={() => setActiveTab(getFallbackTab())}
              />
            )
          )}

          {/* TAB: PROYECTOS */}
          {activeTab === 'proyectos' && (
            permissions.manageProjects ? (
              <ProjectsView />
            ) : (
              <AccessDeniedNotice
                moduleName="Proyectos de Obra"
                userRole={currentUser.role}
                onReturn={() => setActiveTab(getFallbackTab())}
              />
            )
          )}

          {/* TAB: MANTENIMIENTO */}
          {activeTab === 'mantenimiento' && (
            permissions.manageProjects ? (
              <MaintenanceView />
            ) : (
              <AccessDeniedNotice
                moduleName="Mantenimiento Preventivo & Correctivo de Pozos"
                userRole={currentUser.role}
                onReturn={() => setActiveTab(getFallbackTab())}
              />
            )
          )}

          {/* TAB: MATERIALES & STOCK */}
          {activeTab === 'materiales' && (
            permissions.manageMaterials ? (
              <MaterialsView onOpenImportExcel={() => { setExcelModalTab('materiales'); setShowExcelModal(true); }} />
            ) : (
              <AccessDeniedNotice
                moduleName="Materiales, Repuestos e Inventario"
                userRole={currentUser.role}
                onReturn={() => setActiveTab(getFallbackTab())}
              />
            )
          )}

          {/* TAB: FLOTA & AMORTIZACIÓN DE VEHÍCULOS */}
          {activeTab === 'vehiculos' && (
            permissions.manageVehicles ? (
              <VehicleAmortizationView />
            ) : (
              <AccessDeniedNotice
                moduleName="Flota & Análisis de Amortización de Vehículos"
                userRole={currentUser.role}
                onReturn={() => setActiveTab(getFallbackTab())}
              />
            )
          )}

          {/* TAB: FINANZAS */}
          {(activeTab === 'finanzas' || activeTab === 'reportes') && (
            permissions.viewFinancials ? (
              <FinancialReportsView onOpenNewReport={() => setShowNewReportModal(true)} />
            ) : (
              <AccessDeniedNotice
                moduleName="Reportes Financieros & Rentabilidad Global"
                userRole={currentUser.role}
                onReturn={() => setActiveTab(getFallbackTab())}
              />
            )
          )}

          {/* TAB: ADMINISTRACIÓN */}
          {(activeTab === 'administracion' || activeTab === 'admin') && (
            (permissions.manageFixedCosts || permissions.manageBilling || permissions.manageUsers) ? (
              <AdminView onOpenFirebaseModal={() => setShowFirebaseModal(true)} />
            ) : (
              <AccessDeniedNotice
                moduleName="Panel de Configuración y Costos Fijos"
                userRole={currentUser.role}
                onReturn={() => setActiveTab(getFallbackTab())}
              />
            )
          )}

          {/* TAB: USUARIOS & PERMISOS */}
          {activeTab === 'usuarios' && (
            permissions.manageUsers ? (
              <UserManagementView />
            ) : (
              <AccessDeniedNotice
                moduleName="Gestión de Usuarios, Roles y Matriz de Permisos"
                userRole={currentUser.role}
                onReturn={() => setActiveTab(getFallbackTab())}
              />
            )
          )}

          {/* TAB: BASE DE DATOS CENTRAL (SUPERADMIN) */}
          {activeTab === 'database' && (
            currentUser.role === 'SuperAdmin' ? (
              <DatabaseConsoleView />
            ) : (
              <AccessDeniedNotice
                moduleName="Consola Central de Base de Datos"
                userRole={currentUser.role}
                onReturn={() => setActiveTab(getFallbackTab())}
              />
            )
          )}

          {/* TAB: ESPACIO DE PRUEBA EXCLUSIVO (SANDBOX) */}
          {activeTab === 'sandbox' && (
            <SandboxView />
          )}

          {/* TAB: MANUAL DE USO INTEGRAL DEL SISTEMA */}
          {activeTab === 'manual' && (
            <UserManualView />
          )}

        </main>

        {/* Corporate Technical Footer */}
        <footer className="mt-auto border-t border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md py-6 transition-colors">
          <div className={`mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400 transition-all duration-300 ${
            sidebarOpen ? 'max-w-[1720px]' : 'max-w-full'
          }`}>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-800 dark:text-slate-200 tracking-tight">
                JOB Martin Bandiera
              </span>
              <span>·</span>
              <span>Ingeniería, Mantenimiento de Pozos y Obras Eléctricas</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Firestore RBAC Activo</span>
              </div>
              <span>·</span>
              <button
                onClick={() => setShowFirebaseModal(true)}
                className="hover:text-cyan-600 dark:hover:text-cyan-400 font-semibold transition-colors cursor-pointer flex items-center gap-1"
              >
                <Database className="w-3.5 h-3.5 text-amber-500" />
                <span>Configuración Cloud</span>
              </button>
            </div>
          </div>
        </footer>

      </div>

      {/* Global Modals */}
      <FieldReportModal
        isOpen={showFieldReportModal}
        onClose={() => setShowFieldReportModal(false)}
      />

      <NewReportModal
        isOpen={showNewReportModal}
        onClose={() => setShowNewReportModal(false)}
      />

      <FirebaseConfigModal
        isOpen={showFirebaseModal}
        onClose={() => setShowFirebaseModal(false)}
      />

      <ExcelImportModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        initialTab={excelModalTab}
      />

      <ResetSystemModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
      />

    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <AppContent />
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

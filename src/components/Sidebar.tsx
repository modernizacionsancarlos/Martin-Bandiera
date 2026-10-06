import React, { useState } from 'react';
import {
  Layers,
  FileSpreadsheet,
  FileCheck2,
  FileText,
  CheckCircle2,
  FolderArchive,
  Building2,
  Wrench,
  Boxes,
  Users,
  Shield,
  Database,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Clock,
  DollarSign,
  MapPin,
  Sun,
  Moon,
  X,
  UserCheck,
  ChevronDown,
  Trash2,
  Sliders,
  LogOut,
  FlaskConical,
  BookOpen,
  HardHat,
  Truck
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isAdministrativeUser } from '../utils/permissionUtils';

interface SidebarProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onOpenNewReport: () => void;
  onOpenFirebaseModal: () => void;
  onOpenResetModal?: () => void;
  onOpenImportExcel?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onNavigate,
  isOpen,
  onToggle,
  onOpenNewReport,
  onOpenFirebaseModal,
  onOpenResetModal,
  onOpenImportExcel
}) => {
  const { technicalAuditRecords, archivedReceipts, clients, workers, vehicles } = useData();
  const {
    currentUser,
    canViewFinancials,
    canResetSystem,
    canManageUsers,
    permissions,
    users,
    logout
  } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();

  // Dynamic status counters
  const countCargados = technicalAuditRecords.filter(r => r.status === 'Cargado').length;
  const countFacturados = technicalAuditRecords.filter(r => r.status === 'Facturado').length;
  const countPasados = technicalAuditRecords.filter(r => r.status === 'Pasado').length;
  const countCobrados = technicalAuditRecords.filter(r => r.status === 'Cobrado').length;
  const countArchivos = archivedReceipts.length;

  const navGroups = [
    {
      title: 'OPERACIONES & REMITOS',
      items: [
        {
          id: 'dashboard',
          label: 'Inicio & Dashboard',
          icon: Layers,
          restricted: !permissions.viewDashboard,
          badge: null
        },
        {
          id: 'auditoria',
          label: 'Auditoría Técnica',
          subtitle: 'Remitos Cargados',
          icon: FileSpreadsheet,
          badge: countCargados > 0 ? countCargados : null,
          badgeColor: 'bg-rose-500 text-white'
        },
        {
          id: 'facturado',
          label: 'Facturado',
          subtitle: 'Facturas & Retenciones',
          icon: FileCheck2,
          restricted: !permissions.manageBilling,
          badge: countFacturados > 0 ? countFacturados : null,
          badgeColor: 'bg-blue-600 text-white'
        },
        {
          id: 'pasado',
          label: 'Pasado',
          subtitle: 'Remito Pasado & Materiales',
          icon: FileText,
          restricted: !permissions.manageBilling,
          badge: countPasados > 0 ? countPasados : null,
          badgeColor: 'bg-amber-500 text-slate-950 font-black'
        },
        {
          id: 'cobrado',
          label: 'Cobrado',
          subtitle: 'Cobros & Formas de Pago',
          icon: CheckCircle2,
          restricted: !permissions.manageCollections,
          badge: countCobrados > 0 ? countCobrados : null,
          badgeColor: 'bg-emerald-600 text-white'
        },
        {
          id: 'archivo',
          label: 'Archivo Comprobantes',
          subtitle: 'PDFs & Recibos Digitales',
          icon: FolderArchive,
          restricted: !permissions.manageCollections,
          badge: countArchivos > 0 ? countArchivos : null,
          badgeColor: 'bg-slate-700 text-slate-200'
        }
      ]
    },
    {
      title: 'CLIENTES & FINCAS',
      items: [
        {
          id: 'clientes',
          label: 'Base de Clientes',
          subtitle: 'Fincas, CUIT & Distancias KM',
          icon: MapPin,
          badge: clients.length > 0 ? clients.length : null,
          badgeColor: 'bg-cyan-600 text-white'
        }
      ]
    },
    {
      title: 'OBRAS & PERSONAL',
      items: [
        {
          id: 'personal',
          label: 'Gestión de Personal',
          subtitle: 'Nómina, Tarifas $/h & Roles',
          icon: HardHat,
          restricted: !isAdministrativeUser(currentUser) && !permissions.manageLiquidations && !permissions.manageUsers,
          badge: workers?.length > 0 ? workers.length : null,
          badgeColor: 'bg-amber-600 text-white'
        },
        {
          id: 'liquidacion',
          label: 'Liquidación Cuadrillas',
          subtitle: 'Comisiones Capataces (M.O.)',
          icon: Users,
          restricted: !permissions.manageLiquidations,
          badge: null
        },
        {
          id: 'proyectos',
          label: 'Proyectos de Obra',
          icon: Building2,
          restricted: !permissions.manageProjects,
          badge: null
        },
        {
          id: 'mantenimiento',
          label: 'Mantenimiento Pozos',
          icon: Wrench,
          badge: null
        },
        {
          id: 'materiales',
          label: 'Materiales & Stock',
          icon: Boxes,
          restricted: !permissions.manageMaterials,
          badge: null
        },
        {
          id: 'vehiculos',
          label: 'Flota & Amortización',
          subtitle: 'Por Patente, Km & Services',
          icon: Truck,
          restricted: !permissions.manageVehicles,
          badge: vehicles.length > 0 ? vehicles.length : null,
          badgeColor: 'bg-cyan-600 text-white'
        }
      ]
    },
    {
      title: 'ADMINISTRACIÓN & SEGURIDAD',
      items: [
        {
          id: 'finanzas',
          label: 'Reportes & Métricas',
          icon: DollarSign,
          restricted: !permissions.viewFinancials,
          badge: null
        },
        {
          id: 'usuarios',
          label: 'Usuarios y Permisos',
          subtitle: 'Roles & Control RBAC',
          icon: Shield,
          restricted: !permissions.manageUsers,
          badge: users.length > 0 ? users.length : null,
          badgeColor: 'bg-purple-600 text-white'
        },
        {
          id: 'database',
          label: 'Base de Datos Central',
          subtitle: 'Acceso Total SuperAdmin',
          icon: Database,
          restricted: currentUser?.role !== 'SuperAdmin',
          badge: 'DB',
          badgeColor: 'bg-emerald-500 text-slate-950 font-black'
        },
        {
          id: 'administracion',
          label: 'Parámetros & Costos Fijos',
          icon: Sliders,
          restricted: !permissions.manageFixedCosts,
          badge: null
        },
        {
          id: 'sandbox',
          label: 'Espacio de Prueba',
          subtitle: 'Sandbox & Simulador',
          icon: FlaskConical,
          badge: 'TEST',
          badgeColor: 'bg-amber-500 text-slate-950 font-black'
        }
      ]
    },
    {
      title: 'DOCUMENTACIÓN & AYUDA',
      items: [
        {
          id: 'manual',
          label: 'Manual del Sistema',
          subtitle: 'Guía Completa & PDF',
          icon: BookOpen,
          badge: 'PDF',
          badgeColor: 'bg-cyan-400 text-slate-950 font-black'
        }
      ]
    }
  ];

  return (
    <aside
      className={`fixed lg:sticky top-0 left-0 z-40 h-screen transition-all duration-300 ease-in-out flex flex-col bg-slate-900 border-r border-slate-800 text-slate-200 shadow-2xl lg:shadow-none select-none ${
        isOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:w-20 lg:translate-x-0'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 border-b border-slate-800 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center font-black text-white shrink-0 shadow-md shadow-cyan-500/20 text-sm">
            JB
          </div>
          {isOpen && (
            <div className="leading-tight truncate">
              <span className="font-black text-sm tracking-tight text-white block">
                JOB Bandiera
              </span>
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                Auditoría Técnica
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Mobile close button */}
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors lg:hidden flex items-center justify-center cursor-pointer"
            title="Cerrar barra lateral"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Desktop collapse/expand button */}
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors hidden lg:flex items-center justify-center cursor-pointer"
            title={isOpen ? 'Colapsar barra lateral' : 'Expandir barra lateral'}
          >
            {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Quick Action Button */}
      <div className="p-3 border-b border-slate-800/80">
        <button
          onClick={onOpenNewReport}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20 transition-all cursor-pointer ${
            !isOpen ? 'lg:px-0' : ''
          }`}
          title="Nuevo Reporte de Campo"
        >
          <PlusCircle className="w-4 h-4 shrink-0 text-slate-950" />
          {isOpen && <span className="truncate">NUEVO REPORTE</span>}
        </button>
      </div>

      {/* Navigation Links Scrollable */}
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-6 text-xs">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1">
            {isOpen && (
              <div className="px-2.5 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                {group.title}
              </div>
            )}

            <div className="space-y-1">
              {group.items.map(item => {
                // SuperAdmin has full unrestricted access to all modules
                if (currentUser?.role !== 'SuperAdmin' && item.restricted) {
                  return null;
                }
                const Icon = item.icon;
                const isActive = currentTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      // Close on mobile after selection
                      if (window.innerWidth < 1024) {
                        onToggle();
                      }
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl font-bold transition-all cursor-pointer group ${
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                    title={item.label}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                          isActive ? 'text-cyan-400' : 'text-slate-400'
                        }`}
                      />
                      {isOpen && (
                        <div className="text-left truncate">
                          <span className="block truncate text-xs">{item.label}</span>
                          {item.subtitle && (
                            <span className="block text-[10px] font-normal text-slate-400 truncate">
                              {item.subtitle}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {item.badge !== null && item.badge !== undefined && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-black font-mono shrink-0 ${
                          item.badgeColor || 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom User, Theme & Database Controls */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 space-y-2">
        {/* Poner Sistema en 0 Button (Protegido por permisos RBAC) */}
        {onOpenResetModal && canResetSystem && (
          <button
            onClick={onOpenResetModal}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-xs font-black text-rose-300 hover:text-rose-100 transition-colors cursor-pointer border border-rose-800/60 shadow-sm group"
            title="Poner en 0 clientes, auditoría técnica, facturado, pasado, cobrado, comprobantes y liquidaciones"
          >
            <div className="flex items-center gap-2 truncate">
              <Trash2 className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform shrink-0" />
              {isOpen && <span className="truncate">PONER SISTEMA EN 0</span>}
            </div>
            {isOpen && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-900/80 text-rose-200 font-mono">
                RESET
              </span>
            )}
          </button>
        )}

        {/* Importar Excel Button */}
        {onOpenImportExcel && (
          <button
            onClick={onOpenImportExcel}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 text-xs font-black text-emerald-300 hover:text-emerald-100 transition-colors cursor-pointer border border-emerald-800/60 shadow-sm group"
            title="Importar base de clientes o remitos desde archivo Excel (.xlsx)"
          >
            <div className="flex items-center gap-2 truncate">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
              {isOpen && <span className="truncate">IMPORTAR EXCEL</span>}
            </div>
            {isOpen && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-200 font-mono">
                .XLSX
              </span>
            )}
          </button>
        )}

        {/* Dark/Light mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-800/60"
          title={darkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
        >
          <div className="flex items-center gap-2 truncate">
            {darkMode ? (
              <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            )}
            {isOpen && <span className="truncate">{darkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>}
          </div>
          {isOpen && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400 font-mono">
              {darkMode ? 'DARK' : 'LIGHT'}
            </span>
          )}
        </button>

        {/* Firestore status button */}
        <button
          onClick={onOpenFirebaseModal}
          className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-800/60"
          title="Estado de sincronización Firestore"
        >
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            {isOpen && <span className="truncate font-mono">Firestore Activo</span>}
          </div>
          {isOpen && <Database className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
        </button>

        {/* User profile (only logged in user and role, no dropdown list) */}
        {isOpen && currentUser && (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 text-left p-2.5 rounded-xl bg-slate-800/60 text-[11px] border border-slate-700/50">
              <div className="truncate">
                <span className="font-bold text-slate-200 block truncate">{currentUser.displayName}</span>
                <span className="text-[10px] text-cyan-400 uppercase font-black tracking-wider block">
                  {currentUser.role}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/50 hover:border-rose-500/40 transition-colors cursor-pointer shrink-0"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        {!isOpen && (
          <button
            onClick={logout}
            className="w-full flex items-center justify-center p-2 rounded-xl bg-slate-800/40 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors cursor-pointer"
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};

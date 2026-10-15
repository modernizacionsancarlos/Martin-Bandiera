import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Download,
  Printer,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  Users,
  Wrench,
  Fuel,
  Shield,
  Sliders,
  DollarSign,
  MapPin,
  Building2,
  Boxes,
  Database,
  FlaskConical,
  HelpCircle,
  ArrowRight,
  ExternalLink,
  Info,
  Calendar,
  Sparkles,
  ChevronRight,
  Eye,
  Check,
  Zap,
  Clock,
  Car,
  Keyboard,
  ArrowLeft,
  ChevronsLeft,
  ChevronsRight,
  Maximize2,
  BarChart3,
  Smartphone,
  MessageCircle,
  KeyRound,
  ShieldCheck
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { generateSystemManualPDF } from '../utils/manualPdfGenerator';
import {
  MANUAL_EXTRA_SECTIONS,
  MANUAL_VERSION,
  MANUAL_REVIEW,
  type ManualBlock,
  type ManualExtraSection
} from '../utils/manualExtraSections';

type ManualSectionId =
  | 'todos'
  | 'introduccion'
  | 'reporte-campo'
  | 'cuadrilla-roles'
  | 'formulas-costos'
  | 'ciclo-remitos'
  | 'liquidacion'
  | 'clientes'
  | 'obras-stock'
  | 'usuarios-seguridad'
  | 'parametros'
  | 'sandbox'
  | 'panel-estado'
  | 'app-campo'
  | 'canales'
  | 'usuarios-claves'
  | 'respaldos'
  | 'faq';

export const UserManualView: React.FC = () => {
  const { technicalParameters } = useData();
  const { currentUser } = useAuth();

  const [activeSection, setActiveSection] = useState<ManualSectionId>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleExportPDF = () => {
    try {
      setIsExporting(true);
      generateSystemManualPDF(technicalParameters);
      showToast(`¡Manual oficial ${MANUAL_VERSION} descargado en PDF con éxito!`);
    } catch (err: any) {
      showToast('Error al generar el PDF: ' + (err?.message || 'Reintente'));
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const sectionsNav = [
    { id: 'todos', label: 'Ver Todo', icon: BookOpen },
    { id: 'introduccion', label: '1. Arquitectura', icon: LayersIcon },
    { id: 'reporte-campo', label: '2. Reporte Campo', icon: FileText },
    { id: 'cuadrilla-roles', label: '3. Oficial vs Ayudante', icon: Users },
    { id: 'formulas-costos', label: '4. Fórmulas de Costos', icon: Fuel },
    { id: 'ciclo-remitos', label: '5. Ciclo del Remito', icon: FileSpreadsheet },
    { id: 'liquidacion', label: '6. Liquidación', icon: DollarSign },
    { id: 'clientes', label: '7. Clientes & KM', icon: MapPin },
    { id: 'usuarios-seguridad', label: '8. Usuarios RBAC', icon: Shield },
    { id: 'parametros', label: '9. Costos Fijos', icon: Sliders },
    { id: 'sandbox', label: '10. Espacio Sandbox', icon: FlaskConical },
    { id: 'panel-estado', label: '11. Panel de Estado y Archivo', icon: BarChart3, isNew: true },
    { id: 'app-campo', label: '12. App del Capataz', icon: Smartphone, isNew: true },
    { id: 'canales', label: '13. WhatsApp y Drive', icon: MessageCircle, isNew: true },
    { id: 'usuarios-claves', label: '14. Usuarios y Claves', icon: KeyRound, isNew: true },
    { id: 'respaldos', label: '15. Respaldos y Seguridad', icon: ShieldCheck, isNew: true },
    { id: 'faq', label: '16. Preguntas Frecuentes', icon: HelpCircle }
  ];

  // Filter content based on search query
  const matchesSearch = (text: string) => {
    if (!searchQuery.trim()) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200 print:m-0 print:p-0 print:space-y-4">
      {/* Dedicated print stylesheet ensuring content stays within page limits */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 10mm 12mm 10mm;
          }
          body, html {
            background: #ffffff !important;
            color: #0f172a !important;
            font-size: 11px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          section {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin-bottom: 14px !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            max-width: 100% !important;
            overflow: hidden !important;
            padding: 16px !important;
          }
          * {
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
      
      {/* FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-950 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-cyan-400 flex items-center gap-3 text-xs font-bold animate-in slide-in-from-bottom-3">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HERO HEADER */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 shadow-xl text-white relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/4 -bottom-16 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-[#00c2ff] border border-cyan-400/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                <span>Versión Oficial {MANUAL_VERSION}</span>
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" />
                <span>Actualizado Permanentemente</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-[#00c2ff]" />
              <span>Manual de Uso y Operación del Sistema</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Guía técnica y operativa paso a paso de JOB Martin Bandiera. Explica cada sección, función, fórmula de costos, flujo de remitos, asignación de operarios (Oficial vs Ayudante) y cómo aplicar modificaciones en la plataforma.
            </p>

            <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1 font-medium">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Última revisión: {MANUAL_REVIEW}
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                Válido para todos los roles (Técnicos, Administración, Gerencia)
              </span>
            </div>
          </div>

          {/* ACTION BUTTONS: EXPORT PDF & PRINT */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 print:hidden">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#00c2ff] to-cyan-500 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 hover:scale-[1.02] transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Generando PDF...' : 'Descargar Manual en PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="mt-6 pt-5 border-t border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar función, fórmula, botón o procedimiento (ej: viajes, oficial, retenciones)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-[#00c2ff]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-2 self-start sm:self-center">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Documentación interactiva disponible offline y online</span>
          </div>
        </div>
      </div>

      {/* HORIZONTAL SECTION NAV PILLS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none print:hidden">
        {sectionsNav.map(sec => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id as ManualSectionId)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm ring-2 ring-[#00c2ff]'
                  : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 hover:bg-cyan-50/50 dark:hover:bg-slate-750'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#00c2ff]' : 'text-slate-400'}`} />
              <span>{sec.label}</span>
              {(sec as { isNew?: boolean }).isNew && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black uppercase">Nuevo</span>
              )}
            </button>
          );
        })}
      </div>

      {/* CONTENT SECTIONS */}
      <div className="space-y-10">

        {/* 1. ARQUITECTURA Y FLUJO OPERATIVO */}
        {(activeSection === 'todos' || activeSection === 'introduccion') && matchesSearch('arquitectura flujo negocio etapas') && (
          <section id="introduccion" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-[#00c2ff] flex items-center justify-center font-black">
                  1
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    1. Arquitectura General y Flujo Operativo del Negocio
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Misión del sistema y secuencia de vida desde el parte de campo hasta la liquidación final
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                Fundamentos
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[10px]">A</span>
                  <span>Cero Fugas de Costos</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  Cada litro de combustible consumido, cada hora de mano de obra y cada seguro de viaje se imputa automáticamente al centro de costo de la orden.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">B</span>
                  <span>Margen Comercial Protegido</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  El sistema aplica la fórmula <code>Precio = Costo / (1 - 0.35)</code> asegurando una rentabilidad bruta del 35% como piso de facturación.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">C</span>
                  <span>Trazabilidad y Respaldo</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  El remito de papel físico queda sincronizado con el comprobante digital, las retenciones fiscales y el recibo de cobranza en una sola ficha.
                </p>
              </div>
            </div>

            {/* FLOW PIPELINE DIAGRAM */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 block">
                Cadena de Valor: Del Pozo a la Cobranza
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-[11px]">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <div className="font-black text-[#00c2ff]">1. Reporte</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Técnico en campo</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <div className="font-black text-amber-400">2. Auditoría</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Control de costos</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <div className="font-black text-blue-400">3. Facturado</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Factura fiscal</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <div className="font-black text-purple-400">4. Pasado</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Remito valorizado</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <div className="font-black text-emerald-400">5. Cobrado</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Recibo y retenciones</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <div className="font-black text-rose-400">6. Liquidado</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Pago de haberes</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 2. CARGA DE REPORTE DE CAMPO (PASO A PASO CON PREVIEW VISUAL) */}
        {(activeSection === 'todos' || activeSection === 'reporte-campo') && matchesSearch('reporte campo remito papel viajes 0 viajes entrada salida materiales') && (
          <section id="reporte-campo" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-[#00c2ff] flex items-center justify-center font-black">
                  2
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    2. Carga y Confección del Reporte de Campo (Paso a Paso)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Instrucciones detalladas con previsualización visual interactiva del modal
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-cyan-100 dark:bg-cyan-950 text-[#00c2ff]">
                Operación Crítica
              </span>
            </div>

            {/* PREVIEW VISUAL / MOCKUP REAL DE LA INTERFAZ */}
            <div className="rounded-3xl bg-slate-950 p-5 border border-slate-800 space-y-4 text-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-xs font-mono font-bold text-slate-400 ml-2">
                    [UI Real] Modal: Nuevo Reporte de Servicio Técnico
                  </span>
                </div>
                <span className="text-[10px] font-mono bg-cyan-500/20 text-[#00c2ff] px-2 py-0.5 rounded">
                  REMITO INTELIGENTE
                </span>
              </div>

              {/* SIMULATED FORM SCREENSHOT */}
              <div className="space-y-4 bg-slate-900/90 p-4 rounded-2xl border border-slate-800 text-xs">
                
                {/* Zona 1: Cliente y Remito de Papel */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 relative">
                    <span className="absolute -top-2.5 -left-2 w-5 h-5 rounded-full bg-[#00c2ff] text-slate-950 font-black text-[10px] flex items-center justify-center shadow">
                      1
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">CLIENTE / FINCA</span>
                    <div className="font-bold text-white text-xs">FINCA LA CONSULTA S.A.</div>
                    <span className="text-[10px] text-cyan-400 font-mono">45 km autocalculados</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800 border border-cyan-500/40 relative">
                    <span className="absolute -top-2.5 -left-2 w-5 h-5 rounded-full bg-[#00c2ff] text-slate-950 font-black text-[10px] flex items-center justify-center shadow">
                      2
                    </span>
                    <span className="text-[10px] uppercase font-bold text-cyan-300 block mb-1">Nº REMITO PAPEL (MANUAL)</span>
                    <div className="font-mono font-bold text-amber-300 text-xs bg-slate-900 px-2 py-1 rounded">
                      0001-0004523
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 relative">
                    <span className="absolute -top-2.5 -left-2 w-5 h-5 rounded-full bg-[#00c2ff] text-slate-950 font-black text-[10px] flex items-center justify-center shadow">
                      3
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">TÉCNICO RESPONSABLE</span>
                    <div className="font-bold text-white text-xs">Carlos Gómez (Técnico)</div>
                  </div>
                </div>

                {/* Zona 2: Jornada y Viajes */}
                <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 relative space-y-2">
                  <span className="absolute -top-2.5 -left-2 w-5 h-5 rounded-full bg-[#00c2ff] text-slate-950 font-black text-[10px] flex items-center justify-center shadow">
                    4
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-[#00c2ff]">JORNADA DE TRABAJO Y TRASLADOS</span>
                    <span className="text-[10px] bg-orange-500 text-white font-black px-2 py-0.5 rounded-full">
                      1 VIAJE (4.5 HORAS TRABAJADAS)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center text-[11px]">
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">Entrada: 08:00</div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-700">Salida: 12:30</div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-cyan-500/50 flex items-center justify-between">
                      <span>Viajes: 1</span>
                      <span className="text-[9px] text-cyan-400 font-bold">Cambiar a 0 si no hay viaje</span>
                    </div>
                    <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-300 font-bold text-center">
                      Botón: Eliminar Todos los Viajes ($0 Logística)
                    </div>
                  </div>
                </div>

                {/* Zona 3: Cuadrilla Oficial vs Ayudante */}
                <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 relative space-y-2">
                  <span className="absolute -top-2.5 -left-2 w-5 h-5 rounded-full bg-[#00c2ff] text-slate-950 font-black text-[10px] flex items-center justify-center shadow">
                    5
                  </span>
                  <span className="text-[10px] font-black uppercase text-[#00c2ff] block">
                    EQUIPO DE OPERARIOS (OFICIAL VS AYUDANTE)
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between">
                      <div>
                        <div className="font-black text-white">MARCELO QUINTEROS</div>
                        <div className="text-[10px] text-slate-400">$5.500/h × 4.5h = $24.750</div>
                      </div>
                      <div className="flex gap-1">
                        <span className="px-2 py-1 rounded bg-slate-800 text-slate-500 text-[10px] font-bold">Oficial</span>
                        <span className="px-2 py-1 rounded bg-purple-600 text-white text-[10px] font-black ring-2 ring-purple-400">Ayudante</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between">
                      <div>
                        <div className="font-black text-white">CARLOS GÓMEZ</div>
                        <div className="text-[10px] text-slate-400">$9.400/h × 4.5h = $42.300</div>
                      </div>
                      <div className="flex gap-1">
                        <span className="px-2 py-1 rounded bg-[#00c2ff] text-white text-[10px] font-black ring-2 ring-cyan-400">Oficial</span>
                        <span className="px-2 py-1 rounded bg-slate-800 text-slate-500 text-[10px] font-bold">Ayudante</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Zona 4: Pre-auditoría en tiempo real */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/30 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-white/5">
                    <span className="text-[9px] uppercase text-slate-400 block">LOGÍSTICA</span>
                    <span className="font-black text-white text-sm">$40.660</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/5">
                    <span className="text-[9px] uppercase text-slate-400 block">M.O. DIRECTA</span>
                    <span className="font-black text-cyan-300 text-sm">$109.350</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/5">
                    <span className="text-[9px] uppercase text-slate-400 block">COSTO TOTAL</span>
                    <span className="font-black text-amber-400 text-sm">$149.010</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/5">
                    <span className="text-[9px] uppercase text-slate-400 block">PRECIO SUGERIDO</span>
                    <span className="font-black text-emerald-400 text-sm">$229.246</span>
                  </div>
                </div>
              </div>
            </div>

            {/* GUÍA PASO A PASO PARA EL OPERADOR */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Cómo completar cada campo correctamente:
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[10px]">1</span>
                    <span>Selección de Cliente y Finca</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                    Elige el cliente. El campo <strong>Distancia KM</strong> se cargará automáticamente con los kilómetros medidos desde la base en Mendoza. Si es un pozo nuevo o una ubicación extraordinaria, puedes modificar los KM directamente.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[10px]">2</span>
                    <span>Nº de Remito de Papel Manual</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                    Escribe el número preimpreso del talonario físico que firmó el encargado de finca (ej: <code>0001-0004523</code>). Si no tienes el papel físico en ese momento, puedes dejarlo vacío y asignarlo más tarde en la Auditoría.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[10px]">3</span>
                    <span>Entrada, Salida y Cantidad de Viajes</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                    El sistema calcula la diferencia horaria exacta. En el casillero <strong>VIAJES</strong>, define cuántas veces fue y vino la camioneta. Si el técnico ya estaba en la finca o se trabajó en taller, fija <strong>0 VIAJES</strong> para que la logística sea $0.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[10px]">4</span>
                    <span>Oficial vs Ayudante</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                    Para cada operario que participó, pulsa <strong>[ OFICIAL ]</strong> ($9.400/h) o <strong>[ AYUDANTE ]</strong> ($5.500/h). Si necesitas agregar un operario nuevo que no está en la lista, usa el alta rápida y se guardará en la base central.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 3. DIFERENCIACIÓN OFICIAL VS AYUDANTE */}
        {(activeSection === 'todos' || activeSection === 'cuadrilla-roles') && matchesSearch('oficial ayudante cuadrilla tarifa hora horas operario personal') && (
          <section id="cuadrilla-roles" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-[#00c2ff] flex items-center justify-center font-black">
                  3
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    3. Categorías de Personal: Oficial ($9.400/h) vs Ayudante ($5.500/h)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Control salarial por hora y asignación de roles en tiempo real
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300">
                Recursos Humanos
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Card Oficial */}
              <div className="p-5 rounded-3xl bg-cyan-50/50 dark:bg-cyan-950/20 border-2 border-cyan-300 dark:border-cyan-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500 text-white flex items-center justify-center font-black">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <span className="font-black text-slate-900 dark:text-white text-sm">OFICIAL TÉCNICO</span>
                  </div>
                  <span className="font-mono font-black text-cyan-700 dark:text-cyan-300 text-sm">
                    ${(technicalParameters.horaOficial || 9400).toLocaleString('es-AR')} / h
                  </span>
                </div>

                <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5 list-disc list-inside">
                  <li>Personal electromecánico con conocimientos avanzados.</li>
                  <li>Capacidad de conexionado de contactores, arranque estrella-triángulo y variadores.</li>
                  <li>Medición de resistencia de aislación (Megado) de bobinados.</li>
                  <li>En caso de <strong>Guardia</strong>, el valor se ingresa manualmente (como monto fijo pactado o por horas trabajadas), no un recargo automático del 50%.</li>
                </ul>
              </div>

              {/* Card Ayudante */}
              <div className="p-5 rounded-3xl bg-purple-50/50 dark:bg-purple-950/20 border-2 border-purple-300 dark:border-purple-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="font-black text-slate-900 dark:text-white text-sm">AYUDANTE PRÁCTICO</span>
                  </div>
                  <span className="font-mono font-black text-purple-700 dark:text-purple-300 text-sm">
                    ${(technicalParameters.pagoAyudanteHora || 5500).toLocaleString('es-AR')} / h
                  </span>
                </div>

                <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5 list-disc list-inside">
                  <li>Personal auxiliar para apoyo en maniobras y tareas físicas.</li>
                  <li>Acarreo de cables, soporte en izaje de bombas y entubado.</li>
                  <li>Zanjeo, montaje de bandejas portacables y asistencia al oficial.</li>
                  <li>En caso de <strong>Guardia</strong>, el valor se ingresa manualmente según el acuerdo del servicio o las horas de intervención.</li>
                </ul>
              </div>
            </div>

            {/* ACTION GUIDE: HOW TO CHANGE ROLES */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider block">
                Cómo cambiar el rol de un operario o dar de alta uno nuevo:
              </span>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                • <strong>En el Reporte:</strong> Simplemente pulsa el botón <code>[ Oficial ]</code> o <code>[ Ayudante ]</code> ubicado al lado del nombre del operario. La pre-auditoría recalculará el costo al instante.<br />
                • <strong>Alta de Nuevo Operario:</strong> Al final de la sección cuadrilla, escribe el nombre completo, selecciona si es Oficial o Ayudante en el selector desplegable y pulsa <code>Registrar en BD</code>. Quedará disponible para toda la empresa de inmediato.
              </p>
            </div>
          </section>
        )}

        {/* 4. MOTOR MATEMÁTICO DE COSTOS Y FÓRMULAS */}
        {(activeSection === 'todos' || activeSection === 'formulas-costos') && matchesSearch('formulas costos combustible gasoil seguros amortizacion margen 35 logistica') && (
          <section id="formulas-costos" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-[#00c2ff] flex items-center justify-center font-black">
                  4
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    4. Motor Matemático de Costos y Fórmulas
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Algoritmos de cálculo automático de logística, seguros, amortizaciones y margen
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                Matemática Financiera
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              
              {/* Formula Combustible */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Fuel className="w-4 h-4 text-amber-500" />
                    <span>1. Combustible (Diesel Grado 3)</span>
                  </span>
                  <span className="font-mono text-[10px] text-amber-500 font-bold">13 L / 100 km</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-cyan-600 dark:text-cyan-400 font-bold text-[11px]">
                  KM × 2 × Viajes × 0.13 L/km × $Diesel
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Si viajas a una finca a 45 km (ida y vuelta = 90 km) en 1 viaje con gasoil a $1.200/L: <code>90 × 1 × 0.13 × 1.200 = $14.040</code>.
                </p>
              </div>

              {/* Formula Seguros */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-cyan-500" />
                    <span>2. Seguros por Traslado</span>
                  </span>
                  <span className="font-mono text-[10px] text-cyan-500 font-bold">$1.318,78 / viaje</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-cyan-600 dark:text-cyan-400 font-bold text-[11px]">
                  Viajes × $1.318,78  (Si Viajes = 0 → $0)
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Cubre la alícuota de seguro automotor comercial. Si se fija 0 viajes, este valor baja a <strong>$0</strong> automáticamente.
                </p>
              </div>

              {/* Formula Amortizacion */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-purple-500" />
                    <span>3. Amortización de Camioneta</span>
                  </span>
                  <span className="font-mono text-[10px] text-purple-500 font-bold">$7.587,88 / viaje</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-cyan-600 dark:text-cyan-400 font-bold text-[11px]">
                  Viajes × $7.587,88  (Si Viajes = 0 → $0)
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Reserva para recambio de neumáticos, services de 10.000 km, frenos y desgaste del vehículo utilitario.
                </p>
              </div>

              {/* Formula Margen Editable / Costo Honorarios y Costo Total */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    <span>4. Costo Honorarios y Costo Total del Remito</span>
                  </span>
                  <span className="font-mono text-[10px] text-emerald-500 font-bold">Ganancia Editable</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-emerald-600 dark:text-emerald-400 font-bold text-[11px] space-y-1">
                  <div>Costo Honorarios = Costos Directos × (Margen % / 100)</div>
                  <div className="text-slate-700 dark:text-slate-300">Costo Total = Logística + M.O. Capataz + M.O. Ayudante + Materiales + Costo Honorarios</div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  El <strong>Costo Honorarios</strong> es el valor de ganancia que nosotros fijamos para el trabajo. El <strong>Costo Total del Remito</strong> es la suma de todos los componentes. Ambos campos son 100% editables en la planilla de Administración Operativa con recálculo recíproco automático.
                </p>
              </div>

              {/* Régimen de Guardias Técnicas */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-amber-500" />
                    <span>5. Régimen de Guardias Técnicas (Ingreso Manual)</span>
                  </span>
                  <span className="font-mono text-[10px] text-amber-500 font-bold">Monto Fijo o Por Horas</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                  Guardia = Monto Fijo ($)  Ó  (Horas Trabajadas × $/h Guardia)
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Al marcar Guardia SÍ, no se aplica un 50% forzado: la empresa decide ingresar un valor pactado específico (suma fija global o tarifa horario de guardia), pudiendo optar por sumarlo como recargo adicional a la cuadrilla o utilizarlo como tarifa plana que cubre la totalidad de la mano de obra.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* 5. AUDITORÍA TÉCNICA Y CICLO DEL REMITO */}
        {(activeSection === 'todos' || activeSection === 'ciclo-remitos') && matchesSearch('auditoria ciclo remito facturado pasado cobrado archivo retenciones') && (
          <section id="ciclo-remitos" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-[#00c2ff] flex items-center justify-center font-black">
                  5
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    5. Administración Operativa, Auditoría Técnica y Ciclo de Estados del Remito
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Proceso integral: Del reporte de campo a la auditoría de costos, fijación de honorarios, emisión de comprobantes y cobranza
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300">
                Gestión Operativa & Comercial
              </span>
            </div>

            {/* PIPELINE OPERATIVO EN 5 FASES */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white space-y-4 shadow-lg border border-slate-700">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                <span className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  El Proceso Operativo del Remito: De Punta a Punta
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Flujo de Trabajo Estándar JOB Martin Bandiera
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                {/* Paso 1 */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 font-black text-[10px] flex items-center justify-center">1</span>
                    <span className="text-[9px] uppercase font-bold text-cyan-400">CAMPO</span>
                  </div>
                  <div className="font-black text-white text-xs">Carga de Reporte</div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    El técnico registra horas de inicio/fin, distingue <strong>Oficial</strong> de <strong>Ayudante</strong>, KM a finca, viajes (1 o 0) y remito físico de papel.
                  </p>
                </div>

                {/* Paso 2 */}
                <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 space-y-1.5 ring-1 ring-cyan-500/30">
                  <div className="flex items-center justify-between">
                    <span className="w-5 h-5 rounded-full bg-[#00c2ff] text-slate-950 font-black text-[10px] flex items-center justify-center">2</span>
                    <span className="text-[9px] uppercase font-bold text-[#00c2ff]">ADMINISTRACIÓN</span>
                  </div>
                  <div className="font-black text-cyan-200 text-xs">Auditoría Operativa</div>
                  <p className="text-[11px] text-cyan-100/90 leading-relaxed">
                    Control columna por columna: M.O. Capataz, M.O. Ayudante, Logística, fijación de <strong>Costo Honorarios (ganancia)</strong> y determinación del <strong>Costo Total</strong>.
                  </p>
                </div>

                {/* Paso 3 */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="w-5 h-5 rounded-full bg-blue-500 text-white font-black text-[10px] flex items-center justify-center">3</span>
                    <span className="text-[9px] uppercase font-bold text-blue-400">FINANZAS</span>
                  </div>
                  <div className="font-black text-white text-xs">Facturación Fiscal</div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Se presiona <strong>"Facturar"</strong>, se ingresa la Factura A/B y fecha de vencimiento. Pasa a cuenta corriente del cliente.
                  </p>
                </div>

                {/* Paso 4 */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center">4</span>
                    <span className="text-[9px] uppercase font-bold text-amber-400">CLIENTE</span>
                  </div>
                  <div className="font-black text-white text-xs">Remito Pasado</div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Entrega o emisión del <strong>Comprobante Consolidado</strong> formal en finca con el detalle técnico de servicios y materiales instalados.
                  </p>
                </div>

                {/* Paso 5 */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] flex items-center justify-center">5</span>
                    <span className="text-[9px] uppercase font-bold text-emerald-400">TESORERÍA</span>
                  </div>
                  <div className="font-black text-white text-xs">Cobranza & Cierre</div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Acreditación del cobro, retenciones de Ganancias/IIBB deducidas, emisión de recibo digital y remito archivado.
                  </p>
                </div>
              </div>
            </div>

            {/* NUEVA SECCIÓN: LAS 5 COLUMNAS FINANCIERAS DE ADMINISTRACIÓN OPERATIVA */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs">
                    $
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Las 5 Columnas Financieras de la Planilla de Administración Operativa
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Significado exacto, origen matemático y comportamiento editable de cada columna en la tabla principal
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                  Editable en Vivo (Inline)
                </span>
              </div>

              {/* BENTO GRID DE LAS 5 COLUMNAS */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                
                {/* 1. LOGÍSTICA ($) */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Columna 1</span>
                      <Fuel className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div className="font-black text-slate-900 dark:text-white text-xs">LOGÍSTICA ($)</div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      El costo de traslado vehicular: combustible (13 L/100 km), seguros por viaje y desgaste de camioneta.
                    </p>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                      KM × 2 × Viajes × Diesel + Fijos
                    </div>
                    <div className="text-[10px] text-slate-500">
                      <strong>Editable:</strong> Haz clic para ajustar el flete directamente. Si viajes = 0, computa $0.
                    </div>
                  </div>
                </div>

                {/* 2. M.O. CAPATAZ ($) */}
                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 space-y-2 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Columna 2</span>
                      <Users className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <div className="font-black text-slate-900 dark:text-white text-xs">M.O. CAPATAZ ($)</div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      El valor de las horas trabajadas por el <strong>Oficial</strong> o técnico responsable de cuadrilla.
                    </p>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-emerald-200 dark:border-emerald-800/60">
                    <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      Horas × Tarifa Oficial ($/h)
                    </div>
                    <div className="text-[10px] text-slate-500">
                      <strong>Editable:</strong> Permite ingresar el valor pactado. Si aplica, muestra el badge con la comisión del capataz.
                    </div>
                  </div>
                </div>

                {/* 3. M.O. AYUDANTE ($) */}
                <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 space-y-2 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400">Columna 3</span>
                      <Users className="w-3.5 h-3.5 text-purple-500" />
                    </div>
                    <div className="font-black text-slate-900 dark:text-white text-xs">M.O. AYUDANTE ($)</div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      El valor de las horas trabajadas por el <strong>Ayudante</strong> o personal de apoyo de pozo.
                    </p>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-purple-200 dark:border-purple-800/60">
                    <div className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-bold">
                      Horas × Tarifa Ayudante ($/h)
                    </div>
                    <div className="text-[10px] text-slate-500">
                      <strong>Editable:</strong> Ajuste directo para liquidar horas extras o jornales adicionales de colaboradores.
                    </div>
                  </div>
                </div>

                {/* 4. COSTO HONORARIOS ($) */}
                <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border-2 border-indigo-300 dark:border-indigo-800 space-y-2 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">Columna 4</span>
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <div className="font-black text-slate-900 dark:text-white text-xs">COSTO HONORARIOS ($)</div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      El <strong>valor que nosotros ponemos de ganancia</strong> comercial neta sobre el servicio y materiales.
                    </p>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-indigo-200 dark:border-indigo-800">
                    <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                      Costos Directos × Margen %
                    </div>
                    <div className="text-[10px] text-slate-500">
                      <strong>Editable:</strong> Escribe directamente los pesos de ganancia que deseas cobrar. Calcula en vivo el <code>+X% ganancia</code>.
                    </div>
                  </div>
                </div>

                {/* 5. COSTO TOTAL DEL REMITO ($) */}
                <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-800 space-y-2 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">Columna 5</span>
                      <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <div className="font-black text-slate-900 dark:text-white text-xs">COSTO TOTAL DEL REMITO ($)</div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      <strong>Es la suma de todo lo otro:</strong> Logística + M.O. Capataz + M.O. Ayudante + Materiales + Costo Honorarios.
                    </p>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-amber-200 dark:border-amber-800">
                    <div className="text-[10px] font-mono text-amber-700 dark:text-amber-400 font-bold">
                      Suma Consolidada Final
                    </div>
                    <div className="text-[10px] text-slate-500">
                      <strong>Editable:</strong> Si acuerdas un precio cerrado con el cliente, escríbelo aquí y el sistema recalcula los Honorarios de inmediato.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* FUNCIONALIDADES CLAVE Y ACCIONES EN LA PLANILLA */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
              <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider block">
                Funcionalidades de la Planilla dentro del Proceso Diario:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Edición Inline en Tiempo Real</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Cualquier dato (M.O. Capataz, Ayudante, Honorarios, Costo Total, Fecha, Horas o Técnico) se edita haciendo clic en la celda. Al presionar <strong>Enter</strong> o hacer clic fuera, se guarda automáticamente.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span>Comprobante Consolidado (Remito Pasado)</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    En cada fila, pulsa el botón de documento para emitir el Remito Comercial para el cliente con detalle técnico de tareas y repuestos sin exponer costos internos. Puedes tildar múltiples remitos para emitir un comprobante unificado.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-cyan-500" />
                    <span>Exportación a Excel Sincronizada</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    El botón superior de Excel exporta la totalidad de la planilla con las 5 columnas financieras completas (`Logística`, `M.O. Capataz`, `M.O. Ayudante`, `Costo Honorarios` y `Costo Total del Remito`), ideal para contabilidad.
                  </p>
                </div>
              </div>
            </div>

            {/* Ciclo de vida explicativo */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 space-y-2">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-black">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>1. CARGADO</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                  El reporte fue enviado por el técnico. Espera verificación técnica de horas y materiales en el panel de Auditoría.
                </p>
                <div className="text-[10px] text-rose-500 font-bold">Acción: Botón "Facturar"</div>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 space-y-2">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-black">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>2. FACTURADO</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                  Se emitió la factura fiscal (ej: Factura A). Se encuentra en plazo de crédito o cuenta corriente del cliente.
                </p>
                <div className="text-[10px] text-blue-500 font-bold">Acción: "Remito Pasado" o "Cobrar"</div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-black">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>3. PASADO</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                  Comprobante comercial entregado formalmente en mano al cliente para validación de materiales instalados.
                </p>
                <div className="text-[10px] text-amber-500 font-bold">Acción: "Registrar Cobro"</div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>4. COBRADO</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                  Pago acreditado por banco o efectivo, con cálculo de retenciones de Ganancias e IIBB aplicadas y archivado.
                </p>
                <div className="text-[10px] text-emerald-500 font-bold">Estado: Cerrado y Seguro</div>
              </div>
            </div>

            {/* ACTION GUIDE: HOW TO FACTURAR */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
              <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider block">
                Paso a Paso: Cómo facturar y registrar una cobranza:
              </span>
              <ol className="text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside text-[11px]">
                <li>En la pestaña <strong>Auditoría Técnica</strong>, ubica el remito con estado "Cargado" y pulsa el botón <strong>Facturar</strong>.</li>
                <li>Ingresa el número oficial de Factura emitida (ej: <code>A-0004-0001890</code>), la fecha de vencimiento y el monto final facturado.</li>
                <li>El remito pasará automáticamente a la pestaña <strong>Facturado</strong>.</li>
                <li>Cuando el cliente deposite o entregue un cheque, ve a <strong>Facturado</strong> y pulsa <strong>Cobrar</strong>.</li>
                <li>Indica el medio de pago, ingresa el certificado de retención si hubo deducciones impositivas y confirma. Se emitirá el recibo digital que queda en <strong>Archivo Comprobantes</strong>.</li>
              </ol>
            </div>

            {/* NUEVA SECCIÓN: NAVEGACIÓN DE PLANILLA, VISTA POR HOJAS Y OPTIMIZACIÓN DE PANTALLA */}
            <div className="p-5 rounded-3xl bg-cyan-50/50 dark:bg-cyan-950/20 border-2 border-cyan-300 dark:border-cyan-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyan-200 dark:border-cyan-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500 text-slate-950 flex items-center justify-center font-black">
                    <Keyboard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase">
                      Optimización de Pantalla, Vista por Hojas (10/20/50/100) y Teclas de Flechas
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      Herramientas para achicar el alto de la planilla y desplazarse sin tener que ir hasta abajo de todo
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-cyan-500 text-slate-950 font-black text-[10px] uppercase w-fit">
                  Última Actualización {MANUAL_VERSION}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* 1. Selector de Hojas */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-[#00c2ff] text-slate-950 flex items-center justify-center text-[10px] font-black">1</span>
                    <span>Selector de Hojas (10, 20, 50)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    En la barra superior o en el pie de la tabla, pulsa <strong>[ 10 ]</strong>, <strong>[ 20 ]</strong>, <strong>[ 50 ]</strong> o <strong>[ 100 ]</strong> para achicar la altura de la planilla y verla completa en una sola pantalla.
                  </p>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-cyan-600 dark:text-cyan-400">
                    Navegación: [⏮ Primera] [◀ Anterior] [ 1, 2, 3... ] [Siguiente ▶] [Última ⏭]
                  </div>
                </div>

                {/* 2. Flechas del Teclado */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-[#00c2ff] text-slate-950 flex items-center justify-center text-[10px] font-black">2</span>
                    <span>Navegación por Teclado</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Posando el cursor sobre la tabla o haciendo clic en ella, puedes moverte inmediatamente con el teclado sin tocar la barra de scroll:
                  </p>
                  <ul className="text-[10px] text-slate-500 dark:text-slate-400 space-y-1 list-disc list-inside">
                    <li><strong>Flechas ◀ y ▶:</strong> Desplazamiento horizontal entre columnas.</li>
                    <li><strong>Flechas ▲ y ▼:</strong> Desplazamiento vertical entre filas.</li>
                    <li><strong>Re Pág / Av Pág:</strong> Salto rápido a la hoja anterior/siguiente.</li>
                    <li><strong>Inicio / Fin:</strong> Ir a la primera o última columna.</li>
                  </ul>
                </div>

                {/* 3. Barra Superior y Pantalla Completa */}
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-[#00c2ff] text-slate-950 flex items-center justify-center text-[10px] font-black">3</span>
                    <span>Scroll Superior & Barra Lateral</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    <strong>Scroll Superior:</strong> Justo arriba de las cabeceras hay una barra horizontal sincronizada con botones <strong>[ ◀ Desplazar ]</strong> y <strong>[ Desplazar ▶ ]</strong>.
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    <strong>Barra Lateral:</strong> Al colapsar el menú lateral izquierdo, la planilla se expande al 100% del ancho del monitor (hasta pantalla ultra-ancha), desplegando múltiples columnas en simultáneo.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 6. LIQUIDACIÓN DE CUADRILLAS */}
        {(activeSection === 'todos' || activeSection === 'liquidacion') && matchesSearch('liquidacion cuadrillas capataz comision mano obra haberes sueldos') && (
          <section id="liquidacion" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-[#00c2ff] flex items-center justify-center font-black">
                  6
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    6. Liquidación de Cuadrillas y Comisiones de Capataces
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cómputo riguroso de haberes quincenales y comisiones sobre Costo de Servicio
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                Haberes
              </span>
            </div>

            {/* Golden rule alert */}
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs space-y-1">
              <div className="font-black text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>REGLA INQUEBRANTABLE: COMISIÓN SOBRE COSTO DE SERVICIO</span>
              </div>
              <p className="text-amber-900 dark:text-amber-300 text-[11px] leading-relaxed">
                El porcentaje del Capataz (por ejemplo, el 10%) se calcula única y exclusivamente sobre el <strong>Costo de Mano de Obra Directa (Servicio)</strong> de los remitos que estuvieron a su cargo. <strong>Jamás sobre combustible, materiales ni fletes</strong>, evitando inflar los pagos de forma distorsionada.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="font-bold text-slate-900 dark:text-white block text-sm">
                  ¿Cómo generar la liquidación quincenal?
                </span>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  1. Dirígete a <strong>Liquidación Cuadrillas</strong> en la barra lateral.<br />
                  2. Selecciona el rango de fechas (ej: 01 al 15 del mes actual) o filtra por técnico/capataz.<br />
                  3. Revisa la sumatoria de horas normales, guardias técnicas liquidadas (monto convenido o por horas) y los servicios finalizados.<br />
                  4. Pulsa <strong>Descargar Resumen PDF de Liquidación</strong> para entregar copia firmada al trabajador.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="font-bold text-slate-900 dark:text-white block text-sm">
                  Cierre de Liquidación
                </span>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Al completar el pago bancario o en efectivo, haz clic en el botón <strong>Marcar como Liquidado</strong>. Esto congela los remitos involucrados para que no puedan ser cobrados dos veces en quincenas futuras.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* 7. BASE DE CLIENTES, FINCAS Y DISTANCIAS */}
        {(activeSection === 'todos' || activeSection === 'clientes') && matchesSearch('clientes fincas distancias km san carlos tupungato tunuyan cuit') && (
          <section id="clientes" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-[#00c2ff] flex items-center justify-center font-black">
                  7
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    7. Base de Clientes, Fincas y Distancias KM
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Georreferenciación de pozos y precisión de kilometraje en Valle de Uco
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-300">
                Logística
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <span className="font-black text-slate-900 dark:text-white block">Distancia Precisa</span>
                <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                  Cada finca tiene asignada la distancia exacta desde la base operativa. Al seleccionar el cliente en el reporte, el kilometraje se rellena automáticamente.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <span className="font-black text-slate-900 dark:text-white block">CUIT & Condición Fiscal</span>
                <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                  Almacena Razón Social, CUIT y si es Responsable Inscripto o Exento para emitir Factura A o B sin demoras.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <span className="font-black text-slate-900 dark:text-white block">Modificación Rápida</span>
                <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                  En <strong>Base de Clientes</strong>, pulsa el icono de lápiz para cambiar los KM o datos de contacto. El cambio impacta de inmediato en los próximos reportes.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* 8. GESTIÓN DE USUARIOS Y PERMISOS RBAC */}
        {(activeSection === 'todos' || activeSection === 'usuarios-seguridad') && matchesSearch('usuarios roles permisos rbac eliminar usuario baja definitiva superadmin') && (
          <section id="usuarios-seguridad" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-[#00c2ff] flex items-center justify-center font-black">
                  8
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    8. Gestión de Usuarios, Roles RBAC y Bajas Definitivas
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Seguridad por capas y procedimiento de eliminación permanente en base de datos
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300">
                Seguridad
              </span>
            </div>

            {/* Matriz RBAC */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase">
                  <tr>
                    <th className="p-3">Rol</th>
                    <th className="p-3">Reporte Campo</th>
                    <th className="p-3">Auditoría</th>
                    <th className="p-3">Facturar/Cobrar</th>
                    <th className="p-3">Costos Fijos</th>
                    <th className="p-3">Usuarios</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr className="hover:bg-cyan-50/20 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-purple-600 dark:text-purple-400">SuperAdmin (Martin)</td>
                    <td className="p-3 text-emerald-500 font-bold">Total</td>
                    <td className="p-3 text-emerald-500 font-bold">Total</td>
                    <td className="p-3 text-emerald-500 font-bold">Total</td>
                    <td className="p-3 text-emerald-500 font-bold">Total</td>
                    <td className="p-3 text-emerald-500 font-bold">Consola Central DB</td>
                  </tr>
                  <tr className="hover:bg-cyan-50/20 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-slate-800 dark:text-white">Gerencia / Dirección</td>
                    <td className="p-3 text-emerald-500 font-bold">Total</td>
                    <td className="p-3 text-emerald-500 font-bold">Total</td>
                    <td className="p-3 text-emerald-500 font-bold">Total</td>
                    <td className="p-3 text-cyan-500 font-bold">Modificar</td>
                    <td className="p-3 text-slate-400 font-bold">Lectura</td>
                  </tr>
                  <tr className="hover:bg-cyan-50/20 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-slate-800 dark:text-white">Administración</td>
                    <td className="p-3 text-emerald-500 font-bold">Total</td>
                    <td className="p-3 text-emerald-500 font-bold">Total</td>
                    <td className="p-3 text-emerald-500 font-bold">Facturar y Cobrar</td>
                    <td className="p-3 text-slate-400 font-bold">Lectura</td>
                    <td className="p-3 text-rose-500 font-bold">Sin Acceso</td>
                  </tr>
                  <tr className="hover:bg-cyan-50/20 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-slate-800 dark:text-white">Capataz (app de campo)</td>
                    <td className="p-3 text-emerald-500 font-bold">Parte sin valores</td>
                    <td className="p-3 text-rose-500 font-bold">Sin Acceso</td>
                    <td className="p-3 text-rose-500 font-bold">Sin Acceso</td>
                    <td className="p-3 text-rose-500 font-bold">Sin Acceso</td>
                    <td className="p-3 text-rose-500 font-bold">Sin Acceso</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* HOW TO DELETE A USER (FIXED RESOLUTION HIGHLIGHT) */}
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-300 dark:border-rose-800 space-y-2 text-xs">
              <span className="font-black text-rose-700 dark:text-rose-300 uppercase tracking-wider block flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>Procedimiento de Baja Definitiva de Usuario:</span>
              </span>
              <p className="text-rose-950 dark:text-rose-200 text-[11px] leading-relaxed">
                1. Dirígete a <strong>Usuarios y Permisos</strong>.<br />
                2. En la fila del usuario a desvincular, presiona el botón rojo con icono de papelera (Eliminar).<br />
                3. Se abrirá el modal de confirmación. Presiona <strong>Confirmar Eliminación</strong>.<br />
                4. <strong>Garantía de Persistencia:</strong> El sistema elimina el perfil, da de baja la cuenta de acceso desde el servidor y registra la baja. Aunque se recargue el navegador o se limpie la caché, el usuario no vuelve a reaparecer ni puede ingresar. Para el alta, la clave temporal y el restablecimiento de claves, ver la sección 14.
              </p>
            </div>
          </section>
        )}

        {/* 9. PARÁMETROS Y COSTOS FIJOS */}
        {(activeSection === 'todos' || activeSection === 'parametros') && matchesSearch('parametros costos fijos diesel hora oficial ayudante seguro amortizacion') && (
          <section id="parametros" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-[#00c2ff] flex items-center justify-center font-black">
                  9
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    9. Parámetros Técnicos y Costos Fijos
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configuración de variables del motor económico de la empresa
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Variables Centrales
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">PRECIO LITRO DIESEL</span>
                <div className="font-mono font-black text-amber-500 text-base mt-1">
                  ${(technicalParameters.dieselPrice || 1200).toLocaleString('es-AR')}
                </div>
                <span className="text-[10px] text-slate-500">Gasoil Grado 3 (YPF Infinia)</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">HORA OFICIAL</span>
                <div className="font-mono font-black text-cyan-500 text-base mt-1">
                  ${(technicalParameters.horaOficial || 9400).toLocaleString('es-AR')}
                </div>
                <span className="text-[10px] text-slate-500">Mano de Obra Calificada</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">HORA AYUDANTE</span>
                <div className="font-mono font-black text-purple-500 text-base mt-1">
                  ${(technicalParameters.pagoAyudanteHora || 5500).toLocaleString('es-AR')}
                </div>
                <span className="text-[10px] text-slate-500">Apoyo y Maniobras Físicas</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">AMORTIZACIÓN / VIAJE</span>
                <div className="font-mono font-black text-slate-900 dark:text-white text-base mt-1">
                  ${(technicalParameters.amortizacionViaje || 7587.88).toLocaleString('es-AR')}
                </div>
                <span className="text-[10px] text-slate-500">Desgaste Camioneta & Equipos</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-cyan-50/50 dark:bg-slate-800 border border-cyan-300 dark:border-cyan-800 text-xs">
              <span className="font-bold text-slate-900 dark:text-white block mb-1">
                ¿Cómo actualizar estos valores cuando hay inflación o aumento de combustibles?
              </span>
              <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                Ingresa al módulo <strong>Parámetros & Costos Fijos</strong> desde la barra lateral. Modifica el precio del combustible o las tarifas horarias y pulsa <strong>Guardar Parámetros</strong>. Todos los nuevos remitos y simulaciones se calcularán automáticamente con los nuevos valores.
              </p>
            </div>
          </section>
        )}

        {/* 10. ESPACIO DE PRUEBA (SANDBOX AISLADO) */}
        {(activeSection === 'todos' || activeSection === 'sandbox') && matchesSearch('sandbox espacio prueba simulador formulas laboratorio remitos borrador') && (
          <section id="sandbox" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center font-black">
                  10
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    10. Espacio de Prueba Exclusivo (Sandbox Aislado)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Entorno seguro para comprobar fórmulas matemáticas y ensayar remitos sin tocar datos reales
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-500 text-slate-950">
                Laboratorio Seguro
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-slate-800/80 border border-amber-300/60 dark:border-amber-700/60 space-y-2">
                <span className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-500" />
                  <span>Subpestaña 1: Simulador de Fórmulas</span>
                </span>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Permite mover libremente los kilómetros, viajes (incluso probar 0 viajes), horas trabajadas, guardia técnica manual (fija o por horas), margen de facturación editable y alternar operarios entre Oficial y Ayudante. A la derecha, verás cómo se desglosa cada peso en combustible, seguros, M.O. directa y facturación comercial.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-slate-800/80 border border-amber-300/60 dark:border-amber-700/60 space-y-2">
                <span className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  <span>Subpestaña 2: Remitos de Prueba</span>
                </span>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Puedes cargar remitos de prueba con número de papel manual. Estos registros viven en un almacenamiento aislado de ese navegador. Si un remito de prueba queda verificado y quieres incorporarlo a la gestión real, usa el botón <strong>"A Producción"</strong>: pide confirmación con el detalle del remito, exige elegir un <strong>cliente real</strong> de la base, lo crea con el <strong>siguiente número de remito real</strong> (no el de prueba), recalcula el precio con las tarifas vigentes y queda marcado <strong>"En producción"</strong> para que no se pueda cargar dos veces.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* 11 a 15. FUNCIONES NUEVAS (contenido compartido con el PDF) */}
        {MANUAL_EXTRA_SECTIONS.map(section =>
          (activeSection === 'todos' || activeSection === section.id) &&
          matchesSearch(section.keywords + ' ' + section.title + ' ' + section.subtitle) ? (
            <ExtraSection key={section.id} section={section} />
          ) : null
        )}

        {/* 16. PREGUNTAS FRECUENTES (FAQ) */}
        {(activeSection === 'todos' || activeSection === 'faq') && matchesSearch('faq preguntas frecuentes dudas errores solucion conexion offline') && (
          <section id="faq" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-[#00c2ff] flex items-center justify-center font-black">
                  16
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    16. Preguntas Frecuentes y Solución Rápida de Dudas
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Respuestas inmediatas a las situaciones más comunes durante la jornada
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                Soporte
              </span>
            </div>

            <div className="space-y-3 text-xs">
              
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-black text-slate-900 dark:text-white text-xs block text-cyan-600 dark:text-cyan-400">
                  ¿Por qué al fijar 0 viajes el costo logístico baja a $0?
                </span>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Porque si el técnico no utilizó la camioneta utilitaria de la empresa para trasladarse hasta el pozo (por ejemplo, el cliente trajo la bomba al taller o el personal ya se encontraba pernoctando en la finca), no se debe computar combustible, seguro de traslado ni amortización vehicular.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-black text-slate-900 dark:text-white text-xs block text-cyan-600 dark:text-cyan-400">
                  ¿Qué sucede si un técnico carga un reporte sin señal de internet en el campo?
                </span>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Seguí cargando. Con la aplicación del capataz instalada, los partes se guardan en el teléfono (figuran como "Sin enviar") y se envían solos cuando vuelve la señal (ver sección 12). En el sistema de administración, el indicador de la esquina inferior derecha muestra "Sin conexión" y cuántos cambios quedan sin sincronizar, y avisa antes de cerrar la pestaña.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-black text-slate-900 dark:text-white text-xs block text-cyan-600 dark:text-cyan-400">
                  ¿Cómo descargo este manual para imprimirlo o enviarlo por WhatsApp a los técnicos?
                </span>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Pulsa el botón superior <strong>"Descargar Manual en PDF"</strong>. Se generará un documento PDF diagramado en formato A4 con portada institucional, tablas y fórmulas listo para compartir o imprimir.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-black text-slate-900 dark:text-white text-xs block text-cyan-600 dark:text-cyan-400">
                  ¿Se actualiza este manual cada vez que se agreguen nuevas funciones?
                </span>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Sí. Toda nueva modificación en tarifas, pantallas, permisos o cálculos queda incorporada de forma permanente tanto en esta vista interactiva como en el motor de exportación a PDF para que siempre consultes la última versión disponible ({MANUAL_VERSION}).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-black text-slate-900 dark:text-white text-xs block text-cyan-600 dark:text-cyan-400">
                  ¿El capataz puede ver precios o costos?
                </span>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  No. La aplicación del capataz solo permite cargar partes de campo (horas, personal, materiales, descripción y firma). Su sesión no recibe precios, tarifas, costos, sueldos ni remitos. Administración calcula los valores al convertir el parte en remito (sección 12).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-black text-slate-900 dark:text-white text-xs block text-cyan-600 dark:text-cyan-400">
                  ¿Qué hago si un usuario olvidó su contraseña o no tiene correo?
                </span>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  En "Usuarios y Permisos" presioná "Restablecer clave": el sistema genera una clave temporal que se muestra una sola vez. Entregásela al usuario; deberá elegir una propia al ingresar (sección 14).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-black text-slate-900 dark:text-white text-xs block text-cyan-600 dark:text-cyan-400">
                  ¿Dónde están los remitos que ya cobré y archivé?
                </span>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Siguen en Auditoría Técnica: salen de las listas de trabajo pero siempre aparecen en la búsqueda y con el filtro "Archivado". Se pueden desarchivar y salen en la exportación a Excel (sección 11).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-black text-slate-900 dark:text-white text-xs block text-cyan-600 dark:text-cyan-400">
                  ¿Por qué un parte que llegó por foto dice "Revisar antes de convertir"?
                </span>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Porque la lectura de letra manuscrita puede equivocarse. El sistema marca lo que no pudo confirmar (cliente o personal desconocidos, fecha dudosa, horario incompleto, lectura poco clara) para que una persona lo verifique contra la foto antes de crear el remito (sección 13).
                </p>
              </div>
            </div>
          </section>
        )}

      </div>

      {/* FOOTER CALLOUT */}
      <div className="p-6 rounded-3xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-[#00c2ff]" />
          <div>
            <span className="font-bold text-slate-900 dark:text-white block">
              JOB Martin Bandiera · Manual Oficial de Operaciones
            </span>
            <span className="text-[11px]">Soporte técnico, electromecánica y pozos profundos · Mendoza</span>
          </div>
        </div>

        <button
          onClick={handleExportPDF}
          className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-xs print:hidden"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exportar PDF</span>
        </button>
      </div>

    </div>
  );
};

// Helper component for Layers icon inside sub-navigation
function LayersIcon(props: any) {
  return <Sparkles {...props} />;
}


const NOTE_TONE: Record<'info' | 'warn' | 'ok', string> = {
  info: 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-300 dark:border-cyan-800 text-cyan-900 dark:text-cyan-200',
  warn: 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200',
  ok: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
};

const ManualBlockView: React.FC<{ block: ManualBlock }> = ({ block }) => {
  switch (block.type) {
    case 'p':
      return <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{block.text}</p>;
    case 'steps':
      return (
        <div className="space-y-2">
          {block.title && <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">{block.title}</h3>}
          <ol className="space-y-1.5">
            {block.items.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                <span className="shrink-0 w-5 h-5 rounded-full bg-cyan-100 dark:bg-cyan-950 text-[#00a8dd] flex items-center justify-center font-black text-[10px]">{i + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    case 'bullets':
      return (
        <div className="space-y-2">
          {block.title && <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">{block.title}</h3>}
          <ul className="space-y-1.5">
            {block.items.map((item, i) => (
              <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case 'table':
      return (
        <div className="space-y-2 overflow-x-auto">
          {block.title && <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">{block.title}</h3>}
          <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase">
              <tr>
                {block.head.map(h => (
                  <th key={h} className="p-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={`p-3 ${j === 0 ? 'font-bold text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'note':
      return (
        <div className={`p-4 rounded-2xl border space-y-1 ${NOTE_TONE[block.tone]}`}>
          <span className="font-black uppercase tracking-wider text-[11px] flex items-center gap-2">
            <Info className="w-3.5 h-3.5" />
            <span>{block.title}</span>
          </span>
          <p className="text-[11px] leading-relaxed">{block.text}</p>
        </div>
      );
  }
};

const ExtraSection: React.FC<{ section: ManualExtraSection }> = ({ section }) => (
  <section id={section.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-[#00c2ff] flex items-center justify-center font-black">
          {section.num}
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {section.num}. {section.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{section.subtitle}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950">{section.badge}</span>
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Estado: {section.status}</span>
      </div>
    </div>
    {section.blocks.map((block, i) => (
      <ManualBlockView key={i} block={block} />
    ))}
  </section>
);

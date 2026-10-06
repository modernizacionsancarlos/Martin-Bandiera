import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building,
  RefreshCw,
  Table,
  HelpCircle,
  Check,
  Package,
  Sparkles
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { ActualizarDescripcionesModal } from './ActualizarDescripcionesModal';
import {
  parseRemitosExcel,
  parseClientesExcel,
  parseMaterialesExcel,
  downloadRemitosExcelTemplate,
  downloadClientesExcelTemplate,
  downloadMaterialesExcelTemplate,
  ExcelImportResult,
  ExcelClientImportResult,
  ExcelMaterialImportResult
} from '../utils/excelParser';
import { TechnicalAuditRecord, ClientItem, MaterialItem } from '../types';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
  initialTab?: 'remitos' | 'clientes' | 'materiales';
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialTab = 'remitos'
}) => {
  const { bulkAddTechnicalAuditRecords, bulkAddClients, bulkAddMaterials } = useData();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<'remitos' | 'clientes' | 'materiales'>(initialTab);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<ExcelImportResult | null>(null);
  const [parsedClientsData, setParsedClientsData] = useState<ExcelClientImportResult | null>(null);
  const [parsedMaterialsData, setParsedMaterialsData] = useState<ExcelMaterialImportResult | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [isDescRecoveryOpen, setIsDescRecoveryOpen] = useState(false);

  // Sync tab if initialTab changes or modal reopens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      handleReset();
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setParsedData(null);
    setParsedClientsData(null);
    setParsedMaterialsData(null);
    setImportSuccess(false);

    try {
      if (activeTab === 'materiales') {
        const result = await parseMaterialesExcel(file);
        setParsedMaterialsData(result);
      } else if (activeTab === 'clientes') {
        const result = await parseClientesExcel(file);
        setParsedClientsData(result);
      } else {
        const result = await parseRemitosExcel(file);
        setParsedData(result);
      }
    } catch (err: any) {
      if (activeTab === 'materiales') {
        setParsedMaterialsData({
          materials: [],
          errors: [err.message || 'No se pudo leer el archivo Excel de Materiales'],
          totalRows: 0
        });
      } else if (activeTab === 'clientes') {
        setParsedClientsData({
          clients: [],
          errors: [err.message || 'No se pudo leer el archivo Excel de Clientes'],
          totalRows: 0
        });
      } else {
        setParsedData({
          records: [],
          errors: [err.message || 'No se pudo leer el archivo Excel'],
          totalRows: 0
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleCommitImport = () => {
    if (activeTab === 'materiales') {
      if (!parsedMaterialsData || parsedMaterialsData.materials.length === 0) return;
      bulkAddMaterials(parsedMaterialsData.materials);
      setImportedCount(parsedMaterialsData.materials.length);
      setImportSuccess(true);
      if (onSuccess) onSuccess(parsedMaterialsData.materials.length);
    } else if (activeTab === 'clientes') {
      if (!parsedClientsData || parsedClientsData.clients.length === 0) return;
      bulkAddClients(parsedClientsData.clients);
      setImportedCount(parsedClientsData.clients.length);
      setImportSuccess(true);
      if (onSuccess) onSuccess(parsedClientsData.clients.length);
    } else {
      if (!parsedData || parsedData.records.length === 0) return;
      bulkAddTechnicalAuditRecords(parsedData.records);
      setImportedCount(parsedData.records.length);
      setImportSuccess(true);
      if (onSuccess) onSuccess(parsedData.records.length);
    }

    setTimeout(() => {
      onClose();
    }, 2200);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParsedData(null);
    setParsedClientsData(null);
    setParsedMaterialsData(null);
    setImportSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const hasParsedContent =
    activeTab === 'materiales'
      ? !!parsedMaterialsData
      : activeTab === 'clientes'
      ? !!parsedClientsData
      : !!parsedData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[96vh] sm:max-h-[92vh] rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-auto">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-700 via-teal-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/15 shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200">
                CARGA MASIVA POR BASE DE DATOS
              </span>
              <h2 className="text-base sm:text-lg md:text-xl font-black tracking-tight leading-tight">
                Importar desde Excel (.xlsx / .xls / .csv)
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-2 gap-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => { setActiveTab('remitos'); handleReset(); }}
            className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'remitos'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Remitos & Trabajos</span>
          </button>
          <button
            onClick={() => { setActiveTab('clientes'); handleReset(); }}
            className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'clientes'
                ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Base de Clientes</span>
          </button>
          <button
            onClick={() => { setActiveTab('materiales'); handleReset(); }}
            className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'materiales'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Materiales & Repuestos</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto">
          
          {/* Explanation Banner */}
          <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-blue-900 dark:text-blue-200">
                {activeTab === 'materiales'
                  ? 'Carga masiva al catálogo de materiales y stock por base de datos'
                  : activeTab === 'clientes'
                  ? 'Importación automática a la base de clientes y sedes'
                  : 'Importación flexible de remitos de campo'}
              </p>
              <p className="text-blue-700 dark:text-blue-300 leading-relaxed">
                {activeTab === 'materiales' ? (
                  <>
                    Detecta automáticamente: <strong>Código, Nombre / Descripción, Categoría, Stock Inicial, Unidad de Medida, Stock Mínimo, Precio Unitario ($) y Ubicación / Depósito</strong>.
                    Si un material ya existe por código o nombre, su stock y precio se actualizan automáticamente.
                  </>
                ) : activeTab === 'clientes' ? (
                  <>
                    Detecta automáticamente: <strong>Razón Social, CUIT, Finca / Locación, Teléfono, Email, Dirección Fiscal y Distancia KM</strong>.
                  </>
                ) : (
                  <>
                    Detecta automáticamente: <strong>Nº Remito, Fecha, Cliente, Total Facturado, Estado, Mano de Obra, Materiales, Nº Factura y Retenciones</strong>.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick callout for description recovery */}
          {activeTab === 'remitos' && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-200">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  ¿Tus remitos ya cargados dicen <em>"Mantenimiento preventivo..."</em> y querés recuperar sus descripciones de tareas reales desde tu Excel?
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsDescRecoveryOpen(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition shadow-xs cursor-pointer shrink-0"
              >
                Recuperar Tareas
              </button>
            </div>
          )}

          {/* Template Download Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {activeTab === 'materiales'
                  ? 'Descarga la plantilla con ejemplos reales de insumos y electrobombas'
                  : '¿Necesitas la plantilla oficial para completar tus datos?'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'materiales' ? (
                <button
                  onClick={downloadMaterialesExcelTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-white transition-all cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Plantilla de Materiales (.xlsx)</span>
                </button>
              ) : activeTab === 'clientes' ? (
                <button
                  onClick={downloadClientesExcelTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-all cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Plantilla de Clientes (.xlsx)</span>
                </button>
              ) : (
                <button
                  onClick={downloadRemitosExcelTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Plantilla de Remitos (.xlsx)</span>
                </button>
              )}
            </div>
          </div>

          {/* Upload Dropzone */}
          {!hasParsedContent && !importSuccess && (
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 scale-[0.99]'
                  : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Upload className="w-7 h-7" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Arrastra tu archivo Excel aquí o haz clic para seleccionarlo
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Formatos compatibles: .xlsx, .xls o .csv (máximo 5000 filas por archivo)
              </p>
            </div>
          )}

          {/* Loading Indicator */}
          {isProcessing && (
            <div className="p-8 text-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Analizando columnas y validando filas del archivo...
              </p>
            </div>
          )}

          {/* Success Banner */}
          {importSuccess && (
            <div className="p-8 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h3 className="text-lg font-black text-emerald-900 dark:text-emerald-200">
                ¡{importedCount}{' '}
                {activeTab === 'materiales'
                  ? 'materiales e insumos'
                  : activeTab === 'clientes'
                  ? 'clientes'
                  : 'remitos'}{' '}
                importados exitosamente!
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 max-w-md mx-auto">
                {activeTab === 'materiales'
                  ? 'El catálogo de inventario ha sido actualizado y sincronizado en la base de datos de Firestore. Los materiales ya están disponibles para cotizar y asociar a remitos.'
                  : activeTab === 'clientes'
                  ? 'La base de clientes ha sido actualizada y ya se encuentra vinculada a los reportes y remitos de campo.'
                  : 'Los remitos han sido integrados al sistema con sus cálculos de costos, materiales, retenciones y estados actualizados.'}
              </p>
            </div>
          )}

          {/* Parsed Materiales Preview Table */}
          {activeTab === 'materiales' && parsedMaterialsData && !importSuccess && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                    {parsedMaterialsData.materials.length} materiales detectados
                  </span>
                  {parsedMaterialsData.errors.length > 0 && (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                      {parsedMaterialsData.errors.length} advertencia(s)
                    </span>
                  )}
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold cursor-pointer"
                >
                  Cambiar Archivo
                </button>
              </div>

              {/* Table Preview */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xs">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2.5">CÓDIGO</th>
                        <th className="p-2.5">NOMBRE / DESCRIPCIÓN</th>
                        <th className="p-2.5">CATEGORÍA</th>
                        <th className="p-2.5 text-right">STOCK</th>
                        <th className="p-2.5">UNIDAD</th>
                        <th className="p-2.5 text-right">STOCK MÍN.</th>
                        <th className="p-2.5 text-right">PRECIO UNITARIO ($)</th>
                        <th className="p-2.5">UBICACIÓN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedMaterialsData.materials.slice(0, 15).map((m, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2.5 font-mono font-bold text-amber-600 dark:text-amber-400">
                            {m.code}
                          </td>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white max-w-[200px] truncate">
                            {m.name}
                          </td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {m.category}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {(m.stock || 0).toLocaleString('es-AR')}
                          </td>
                          <td className="p-2.5 text-slate-500 font-medium">
                            {m.unit}
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-500">
                            {(m.minStock || 0).toLocaleString('es-AR')}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ${(m.unitPrice || 0).toLocaleString('es-AR')}
                          </td>
                          <td className="p-2.5 text-slate-500 truncate max-w-[140px]">
                            {m.location || 'Depósito Central'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {parsedMaterialsData.materials.length > 15 && (
                <p className="text-[11px] text-slate-400 text-center italic">
                  Mostrando las primeras 15 filas de {parsedMaterialsData.materials.length} en vista previa.
                </p>
              )}
            </div>
          )}

          {/* Parsed Clientes Preview Table */}
          {activeTab === 'clientes' && parsedClientsData && !importSuccess && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300">
                    {parsedClientsData.clients.length} clientes detectados
                  </span>
                  {parsedClientsData.errors.length > 0 && (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                      {parsedClientsData.errors.length} advertencia(s)
                    </span>
                  )}
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold cursor-pointer"
                >
                  Cambiar Archivo
                </button>
              </div>

              {/* Table Preview */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xs">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2.5">RAZÓN SOCIAL</th>
                        <th className="p-2.5">CUIT</th>
                        <th className="p-2.5">FINCA / LOCACIÓN</th>
                        <th className="p-2.5">TELÉFONO</th>
                        <th className="p-2.5">EMAIL</th>
                        <th className="p-2.5 text-right">DISTANCIA KM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedClientsData.clients.slice(0, 15).map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                            {c.razonSocial}
                          </td>
                          <td className="p-2.5 font-mono text-slate-500">{c.cuit || '—'}</td>
                          <td className="p-2.5 font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                            {c.fincaLocacion || '—'}
                          </td>
                          <td className="p-2.5 text-slate-500">{c.telefono || '—'}</td>
                          <td className="p-2.5 text-slate-500 truncate max-w-[140px]">{c.email || '—'}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-cyan-600 dark:text-cyan-400">
                            {c.distanciaKm} km
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {parsedClientsData.clients.length > 15 && (
                <p className="text-[11px] text-slate-400 text-center italic">
                  Mostrando las primeras 15 filas de {parsedClientsData.clients.length} en vista previa.
                </p>
              )}
            </div>
          )}

          {/* Parsed Remitos Preview Table */}
          {activeTab === 'remitos' && parsedData && !importSuccess && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                    {parsedData.records.length} registros detectados
                  </span>
                  {parsedData.errors.length > 0 && (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                      {parsedData.errors.length} advertencia(s)
                    </span>
                  )}
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold cursor-pointer"
                >
                  Cambiar Archivo
                </button>
              </div>

              {/* Table Preview */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xs">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2.5">REMITO</th>
                        <th className="p-2.5">FECHA</th>
                        <th className="p-2.5">CLIENTE</th>
                        <th className="p-2.5">PUNTO TRABAJO</th>
                        <th className="p-2.5 text-right">TOTAL FACTURADO ($)</th>
                        <th className="p-2.5 text-center">ESTADO</th>
                        <th className="p-2.5">Nº FACTURA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedData.records.slice(0, 15).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-white">
                            {r.remitoId}
                          </td>
                          <td className="p-2.5 text-slate-500">{r.date}</td>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                            {r.clientName}
                          </td>
                          <td className="p-2.5 text-slate-500 truncate max-w-[120px]">
                            {r.workPoint}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ${(r.billedPrice || r.suggestedPrice || 0).toLocaleString('es-AR')}
                          </td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                r.status === 'Facturado'
                                  ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                                  : r.status === 'Cobrado'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  : r.status === 'Pasado'
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-indigo-600 dark:text-indigo-400">
                            {r.numeroFactura || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {parsedData.records.length > 15 && (
                <p className="text-[11px] text-slate-400 text-center italic">
                  Mostrando las primeras 15 filas de {parsedData.records.length} en vista previa.
                </p>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            Cerrar
          </button>
          {!importSuccess && (
            <>
              {activeTab === 'materiales' && parsedMaterialsData && (
                <button
                  onClick={handleCommitImport}
                  disabled={parsedMaterialsData.materials.length === 0}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar e Importar {parsedMaterialsData.materials.length} Materiales a la Base de Datos</span>
                </button>
              )}
              {activeTab === 'clientes' && parsedClientsData && (
                <button
                  onClick={handleCommitImport}
                  disabled={parsedClientsData.clients.length === 0}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar e Importar {parsedClientsData.clients.length} Clientes</span>
                </button>
              )}
              {activeTab === 'remitos' && parsedData && (
                <button
                  onClick={handleCommitImport}
                  disabled={parsedData.records.length === 0}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar e Importar {parsedData.records.length} Registros</span>
                </button>
              )}
            </>
          )}
        </div>

      </div>

      {/* Description Recovery Modal */}
      <ActualizarDescripcionesModal
        isOpen={isDescRecoveryOpen}
        onClose={() => setIsDescRecoveryOpen(false)}
      />
    </div>
  );
};

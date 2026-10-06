import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  RefreshCw, 
  Sparkles,
  Info,
  Layers
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { 
  inspectExcelFile, 
  matchDescriptionsFromExcel, 
  ExcelColumnInfo, 
  DescriptionMatchResult,
  MatchedDescriptionItem 
} from '../utils/excelParser';

interface ActualizarDescripcionesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActualizarDescripcionesModal: React.FC<ActualizarDescripcionesModalProps> = ({
  isOpen,
  onClose
}) => {
  const { technicalAuditRecords, bulkUpdateAuditRecordDescriptions } = useData();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<ExcelColumnInfo | null>(null);
  const [remitoCol, setRemitoCol] = useState<string>('');
  const [descCol, setDescCol] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMatching, setIsMatching] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<DescriptionMatchResult | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  // Handle file drop / select
  const handleFileChange = async (file: File) => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      setMatchResult(null);
      setSuccessCount(null);
      setSelectedFile(file);

      const info = await inspectExcelFile(file);
      setFileInfo(info);

      const rCol = info.suggestedRemitoCol || (info.columns.length > 0 ? info.columns[0] : '');
      const dCol = info.suggestedDescCol || (info.columns.length > 1 ? info.columns[1] : '');

      setRemitoCol(rCol);
      setDescCol(dCol);

      // If we have both columns, run auto-matching
      if (rCol && dCol) {
        setIsMatching(true);
        const res = await matchDescriptionsFromExcel(file, technicalAuditRecords, {
          remitoCol: rCol,
          descCol: dCol,
          sheetName: info.sheetName
        });
        setMatchResult(res);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el archivo Excel');
    } finally {
      setIsLoading(false);
      setIsMatching(false);
    }
  };

  // Re-run matching if user manually changes column mappings
  const handleReMatch = async (newRemitoCol: string, newDescCol: string) => {
    if (!selectedFile || !fileInfo || !newRemitoCol || !newDescCol) return;
    try {
      setIsMatching(true);
      setErrorMsg(null);
      const res = await matchDescriptionsFromExcel(selectedFile, technicalAuditRecords, {
        remitoCol: newRemitoCol,
        descCol: newDescCol,
        sheetName: fileInfo.sheetName
      });
      setMatchResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al buscar coincidencias');
    } finally {
      setIsMatching(false);
    }
  };

  // Execute database updates
  const handleApplyUpdates = async () => {
    if (!matchResult || matchResult.matches.length === 0) return;
    try {
      setIsSaving(true);
      setErrorMsg(null);

      const payload = matchResult.matches.map(m => ({
        id: m.recordId,
        description: m.newDescription
      }));

      const count = await bulkUpdateAuditRecordDescriptions(payload);
      setSuccessCount(count);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar los cambios en la base de datos');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFileInfo(null);
    setMatchResult(null);
    setSuccessCount(null);
    setErrorMsg(null);
    setRemitoCol('');
    setDescCol('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Recuperar / Actualizar Descripciones desde Excel</h2>
              <p className="text-xs text-slate-300">
                Sincroniza la columna de tareas reales desde tu planilla original hacia la base de datos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Explanation Banner */}
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3 text-xs text-blue-800">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold mb-0.5">¿Cómo funciona la recuperación?</p>
              <p className="text-blue-700 leading-relaxed">
                Selecciona la planilla Excel que contiene tus remitos. El sistema cruzará automáticamente cada fila 
                por su número de remito (o remito papel) e insertará la descripción real de las tareas realizadas, 
                reemplazando el texto por defecto sin modificar facturas, estados, fechas ni importes.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successCount !== null ? (
            /* Success View */
            <div className="py-8 px-6 text-center space-y-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-900">¡Descripciones actualizadas con éxito!</h3>
                <p className="text-sm text-emerald-700 mt-1">
                  Se actualizaron <strong>{successCount}</strong> remitos en la base de datos de Firestore con sus tareas reales.
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition shadow-sm"
                >
                  Cerrar y Ver Resultados
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Cargar otro archivo
                </button>
              </div>
            </div>
          ) : !selectedFile ? (
            /* Upload Dropzone */
            <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-8 text-center transition bg-slate-50/50 hover:bg-blue-50/20 group">
              <input
                type="file"
                id="excel-file-desc-update"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <label
                htmlFor="excel-file-desc-update"
                className="cursor-pointer flex flex-col items-center justify-center"
              >
                <div className="w-14 h-14 bg-blue-100 group-hover:bg-blue-200 text-blue-600 rounded-2xl flex items-center justify-center mb-3 transition shadow-xs">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Haz clic para seleccionar tu planilla Excel (.xlsx, .xls)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  O arrastra y suelta el archivo aquí
                </p>
                <span className="mt-4 px-3 py-1 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-700 shadow-xs group-hover:border-blue-400">
                  Seleccionar Archivo
                </span>
              </label>
            </div>
          ) : (
            /* Mapped Columns & Preview */
            <div className="space-y-5">
              {/* File Info Bar */}
              <div className="flex items-center justify-between p-3 bg-slate-100 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2.5 text-xs text-slate-700">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold">{selectedFile.name}</span>
                  <span className="text-slate-400">|</span>
                  <span>{fileInfo?.totalRows || 0} filas leídas</span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-500">Hoja: {fileInfo?.sheetName}</span>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                >
                  Cambiar archivo
                </button>
              </div>

              {/* Column Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    1. Columna con Nº de Remito o Remito Papel:
                  </label>
                  <select
                    value={remitoCol}
                    onChange={e => {
                      setRemitoCol(e.target.value);
                      handleReMatch(e.target.value, descCol);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {fileInfo?.columns.map(col => (
                      <option key={col} value={col}>
                        {col} {col === fileInfo.suggestedRemitoCol ? '★ (Sugerida)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Se usará para cruzar con el remito correspondiente en el sistema.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    2. Columna con la Descripción Real de Tareas:
                  </label>
                  <select
                    value={descCol}
                    onChange={e => {
                      setDescCol(e.target.value);
                      handleReMatch(remitoCol, e.target.value);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-emerald-800"
                  >
                    {fileInfo?.columns.map(col => (
                      <option key={col} value={col}>
                        {col} {col === fileInfo.suggestedDescCol ? '★ (Sugerida)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Es el texto que se guardará en la columna "Descripción de Tareas".
                  </p>
                </div>
              </div>

              {/* Match Statistics */}
              {isMatching ? (
                <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Buscando coincidencias con los remitos del sistema...</span>
                </div>
              ) : matchResult && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        {matchResult.matchedCount} remitos listos para actualizar
                      </span>
                      <span className="text-xs text-slate-500">
                        (de {matchResult.totalExcelRows} filas en el archivo)
                      </span>
                    </div>

                    <button
                      onClick={() => handleReMatch(remitoCol, descCol)}
                      className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 hover:underline"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Recalcular
                    </button>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-600 sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 font-semibold">Remito</th>
                          <th className="py-2 px-3 font-semibold">Cliente</th>
                          <th className="py-2 px-3 font-semibold text-slate-400">Descripción Actual</th>
                          <th className="py-2 px-3 font-semibold text-emerald-700 bg-emerald-50/60">Nueva Descripción Detectada</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {matchResult.matches.slice(0, 50).map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">
                              {item.remitoPapel || item.remitoId}
                            </td>
                            <td className="py-2 px-3 truncate max-w-[150px] text-slate-600" title={item.clientName}>
                              {item.clientName}
                            </td>
                            <td className="py-2 px-3 text-slate-400 italic truncate max-w-[180px]" title={item.currentDescription}>
                              {item.currentDescription}
                            </td>
                            <td className="py-2 px-3 text-emerald-800 font-medium bg-emerald-50/30">
                              {item.newDescription}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {matchResult.matches.length > 50 && (
                    <p className="text-[11px] text-slate-500 text-center italic">
                      Mostrando las primeras 50 coincidencias de un total de {matchResult.matches.length}.
                    </p>
                  )}

                  {matchResult.matchedCount === 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 text-center">
                      No se encontraron remitos que coincidan con la columna seleccionada. 
                      Verifica que la columna de remitos corresponda al número o remito papel (ej. 2-11124).
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition"
          >
            {successCount !== null ? 'Cerrar' : 'Cancelar'}
          </button>

          {selectedFile && successCount === null && (
            <button
              onClick={handleApplyUpdates}
              disabled={isSaving || isMatching || !matchResult || matchResult.matchedCount === 0}
              className={`px-5 py-2 text-xs font-bold text-white rounded-lg flex items-center gap-2 transition shadow-sm ${
                isSaving || isMatching || !matchResult || matchResult.matchedCount === 0
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
              }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Actualizando en Base de Datos...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>
                    Confirmar y Actualizar {matchResult?.matchedCount || 0} Descripciones
                  </span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

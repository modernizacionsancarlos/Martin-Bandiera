import React, { useState } from 'react';
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  Trash2,
  Package,
  Layers,
  MapPin,
  Sparkles,
  FileSpreadsheet,
  Download,
  Upload,
  FileDown
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { MaterialItem } from '../types';
import { formatCurrency } from '../utils/exportUtils';
import {
  downloadMaterialesExcelTemplate,
  exportMaterialesToExcel
} from '../utils/excelParser';
import { ExcelImportModal } from './ExcelImportModal';

interface MaterialsViewProps {
  onOpenImportExcel?: () => void;
}

export const MaterialsView: React.FC<MaterialsViewProps> = ({ onOpenImportExcel }) => {
  const { materials, updateMaterialStock, addMaterial, deleteMaterial } = useData();
  const { canManageMaterials, isAdmin } = useAuth();
  const { themeClasses } = useTheme();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLocalImportModal, setShowLocalImportModal] = useState(false);

  // Form state for Alta de Material
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MaterialItem['category']>('Electricidad');
  const [stock, setStock] = useState(50);
  const [unit, setUnit] = useState('Unidades');
  const [minStock, setMinStock] = useState(10);
  const [unitPrice, setUnitPrice] = useState(25000);
  const [location, setLocation] = useState('Depósito Central');

  const handleOpenImport = () => {
    if (onOpenImportExcel) {
      onOpenImportExcel();
    } else {
      setShowLocalImportModal(true);
    }
  };

  const filteredMaterials = materials.filter(m => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === 'todas' || m.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const totalInventoryValue = materials.reduce((s, m) => s + (m.stock || 0) * (m.unitPrice || 0), 0);
  const lowStockItems = materials.filter(m => (m.stock || 0) <= (m.minStock || 0));

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;

    addMaterial({
      code,
      name,
      category,
      stock: Number(stock) || 0,
      unit,
      minStock: Number(minStock) || 0,
      unitPrice: Number(unitPrice) || 0,
      location,
      tenantId: 'tenant_bandiera_hq'
    });

    setCode('');
    setName('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
              Control de Inventario & Suministros
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Materiales de Obra y Repuestos
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gestión de cables, válvulas, rodamientos, bombas y elementos de seguridad para cuadrillas.
          </p>
        </div>

        {canManageMaterials && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenImport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-300 dark:border-slate-700 shadow-xs cursor-pointer"
              title="Importar lista de materiales desde Excel directamente a la base de datos"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-500" />
              <span>Importar Excel</span>
            </button>

            <button
              onClick={() => exportMaterialesToExcel(filteredMaterials)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-300 dark:border-slate-700 shadow-xs cursor-pointer"
              title="Descargar catálogo de materiales en formato Excel"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Exportar</span>
            </button>

            <button
              onClick={downloadMaterialesExcelTemplate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer"
              title="Descargar plantilla de Excel oficial para carga de materiales"
            >
              <FileDown className="w-4 h-4 text-amber-500" />
              <span>Plantilla</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold ${themeClasses.buttonClass} transition-all shadow-md cursor-pointer`}
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Material</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Valorización Total Stock</span>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
            {formatCurrency(totalInventoryValue)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">{materials.length} artículos en catálogo</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-amber-500 uppercase">Alertas Stock Mínimo</span>
          <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
            {lowStockItems.length} insumos críticos
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Requieren orden de compra prioritaria</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-500 uppercase">Permisos de Edición</span>
          <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
            Capataz & Administradores
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Ajustes directos de cantidad en obra habilitados</p>
        </div>
      </div>

      {/* Filter strip */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, código o ubicación (ej: XLPE, SKF, Bahía)..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-cyan-500 cursor-pointer"
        >
          <option value="todas">Todas las Categorías</option>
          <option value="Electricidad">Electricidad</option>
          <option value="Cañerías y Válvulas">Cañerías y Válvulas</option>
          <option value="Herramientas">Herramientas</option>
          <option value="Químicos y Fluidos">Químicos y Fluidos</option>
          <option value="Seguridad">Seguridad</option>
        </select>
      </div>

      {/* Materials Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3.5 px-4">Código / Nombre</th>
                <th className="py-3.5 px-4">Categoría</th>
                <th className="py-3.5 px-4">Ubicación</th>
                <th className="py-3.5 px-4 text-right">Precio Unitario</th>
                <th className="py-3.5 px-4 text-center">Stock Actual</th>
                <th className="py-3.5 px-4 text-center">Stock Mínimo</th>
                <th className="py-3.5 px-4 text-center">Ajuste de Cuadrilla</th>
                {isAdmin && <th className="py-3.5 px-4 text-center">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredMaterials.map(m => {
                const isLow = (m.stock || 0) <= (m.minStock || 0);

                return (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <p className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                        {m.code}
                      </p>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {m.name}
                      </p>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md font-medium text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {m.category}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{m.location || 'Depósito Central'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      ${(m.unitPrice || 0).toLocaleString('es-AR')}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                          isLow
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                        }`}
                      >
                        {isLow ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                        {(m.stock || 0).toLocaleString('es-AR')} {m.unit}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center font-mono text-slate-500 whitespace-nowrap">
                      {(m.minStock || 0).toLocaleString('es-AR')} {m.unit}
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {canManageMaterials ? (
                        <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                          <button
                            onClick={() => updateMaterialStock(m.id, (m.stock || 0) - 1)}
                            className="w-6 h-6 rounded flex items-center justify-center font-bold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors shadow-2xs"
                            title="Restar 1 unidad"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                            {m.stock || 0}
                          </span>
                          <button
                            onClick={() => updateMaterialStock(m.id, (m.stock || 0) + 1)}
                            className="w-6 h-6 rounded flex items-center justify-center font-bold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors shadow-2xs"
                            title="Sumar 1 unidad"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono">{m.stock || 0}</span>
                      )}
                    </td>

                    {isAdmin && (
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => deleteMaterial(m.id)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                          title="Eliminar material"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo Material (Alta de Materiales) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[96vh] sm:max-h-[92vh] overflow-y-auto my-auto p-5 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">
              Dar de Alta Material o Repuesto
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Registra individualmente el insumo o utiliza la carga masiva desde Excel por base de datos.
            </p>

            {/* Banner Alta desde Excel con Plantilla Oficial */}
            <div className="mb-5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    ¿Deseas cargar tu catálogo completo desde Excel?
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    Descarga la plantilla con ejemplos reales o importa tu archivo directamente a la base de datos.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={downloadMaterialesExcelTemplate}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Descargar plantilla de Excel de Materiales"
                >
                  <Download className="w-3.5 h-3.5 text-amber-600" />
                  <span>Plantilla</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    handleOpenImport();
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Importar Excel</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Código Interno *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: CAB-SUB-4x25"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Categoría
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                  >
                    <option value="Electricidad">Electricidad</option>
                    <option value="Cañerías y Válvulas">Cañerías y Válvulas</option>
                    <option value="Herramientas">Herramientas</option>
                    <option value="Químicos y Fluidos">Químicos y Fluidos</option>
                    <option value="Seguridad">Seguridad</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre o Descripción del Insumo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Cable de Cobre IRAM 2178 4x25mm²"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Stock Inicial
                  </label>
                  <input
                    type="number"
                    value={stock}
                    onChange={e => setStock(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Unidad
                  </label>
                  <input
                    type="text"
                    placeholder="Metros, Unidades..."
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Stock Mínimo
                  </label>
                  <input
                    type="number"
                    value={minStock}
                    onChange={e => setMinStock(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Precio Unitario (ARS)
                  </label>
                  <input
                    type="number"
                    value={unitPrice}
                    onChange={e => setUnitPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ubicación en Depósito
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-xs font-bold rounded-xl ${themeClasses.buttonClass} cursor-pointer`}
                >
                  Guardar Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Standalone Excel Import Modal fallback */}
      {!onOpenImportExcel && (
        <ExcelImportModal
          isOpen={showLocalImportModal}
          onClose={() => setShowLocalImportModal(false)}
          initialTab="materiales"
        />
      )}
    </div>
  );
};

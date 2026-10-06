import React, { useState } from 'react';
import {
  Sliders,
  Fuel,
  Clock,
  ShieldCheck,
  Car,
  Gauge,
  Save,
  CheckCircle2,
  HelpCircle,
  Calculator,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { DEFAULT_TECHNICAL_PARAMETERS } from '../data/initialData';
import { calculateAuditCosts, formatCurrency } from '../utils/calculationUtils';

export const FixedCostsView: React.FC = () => {
  const { technicalParameters, updateTechnicalParameters, technicalAuditRecords } = useData();

  // Local form state initialized from technicalParameters
  const [form, setForm] = useState({
    dieselPrice: technicalParameters.dieselPrice,
    horaBase: technicalParameters.horaBase,
    horaOficial: technicalParameters.horaOficial || 9400,
    seguroViaje: technicalParameters.seguroViaje,
    amortizacionViaje: technicalParameters.amortizacionViaje,
    consumoLKm: technicalParameters.consumoLKm,
    guardiaMultiplier: technicalParameters.guardiaMultiplier,
    pagoAyudanteHora: technicalParameters.pagoAyudanteHora
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Simulation test state
  const [simHours, setSimHours] = useState(5.0);
  const [simKm, setSimKm] = useState(40);
  const [simViajes, setSimViajes] = useState(1);
  const [simHelpers, setSimHelpers] = useState(1);
  const [simGuardia, setSimGuardia] = useState(false);
  const [simMaterials, setSimMaterials] = useState(0);

  const simResult = calculateAuditCosts(form as any, {
    hoursWorked: simHours,
    travelHours: 1.5,
    viajes: simViajes,
    distanceKm: simKm,
    isGuardia: simGuardia,
    helpersCount: simHelpers,
    materialsCost: simMaterials
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateTechnicalParameters(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleResetDefaults = () => {
    if (window.confirm('¿Restablecer los costos fijos a los valores estándar de Bandiera?')) {
      setForm(DEFAULT_TECHNICAL_PARAMETERS);
      updateTechnicalParameters(DEFAULT_TECHNICAL_PARAMETERS);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-500" />
            Configuración de Costos Fijos & Parámetros Operativos
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cualquier modificación actualizará y recalculará automáticamente los costos de los {technicalAuditRecords.length} reportes de auditoría técnica.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Valores Predeterminados</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-2.5 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>¡Parámetros actualizados con éxito! Todos los reportes han sido recalculados dinámicamente.</span>
        </div>
      )}

      {/* Main Grid: Form on Left, Math & Simulator on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Form: 7 cols */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <form onSubmit={handleSave} className="space-y-5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
              Tarifas Maestras & Fórmulas de Desplazamiento
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Diesel */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-bold">
                  <span className="flex items-center gap-1.5 text-[11px] uppercase">
                    <Fuel className="w-3.5 h-3.5 text-amber-500" />
                    Precio Diesel ($/Litro)
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={form.dieselPrice}
                    onChange={e => setForm({ ...form, dieselPrice: Number(e.target.value) || 0 })}
                    className="w-full pl-7 pr-3 py-2 text-sm font-black font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Costo de combustible por litro según estación de servicio.
                </p>
              </div>

              {/* Hora Base */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-bold">
                  <span className="flex items-center gap-1.5 text-[11px] uppercase">
                    <Clock className="w-3.5 h-3.5 text-cyan-500" />
                    Tarifa Hora Base ($/Hora)
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={form.horaBase}
                    onChange={e => setForm({ ...form, horaBase: Number(e.target.value) || 0 })}
                    className="w-full pl-7 pr-3 py-2 text-sm font-black font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Valor base horario aplicado al Responsable Técnico en sitio.
                </p>
              </div>

              {/* Seguro por Viaje */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-bold">
                  <span className="flex items-center gap-1.5 text-[11px] uppercase">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    Seguro / Viaje ($)
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.seguroViaje}
                    onChange={e => setForm({ ...form, seguroViaje: Number(e.target.value) || 0 })}
                    className="w-full pl-7 pr-3 py-2 text-sm font-black font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Cuota fija de póliza de responsabilidad y ART por salida de móvil.
                </p>
              </div>

              {/* Amortización */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-bold">
                  <span className="flex items-center gap-1.5 text-[11px] uppercase">
                    <Car className="w-3.5 h-3.5 text-purple-500" />
                    Amortización / Viaje ($)
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amortizacionViaje}
                    onChange={e => setForm({ ...form, amortizacionViaje: Number(e.target.value) || 0 })}
                    className="w-full pl-7 pr-3 py-2 text-sm font-black font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Desgaste de cubiertas, service, lubricantes y depreciación de camioneta.
                </p>
              </div>

              {/* Consumo L/Km */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-bold">
                  <span className="flex items-center gap-1.5 text-[11px] uppercase">
                    <Gauge className="w-3.5 h-3.5 text-rose-500" />
                    Consumo Estimado (L/Km)
                  </span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.05"
                  max="1.0"
                  value={form.consumoLKm}
                  onChange={e => setForm({ ...form, consumoLKm: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm font-black font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
                <p className="text-[10px] text-slate-400">
                  Rendimiento promedio de flota (0.13 L/km = ~7.7 km por litro).
                </p>
              </div>

              {/* Tarifa Oficial */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-bold">
                  <span className="flex items-center gap-1.5 text-[11px] uppercase">
                    <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    Tarifa Oficial ($/Hora)
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={form.horaOficial}
                    onChange={e => setForm({ ...form, horaOficial: Number(e.target.value) || 0 })}
                    className="w-full pl-7 pr-3 py-2 text-sm font-black font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Pago por hora computado para colaboradores con categoría Oficial en la orden.
                </p>
              </div>

              {/* Tarifa Ayudante */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-bold">
                  <span className="flex items-center gap-1.5 text-[11px] uppercase">
                    <Clock className="w-3.5 h-3.5 text-purple-500" />
                    Tarifa Ayudante ($/Hora)
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={form.pagoAyudanteHora}
                    onChange={e => setForm({ ...form, pagoAyudanteHora: Number(e.target.value) || 0 })}
                    className="w-full pl-7 pr-3 py-2 text-sm font-black font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Pago por hora computado para colaboradores con categoría Ayudante en la orden.
                </p>
              </div>
            </div>

            {/* Recargo Guardia */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-amber-700 dark:text-amber-300 uppercase">
                  Multiplicador de Guardia Técnica (Fin de Semana / Nocturno)
                </label>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {form.guardiaMultiplier}x ({Math.round((form.guardiaMultiplier - 1) * 100)}% Recargo)
                </span>
              </div>
              <input
                type="range"
                min="1.0"
                max="2.5"
                step="0.1"
                value={form.guardiaMultiplier}
                onChange={e => setForm({ ...form, guardiaMultiplier: parseFloat(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <p className="text-[11px] text-amber-800 dark:text-amber-300/80">
                Cuando el técnico marca "GUARDIA SÍ" en el remito de campo, la hora base se multiplica por este coeficiente.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>GUARDAR Y APLICAR CAMBIOS</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Math & Live Simulator: 5 cols */}
        <div className="lg:col-span-5 space-y-6">
          {/* Formula Card */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-cyan-500" />
              Ecuaciones de Costos de Bandiera
            </h4>
            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 font-mono text-[11px] space-y-1">
                <span className="text-cyan-600 dark:text-cyan-400 font-bold block">1. LOGÍSTICA ($)</span>
                <p className="text-slate-500 dark:text-slate-400">
                  Combustible: (Km ida y vuelta × {form.consumoLKm} L/km × ${form.dieselPrice}) × Viajes
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  Seguros: ${form.seguroViaje} × Viajes
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  Amortización: ${form.amortizacionViaje} × Viajes
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 font-mono text-[11px] space-y-1">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold block">2. M.O. DIRECTA / COSTO DE SERVICIO ($)</span>
                <p className="text-slate-500 dark:text-slate-400">
                  Oficial: Hs × ${form.horaOficial || form.horaBase} {simGuardia ? `× ${form.guardiaMultiplier}` : ''}
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  Ayudante: Hs × ${form.pagoAyudanteHora} {simGuardia ? `× 1.3` : ''}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 font-mono text-[11px] space-y-1">
                <span className="text-amber-600 dark:text-amber-400 font-bold block">3. COSTO OPERATIVO TOTAL ($)</span>
                <p className="text-slate-500 dark:text-slate-400">
                  Logística (Combustibles + Seguros + Amort.) + M.O. Directa + Materiales
                </p>
              </div>
            </div>
          </div>

          {/* Simulator Box */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white p-5 rounded-3xl border border-slate-800 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Calculator className="w-4 h-4" />
                Simulador de Presupuesto en Tiempo Real
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">Test interactivo</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Horas en Sitio:</label>
                <input
                  type="number"
                  step="0.5"
                  value={simHours}
                  onChange={e => setSimHours(Number(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Distancia Km (Ida):</label>
                <input
                  type="number"
                  value={simKm}
                  onChange={e => setSimKm(Number(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Cant. Viajes:</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={simViajes}
                  onChange={e => setSimViajes(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Cant. Ayudantes:</label>
                <input
                  type="number"
                  min="0"
                  max="6"
                  value={simHelpers}
                  onChange={e => setSimHelpers(Number(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono"
                />
              </div>

              <div className="col-span-2">
                <label className="text-[10px] text-slate-400 block mb-1">¿Guardia?:</label>
                <button
                  type="button"
                  onClick={() => setSimGuardia(!simGuardia)}
                  className={`w-full py-1.5 rounded-lg font-bold text-[11px] border transition-all cursor-pointer ${
                    simGuardia ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {simGuardia ? 'GUARDIA SÍ' : 'ORDINARIO'}
                </button>
              </div>
            </div>

            {/* Results */}
            <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Logística:</span>
                <span className="font-mono text-white">${formatCurrency(simResult.logisticsCost || 0)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Mano de Obra Directa:</span>
                <span className="font-mono text-emerald-400">${formatCurrency(simResult.laborDirectCost || 0)}</span>
              </div>
              <div className="flex justify-between text-slate-300 font-bold">
                <span>Costo Operativo Total:</span>
                <span className="font-mono text-amber-400">${formatCurrency(simResult.operatingCost || 0)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-slate-800">
                <span className="text-cyan-400 font-black text-xs uppercase">Precio Facturado Sugerido:</span>
                <span className="font-mono font-black text-lg text-cyan-300">
                  ${formatCurrency(simResult.suggestedPrice || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

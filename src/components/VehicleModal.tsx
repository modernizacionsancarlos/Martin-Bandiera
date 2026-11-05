import React, { useState, useEffect } from 'react';
import { X, Truck, DollarSign, Gauge, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';
import { VehicleItem, VehicleCategory, VehicleStatus } from '../types';
import { todayLocalISO } from '../utils/dateUtils';

interface VehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (vehicleData: Partial<VehicleItem>) => void;
  initialVehicle?: VehicleItem | null;
}

const VEHICLE_CATEGORIES: VehicleCategory[] = [
  'Camioneta 4x4',
  'Camioneta 4x2',
  'Utilitario / Furgón',
  'Camión con Grúa',
  'Automóvil',
  'Otro'
];

const VEHICLE_STATUSES: VehicleStatus[] = [
  'Operativo',
  'En Taller',
  'Mantenimiento Pendiente',
  'Fuera de Servicio'
];

const FUEL_TYPES = [
  'Infinia Diesel / Grado 3',
  'Diesel 500',
  'Nafta Súper',
  'Nafta Premium',
  'GNC'
] as const;

export const VehicleModal: React.FC<VehicleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialVehicle
}) => {
  const isEditing = Boolean(initialVehicle);

  const [patente, setPatente] = useState('');
  const [brand, setBrand] = useState('Toyota');
  const [model, setModel] = useState('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [type, setType] = useState<VehicleCategory>('Camioneta 4x4');
  const [status, setStatus] = useState<VehicleStatus>('Operativo');
  const [assignedDriver, setAssignedDriver] = useState('');
  const [vin, setVin] = useState('');
  const [color, setColor] = useState('');
  const [fuelType, setFuelType] = useState<typeof FUEL_TYPES[number]>('Infinia Diesel / Grado 3');
  const [avgConsumptionL100Km, setAvgConsumptionL100Km] = useState<number>(11);

  // Parámetros de Amortización
  const [purchaseDate, setPurchaseDate] = useState(todayLocalISO());
  const [purchasePrice, setPurchasePrice] = useState<number>(35000000);
  const [residualValue, setResidualValue] = useState<number>(10000000);
  const [usefulLifeKm, setUsefulLifeKm] = useState<number>(300000);
  const [usefulLifeYears, setUsefulLifeYears] = useState<number>(5);
  const [initialMileageKm, setInitialMileageKm] = useState<number>(0);
  const [currentMileageKm, setCurrentMileageKm] = useState<number>(0);

  // Mantenimiento programado & Seguros
  const [oilChangeIntervalKm, setOilChangeIntervalKm] = useState<number>(10000);
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [vtvExpirationDate, setVtvExpirationDate] = useState('');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (initialVehicle) {
      setPatente(initialVehicle.patente || '');
      setBrand(initialVehicle.brand || '');
      setModel(initialVehicle.model || '');
      setYear(initialVehicle.year || new Date().getFullYear());
      setType(initialVehicle.type || 'Camioneta 4x4');
      setStatus(initialVehicle.status || 'Operativo');
      setAssignedDriver(initialVehicle.assignedDriver || '');
      setVin(initialVehicle.vin || '');
      setColor(initialVehicle.color || '');
      setFuelType((initialVehicle.fuelType as any) || 'Infinia Diesel / Grado 3');
      setAvgConsumptionL100Km(initialVehicle.avgConsumptionL100Km || 11);
      setPurchaseDate(initialVehicle.purchaseDate || todayLocalISO());
      setPurchasePrice(initialVehicle.purchasePrice || 0);
      setResidualValue(initialVehicle.residualValue || 0);
      setUsefulLifeKm(initialVehicle.usefulLifeKm || 300000);
      setUsefulLifeYears(initialVehicle.usefulLifeYears || 5);
      setInitialMileageKm(initialVehicle.initialMileageKm || 0);
      setCurrentMileageKm(initialVehicle.currentMileageKm || 0);
      setOilChangeIntervalKm(initialVehicle.oilChangeIntervalKm || 10000);
      setInsuranceCompany(initialVehicle.insuranceCompany || '');
      setPolicyNumber(initialVehicle.policyNumber || '');
      setVtvExpirationDate(initialVehicle.vtvExpirationDate || '');
      setNotes(initialVehicle.notes || '');
      setErrors({});
    } else {
      // Defaults para nuevo vehículo
      setPatente('');
      setBrand('Toyota');
      setModel('');
      setYear(new Date().getFullYear());
      setType('Camioneta 4x4');
      setStatus('Operativo');
      setAssignedDriver('');
      setVin('');
      setColor('');
      setFuelType('Infinia Diesel / Grado 3');
      setAvgConsumptionL100Km(11);
      setPurchaseDate(todayLocalISO());
      setPurchasePrice(35000000);
      setResidualValue(10000000);
      setUsefulLifeKm(300000);
      setUsefulLifeYears(5);
      setInitialMileageKm(0);
      setCurrentMileageKm(0);
      setOilChangeIntervalKm(10000);
      setInsuranceCompany('La Segunda Seguros');
      setPolicyNumber('');
      setVtvExpirationDate('');
      setNotes('');
      setErrors({});
    }
  }, [initialVehicle, isOpen]);

  if (!isOpen) return null;

  // Métricas de previsualización de amortización
  const depreciableBase = Math.max(0, purchasePrice - residualValue);
  const depreciationRatePerKm = usefulLifeKm > 0 ? depreciableBase / usefulLifeKm : 0;
  const totalAccumulatedKm = Math.max(0, currentMileageKm - initialMileageKm);
  const accumulatedDepreciation = totalAccumulatedKm * depreciationRatePerKm;
  const currentBookValue = Math.max(residualValue, purchasePrice - accumulatedDepreciation);
  const consumedPct = usefulLifeKm > 0 ? Math.min(100, (totalAccumulatedKm / usefulLifeKm) * 100) : 0;

  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (!patente.trim()) {
      errs.patente = 'La patente es obligatoria (ej: AF 382 PL)';
    }
    if (!brand.trim()) {
      errs.brand = 'La marca es obligatoria';
    }
    if (!model.trim()) {
      errs.model = 'El modelo es obligatorio';
    }
    if (purchasePrice <= 0) {
      errs.purchasePrice = 'El valor de compra debe ser mayor a 0';
    }
    if (usefulLifeKm <= 0) {
      errs.usefulLifeKm = 'La vida útil en Km debe ser mayor a 0';
    }
    if (currentMileageKm < initialMileageKm) {
      errs.currentMileageKm = 'El odómetro actual no puede ser menor al inicial';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      patente: patente.trim().toUpperCase(),
      brand: brand.trim(),
      model: model.trim(),
      year: Number(year) || new Date().getFullYear(),
      type,
      status,
      assignedDriver: assignedDriver.trim(),
      vin: vin.trim(),
      color: color.trim(),
      fuelType,
      avgConsumptionL100Km: Number(avgConsumptionL100Km) || 10,
      purchaseDate,
      purchasePrice: Number(purchasePrice) || 0,
      residualValue: Number(residualValue) || 0,
      usefulLifeKm: Number(usefulLifeKm) || 300000,
      usefulLifeYears: Number(usefulLifeYears) || 5,
      initialMileageKm: Number(initialMileageKm) || 0,
      currentMileageKm: Number(currentMileageKm) || 0,
      oilChangeIntervalKm: Number(oilChangeIntervalKm) || 10000,
      insuranceCompany: insuranceCompany.trim(),
      policyNumber: policyNumber.trim(),
      vtvExpirationDate: vtvExpirationDate || undefined,
      notes: notes.trim()
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {isEditing ? `Editar Vehículo [${initialVehicle?.patente}]` : 'Alta de Nuevo Vehículo a la Flota'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Parámetros de amortización, odómetro actual y especificaciones técnicas autoadministrables
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          
          {/* SECCIÓN 1: IDENTIFICACIÓN Y PATENTE */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-4">
            <h4 className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4" /> 1. Datos de Identificación del Vehículo
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Patente */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Patente (Dominio) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={patente}
                    onChange={e => setPatente(e.target.value.toUpperCase())}
                    placeholder="AF 382 PL o AB 123 CD"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-900 dark:text-white uppercase tracking-wider text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                  />
                </div>
                {errors.patente && (
                  <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.patente}
                  </p>
                )}
              </div>

              {/* Marca */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Marca *
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  placeholder="Toyota, Ford, Mercedes-Benz..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                />
                {errors.brand && <p className="text-xs text-rose-500 mt-1">{errors.brand}</p>}
              </div>

              {/* Modelo */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Modelo y Versión *
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder="Hilux 4x4 DX 2.8 D/C"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                />
                {errors.model && <p className="text-xs text-rose-500 mt-1">{errors.model}</p>}
              </div>

              {/* Año */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Año de Fabricación
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={e => setYear(Number(e.target.value))}
                  min={1990}
                  max={new Date().getFullYear() + 1}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tipo / Carrocería
                </label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as VehicleCategory)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                >
                  {VEHICLE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Estado Operativo */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Estado Operativo
                </label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as VehicleStatus)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                >
                  {VEHICLE_STATUSES.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {/* Chofer / Responsable */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Chofer / Responsable Asignado
                </label>
                <input
                  type="text"
                  value={assignedDriver}
                  onChange={e => setAssignedDriver(e.target.value)}
                  placeholder="Ej: Héctor Luffi (Cuadrilla 1)"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                />
              </div>

              {/* Combustible */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Combustible
                </label>
                <select
                  value={fuelType}
                  onChange={e => setFuelType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                >
                  {FUEL_TYPES.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              {/* Consumo L/100km */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Consumo Promedio (L/100 Km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={avgConsumptionL100Km}
                  onChange={e => setAvgConsumptionL100Km(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: AMORTIZACIÓN Y VIDA ÚTIL */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> 2. Análisis y Parámetros de Amortización Contable
              </h4>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Fórmula: (Valor Compra - Valor Residual) / Vida Útil Km
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Fecha de Adquisición */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Fecha de Adquisición / Compra
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={e => setPurchaseDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Valor de Compra */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Valor de Compra / Adquisición ($) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    value={purchasePrice}
                    onChange={e => setPurchasePrice(Number(e.target.value))}
                    min={0}
                    step={10000}
                    className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                {errors.purchasePrice && <p className="text-xs text-rose-500 mt-1">{errors.purchasePrice}</p>}
              </div>

              {/* Valor Residual */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Valor Residual Estimado ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    value={residualValue}
                    onChange={e => setResidualValue(Number(e.target.value))}
                    min={0}
                    step={10000}
                    className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Valor de descarte / venta futura esperada</p>
              </div>

              {/* Vida Útil Km */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Vida Útil Proyectada (en Km) *
                </label>
                <input
                  type="number"
                  value={usefulLifeKm}
                  onChange={e => setUsefulLifeKm(Number(e.target.value))}
                  min={1000}
                  step={10000}
                  placeholder="300000"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                {errors.usefulLifeKm && <p className="text-xs text-rose-500 mt-1">{errors.usefulLifeKm}</p>}
              </div>

              {/* Vida Útil Años */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Vida Útil en Años
                </label>
                <input
                  type="number"
                  value={usefulLifeYears}
                  onChange={e => setUsefulLifeYears(Number(e.target.value))}
                  min={1}
                  max={25}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Odómetro Inicial */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Kilometraje Inicial (de Ingreso)
                </label>
                <input
                  type="number"
                  value={initialMileageKm}
                  onChange={e => setInitialMileageKm(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Odómetro Actual */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Odómetro Actual (Km) *
                </label>
                <input
                  type="number"
                  value={currentMileageKm}
                  onChange={e => setCurrentMileageKm(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                {errors.currentMileageKm && <p className="text-xs text-rose-500 mt-1">{errors.currentMileageKm}</p>}
              </div>

              {/* Intervalo Service */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Intervalo Cambio de Aceite (Km)
                </label>
                <input
                  type="number"
                  value={oilChangeIntervalKm}
                  onChange={e => setOilChangeIntervalKm(Number(e.target.value))}
                  min={1000}
                  step={1000}
                  placeholder="10000"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Banner Dinámico de Cálculo de Amortización */}
            <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <span className="block text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">Amortización por Km</span>
                <span className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                  ${depreciationRatePerKm.toFixed(2)} / km
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">Km Recorridos Flota</span>
                <span className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                  {totalAccumulatedKm.toLocaleString('es-AR')} km
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">Amortización Acumulada</span>
                <span className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                  ${Math.round(accumulatedDepreciation).toLocaleString('es-AR')}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">Valor Contable Actual</span>
                <span className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                  ${Math.round(currentBookValue).toLocaleString('es-AR')}
                </span>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: SEGUROS, VTV Y DOCUMENTACIÓN */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-4">
            <h4 className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4" /> 3. Seguros, Inspección Técnica (VTV) & Notas
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Compañía de Seguros
                </label>
                <input
                  type="text"
                  value={insuranceCompany}
                  onChange={e => setInsuranceCompany(e.target.value)}
                  placeholder="La Segunda, Federación Patronal, San Cristóbal..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Número de Póliza
                </label>
                <input
                  type="text"
                  value={policyNumber}
                  onChange={e => setPolicyNumber(e.target.value)}
                  placeholder="POL-8291-..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Vencimiento RTO / VTV
                </label>
                <input
                  type="date"
                  value={vtvExpirationDate}
                  onChange={e => setVtvExpirationDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-2 md:col-span-3">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Observaciones Técnicas & Asignación
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Detalles sobre equipamiento (grúa, cúpula, estribos, destinos habituales en yacimiento)..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 rounded-xl shadow-md shadow-cyan-500/20 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isEditing ? 'Guardar Cambios del Vehículo' : 'Registrar Vehículo en la Flota'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  X,
  Gauge,
  Droplets,
  Wrench,
  Package,
  CheckCircle2,
  AlertCircle,
  Calendar,
  DollarSign,
  FileText,
  Building2,
  Sparkles
} from 'lucide-react';
import { VehicleEventItem, VehicleEventType, VehicleItem } from '../types';

interface VehicleEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: Partial<VehicleEventItem>) => void;
  initialEvent?: VehicleEventItem | null;
  vehicles: VehicleItem[];
  selectedVehicleId?: string;
}

const EVENT_TYPE_OPTIONS: { type: VehicleEventType; label: string; icon: any; color: string; desc: string }[] = [
  {
    type: 'kilometraje',
    label: 'Kilometraje',
    icon: Gauge,
    color: 'border-blue-500 text-blue-500 bg-blue-500/10',
    desc: 'Lectura de odómetro periódico / control de ruta'
  },
  {
    type: 'cambio_aceite',
    label: 'Cambio de Aceite',
    icon: Droplets,
    color: 'border-amber-500 text-amber-500 bg-amber-500/10',
    desc: 'Lubricación de motor y reemplazo de filtros'
  },
  {
    type: 'mecanico',
    label: 'Mecánicos',
    icon: Wrench,
    color: 'border-rose-500 text-rose-500 bg-rose-500/10',
    desc: 'Taller mecánico, reparaciones y mano de obra'
  },
  {
    type: 'repuesto',
    label: 'Repuestos',
    icon: Package,
    color: 'border-purple-500 text-purple-500 bg-purple-500/10',
    desc: 'Partes, cubiertas, batería, filtros y piezas'
  },
  {
    type: 'mantenimiento_gral',
    label: 'Mantenimiento Gral',
    icon: Sparkles,
    color: 'border-emerald-500 text-emerald-500 bg-emerald-500/10',
    desc: 'Alineación, balanceo, VTV / RTO y rutina'
  }
];

export const VehicleEventModal: React.FC<VehicleEventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialEvent,
  vehicles,
  selectedVehicleId
}) => {
  const isEditing = Boolean(initialEvent);

  const [vehicleId, setVehicleId] = useState('');
  const [type, setType] = useState<VehicleEventType>('cambio_aceite');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mileageKm, setMileageKm] = useState<number>(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState<number>(0);
  const [workshopOrProvider, setWorkshopOrProvider] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [performedBy, setPerformedBy] = useState('');

  // Detalles de Cambio de Aceite
  const [oilType, setOilType] = useState('Sintético 5W-30');
  const [oilBrand, setOilBrand] = useState('Shell Helix Ultra');
  const [oilFilterChanged, setOilFilterChanged] = useState(true);
  const [airFilterChanged, setAirFilterChanged] = useState(true);
  const [fuelFilterChanged, setFuelFilterChanged] = useState(false);
  const [nextChangeKm, setNextChangeKm] = useState<number>(0);

  // Detalles de Mecánico / Taller
  const [laborCost, setLaborCost] = useState<number>(0);
  const [partsCost, setPartsCost] = useState<number>(0);

  // Errores
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const currentVehicle = vehicles.find(v => v.id === vehicleId);

  useEffect(() => {
    if (initialEvent) {
      setVehicleId(initialEvent.vehicleId);
      setType(initialEvent.type);
      setDate(initialEvent.date || new Date().toISOString().slice(0, 10));
      setMileageKm(initialEvent.mileageKm || 0);
      setTitle(initialEvent.title || '');
      setDescription(initialEvent.description || '');
      setCost(initialEvent.cost || 0);
      setWorkshopOrProvider(initialEvent.workshopOrProvider || '');
      setInvoiceNumber(initialEvent.invoiceNumber || '');
      setPerformedBy(initialEvent.performedBy || '');

      if (initialEvent.oilChangeDetails) {
        setOilType(initialEvent.oilChangeDetails.oilType || 'Sintético 5W-30');
        setOilBrand(initialEvent.oilChangeDetails.oilBrand || 'Shell');
        setOilFilterChanged(initialEvent.oilChangeDetails.filterChanged ?? true);
        setAirFilterChanged(initialEvent.oilChangeDetails.airFilterChanged ?? true);
        setFuelFilterChanged(initialEvent.oilChangeDetails.fuelFilterChanged ?? false);
        setNextChangeKm(initialEvent.oilChangeDetails.nextChangeKm || 0);
      }
      setErrors({});
    } else {
      const defaultVeh = selectedVehicleId
        ? vehicles.find(v => v.id === selectedVehicleId)
        : vehicles[0];

      const initialVehId = defaultVeh ? defaultVeh.id : '';
      setVehicleId(initialVehId);
      setType('cambio_aceite');
      setDate(new Date().toISOString().slice(0, 10));

      const currKm = defaultVeh?.currentMileageKm || 0;
      setMileageKm(currKm);
      setTitle('Service y Cambio de Aceite Programado');
      setDescription('');
      setCost(165000);
      setWorkshopOrProvider('Lubricentro / Concesionario Oficial');
      setInvoiceNumber('');
      setPerformedBy(defaultVeh?.assignedDriver || '');

      // Aceite defaults
      setOilType('Sintético 5W-30');
      setOilBrand('Shell Rimula / Helix');
      setOilFilterChanged(true);
      setAirFilterChanged(true);
      setFuelFilterChanged(false);
      const interval = defaultVeh?.oilChangeIntervalKm || 10000;
      setNextChangeKm(currKm + interval);
      setErrors({});
    }
  }, [initialEvent, isOpen, selectedVehicleId, vehicles]);

  // Si cambia el tipo de evento en alta nueva, sugerir título por defecto
  const handleTypeChange = (newType: VehicleEventType) => {
    setType(newType);
    if (!isEditing) {
      if (newType === 'kilometraje') {
        setTitle('Lectura de Odómetro / Cierre Mensual');
        setCost(0);
      } else if (newType === 'cambio_aceite') {
        setTitle('Service de Aceite y Filtros');
        setCost(165000);
      } else if (newType === 'mecanico') {
        setTitle('Reparación de Taller Mecánico');
        setCost(280000);
      } else if (newType === 'repuesto') {
        setTitle('Compra e Instalación de Repuestos');
        setCost(145000);
      } else if (newType === 'mantenimiento_gral') {
        setTitle('Alineación, Balanceo e Inspección Técnica');
        setCost(95000);
      }
    }
  };

  // Si cambia el vehículo seleccionado, sugerir su kilometraje actual
  const handleVehicleSelect = (vid: string) => {
    setVehicleId(vid);
    const v = vehicles.find(item => item.id === vid);
    if (v && !isEditing) {
      setMileageKm(v.currentMileageKm || 0);
      const interval = v.oilChangeIntervalKm || 10000;
      setNextChangeKm((v.currentMileageKm || 0) + interval);
      if (v.assignedDriver) {
        setPerformedBy(v.assignedDriver);
      }
    }
  };

  // Autocalcular próximo cambio de aceite cuando cambia mileageKm
  const handleMileageChange = (km: number) => {
    setMileageKm(km);
    if (type === 'cambio_aceite' && currentVehicle) {
      const interval = currentVehicle.oilChangeIntervalKm || 10000;
      setNextChangeKm(km + interval);
    }
  };

  if (!isOpen) return null;

  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (!vehicleId) {
      errs.vehicleId = 'Debe seleccionar un vehículo de la flota';
    }
    if (!title.trim()) {
      errs.title = 'El título descriptivo es obligatorio';
    }
    if (mileageKm < 0) {
      errs.mileageKm = 'El odómetro no puede ser negativo';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const veh = vehicles.find(v => v.id === vehicleId);
    const patente = veh ? veh.patente : '';

    const eventPayload: Partial<VehicleEventItem> = {
      vehicleId,
      patente,
      type,
      date,
      mileageKm: Number(mileageKm) || 0,
      title: title.trim(),
      description: description.trim(),
      cost: Number(cost) || 0,
      workshopOrProvider: workshopOrProvider.trim(),
      invoiceNumber: invoiceNumber.trim(),
      performedBy: performedBy.trim(),
      oilChangeDetails:
        type === 'cambio_aceite'
          ? {
              oilType,
              oilBrand,
              filterChanged: oilFilterChanged,
              airFilterChanged,
              fuelFilterChanged,
              nextChangeKm: Number(nextChangeKm) || (Number(mileageKm) + 10000)
            }
          : undefined
    };

    onSave(eventPayload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {isEditing ? `Editar Evento #${initialEvent?.id}` : 'Registrar Evento / Mantenimiento en Vehículo'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Guarda odómetro, cambios de aceite, mecánicos, repuestos o mantenimiento gral
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

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          
          {/* SELECCIÓN DE TIPO DE EVENTO (5 PILLS) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Tipo de Evento a Registrar *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {EVENT_TYPE_OPTIONS.map(opt => {
                const IconComponent = opt.icon;
                const isSelected = type === opt.type;
                return (
                  <button
                    type="button"
                    key={opt.type}
                    onClick={() => handleTypeChange(opt.type)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer ${
                      isSelected
                        ? `${opt.color} ring-2 ring-cyan-500 font-bold shadow-md`
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <IconComponent className="w-5 h-5" />
                    <span className="text-xs leading-tight">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* VEHÍCULO & ODÓMETRO */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              
              {/* Selector de Vehículo por Patente */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Vehículo (Patente - Marca - Modelo) *
                </label>
                <select
                  value={vehicleId}
                  onChange={e => handleVehicleSelect(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                >
                  <option value="">Seleccione vehículo...</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      [{v.patente}] {v.brand} {v.model} ({v.type}) - Odóm: {v.currentMileageKm.toLocaleString('es-AR')} km
                    </option>
                  ))}
                </select>
                {errors.vehicleId && (
                  <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.vehicleId}
                  </p>
                )}
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Fecha del Evento *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                />
              </div>

              {/* Odómetro / Kilometraje */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Kilometraje del Odómetro (Km) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={mileageKm}
                    onChange={e => handleMileageChange(Number(e.target.value))}
                    min={0}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                  />
                </div>
                {currentVehicle && mileageKm > currentVehicle.currentMileageKm && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                    +{(mileageKm - currentVehicle.currentMileageKm).toLocaleString('es-AR')} km respecto al odómetro anterior
                  </p>
                )}
                {errors.mileageKm && <p className="text-xs text-rose-500 mt-1">{errors.mileageKm}</p>}
              </div>

              {/* Costo Total $ */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Costo Total del Evento ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    value={cost}
                    onChange={e => setCost(Number(e.target.value))}
                    min={0}
                    step={100}
                    className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Taller / Proveedor */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Taller Mecánico / Proveedor
                </label>
                <input
                  type="text"
                  value={workshopOrProvider}
                  onChange={e => setWorkshopOrProvider(e.target.value)}
                  placeholder="Ej: Taller Mecánico San Juan, YPFBoxes, Repuestos Cuyo..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                />
              </div>

              {/* Factura / Remito */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nº Factura / Remito
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  placeholder="FC-A 0001-00029381"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                />
              </div>

              {/* Responsable / Chofer */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Chofer / Responsable que realizó o autorizó
                </label>
                <input
                  type="text"
                  value={performedBy}
                  onChange={e => setPerformedBy(e.target.value)}
                  placeholder="Nombre de chofer o jefe de flota..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                />
              </div>

            </div>
          </div>

          {/* CAMPOS ESPECÍFICOS PARA CAMBIO DE ACEITE */}
          {type === 'cambio_aceite' && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Droplets className="w-4 h-4" /> Detalle del Servicio de Lubricación y Filtros
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Graduación / Tipo de Aceite
                  </label>
                  <input
                    type="text"
                    value={oilType}
                    onChange={e => setOilType(e.target.value)}
                    placeholder="Sintético 5W-30, 15W-40..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Marca de Aceite
                  </label>
                  <input
                    type="text"
                    value={oilBrand}
                    onChange={e => setOilBrand(e.target.value)}
                    placeholder="Shell Helix, Total Quartz, Elaion..."
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Próximo Cambio Sugerido (Km)
                  </label>
                  <input
                    type="number"
                    value={nextChangeKm}
                    onChange={e => setNextChangeKm(Number(e.target.value))}
                    min={mileageKm}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-amber-900 dark:text-amber-300 text-sm"
                  />
                </div>
              </div>

              {/* Filtros cambiados */}
              <div className="pt-2 border-t border-amber-500/20 flex flex-wrap gap-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={oilFilterChanged}
                    onChange={e => setOilFilterChanged(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  Filtro de Aceite reemplazado
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={airFilterChanged}
                    onChange={e => setAirFilterChanged(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  Filtro de Aire reemplazado
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fuelFilterChanged}
                    onChange={e => setFuelFilterChanged(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  Filtro de Combustible (Gasoil) reemplazado
                </label>
              </div>
            </div>
          )}

          {/* DESCRIPCIÓN Y DETALLE DE LA TAREA */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Título / Tarea Principal *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Cambio de pastillas de freno delanteras y rectificación de discos"
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
            />
            {errors.title && <p className="text-xs text-rose-500 mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Descripción Detallada / Repuestos Reemplazados / Falla Mecánica
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Especifique diagnósticos del mecánico, códigos de piezas, reparaciones eléctricas o detalles de mantenimiento general..."
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
            />
          </div>

          {/* Acciones */}
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
              {isEditing ? 'Guardar Cambios del Evento' : 'Registrar Evento en la Ficha'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

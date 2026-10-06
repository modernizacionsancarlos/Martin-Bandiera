import React, { useState, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  DollarSign,
  Gauge,
  Droplets,
  Wrench,
  Package,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit2,
  ChevronRight,
  Shield,
  Activity,
  Layers,
  ArrowUpDown,
  Car,
  Clock,
  UserCheck,
  Fuel,
  Info
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { VehicleItem, VehicleEventItem, VehicleEventType, VehicleStatus } from '../types';
import { VehicleModal } from './VehicleModal';
import { VehicleEventModal } from './VehicleEventModal';
import { exportVehiclesToExcel } from '../utils/excelParser';

export const VehicleAmortizationView: React.FC = () => {
  const {
    vehicles,
    vehicleEvents,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    addVehicleEvent,
    updateVehicleEvent,
    deleteVehicleEvent
  } = useData();

  const { canManageVehicles, currentUser } = useAuth();

  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState<'amortizacion' | 'eventos' | 'ficha'>('amortizacion');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicles[0]?.id || '');

  // Modals
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [vehicleToEdit, setVehicleToEdit] = useState<VehicleItem | null>(null);

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<VehicleEventItem | null>(null);
  const [eventModalVehicleId, setEventModalVehicleId] = useState<string>('');

  // Delete Confirmation
  const [vehicleToDelete, setVehicleToDelete] = useState<VehicleItem | null>(null);
  const [eventToDelete, setEventToDelete] = useState<VehicleEventItem | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventType, setSelectedEventType] = useState<string>('todos');
  const [selectedPatenteFilter, setSelectedPatenteFilter] = useState<string>('todas');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('todos');

  // Selected vehicle for Ficha Individual
  const activeVehicle = useMemo(() => {
    return vehicles.find(v => v.id === selectedVehicleId) || vehicles[0] || null;
  }, [vehicles, selectedVehicleId]);

  // Global fleet metrics & amortization calculations
  const fleetMetrics = useMemo(() => {
    let totalPurchaseValue = 0;
    let totalResidualValue = 0;
    let totalAccumulatedKm = 0;
    let totalDepreciation = 0;
    let totalCurrentBookValue = 0;
    let totalMaintenanceExpenses = 0;

    let oilExpenses = 0;
    let mechanicsExpenses = 0;
    let partsExpenses = 0;
    let generalExpenses = 0;

    // Costos acumulados por evento
    vehicleEvents.forEach(e => {
      const cost = e.cost || 0;
      totalMaintenanceExpenses += cost;
      if (e.type === 'cambio_aceite') oilExpenses += cost;
      else if (e.type === 'mecanico') mechanicsExpenses += cost;
      else if (e.type === 'repuesto') partsExpenses += cost;
      else if (e.type === 'mantenimiento_gral') generalExpenses += cost;
    });

    // Amortizaciones por vehículo
    const vehicleCalculations = vehicles.map(v => {
      const depreciableBase = Math.max(0, v.purchasePrice - v.residualValue);
      const ratePerKm = v.usefulLifeKm > 0 ? depreciableBase / v.usefulLifeKm : 0;
      const accumulatedKm = Math.max(0, v.currentMileageKm - v.initialMileageKm);
      const accumulatedDepreciation = accumulatedKm * ratePerKm;
      const bookValue = Math.max(v.residualValue, v.purchasePrice - accumulatedDepreciation);
      const consumedPct = v.usefulLifeKm > 0 ? Math.min(100, (accumulatedKm / v.usefulLifeKm) * 100) : 0;

      // Gastos directos de este vehículo
      const vEvents = vehicleEvents.filter(e => e.vehicleId === v.id || e.patente.toUpperCase() === v.patente.toUpperCase());
      const vTotalCost = vEvents.reduce((acc, ev) => acc + (ev.cost || 0), 0);
      const vOperatingCostPerKm = accumulatedKm > 0 ? (accumulatedDepreciation + vTotalCost) / accumulatedKm : 0;

      // Alertas de Cambio de Aceite
      const nextOilKm = (v.lastOilChangeKm || v.initialMileageKm || 0) + (v.oilChangeIntervalKm || 10000);
      const kmUntilOil = nextOilKm - v.currentMileageKm;
      const isOilUrgent = kmUntilOil <= 1000;
      const isOilOverdue = kmUntilOil < 0;

      // Alertas de VTV
      let isVtvExpiringSoon = false;
      let isVtvExpired = false;
      if (v.vtvExpirationDate) {
        const diffDays = Math.round((new Date(v.vtvExpirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) isVtvExpired = true;
        else if (diffDays <= 30) isVtvExpiringSoon = true;
      }

      totalPurchaseValue += v.purchasePrice;
      totalResidualValue += v.residualValue;
      totalAccumulatedKm += accumulatedKm;
      totalDepreciation += accumulatedDepreciation;
      totalCurrentBookValue += bookValue;

      return {
        ...v,
        depreciableBase,
        ratePerKm,
        accumulatedKm,
        accumulatedDepreciation,
        bookValue,
        consumedPct,
        eventsCount: vEvents.length,
        totalMaintenanceCost: vTotalCost,
        operatingCostPerKm: vOperatingCostPerKm,
        nextOilKm,
        kmUntilOil,
        isOilUrgent,
        isOilOverdue,
        isVtvExpiringSoon,
        isVtvExpired
      };
    });

    const urgentServicesCount = vehicleCalculations.filter(v => v.isOilUrgent || v.isOilOverdue || v.isVtvExpired).length;

    return {
      vehiclesWithStats: vehicleCalculations,
      totalPurchaseValue,
      totalResidualValue,
      totalAccumulatedKm,
      totalDepreciation,
      totalCurrentBookValue,
      totalMaintenanceExpenses,
      oilExpenses,
      mechanicsExpenses,
      partsExpenses,
      generalExpenses,
      urgentServicesCount
    };
  }, [vehicles, vehicleEvents]);

  // Filtrado de vehículos en tabla de amortización
  const filteredVehicles = useMemo(() => {
    return fleetMetrics.vehiclesWithStats.filter(v => {
      const matchSearch =
        v.patente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.assignedDriver && v.assignedDriver.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = selectedStatusFilter === 'todos' || v.status === selectedStatusFilter;

      return matchSearch && matchStatus;
    });
  }, [fleetMetrics.vehiclesWithStats, searchTerm, selectedStatusFilter]);

  // Filtrado de eventos en historial
  const filteredEvents = useMemo(() => {
    return vehicleEvents
      .filter(e => {
        const matchType = selectedEventType === 'todos' || e.type === selectedEventType;
        const matchPatente = selectedPatenteFilter === 'todas' || e.patente === selectedPatenteFilter;
        const matchSearch =
          searchTerm === '' ||
          e.patente.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (e.description && e.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (e.workshopOrProvider && e.workshopOrProvider.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (e.invoiceNumber && e.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (e.performedBy && e.performedBy.toLowerCase().includes(searchTerm.toLowerCase()));

        return matchType && matchPatente && matchSearch;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.mileageKm - a.mileageKm);
  }, [vehicleEvents, selectedEventType, selectedPatenteFilter, searchTerm]);

  // Eventos del vehículo activo seleccionado para la ficha individual
  const activeVehicleEvents = useMemo(() => {
    if (!activeVehicle) return [];
    return vehicleEvents
      .filter(e => e.vehicleId === activeVehicle.id || e.patente.toUpperCase() === activeVehicle.patente.toUpperCase())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.mileageKm - a.mileageKm);
  }, [activeVehicle, vehicleEvents]);

  // Handlers para Vehículos
  const handleOpenAddVehicle = () => {
    setVehicleToEdit(null);
    setIsVehicleModalOpen(true);
  };

  const handleOpenEditVehicle = (veh: VehicleItem) => {
    setVehicleToEdit(veh);
    setIsVehicleModalOpen(true);
  };

  const handleSaveVehicle = (data: Partial<VehicleItem>) => {
    if (vehicleToEdit) {
      updateVehicle(vehicleToEdit.id, data);
    } else {
      const created = addVehicle(data as any);
      setSelectedVehicleId(created.id);
    }
  };

  const handleDeleteVehicleConfirm = () => {
    if (vehicleToDelete) {
      deleteVehicle(vehicleToDelete.id);
      setVehicleToDelete(null);
      if (selectedVehicleId === vehicleToDelete.id) {
        const remaining = vehicles.filter(v => v.id !== vehicleToDelete.id);
        setSelectedVehicleId(remaining[0]?.id || '');
      }
    }
  };

  // Handlers para Eventos
  const handleOpenAddEvent = (targetVehicleId?: string) => {
    setEventToEdit(null);
    setEventModalVehicleId(targetVehicleId || selectedVehicleId || vehicles[0]?.id || '');
    setIsEventModalOpen(true);
  };

  const handleOpenEditEvent = (evt: VehicleEventItem) => {
    setEventToEdit(evt);
    setEventModalVehicleId(evt.vehicleId);
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = (data: Partial<VehicleEventItem>) => {
    if (eventToEdit) {
      updateVehicleEvent(eventToEdit.id, data);
    } else {
      addVehicleEvent(data as any);
    }
  };

  const handleDeleteEventConfirm = () => {
    if (eventToDelete) {
      deleteVehicleEvent(eventToDelete.id);
      setEventToDelete(null);
    }
  };

  // Renderizador de Badge de Tipo de Evento
  const renderEventTypeBadge = (type: VehicleEventType) => {
    switch (type) {
      case 'kilometraje':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Gauge className="w-3 h-3" /> Kilometraje
          </span>
        );
      case 'cambio_aceite':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Droplets className="w-3 h-3" /> Cambio de Aceite
          </span>
        );
      case 'mecanico':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <Wrench className="w-3 h-3" /> Mecánicos
          </span>
        );
      case 'repuesto':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Package className="w-3 h-3" /> Repuestos
          </span>
        );
      case 'mantenimiento_gral':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Sparkles className="w-3 h-3" /> Mantenimiento Gral
          </span>
        );
      default:
        return null;
    }
  };

  const renderStatusBadge = (status: VehicleStatus) => {
    switch (status) {
      case 'Operativo':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Operativo
          </span>
        );
      case 'En Taller':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <Wrench className="w-3 h-3" /> En Taller
          </span>
        );
      case 'Mantenimiento Pendiente':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" /> Service Pendiente
          </span>
        );
      case 'Fuera de Servicio':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-500/20">
            Inactivo
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. HEADER PRINCIPAL Y ACCIONES */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shadow-xs">
              <Truck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Flota & Análisis de Amortización de Vehículos
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  {vehicles.length} Vehículos
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Seguimiento autoadministrable por patente: odómetros, cambios de aceite, mecánicos, repuestos, mantenimiento general y amortización contable por kilómetro.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => exportVehiclesToExcel(vehicles, vehicleEvents)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Descargar informe completo en Excel con pestañas de Flota y Eventos"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Exportar Excel
            </button>

            <button
              onClick={() => handleOpenAddEvent()}
              className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Wrench className="w-4 h-4 text-amber-400" />
              + Nuevo Evento / Service
            </button>

            <button
              onClick={handleOpenAddVehicle}
              className="px-4 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-cyan-500/20"
            >
              <Plus className="w-4 h-4" />
              + Nuevo Vehículo
            </button>
          </div>
        </div>

        {/* ALERTA PREVENTIVA DE SERVICES PRÓXIMOS O VENCIDOS */}
        {fleetMetrics.urgentServicesCount > 0 && (
          <div className="mt-4 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Atención preventiva:</strong> Se detectaron{' '}
                <span className="font-bold underline">{fleetMetrics.urgentServicesCount} vehículo(s)</span> con cambio de aceite urgente/vencido o inspección técnica (VTV) por caducar.
              </span>
            </div>
            <button
              onClick={() => {
                setActiveTab('amortizacion');
                setSelectedStatusFilter('todos');
              }}
              className="font-bold underline text-amber-800 dark:text-amber-300 hover:text-amber-950 cursor-pointer"
            >
              Revisar Flota
            </button>
          </div>
        )}

        {/* BARRA DE NAVEGACIÓN ENTRE TABS */}
        <div className="flex items-center gap-2 mt-5 border-t border-slate-200/80 dark:border-slate-800 pt-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('amortizacion')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'amortizacion'
                ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Análisis de Amortización & Flota
          </button>

          <button
            onClick={() => setActiveTab('eventos')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'eventos'
                ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-4 h-4" />
            Historial de Novedades & Mantenimientos ({vehicleEvents.length})
          </button>

          <button
            onClick={() => setActiveTab('ficha')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'ficha'
                ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <Car className="w-4 h-4" />
            Ficha Individual por Patente
          </button>
        </div>
      </div>

      {/* 2. TARJETAS DE MÉTRICAS GLOBALES (KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Vehículos Totales */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Flota Total</span>
            <Truck className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            {vehicles.length}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
            {vehicles.filter(v => v.status === 'Operativo').length} Operativos
          </span>
        </div>

        {/* Kilometraje Acumulado */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Km Flota</span>
            <Gauge className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            {fleetMetrics.totalAccumulatedKm.toLocaleString('es-AR')}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            Km acumulados
          </span>
        </div>

        {/* Amortización Acumulada */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Amortización</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            ${Math.round(fleetMetrics.totalDepreciation).toLocaleString('es-AR')}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            Depreciación acumulada
          </span>
        </div>

        {/* Valor Contable en Libros */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Valor Libros</span>
            <Shield className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            ${Math.round(fleetMetrics.totalCurrentBookValue).toLocaleString('es-AR')}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            Patrimonio neto flota
          </span>
        </div>

        {/* Gasto Mantenimiento & Taller */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Gastos Taller</span>
            <Wrench className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            ${Math.round(fleetMetrics.totalMaintenanceExpenses).toLocaleString('es-AR')}
          </div>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
            {vehicleEvents.length} eventos registrados
          </span>
        </div>

        {/* Costo Promedio por Km */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Amortiz. / Km</span>
            <Activity className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            ${fleetMetrics.totalAccumulatedKm > 0 ? (fleetMetrics.totalDepreciation / fleetMetrics.totalAccumulatedKm).toFixed(2) : '0.00'}
          </div>
          <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">
            Costo $/km promedio
          </span>
        </div>
      </div>

      {/* 3. VISTA: ANÁLISIS DE AMORTIZACIÓN & TABLA COMPARATIVA */}
      {activeTab === 'amortizacion' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          
          {/* Header de la Tabla con Buscador & Filtros */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por patente, marca, modelo o chofer..."
                className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <select
                value={selectedStatusFilter}
                onChange={e => setSelectedStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
              >
                <option value="todos">Todos los Estados</option>
                <option value="Operativo">Operativo</option>
                <option value="En Taller">En Taller</option>
                <option value="Mantenimiento Pendiente">Mantenimiento Pendiente</option>
                <option value="Fuera de Servicio">Fuera de Servicio</option>
              </select>
            </div>
          </div>

          {/* Tabla de Amortización */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Patente & Vehículo</th>
                  <th className="py-3 px-3">Estado</th>
                  <th className="py-3 px-3">Chofer / Asignado</th>
                  <th className="py-3 px-3 text-right">Odómetro Actual</th>
                  <th className="py-3 px-3 text-right">Valor Compra ($)</th>
                  <th className="py-3 px-3 text-right">Amortiz. $/Km</th>
                  <th className="py-3 px-3 text-right">Amortiz. Acumulada</th>
                  <th className="py-3 px-3 text-right">Valor en Libros</th>
                  <th className="py-3 px-3">Vida Útil (%)</th>
                  <th className="py-3 px-3 text-right">Gastos Mantenimiento</th>
                  <th className="py-3 px-3 text-center">Próximo Service</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-10 text-slate-400">
                      No se encontraron vehículos registrados con el criterio de búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map(v => (
                    <tr
                      key={v.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedVehicleId(v.id);
                        setActiveTab('ficha');
                      }}
                    >
                      {/* Patente & Vehículo */}
                      <td className="py-3 px-4 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 font-mono font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md shadow-xs">
                            {v.patente}
                          </span>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {v.brand} {v.model}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Año {v.year} • {v.type}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {renderStatusBadge(v.status)}
                      </td>

                      {/* Chofer */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {v.assignedDriver || <span className="text-slate-400 italic">Sin asignar</span>}
                      </td>

                      {/* Odómetro */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {v.currentMileageKm.toLocaleString('es-AR')} km
                      </td>

                      {/* Valor Compra */}
                      <td className="py-3 px-3 text-right font-medium whitespace-nowrap">
                        ${v.purchasePrice.toLocaleString('es-AR')}
                      </td>

                      {/* Amortización por Km */}
                      <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ${v.ratePerKm.toFixed(2)} / km
                      </td>

                      {/* Amortización Acumulada */}
                      <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        ${Math.round(v.accumulatedDepreciation).toLocaleString('es-AR')}
                      </td>

                      {/* Valor Libros */}
                      <td className="py-3 px-3 text-right font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        ${Math.round(v.bookValue).toLocaleString('es-AR')}
                      </td>

                      {/* Barra de Vida Útil Consumida */}
                      <td className="py-3 px-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                v.consumedPct > 80
                                  ? 'bg-rose-500'
                                  : v.consumedPct > 50
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${v.consumedPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-bold">{v.consumedPct.toFixed(0)}%</span>
                        </div>
                      </td>

                      {/* Gastos de Mantenimiento Acumulados */}
                      <td className="py-3 px-3 text-right font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        ${v.totalMaintenanceCost.toLocaleString('es-AR')}
                      </td>

                      {/* Próximo Service / Alerta */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {v.isOilOverdue ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                            ¡VENCIDO {Math.abs(v.kmUntilOil).toLocaleString('es-AR')} km!
                          </span>
                        ) : v.isOilUrgent ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                            En {v.kmUntilOil.toLocaleString('es-AR')} km
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                            {v.nextOilKm.toLocaleString('es-AR')} km
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenAddEvent(v.id)}
                            className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Registrar evento o novedad rápida"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditVehicle(v)}
                            className="p-1.5 text-slate-500 hover:text-cyan-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Editar parámetros y amortización del vehículo"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setVehicleToDelete(v)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar vehículo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. VISTA: HISTORIAL DE NOVEDADES & MANTENIMIENTOS */}
      {activeTab === 'eventos' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          
          {/* Barra de Filtros */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
            
            {/* Buscador */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar evento, falla, repuesto, taller..."
                className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
              />
            </div>

            {/* Filtros de Tipo y Patente */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
              
              {/* Filtro por Patente */}
              <select
                value={selectedPatenteFilter}
                onChange={e => setSelectedPatenteFilter(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
              >
                <option value="todas">Todas las Patentes</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.patente}>
                    {v.patente} ({v.brand} {v.model})
                  </option>
                ))}
              </select>

              {/* Filtro por Tipo de Evento */}
              <select
                value={selectedEventType}
                onChange={e => setSelectedEventType(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
              >
                <option value="todos">Todos los Tipos de Eventos</option>
                <option value="kilometraje">Kilometraje</option>
                <option value="cambio_aceite">Cambio de Aceite</option>
                <option value="mecanico">Mecánicos</option>
                <option value="repuesto">Repuestos</option>
                <option value="mantenimiento_gral">Mantenimiento Gral</option>
              </select>

              <button
                onClick={() => handleOpenAddEvent()}
                className="px-3 py-1.5 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Nuevo Evento
              </button>
            </div>
          </div>

          {/* Tabla de Eventos */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-3">Patente</th>
                  <th className="py-3 px-3">Tipo de Evento</th>
                  <th className="py-3 px-3 text-right">Odómetro (Km)</th>
                  <th className="py-3 px-4">Descripción / Tarea Realizada</th>
                  <th className="py-3 px-3">Taller / Proveedor</th>
                  <th className="py-3 px-3">Factura / Remito</th>
                  <th className="py-3 px-3 text-right">Costo ($)</th>
                  <th className="py-3 px-3">Responsable</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-slate-400">
                      No hay eventos registrados que coincidan con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map(evt => (
                    <tr key={evt.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Fecha */}
                      <td className="py-3 px-4 font-medium whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {evt.date}
                      </td>

                      {/* Patente */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
                          {evt.patente}
                        </span>
                      </td>

                      {/* Tipo */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {renderEventTypeBadge(evt.type)}
                      </td>

                      {/* Odómetro */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {evt.mileageKm.toLocaleString('es-AR')} km
                      </td>

                      {/* Título & Detalle */}
                      <td className="py-3 px-4 max-w-xs sm:max-w-md">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {evt.title}
                        </span>
                        {evt.description && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                            {evt.description}
                          </span>
                        )}
                        {evt.oilChangeDetails && (
                          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                            <span className="bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              Aceite: {evt.oilChangeDetails.oilType} ({evt.oilChangeDetails.oilBrand})
                            </span>
                            {evt.oilChangeDetails.nextChangeKm && (
                              <span className="bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                Próx: {evt.oilChangeDetails.nextChangeKm.toLocaleString('es-AR')} km
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Taller / Proveedor */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {evt.workshopOrProvider || '-'}
                      </td>

                      {/* Factura */}
                      <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                        {evt.invoiceNumber || '-'}
                      </td>

                      {/* Costo */}
                      <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {evt.cost > 0 ? `$${evt.cost.toLocaleString('es-AR')}` : '$0'}
                      </td>

                      {/* Responsable */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {evt.performedBy || '-'}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditEvent(evt)}
                            className="p-1.5 text-slate-500 hover:text-cyan-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Editar evento"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEventToDelete(evt)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar evento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. VISTA: FICHA INDIVIDUAL POR PATENTE */}
      {activeTab === 'ficha' && (
        <div className="space-y-6">
          
          {/* Selector de Patente en Ficha Individual */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Seleccionar Patente:
              </label>
              <select
                value={selectedVehicleId}
                onChange={e => setSelectedVehicleId(e.target.value)}
                className="w-full sm:w-72 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
              >
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    [{v.patente}] {v.brand} {v.model}
                  </option>
                ))}
              </select>
            </div>

            {activeVehicle && (
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => handleOpenAddEvent(activeVehicle.id)}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Wrench className="w-4 h-4 text-amber-400" />
                  + Registrar Novedad en {activeVehicle.patente}
                </button>
                <button
                  onClick={() => handleOpenEditVehicle(activeVehicle)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Editar Parámetros
                </button>
              </div>
            )}
          </div>

          {activeVehicle ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Tarjeta de Ficha Técnica & Amortización */}
              <div className="lg:col-span-1 space-y-4">
                
                {/* Banner Principal del Vehículo */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 font-mono font-black text-base text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-lg shadow-inner">
                      {activeVehicle.patente}
                    </span>
                    {renderStatusBadge(activeVehicle.status)}
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                      {activeVehicle.brand} {activeVehicle.model}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Año {activeVehicle.year} • {activeVehicle.type} • {activeVehicle.fuelType}
                    </p>
                  </div>

                  {/* Odómetro Actual */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-medium text-slate-500 uppercase block">Odómetro Actual</span>
                      <span className="text-xl font-black font-mono text-slate-900 dark:text-white">
                        {activeVehicle.currentMileageKm.toLocaleString('es-AR')} km
                      </span>
                    </div>
                    <Gauge className="w-7 h-7 text-cyan-500" />
                  </div>

                  {/* Desglose de Amortización */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Valor de Compra:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        ${activeVehicle.purchasePrice.toLocaleString('es-AR')}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Valor Residual Estimado:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        ${activeVehicle.residualValue.toLocaleString('es-AR')}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Vida Útil Proyectada:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {activeVehicle.usefulLifeKm.toLocaleString('es-AR')} km ({activeVehicle.usefulLifeYears} años)
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Costo Amortización por Km:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        ${(
                          Math.max(0, activeVehicle.purchasePrice - activeVehicle.residualValue) /
                          (activeVehicle.usefulLifeKm || 1)
                        ).toFixed(2)} / km
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>Amortización Acumulada:</span>
                      <span className="font-black text-slate-900 dark:text-white">
                        ${Math.round(
                          (Math.max(0, activeVehicle.currentMileageKm - activeVehicle.initialMileageKm) *
                            Math.max(0, activeVehicle.purchasePrice - activeVehicle.residualValue)) /
                            (activeVehicle.usefulLifeKm || 1)
                        ).toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>

                  {/* Alerta de Service de Aceite */}
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
                      <span className="flex items-center gap-1.5">
                        <Droplets className="w-4 h-4 text-amber-500" /> Próximo Cambio de Aceite
                      </span>
                      <span>
                        {(activeVehicle.lastOilChangeKm || 0) + (activeVehicle.oilChangeIntervalKm || 10000)} km
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      Último cambio realizado:{' '}
                      <strong>{activeVehicle.lastOilChangeKm?.toLocaleString('es-AR') || 'Sin registrar'} km</strong>
                      {activeVehicle.lastOilChangeDate ? ` (${activeVehicle.lastOilChangeDate})` : ''}
                    </div>
                  </div>

                  {/* Documentación & Seguro */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                    <div>
                      <strong>Chofer Asignado:</strong> {activeVehicle.assignedDriver || 'Sin chofer fijo'}
                    </div>
                    <div>
                      <strong>Seguro:</strong> {activeVehicle.insuranceCompany || 'No especificado'}{' '}
                      {activeVehicle.policyNumber ? `(Póliza: ${activeVehicle.policyNumber})` : ''}
                    </div>
                    {activeVehicle.vtvExpirationDate && (
                      <div>
                        <strong>Vencimiento VTV/RTO:</strong> {activeVehicle.vtvExpirationDate}
                      </div>
                    )}
                    {activeVehicle.notes && (
                      <div className="italic mt-1 text-slate-400">
                        "{activeVehicle.notes}"
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Historial Exclusivo de este Vehículo */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-cyan-500" />
                        Historial de Novedades de {activeVehicle.patente}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Todos los registros de odómetro, cambio de aceite, mecánicos y repuestos
                      </p>
                    </div>

                    <button
                      onClick={() => handleOpenAddEvent(activeVehicle.id)}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Agregar Registro
                    </button>
                  </div>

                  {activeVehicleEvents.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      <Wrench className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                      <p className="text-sm font-medium">Aún no hay eventos registrados para este vehículo.</p>
                      <button
                        onClick={() => handleOpenAddEvent(activeVehicle.id)}
                        className="mt-3 px-3.5 py-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                      >
                        + Registrar el primer service o cambio de aceite
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeVehicleEvents.map(evt => (
                        <div
                          key={evt.id}
                          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all bg-slate-50/50 dark:bg-slate-800/30"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {renderEventTypeBadge(evt.type)}
                                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                  {evt.mileageKm.toLocaleString('es-AR')} km
                                </span>
                                <span className="text-xs text-slate-400">• {evt.date}</span>
                              </div>
                              <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                                {evt.title}
                              </h5>
                              {evt.description && (
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                  {evt.description}
                                </p>
                              )}
                              {evt.oilChangeDetails && (
                                <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 p-2 rounded-lg mt-1.5 flex flex-wrap gap-3">
                                  <span>Tipo: <strong>{evt.oilChangeDetails.oilType}</strong> ({evt.oilChangeDetails.oilBrand})</span>
                                  {evt.oilChangeDetails.filterChanged && <span>Filtro aceite: <strong>Reemplazado</strong></span>}
                                  {evt.oilChangeDetails.nextChangeKm && (
                                    <span>Próximo: <strong>{evt.oilChangeDetails.nextChangeKm.toLocaleString('es-AR')} km</strong></span>
                                  )}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 pt-1">
                                {evt.workshopOrProvider && <span>Taller: <strong>{evt.workshopOrProvider}</strong></span>}
                                {evt.invoiceNumber && <span>Factura: <strong>{evt.invoiceNumber}</strong></span>}
                                {evt.performedBy && <span>Responsable: <strong>{evt.performedBy}</strong></span>}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-sm font-bold text-slate-900 dark:text-white block">
                                {evt.cost > 0 ? `$${evt.cost.toLocaleString('es-AR')}` : '$0'}
                              </span>
                              <div className="flex items-center gap-1 justify-end mt-2">
                                <button
                                  onClick={() => handleOpenEditEvent(evt)}
                                  className="p-1 text-slate-400 hover:text-cyan-600 transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEventToDelete(evt)}
                                  className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              No hay vehículos registrados para mostrar ficha individual.
            </div>
          )}
        </div>
      )}

      {/* MODAL: ALTA / EDICIÓN DE VEHÍCULO */}
      <VehicleModal
        isOpen={isVehicleModalOpen}
        onClose={() => setIsVehicleModalOpen(false)}
        onSave={handleSaveVehicle}
        initialVehicle={vehicleToEdit}
      />

      {/* MODAL: ALTA / EDICIÓN DE EVENTO */}
      <VehicleEventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSave={handleSaveEvent}
        initialEvent={eventToEdit}
        vehicles={vehicles}
        selectedVehicleId={eventModalVehicleId}
      />

      {/* DIÁLOGO DE CONFIRMACIÓN DE ELIMINACIÓN DE VEHÍCULO */}
      {vehicleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-500/10 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  ¿Eliminar Vehículo [{vehicleToDelete.patente}]?
                </h3>
                <p className="text-xs text-slate-500">
                  Esta acción eliminará el vehículo y su historial de eventos asociado.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setVehicleToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteVehicleConfirm}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-md shadow-rose-500/20"
              >
                Sí, Eliminar Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIÁLOGO DE CONFIRMACIÓN DE ELIMINACIÓN DE EVENTO */}
      {eventToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-500/10 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  ¿Eliminar Registro de Evento?
                </h3>
                <p className="text-xs text-slate-500">
                  {eventToDelete.title} - Patente [{eventToDelete.patente}]
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setEventToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteEventConfirm}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-md shadow-rose-500/20"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

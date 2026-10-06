import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Check,
  X,
  Phone,
  Mail,
  Briefcase,
  Percent,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HardHat,
  Wrench,
  UserCheck,
  Building2,
  DollarSign,
  Clock,
  Download,
  RefreshCw,
  Cloud,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileSpreadsheet,
  ArrowUpAZ,
  ArrowDownZA
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { WorkerItem, UserRole, WorkerCategory } from '../types';
import { isAdministrativeProfile, normalizeWorkerName, deduplicateWorkersList } from '../utils/calculationUtils';
import { isAdministrativeUser } from '../utils/permissionUtils';
import { saveWorkersBatchToFirestore } from '../services/firestoreSync';
import {
  exportWorkersToExcel,
  downloadWorkersExcelTemplate,
  parseWorkersExcel,
  ExcelWorkerImportResult
} from '../utils/excelParser';

interface EmployeesManagementTabProps {
  onSelectWorkerForDetail?: (workerName: string) => void;
}

export const EmployeesManagementTab: React.FC<EmployeesManagementTabProps> = () => {
  const { workers, addWorker, updateWorker, deleteWorker, bulkAddWorkers, technicalAuditRecords, technicalParameters } = useData();
  const { currentUser, users } = useAuth();
  const canManage = isAdministrativeUser(currentUser);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'Todos' | 'Oficiales' | 'Ayudantes' | 'Capataz' | 'Administrativo' | 'Directivo'>('Todos');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modal State for Add/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkerItem | null>(null);
  const [workerToDelete, setWorkerToDelete] = useState<WorkerItem | null>(null);

  // Excel Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [parsedExcelWorkers, setParsedExcelWorkers] = useState<ExcelWorkerImportResult | null>(null);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [replaceAllWorkers, setReplaceAllWorkers] = useState(false);
  const [isImportingToFirestore, setIsImportingToFirestore] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('Empleado');
  const [category, setCategory] = useState<WorkerCategory>('Ayudante');
  const [cargo, setCargo] = useState('');
  const [capatazPercentage, setCapatazPercentage] = useState<number>(10);
  const [cuadrilla, setCuadrilla] = useState('Cuadrilla 1 - Valle de Uco');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [salaryMonthly, setSalaryMonthly] = useState<number>(980000);
  const [hourlyRate, setHourlyRate] = useState<number>(5500);
  const [active, setActive] = useState(true);

  // Inline percentage editing state
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlinePercentage, setInlinePercentage] = useState<number>(10);
  // Inline hourly rate editing state
  const [inlineRateId, setInlineRateId] = useState<string | null>(null);
  const [inlineRateValue, setInlineRateValue] = useState<string>('');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [highlightedWorkerName, setHighlightedWorkerName] = useState<string | null>(null);

  // Dual horizontal scrollbars and Keyboard Arrow Navigation refs & state
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState<number>(1400);
  const isSyncingTop = useRef<boolean>(false);
  const isSyncingBottom = useRef<boolean>(false);

  // Synchronize top and bottom scroll positions
  const handleTopScroll = () => {
    if (isSyncingTop.current) {
      isSyncingTop.current = false;
      return;
    }
    if (topScrollRef.current && tableContainerRef.current) {
      isSyncingBottom.current = true;
      tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleBottomScroll = () => {
    if (isSyncingBottom.current) {
      isSyncingBottom.current = false;
      return;
    }
    if (topScrollRef.current && tableContainerRef.current) {
      isSyncingTop.current = true;
      topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
  };

  // Keep top scroll spacer width in sync with real table scroll width
  useEffect(() => {
    const updateScrollWidth = () => {
      if (tableContainerRef.current) {
        setTableScrollWidth(tableContainerRef.current.scrollWidth);
      }
    };

    updateScrollWidth();
    const timer = setTimeout(updateScrollWidth, 120);

    window.addEventListener('resize', updateScrollWidth);
    let observer: ResizeObserver | null = null;
    if (tableContainerRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateScrollWidth);
      observer.observe(tableContainerRef.current);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateScrollWidth);
      if (observer) observer.disconnect();
    };
  }, [workers]);

  // Smooth horizontal scroll helper for buttons and keyboard
  const scrollHorizontally = (delta: number) => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  // Keyboard navigation handler (flechas del teclado: ArrowLeft / ArrowRight / Home / End)
  const handleTableKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
      return;
    }

    const SCROLL_STEP = 220;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      scrollHorizontally(SCROLL_STEP);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scrollHorizontally(-SCROLL_STEP);
    } else if (e.key === 'Home') {
      e.preventDefault();
      tableContainerRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (e.key === 'End') {
      e.preventDefault();
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTo({ left: tableContainerRef.current.scrollWidth, behavior: 'smooth' });
      }
    }
  };

  // Auto-focus table container on hover so keyboard arrows work immediately
  const handleMouseEnterTable = () => {
    const activeEl = document.activeElement as HTMLElement | null;
    const isEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
    if (!isEditing && tableContainerRef.current) {
      tableContainerRef.current.focus({ preventScroll: true });
    }
  };

  const showFeedback = (msg: string) => {
    setSaveSuccessMessage(msg);
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // Open modal for new employee
  const handleOpenNewModal = () => {
    setEditingWorker(null);
    setName('');
    setRole('Empleado');
    setCategory('Ayudante');
    setCargo('Ayudante de Cuadrilla');
    setCapatazPercentage(10);
    setCuadrilla('Cuadrilla 1 - Valle de Uco');
    setPhone('+54 9 261 ');
    setEmail('');
    setSalaryMonthly(850000);
    setHourlyRate(technicalParameters.pagoAyudanteHora || 5500);
    setActive(true);
    setIsModalOpen(true);
  };

  // Open modal for editing employee
  const handleOpenEditModal = (worker: WorkerItem) => {
    setEditingWorker(worker);
    setName(worker.name);
    setRole(worker.role);
    const isAdm = isAdministrativeProfile(worker) || (
      ['SuperAdmin', 'Owner', 'Gerente', 'Admin'].includes(worker.role) &&
      !worker.cargo?.toLowerCase().includes('oficial') &&
      !worker.specialty?.toLowerCase().includes('oficial') &&
      worker.category !== 'Oficial' &&
      worker.category !== 'Ayudante' &&
      worker.category !== 'Capataz'
    );
    const inferredCat: WorkerCategory = worker.category || (
      isAdm ? 'Administrativo' :
      worker.role === 'Capataz' ? 'Capataz' :
      (worker.cargo?.toLowerCase().includes('oficial') || worker.specialty?.toLowerCase().includes('oficial')) ? 'Oficial' :
      (worker.cargo?.toLowerCase().includes('ayudante') || worker.specialty?.toLowerCase().includes('ayudante')) ? 'Ayudante' :
      'Oficial'
    );
    setCategory(inferredCat);
    setCargo(worker.cargo || worker.specialty || (isAdm ? 'Personal Administrativo / Gestión' : worker.role === 'Capataz' ? 'Capataz de Obra' : 'Técnico Operario'));
    setCapatazPercentage(worker.capatazPercentage ?? (worker.role === 'Capataz' ? 10 : 10));
    setCuadrilla(worker.cuadrilla || (isAdm ? 'Sede Central / Administración' : 'Cuadrilla 1 - Valle de Uco'));
    setPhone(worker.phone || '');
    setEmail(worker.email || '');
    setSalaryMonthly(worker.salaryMonthly || (isAdm ? 1100000 : 980000));
    const defaultRate = isAdm
      ? 0
      : inferredCat === 'Capataz'
        ? 11500
        : inferredCat === 'Oficial'
          ? (technicalParameters.horaOficial || technicalParameters.horaBase || 9400)
          : (technicalParameters.pagoAyudanteHora || 5500);
    setHourlyRate(worker.hourlyRate || defaultRate);
    setActive(worker.active !== false);
    setIsModalOpen(true);
  };

  // Submit modal form
  const handleSaveWorker = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const finalCategory: WorkerCategory = role === 'Capataz' ? 'Capataz' : category;
    const isAdm = finalCategory === 'Administrativo' || isAdministrativeProfile({ role, category: finalCategory, cargo });

    const parsedSalary = parseFloat(String(salaryMonthly).replace(',', '.'));
    const parsedHourly = parseFloat(String(hourlyRate).replace(',', '.'));
    const parsedCapatazPct = parseFloat(String(capatazPercentage).replace(',', '.'));

    const workerPayload: Omit<WorkerItem, 'id'> = {
      name: trimmedName,
      role,
      category: finalCategory,
      isAdministrative: isAdm,
      specialty: cargo.trim() || (isAdm ? 'Personal Administrativo / Gestión' : role === 'Capataz' ? 'Capataz de Obra' : finalCategory === 'Oficial' ? 'Oficial Especialista' : 'Ayudante de Cuadrilla'),
      cargo: cargo.trim() || (isAdm ? 'Personal Administrativo / Gestión' : role === 'Capataz' ? 'Capataz de Obra' : finalCategory === 'Oficial' ? 'Oficial Especialista' : 'Ayudante de Cuadrilla'),
      capatazPercentage: role === 'Capataz' ? (!isNaN(parsedCapatazPct) ? parsedCapatazPct : 10) : undefined,
      cuadrilla: cuadrilla.trim() || (isAdm ? 'Sede Central / Administración' : 'Cuadrilla 1 - Valle de Uco'),
      phone: phone.trim(),
      email: email.trim() || `${trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@bandiera.com`,
      active,
      assignedProjectsCount: editingWorker?.assignedProjectsCount || (isAdm ? 0 : 1),
      salaryMonthly: !isNaN(parsedSalary) ? parsedSalary : (isAdm ? 1100000 : role === 'Capataz' ? 1250000 : 980000),
      hourlyRate: isAdm ? (parsedHourly >= 0 ? parsedHourly : 0) : (!isNaN(parsedHourly) && parsedHourly >= 0 ? parsedHourly : undefined)
    };

    if (editingWorker) {
      updateWorker(editingWorker.id, workerPayload);
      showFeedback(`Empleado "${trimmedName}" actualizado correctamente.`);
    } else {
      addWorker(workerPayload);
      showFeedback(`Nuevo empleado "${trimmedName}" agregado a la nómina con éxito.`);
      setRoleFilter('Todos');
      setSearchTerm('');
      setHighlightedWorkerName(trimmedName.toLowerCase().trim());
      setTimeout(() => setHighlightedWorkerName(null), 8000);
    }
    setIsModalOpen(false);
  };

  // Quick save inline hourly rate
  const handleSaveInlineHourlyRate = (workerId: string) => {
    const cleanStr = inlineRateValue.replace(',', '.').trim();
    const val = parseFloat(cleanStr);
    if (isNaN(val) || val < 0) {
      setInlineRateId(null);
      return;
    }
    const worker = workers.find(w => w.id === workerId);
    updateWorker(workerId, { hourlyRate: val });
    setInlineRateId(null);
    showFeedback(`Tarifa horaria de ${worker?.name || 'empleado'} fijada en $${val.toLocaleString('es-AR')}/h.`);
  };

  // Quick save inline Capataz percentage
  const handleSaveInlinePercentage = (workerId: string) => {
    const cleanStr = String(inlinePercentage).replace(',', '.').trim();
    const val = parseFloat(cleanStr);
    if (isNaN(val) || val < 0 || val > 100) return;

    updateWorker(workerId, { capatazPercentage: val });
    setInlineEditingId(null);
    showFeedback(`Porcentaje de Capataz actualizado al ${val}%.`);
  };

  // Toggle active status
  const handleToggleActive = (worker: WorkerItem) => {
    updateWorker(worker.id, { active: !worker.active });
    showFeedback(`Estado de "${worker.name}" cambiado a ${!worker.active ? 'Activo' : 'Inactivo'}.`);
  };

  // Delete worker (only admin@admin.com is protected)
  const handleDeleteWorker = (worker: WorkerItem) => {
    if ((worker.email || '').toLowerCase().trim() === 'admin@admin.com') {
      showFeedback('El usuario root principal (admin@admin.com) está protegido y no puede ser eliminado.');
      return;
    }
    setWorkerToDelete(worker);
  };

  const confirmDeleteWorker = () => {
    if (!workerToDelete) return;
    const workerName = workerToDelete.name;
    deleteWorker(workerToDelete.id);
    setWorkerToDelete(null);
    showFeedback(`Empleado "${workerName}" eliminado permanentemente de la nómina y base de datos.`);
  };

  // Export full workers list to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      exportWorkersToExcel(filteredWorkers);
      showFeedback('Nómina de personal exportada a Excel (.xlsx) exitosamente.');
    } catch (err: any) {
      showFeedback(`Error al exportar a Excel: ${err.message || 'Error desconocido'}`);
    }
  };

  // Open Excel Import Modal
  const handleOpenExcelImport = () => {
    setExcelFile(null);
    setParsedExcelWorkers(null);
    setReplaceAllWorkers(false);
    setIsExcelImportModalOpen(true);
  };

  // Handle Excel file selection (.xlsx / .xls)
  const handleSelectExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);
    setIsParsingExcel(true);
    try {
      const result = await parseWorkersExcel(file);
      setParsedExcelWorkers(result);
    } catch (err: any) {
      showFeedback(`Error al leer archivo Excel: ${err.message || 'Formato no compatible'}`);
    } finally {
      setIsParsingExcel(false);
    }
  };

  // Analyze parsed Excel data against current database to prevent duplicates
  const excelDeduplicationSummary = useMemo(() => {
    if (!parsedExcelWorkers || !parsedExcelWorkers.workers || parsedExcelWorkers.workers.length === 0) {
      return null;
    }

    const existingByName = new Map<string, WorkerItem>();
    const existingByEmail = new Map<string, WorkerItem>();
    workers.forEach(w => {
      const norm = normalizeWorkerName(w.name);
      if (norm) existingByName.set(norm, w);
      const em = (w.email || '').toLowerCase().trim();
      if (em) existingByEmail.set(em, w);
    });

    const analyzed = parsedExcelWorkers.workers.map(w => {
      const norm = normalizeWorkerName(w.name);
      const em = (w.email || '').toLowerCase().trim();
      const existing = (norm ? existingByName.get(norm) : undefined) || (em ? existingByEmail.get(em) : undefined);
      return {
        worker: w,
        isExisting: !!existing,
        existingRecord: existing
      };
    });

    const existingCount = analyzed.filter(a => a.isExisting).length;
    const newCount = analyzed.filter(a => !a.isExisting).length;

    return {
      total: analyzed.length,
      existingCount,
      newCount,
      analyzed
    };
  }, [parsedExcelWorkers, workers]);

  // Confirm and persist imported workers to Firestore with strict deduplication
  const handleConfirmImportExcel = async () => {
    if (!parsedExcelWorkers || parsedExcelWorkers.workers.length === 0) return;
    setIsImportingToFirestore(true);
    try {
      const res = await bulkAddWorkers(parsedExcelWorkers.workers, replaceAllWorkers);
      setIsExcelImportModalOpen(false);
      setParsedExcelWorkers(null);
      setExcelFile(null);
      showFeedback(`¡Base de datos actualizada! Se agregaron ${res.added} nuevos empleados y se actualizaron ${res.updated} existentes (0 duplicados).`);
    } catch (err: any) {
      showFeedback(`Error al importar: ${err.message || 'Error de persistencia'}`);
    } finally {
      setIsImportingToFirestore(false);
    }
  };

  const handleForceCloudSync = async () => {
    try {
      showFeedback('Sincronizando nómina en tiempo real con Firestore en la nube...');
      await saveWorkersBatchToFirestore(workers);
      showFeedback('¡Nómina sincronizada y asegurada en Firebase Firestore!');
    } catch {
      showFeedback('Error de sincronización con la nube. Verifica tu conexión.');
    }
  };

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    const uniqueWorkers = deduplicateWorkersList(workers);
    return uniqueWorkers.filter(worker => {
      // Search (accent-insensitive & case-insensitive)
      const search = searchTerm.toLowerCase().trim();
      const normSearch = normalizeWorkerName(searchTerm);
      const normName = normalizeWorkerName(worker.name);
      const normCargo = normalizeWorkerName(worker.cargo);
      const normSpec = normalizeWorkerName(worker.specialty);
      const normCuad = normalizeWorkerName(worker.cuadrilla);
      const cleanEmail = (worker.email || '').toLowerCase().trim();

      const matchSearch =
        !search ||
        normName.includes(normSearch) ||
        (cleanEmail && cleanEmail.includes(search)) ||
        normCargo.includes(normSearch) ||
        normSpec.includes(normSearch) ||
        normCuad.includes(normSearch) ||
        (worker.phone && worker.phone.includes(search));

      // Role filter
      if (!matchSearch) return false;
      if (roleFilter === 'Todos') return true;
      if (roleFilter === 'Capataz') return worker.role === 'Capataz';
      if (roleFilter === 'Administrativo') {
        return worker.category === 'Administrativo' || isAdministrativeProfile(worker);
      }
      if (roleFilter === 'Oficiales') {
        return (worker.category === 'Oficial' ||
          (worker.cargo?.toLowerCase().includes('oficial') && !worker.cargo?.toLowerCase().includes('ayudante')) ||
          (worker.specialty?.toLowerCase().includes('oficial') && !worker.specialty?.toLowerCase().includes('ayudante'))) &&
          !isAdministrativeProfile(worker);
      }
      if (roleFilter === 'Ayudantes') {
        return (worker.category === 'Ayudante' ||
          worker.cargo?.toLowerCase().includes('ayudante') ||
          worker.specialty?.toLowerCase().includes('ayudante')) &&
          !isAdministrativeProfile(worker);
      }
      if (roleFilter === 'Directivo') return ['SuperAdmin', 'Owner', 'Gerente', 'Admin'].includes(worker.role);

      return true;
    }).sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [workers, searchTerm, roleFilter, sortOrder]);

  // Quick Metrics
  const totalEmployees = workers.length;
  const totalCapataces = workers.filter(w => w.role === 'Capataz').length;
  const totalAdministrativos = workers.filter(w => w.category === 'Administrativo' || isAdministrativeProfile(w)).length;
  const totalOficiales = workers.filter(w =>
    (w.category === 'Oficial' ||
    (w.cargo?.toLowerCase().includes('oficial') && !w.cargo?.toLowerCase().includes('ayudante')) ||
    (w.specialty?.toLowerCase().includes('oficial') && !w.specialty?.toLowerCase().includes('ayudante'))) &&
    !isAdministrativeProfile(w)
  ).length;
  const totalAyudantes = workers.filter(w =>
    (w.category === 'Ayudante' ||
    w.cargo?.toLowerCase().includes('ayudante') ||
    w.specialty?.toLowerCase().includes('ayudante')) &&
    !isAdministrativeProfile(w)
  ).length;
  const activeCount = workers.filter(w => w.active !== false).length;

  return (
    <div className="space-y-6">
      {/* Toast feedback */}
      {saveSuccessMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Explanation Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-linear-to-r from-amber-500/10 via-cyan-500/10 to-blue-500/10 border border-amber-500/20 dark:border-amber-400/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                Nómina de Empleados, Categorías (Oficial / Ayudante) y Comisiones
              </h4>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Cloud Firestore Activo
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed max-w-2xl">
              Diferencie a cada operario entre <strong>Oficial</strong> (${technicalParameters.horaOficial || 9400}/h) y <strong>Ayudante</strong> (${technicalParameters.pagoAyudanteHora || 5500}/h) para que el cómputo de costos en órdenes de campo sea exacto. Asimismo, configure el % de comisión de los Capataces.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={downloadWorkersExcelTemplate}
            className="px-3 py-2 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            title="Descargar plantilla modelo en Excel (.xlsx) para completar nómina"
          >
            <Download className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="hidden sm:inline">Plantilla Excel</span>
          </button>
          <button
            type="button"
            onClick={handleOpenExcelImport}
            disabled={!canManage}
            className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 ${
              canManage
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 cursor-pointer'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
            title={canManage ? 'Importar base de datos de empleados desde archivo Excel (.xlsx / .xls)' : 'Permiso administrativo requerido'}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar Excel</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-2 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            title="Exportar nómina a archivo Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>
          <button
            type="button"
            onClick={handleOpenNewModal}
            disabled={!canManage}
            className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all shadow-md flex items-center gap-1.5 shrink-0 ${
              canManage
                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20 cursor-pointer'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
            title={canManage ? 'Registrar nuevo empleado o cargo' : 'Permiso administrativo requerido'}
          >
            <UserPlus className="w-4 h-4" />
            <span>+ NUEVO EMPLEADO</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Personal en Nómina</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{totalEmployees}</span>
            <Users className="w-4 h-4 text-cyan-500" />
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 block">
            {activeCount} activos
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-black uppercase text-cyan-600 dark:text-cyan-400 block mb-1">Oficiales Especialistas</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400">{totalOficiales}</span>
            <Wrench className="w-4 h-4 text-cyan-500" />
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">
            ${(technicalParameters.horaOficial || 9400).toLocaleString('es-AR')}/h
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-black uppercase text-purple-500 block mb-1">Ayudantes de Cuadrilla</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{totalAyudantes}</span>
            <Users className="w-4 h-4 text-purple-500" />
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">
            ${(technicalParameters.pagoAyudanteHora || 5500).toLocaleString('es-AR')}/h
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-black uppercase text-amber-500 block mb-1">Capataces de Obra</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{totalCapataces}</span>
            <HardHat className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">
            Líder + % Comisión
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 block mb-1">Personal Administrativo</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{totalAdministrativos}</span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-[10px] text-slate-400 font-medium mt-1 block">
            Gestión (No van a campo)
          </span>
        </div>
      </div>

      {/* Controls & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por nombre, cargo, categoría..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {(['Todos', 'Oficiales', 'Ayudantes', 'Capataz', 'Administrativo', 'Directivo'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setRoleFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                roleFilter === tab
                  ? 'bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950 shadow-xs'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab === 'Todos' ? `Todos (${workers.length})` : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Listado de Personal y Roles de Trabajo</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {filteredWorkers.length} registrados
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Haga clic en el porcentaje de un Capataz para modificarlo directamente o en "Editar" para modificar sus datos completos.
            </p>
          </div>

          {/* Quick navigation and Keyboard Controls Hint */}
          <div className="flex items-center gap-2 self-start md:self-auto bg-slate-100/80 dark:bg-slate-800/90 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono text-[10px] font-bold shadow-2xs border border-slate-200 dark:border-slate-600">
                ◄ ►
              </span>
              <span className="hidden sm:inline">Desplazamiento horizontal</span>
            </span>
            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => scrollHorizontally(-240)}
                className="px-2 py-1 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 cursor-pointer shadow-2xs transition-colors flex items-center gap-1 text-[11px] font-bold"
                title="Desplazar tabla a la izquierda (o tecla ◄)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Izquierda</span>
              </button>
              <button
                type="button"
                onClick={() => scrollHorizontally(240)}
                className="px-2 py-1 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 cursor-pointer shadow-2xs transition-colors flex items-center gap-1 text-[11px] font-bold"
                title="Desplazar tabla a la derecha (o tecla ►)"
              >
                <span className="hidden lg:inline">Derecha</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Top Synchronized Scrollbar */}
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="overflow-x-auto overflow-y-hidden bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 scrollbar-visible cursor-ew-resize"
          style={{ height: '14px' }}
          title="Barra de desplazamiento superior: deslice para navegar las columnas de la tabla"
        >
          <div style={{ width: `${tableScrollWidth}px`, height: '1px' }} />
        </div>

        {/* Main Table Container (with keyboard navigation & bottom scrollbar) */}
        <div
          ref={tableContainerRef}
          tabIndex={0}
          onKeyDown={handleTableKeyDown}
          onScroll={handleBottomScroll}
          onMouseEnter={handleMouseEnterTable}
          className="overflow-x-auto scrollbar-visible focus:outline-hidden focus:ring-2 focus:ring-cyan-500/30 transition-all"
          title="Tabla de personal: haz clic o usa las teclas ◄ ► del teclado para desplazarte"
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-black text-slate-500 dark:text-slate-400 text-[11px] tracking-wider uppercase whitespace-nowrap">
                <th className="p-3.5 sm:p-4 text-center w-24">GESTIÓN</th>
                <th className="p-3.5 sm:p-4">
                  <button
                    type="button"
                    onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                    className="flex items-center gap-2 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer group select-none font-black text-left"
                    title={`Ordenado alfabéticamente por nombre (${sortOrder === 'asc' ? 'A → Z' : 'Z → A'}). Clic para alternar.`}
                  >
                    <span>PERSONAL / EMPLEADO</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 group-hover:bg-cyan-500/20 transition-all">
                      {sortOrder === 'asc' ? <ArrowUpAZ className="w-3.5 h-3.5" /> : <ArrowDownZA className="w-3.5 h-3.5" />}
                      <span>{sortOrder === 'asc' ? 'A-Z' : 'Z-A'}</span>
                    </span>
                  </button>
                </th>
                <th className="p-3.5 sm:p-4 text-center">CATEGORÍA OPERATIVA</th>
                <th className="p-3.5 sm:p-4">CARGO ESPECÍFICO</th>
                <th className="p-3.5 sm:p-4">ROL SISTEMA</th>
                <th className="p-3.5 sm:p-4 text-center">% GANANCIA CAPATAZ</th>
                <th className="p-3.5 sm:p-4 text-center">HORA BASE ($/H)</th>
                <th className="p-3.5 sm:p-4">CUADRILLA / SEDE</th>
                <th className="p-3.5 sm:p-4">CONTACTO</th>
                <th className="p-3.5 sm:p-4 text-center">ESTADO</th>
                <th className="p-3.5 sm:p-4 text-center">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredWorkers.map(worker => {
                const isAdm = isAdministrativeProfile(worker) || (
                  ['SuperAdmin', 'Owner', 'Gerente', 'Admin'].includes(worker.role) &&
                  !worker.cargo?.toLowerCase().includes('oficial') &&
                  !worker.specialty?.toLowerCase().includes('oficial') &&
                  worker.category !== 'Oficial' &&
                  worker.category !== 'Ayudante' &&
                  worker.category !== 'Capataz'
                );
                const isCapataz = worker.role === 'Capataz';
                const isInlineEditing = inlineEditingId === worker.id;
                const currentPct = worker.capatazPercentage ?? (isCapataz ? 10 : 0);
                const displayCargo = worker.cargo || worker.specialty || (isAdm ? 'Personal Administrativo / Gestión' : isCapataz ? 'Capataz de Obra' : 'Ayudante de Cuadrilla');

                const effectiveCategory: WorkerCategory = worker.category || (
                  isAdm ? 'Administrativo' :
                  isCapataz ? 'Capataz' :
                  (displayCargo.toLowerCase().includes('oficial')) ? 'Oficial' :
                  (displayCargo.toLowerCase().includes('ayudante')) ? 'Ayudante' :
                  'Oficial'
                );

                const isProtectedRootAdmin = (worker.email || '').toLowerCase().trim() === 'admin@admin.com';
                const isRecentlyAdded = highlightedWorkerName && worker.name.toLowerCase().trim() === highlightedWorkerName;

                return (
                  <tr
                    key={worker.id}
                    className={`transition-colors ${
                      isRecentlyAdded
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/40 ring-2 ring-emerald-500/70'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Botones de Gestión (Editar y Eliminar) antes del Nombre */}
                    <td className="p-3.5 sm:p-4 text-center whitespace-nowrap w-24">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Botón Editar */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(worker)}
                          disabled={!canManage}
                          className={`p-2 rounded-xl transition-all ${
                            canManage
                              ? 'text-cyan-600 dark:text-cyan-400 hover:text-white hover:bg-cyan-600 bg-cyan-500/10 border border-cyan-500/30 cursor-pointer shadow-2xs hover:scale-105 active:scale-95'
                              : 'text-slate-400 cursor-not-allowed opacity-30 bg-slate-100 dark:bg-slate-800'
                          }`}
                          title={canManage ? `Editar datos de "${worker.name}"` : 'Permiso administrativo requerido'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Botón Eliminar */}
                        <button
                          type="button"
                          onClick={() => handleDeleteWorker(worker)}
                          disabled={!canManage || isProtectedRootAdmin}
                          className={`p-2 rounded-xl transition-all ${
                            canManage && !isProtectedRootAdmin
                              ? 'text-rose-500 hover:text-white hover:bg-rose-600 bg-rose-500/10 border border-rose-500/30 cursor-pointer shadow-2xs hover:scale-105 active:scale-95'
                              : 'text-slate-400 cursor-not-allowed opacity-30 bg-slate-100 dark:bg-slate-800'
                          }`}
                          title={
                            isProtectedRootAdmin
                              ? 'Usuario root principal (admin@admin.com) protegido contra eliminación'
                              : canManage
                                ? `Eliminar a "${worker.name}" de la nómina`
                                : 'Permiso administrativo requerido'
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                    {/* Nombre y Avatar */}
                    <td className="p-3.5 sm:p-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                            isCapataz
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : isAdm
                                ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                                : effectiveCategory === 'Oficial'
                                  ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30'
                                  : 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                          }`}
                        >
                          {worker.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-900 dark:text-white font-bold">{worker.name}</span>
                            {isRecentlyAdded && (
                              <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-500 text-white animate-pulse shadow-sm">
                                NUEVO
                              </span>
                            )}
                            {isCapataz && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                CAP
                              </span>
                            )}
                            {isAdm && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                                ADM
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-normal font-mono block">
                            {worker.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Categoría Operativa (Oficial vs Ayudante vs Capataz vs Administrativo) */}
                    <td className="p-3.5 sm:p-4 text-center whitespace-nowrap">
                      {effectiveCategory === 'Administrativo' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide uppercase bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                          <Building2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          ADMINISTRATIVO
                        </span>
                      ) : effectiveCategory === 'Oficial' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide uppercase bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                          <Wrench className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                          OFICIAL
                        </span>
                      ) : effectiveCategory === 'Ayudante' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide uppercase bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                          <Users className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          AYUDANTE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide uppercase bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                          <HardHat className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          CAPATAZ
                        </span>
                      )}
                    </td>

                    {/* Cargo Específico */}
                    <td className="p-3.5 sm:p-4 whitespace-nowrap">
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {displayCargo}
                      </span>
                    </td>

                    {/* Rol en Sistema */}
                    <td className="p-3.5 sm:p-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase ${
                          isCapataz
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                            : isAdm
                            ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                            : worker.role === 'Empleado'
                            ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                            : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                        }`}
                      >
                        {worker.role}
                      </span>
                    </td>

                    {/* % Ganancia Capataz */}
                    <td className="p-3.5 sm:p-4 text-center whitespace-nowrap">
                      {isCapataz ? (
                        isInlineEditing ? (
                          <div className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-400 p-1 rounded-xl">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={inlinePercentage}
                              onChange={e => setInlinePercentage(Number(e.target.value))}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveInlinePercentage(worker.id);
                                if (e.key === 'Escape') setInlineEditingId(null);
                              }}
                              className="w-12 px-1 text-center font-bold text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:outline-none"
                              autoFocus
                            />
                            <span className="font-bold text-amber-600 text-xs">%</span>
                            <button
                              onClick={() => handleSaveInlinePercentage(worker.id)}
                              className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                              title="Guardar porcentaje"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setInlineEditingId(null)}
                              className="p-1 rounded-md bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 text-slate-700 dark:text-slate-300 cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <button
                              onClick={() => {
                                if (!canManage) return;
                                setInlineEditingId(worker.id);
                                setInlinePercentage(currentPct);
                              }}
                              disabled={!canManage}
                              className={`group flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono font-black text-xs transition-all ${
                                canManage ? 'hover:bg-amber-500/25 cursor-pointer' : 'opacity-70 cursor-default'
                              }`}
                              title={canManage ? 'Haga clic para editar porcentaje' : 'Permiso administrativo requerido'}
                            >
                              <span>{currentPct}% de Ganancia</span>
                              {canManage && <Edit2 className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />}
                            </button>
                            <span className="text-[9px] text-slate-400 mt-0.5 font-medium">
                              s/ Costo de Servicio
                            </span>
                          </div>
                        )
                      ) : (
                        <span className="text-slate-400 text-xs italic font-medium">
                          —
                        </span>
                      )}
                    </td>

                    {/* Tarifa Hora Base ($/h) con edición rápida inline */}
                    <td className="p-3.5 sm:p-4 text-center whitespace-nowrap">
                      {inlineRateId === worker.id ? (
                        <div className="inline-flex items-center gap-1 bg-cyan-500/15 border border-cyan-400 p-1 rounded-xl shadow-xs">
                          <span className="font-bold text-cyan-600 dark:text-cyan-400 text-xs pl-1">$</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={inlineRateValue}
                            onChange={e => setInlineRateValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveInlineHourlyRate(worker.id);
                              if (e.key === 'Escape') setInlineRateId(null);
                            }}
                            className="w-20 px-1 text-center font-mono font-black text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:outline-none ring-1 ring-cyan-500"
                            autoFocus
                          />
                          <span className="text-[10px] font-bold text-slate-500">/h</span>
                          <button
                            type="button"
                            onClick={() => handleSaveInlineHourlyRate(worker.id)}
                            className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                            title="Guardar tarifa"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setInlineRateId(null)}
                            className="p-1 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-300 cursor-pointer"
                            title="Cancelar"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() => {
                            if (!canManage) return;
                            setInlineRateId(worker.id);
                            const currentRate = worker.hourlyRate !== undefined ? worker.hourlyRate : (isAdm ? 0 : isCapataz ? 11500 : (worker.cargo?.includes('Ayudante') || worker.specialty?.includes('Ayudante')) ? 5500 : 9400);
                            setInlineRateValue(String(currentRate));
                          }}
                          className={`group inline-flex items-center gap-1.5 font-mono font-bold text-slate-800 dark:text-slate-200 text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 transition-all ${
                            canManage ? 'hover:bg-cyan-500/15 dark:hover:bg-cyan-950/40 hover:border-cyan-500/40 cursor-pointer' : 'opacity-80 cursor-default'
                          }`}
                          title={canManage ? 'Haga clic para editar la tarifa $/h de este empleado' : 'Permiso administrativo requerido'}
                        >
                          <Clock className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0" />
                          <span>
                            {isAdm && (!worker.hourlyRate || worker.hourlyRate === 0)
                              ? 'Oficina ($0)'
                              : `$${(worker.hourlyRate !== undefined ? worker.hourlyRate : (isCapataz ? 11500 : (worker.cargo?.includes('Ayudante') || worker.specialty?.includes('Ayudante')) ? 5500 : 9400)).toLocaleString('es-AR')}`}
                          </span>
                          {canManage && <Edit2 className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 text-cyan-600 dark:text-cyan-400 ml-0.5 transition-opacity" />}
                        </button>
                      )}
                    </td>

                    {/* Cuadrilla / Sede */}
                    <td className="p-3.5 sm:p-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{worker.cuadrilla || 'Cuadrilla 1 - Valle de Uco'}</span>
                      </div>
                    </td>

                    {/* Contacto */}
                    <td className="p-3.5 sm:p-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      <div className="space-y-0.5 text-[11px]">
                        {worker.phone ? (
                          <div className="flex items-center gap-1 font-mono text-slate-700 dark:text-slate-300">
                            <Phone className="w-3 h-3 text-emerald-500" />
                            <span>{worker.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Sin teléfono</span>
                        )}
                        {worker.email && (
                          <div className="text-[10px] text-slate-400 truncate max-w-40">
                            {worker.email}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="p-3.5 sm:p-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => {
                          if (!canManage) return;
                          handleToggleActive(worker);
                        }}
                        disabled={!canManage}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all ${
                          canManage ? 'cursor-pointer' : 'cursor-default opacity-80'
                        } ${
                          worker.active !== false
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25'
                        }`}
                        title={canManage ? 'Haga clic para cambiar estado' : 'Estado del empleado'}
                      >
                        {worker.active !== false ? '● ACTIVO' : '○ INACTIVO'}
                      </button>
                    </td>

                    {/* Acciones */}
                    <td className="p-3.5 sm:p-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(worker)}
                          disabled={!canManage}
                          className={`p-1.5 rounded-lg transition-colors ${
                            canManage
                              ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                          }`}
                          title={canManage ? 'Editar datos del empleado' : 'Permiso administrativo requerido'}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteWorker(worker)}
                          disabled={!canManage || isProtectedRootAdmin}
                          className={`p-1.5 rounded-lg transition-colors ${
                            canManage && !isProtectedRootAdmin
                              ? 'text-rose-500 hover:text-rose-600 hover:bg-rose-500/15 cursor-pointer'
                              : 'text-slate-400 cursor-not-allowed opacity-40'
                          }`}
                          title={
                            isProtectedRootAdmin
                              ? 'Usuario root principal (admin@admin.com) protegido contra eliminación'
                              : canManage
                                ? 'Eliminar de la nómina'
                                : 'Permiso administrativo requerido'
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Navigation & Status Bar */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Navegación horizontal dual</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="hidden sm:inline">Usa la barra superior, la inferior o las teclas</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-bold border border-slate-200 dark:border-slate-600 shadow-2xs">◄</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-bold border border-slate-200 dark:border-slate-600 shadow-2xs">►</kbd>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollHorizontally(-240)}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 cursor-pointer shadow-2xs flex items-center gap-1 text-[11px] font-bold transition-colors"
              title="Desplazar tabla al inicio a la izquierda"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Inicio</span>
            </button>
            <button
              type="button"
              onClick={() => scrollHorizontally(240)}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 cursor-pointer shadow-2xs flex items-center gap-1 text-[11px] font-bold transition-colors"
              title="Desplazar tabla hacia la columna de acciones"
            >
              <span>Acciones</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Add / Edit Employee */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[94vh] overflow-y-auto space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {editingWorker ? 'Editar Empleado / Cargo' : 'Nuevo Empleado a la Nómina'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Defina nombre, cargo y porcentaje de comisión si es Capataz.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveWorker} className="space-y-4 text-xs">
              {/* Nombre Completo */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Nombre y Apellido <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Marcelo Quinteros"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              {/* Categoría: Oficial vs Ayudante vs Capataz vs Administrativo */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block font-black text-slate-900 dark:text-white text-xs">
                  Categoría del Colaborador <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCategory('Oficial');
                      if (role === 'Capataz' || role === 'Admin') setRole('Empleado');
                      setHourlyRate(technicalParameters.horaOficial || 9400);
                      if (!cargo || cargo.includes('Ayudante') || cargo.includes('Administrativ') || cargo.includes('Capataz')) setCargo('Oficial Técnico Especialista');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      category === 'Oficial' && role !== 'Capataz'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-800 dark:text-cyan-200 ring-2 ring-cyan-500/30'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs mb-1">
                      <Wrench className="w-3.5 h-3.5 text-cyan-500" />
                      <span>OFICIAL</span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono font-bold">
                      ${(technicalParameters.horaOficial || 9400).toLocaleString('es-AR')}/h
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">
                      Montaje, electromecánica
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCategory('Ayudante');
                      if (role === 'Capataz' || role === 'Admin') setRole('Empleado');
                      setHourlyRate(technicalParameters.pagoAyudanteHora || 5500);
                      if (!cargo || cargo.includes('Oficial') || cargo.includes('Administrativ') || cargo.includes('Capataz')) setCargo('Ayudante de Cuadrilla');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      category === 'Ayudante' && role !== 'Capataz'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-800 dark:text-purple-200 ring-2 ring-purple-500/30'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs mb-1">
                      <Users className="w-3.5 h-3.5 text-purple-500" />
                      <span>AYUDANTE</span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono font-bold">
                      ${(technicalParameters.pagoAyudanteHora || 5500).toLocaleString('es-AR')}/h
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">
                      Apoyo operativo en obra
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCategory('Capataz');
                      setRole('Capataz');
                      setHourlyRate(11500);
                      setCargo('Capataz de Obra');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      role === 'Capataz'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-800 dark:text-amber-200 ring-2 ring-amber-500/30'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs mb-1">
                      <HardHat className="w-3.5 h-3.5 text-amber-500" />
                      <span>CAPATAZ</span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono font-bold">
                      Líder + % Comisión
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">
                      Responsable de cuadrilla
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCategory('Administrativo');
                      if (role === 'Empleado' || role === 'Capataz') setRole('Admin');
                      setHourlyRate(0);
                      if (!cargo || cargo.includes('Oficial') || cargo.includes('Ayudante') || cargo.includes('Capataz')) {
                        setCargo('Personal Administrativo / Gestión');
                      }
                      if (!cuadrilla || cuadrilla.includes('Cuadrilla 1')) {
                        setCuadrilla('Sede Central / Administración');
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      category === 'Administrativo' && role !== 'Capataz'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-800 dark:text-blue-200 ring-2 ring-blue-500/30'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs mb-1">
                      <Building2 className="w-3.5 h-3.5 text-blue-500" />
                      <span>ADMINISTRATIVO</span>
                    </div>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 block font-bold">
                      Oficina / Gestión
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">
                      No se carga en reportes
                    </span>
                  </button>
                </div>

                {category === 'Administrativo' && (
                  <div className="mt-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-2.5">
                    <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed font-medium">
                      <strong>Perfil Administrativo / Oficina Técnica:</strong> Este colaborador queda registrado con rol administrativo. <strong>No aparecerá en los listados de técnicos ni ayudantes del Reporte de Campo</strong>, manteniendo las opciones del remito 100% operativas.
                    </p>
                  </div>
                )}
              </div>

              {/* Rol & Cargo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Rol en el Sistema
                  </label>
                  <select
                    value={role}
                    onChange={e => {
                      const newRole = e.target.value as UserRole;
                      setRole(newRole);
                      if (newRole === 'Capataz' && (!cargo || cargo.includes('Ayudante') || cargo.includes('Administrativ'))) {
                        setCargo('Capataz de Obra');
                      } else if (newRole === 'Admin' && (!cargo || cargo.includes('Ayudante') || cargo.includes('Oficial'))) {
                        setCargo('Personal Administrativo / Gestión');
                        setCategory('Administrativo');
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold cursor-pointer focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  >
                    <option value="Admin">Admin (Administrativo / Gestión)</option>
                    <option value="Gerente">Gerente Operativo</option>
                    <option value="SuperAdmin">SuperAdmin (Dirección)</option>
                    <option value="Capataz">Capataz (Líder de Obra)</option>
                    <option value="Empleado">Empleado (Técnico / Ayudante de Campo)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Cargo / Especialidad
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Capataz de Obra / Ayudante Especializado"
                    value={cargo}
                    onChange={e => setCargo(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Bloque especial si es Capataz: % Ganancia Capataz */}
              {role === 'Capataz' && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-amber-700 dark:text-amber-400 text-xs flex items-center gap-1.5">
                      <Percent className="w-4 h-4" />
                      % Ganancia Capataz (Tabla Administración Operativa)
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/20 text-amber-700 dark:text-amber-400">
                      Configuración Clave
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Indique el porcentaje que ganará este Capataz sobre el Costo de Servicio (M.O. Directa) en los remitos que lidere. Se cargará de forma automática en el Nuevo Reporte de Campo.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      required
                      value={capatazPercentage}
                      onChange={e => setCapatazPercentage(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      className="w-24 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-400 text-slate-900 dark:text-white text-center font-mono font-black text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">%</span>
                    <span className="text-[11px] text-slate-400">
                      (Por defecto 10%)
                    </span>
                  </div>
                </div>
              )}

              {/* Cuadrilla y Teléfono */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Cuadrilla / Sede
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Cuadrilla 1 - Valle de Uco"
                    value={cuadrilla}
                    onChange={e => setCuadrilla(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    placeholder="+54 9 261 455-8900"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Correo y Sueldo de Referencia */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Correo Electrónico (Opcional)
                  </label>
                  <input
                    type="email"
                    placeholder="empleado@bandiera.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Sueldo Mensual Base ($ Ref.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={salaryMonthly}
                    onChange={e => setSalaryMonthly(e.target.value === '' ? 0 : parseFloat(e.target.value.replace(',', '.')) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Tarifa Hora Base para cálculo en Auditorías y Remitos */}
              <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 space-y-1.5">
                <label className="block font-black text-cyan-800 dark:text-cyan-300 text-xs flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Tarifa Hora Base ($/h) para Auditorías y Liquidaciones
                </label>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Valor que se computa por cada hora trabajada por este operario en los remitos de campo. Si es responsable o ayudante, el sistema aplica su valor base por hora de forma automática.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="font-mono font-bold text-slate-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={hourlyRate}
                    onChange={e => setHourlyRate(e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value.replace(',', '.')) || 0))}
                    className="w-36 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-cyan-400 text-slate-900 dark:text-white font-mono font-black text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    placeholder="Ej: 6500"
                  />
                  <span className="text-slate-500 font-medium text-xs">/ hora trabajada (admite enteros y decimales)</span>
                </div>
              </div>

              {/* Estado Activo */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="worker-active-check"
                  checked={active}
                  onChange={e => setActive(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                />
                <label htmlFor="worker-active-check" className="font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                  Personal Activo (Disponible para seleccionar en Reportes de Campo)
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  {editingWorker ? 'Guardar Cambios' : 'Registrar Empleado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Import Excel */}
      {isExcelImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Importar Nómina de Personal desde Excel
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cargue su archivo de nómina en formato Excel (.xlsx / .xls)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExcelImportModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Download Prompt */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Download className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  ¿Necesitas el formato modelo? Descarga la plantilla oficial en Excel:
                </span>
              </div>
              <button
                type="button"
                onClick={downloadWorkersExcelTemplate}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-600 shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-cyan-500" />
                <span>Descargar Plantilla (.xlsx)</span>
              </button>
            </div>

            {/* File Upload Drop Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-3xl p-8 text-center bg-slate-50/50 dark:bg-slate-800/30 cursor-pointer transition-colors group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleSelectExcelFile}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                <Upload className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {excelFile ? excelFile.name : 'Haz clic para seleccionar o arrastra tu archivo Excel (.xlsx / .xls)'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Formatos compatibles: Microsoft Excel (.xlsx, .xls)
              </p>
            </div>

            {isParsingExcel && (
              <div className="flex items-center justify-center gap-2 p-4 text-xs font-bold text-slate-600 dark:text-slate-300">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                <span>Analizando registros del archivo Excel...</span>
              </div>
            )}

            {/* Parsed Preview Table with Deduplication Status */}
            {parsedExcelWorkers && parsedExcelWorkers.workers.length > 0 && excelDeduplicationSummary && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Se leyeron <strong>{parsedExcelWorkers.workers.length}</strong> registros del archivo Excel</span>
                  </span>
                </div>

                {/* Deduplication Metric Badges */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                    <div className="font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>{excelDeduplicationSummary.newCount} Nuevos Empleados</span>
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5">
                      Se darán de alta en la base de datos
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-800 dark:text-cyan-300">
                    <div className="font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-500" />
                      <span>{excelDeduplicationSummary.existingCount} Ya Existen en BD</span>
                    </div>
                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400 block mt-0.5">
                      Se actualizarán sin duplicar información
                    </span>
                  </div>
                </div>

                {/* Intelligent deduplication banner */}
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Detección anti-duplicados:</span>
                  <span>El sistema compara nombres y correos para no duplicar ningún operario existente.</span>
                </div>

                <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {excelDeduplicationSummary.analyzed.map((item, idx) => (
                    <div key={idx} className="p-2.5 px-3.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">{item.worker.name}</span>
                          {item.isExisting ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                              YA EXISTE EN BD
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              NUEVO
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="font-semibold text-cyan-600 dark:text-cyan-400">{item.worker.category || 'Ayudante'}</span>
                          <span>•</span>
                          <span>{item.worker.cargo || item.worker.specialty}</span>
                          {item.worker.capatazPercentage ? (
                            <>
                              <span>•</span>
                              <span className="text-amber-600 font-bold">{item.worker.capatazPercentage}% Ganancia</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          ${(item.worker.hourlyRate || 9400).toLocaleString('es-AR')}/h
                        </span>
                        <span className="text-[10px] text-slate-400 block">{item.worker.cuadrilla || 'Sin cuadrilla'}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Import Mode Options */}
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                  <label className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={replaceAllWorkers}
                      onChange={e => setReplaceAllWorkers(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Reemplazar nómina completa con los registros de este archivo Excel</span>
                  </label>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 ml-6">
                    {replaceAllWorkers
                      ? 'Atención: Se sustituirá la lista actual en Firebase Firestore por las filas de este Excel.'
                      : 'Modo seguro: Se actualizarán los empleados existentes que coincidan en nombre y se agregarán los nuevos.'}
                  </p>
                </div>
              </div>
            )}

            {parsedExcelWorkers?.errors && parsedExcelWorkers.errors.length > 0 && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                <span className="font-bold block mb-1">Avisos durante la lectura:</span>
                <ul className="list-disc pl-4 space-y-0.5">
                  {parsedExcelWorkers.errors.slice(0, 4).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsExcelImportModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmImportExcel}
                disabled={!parsedExcelWorkers || parsedExcelWorkers.workers.length === 0 || isImportingToFirestore}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  parsedExcelWorkers && parsedExcelWorkers.workers.length > 0 && !isImportingToFirestore
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 cursor-pointer'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isImportingToFirestore ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Guardando en Firebase...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar e Importar ({parsedExcelWorkers?.workers.length || 0})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Worker Deletion */}
      {workerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-800">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                ¿Eliminar a {workerToDelete.name}?
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Esta acción removerá el empleado de la nómina de cuadrilla y de la base de datos de forma permanente.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWorkerToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteWorker}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-500 transition cursor-pointer"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

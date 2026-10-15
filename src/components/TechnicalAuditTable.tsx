import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  Plus,
  Calendar,
  Eye,
  Trash2,
  Loader2,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ShieldAlert,
  FileSpreadsheet,
  X,
  FileText,
  User,
  Users,
  DollarSign,
  AlertTriangle,
  Info,
  Check,
  Table2,
  Keyboard,
  ArrowLeft,
  ArrowRight,
  Pencil,
  Sparkles,
  FileCheck2,
  MessageSquare,
  MessageSquareText,
  MessageSquarePlus,
  Bell,
  CheckCheck
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth, getDeletedUsersTombstone } from '../context/AuthContext';
import { TechnicalAuditRecord, GuardiaType } from '../types';
import { RemitoPasadoModal } from './RemitoPasadoModal';
import { PaymentModal } from './PaymentModal';
import { FieldReportModal } from './FieldReportModal';
import { PasarAFacturadoModal } from './PasarAFacturadoModal';
import { ActualizarDescripcionesModal } from './ActualizarDescripcionesModal';
import { RemitoMessageModal } from './RemitoMessageModal';
import { exportRemitosToExcel } from '../utils/excelParser';
import {
  calculateAuditCosts,
  calculateCapatazProfit,
  roundCurrency,
  formatCurrency,
  calculateRecordHonorarios,
  calculateCostoTotalRemito,
  isAdministrativeProfile
} from '../utils/calculationUtils';
import { EditableNumberCell, EditableTextCell, EditableDateCell } from './AuditTableEditableCells';

export interface ColumnConfig {
  id: string;
  label: string;
  defaultVisible?: boolean;
}

export const AUDIT_COLUMNS: ColumnConfig[] = [
  { id: 'semaforo', label: 'SEMÁFORO', defaultVisible: true },
  { id: 'sistema', label: 'SISTEMA', defaultVisible: true },
  { id: 'papel', label: 'PAPEL', defaultVisible: true },
  { id: 'fecha', label: 'FECHA', defaultVisible: true },
  { id: 'cliente', label: 'CLIENTE / SEDE', defaultVisible: true },
  { id: 'punto', label: 'PUNTO INTERNO', defaultVisible: true },
  { id: 'descripcion', label: 'DESCRIPCIÓN DE TAREAS', defaultVisible: true },
  { id: 'guardia', label: 'GUARDIA', defaultVisible: true },
  { id: 'hs', label: 'HS', defaultVisible: true },
  { id: 'logistica', label: 'LOGÍSTICA ($)', defaultVisible: true },
  { id: 'mo_dir', label: 'M.O. CAPATAZ ($)', defaultVisible: true },
  { id: 'costo_ayudantes', label: 'M.O. AYUDANTE ($)', defaultVisible: true },
  { id: 'mat', label: 'MAT. ($)', defaultVisible: true },
  { id: 'equipo', label: 'EQUIPO', defaultVisible: true },
  { id: 'costo_honorarios', label: 'COSTO HONORARIOS ($)', defaultVisible: true },
  { id: 'costo_total_remito', label: 'COSTO TOTAL DEL REMITO ($)', defaultVisible: true },
  { id: 'estado', label: 'ESTADO', defaultVisible: true },
  { id: 'fecha_archivo', label: 'FECHA DE ARCHIVO', defaultVisible: true },
  { id: 'acciones', label: 'ACCIONES', defaultVisible: true }
];

const STORAGE_KEY = 'bandiera_admin_table_columns_v5';

interface TechnicalAuditTableProps {
  onOpenNewReport: () => void;
}

export const TechnicalAuditTable: React.FC<TechnicalAuditTableProps> = ({ onOpenNewReport }) => {
  const {
    technicalAuditRecords,
    updateTechnicalAuditRecord,
    deleteTechnicalAuditRecord,
    bulkPassToFacturado,
    bulkSetArchived,
    workers,
    technicalParameters
  } = useData();
  const { users } = useAuth();

  // Active enabled Capataces strictly derived from users and workers in nómina
  const capatacesNomina = useMemo(() => {
    const { uids: deletedUids, emails: deletedEmails, names: deletedNames } = getDeletedUsersTombstone();
    const list: { id: string; name: string; cuadrilla?: string }[] = [];
    const seen = new Set<string>();

    workers.forEach(w => {
      const isCap = w.role === 'Capataz' || w.category === 'Capataz';
      if (!isCap || w.active === false || w.isAdministrative || isAdministrativeProfile(w)) return;
      const em = (w.email || '').toLowerCase().trim();
      const nm = (w.name || '').toLowerCase().trim();
      if (deletedUids.has(w.id) || (em && deletedEmails.has(em)) || (nm && deletedNames.has(nm))) return;
      if (seen.has(nm)) return;
      seen.add(nm);
      list.push({ id: w.id, name: w.name, cuadrilla: w.cuadrilla });
    });

    users.forEach(u => {
      const isCap = u.role === 'Capataz' || (u as any).category === 'Capataz';
      if (!isCap || u.active === false || u.isAdministrative || isAdministrativeProfile(u)) return;
      const em = (u.email || '').toLowerCase().trim();
      const nm = (u.displayName || '').toLowerCase().trim();
      if (deletedUids.has(u.uid) || (em && deletedEmails.has(em)) || (nm && deletedNames.has(nm))) return;
      if (seen.has(nm)) return;
      seen.add(nm);
      list.push({ id: u.uid, name: u.displayName, cuadrilla: u.cuadrilla });
    });

    return list;
  }, [workers, users]);

  // Visible Columns state with localStorage persistence
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Columna nueva "Fecha de archivo": se agrega una sola vez a quienes ya tenían una selección guardada
          const ARCHIVE_COL_FLAG = `${STORAGE_KEY}_fecha_archivo_agregada`;
          if (!parsed.includes('fecha_archivo') && !localStorage.getItem(ARCHIVE_COL_FLAG)) {
            localStorage.setItem(ARCHIVE_COL_FLAG, '1');
            return [...parsed, 'fecha_archivo'];
          }
          return parsed;
        }
      }
      // Migrate from v2 if available
      const savedV2 = localStorage.getItem('bandiera_admin_table_columns_v2');
      if (savedV2) {
        const parsedV2 = JSON.parse(savedV2);
        if (Array.isArray(parsedV2) && parsedV2.length > 0) {
          const migrated = [...parsedV2];
          if (!migrated.includes('costo_honorarios')) migrated.push('costo_honorarios');
          if (!migrated.includes('costo_total_remito')) migrated.push('costo_total_remito');
          return migrated.filter(id => id !== 'costo_op' && id !== 'facturado' && id !== 'pago_tec');
        }
      }
    } catch {}
    return AUDIT_COLUMNS.filter(c => c.defaultVisible !== false).map(c => c.id);
  });

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
    } catch {}
  }, [visibleColumns]);

  // Column picker popover state (matches user image 2)
  const [isVistaOpen, setIsVistaOpen] = useState(false);
  const [isUpdateDescModalOpen, setIsUpdateDescModalOpen] = useState(false);
  const vistaRef = useRef<HTMLDivElement | null>(null);

  // Close vista dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (vistaRef.current && !vistaRef.current.contains(e.target as Node)) {
        setIsVistaOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isColVisible = (colId: string) => {
    if (colId === 'mo_dir' || colId === 'mo_capataz') {
      return visibleColumns.includes('mo_dir') || visibleColumns.includes('mo_capataz');
    }
    if (colId === 'costo_ayudantes' || colId === 'mo_ayudante') {
      return visibleColumns.includes('costo_ayudantes') || visibleColumns.includes('mo_ayudante');
    }
    if (colId === 'costo_honorarios' || colId === 'honorarios') {
      return visibleColumns.includes('costo_honorarios') || visibleColumns.includes('honorarios');
    }
    if (colId === 'costo_total_remito') {
      return visibleColumns.includes('costo_total_remito');
    }
    return visibleColumns.includes(colId);
  };

  const toggleColumn = (colId: string) => {
    setVisibleColumns(prev => {
      if (prev.includes(colId)) {
        // Prevent hiding all columns
        if (prev.length <= 1) return prev;
        return prev.filter(id => id !== colId);
      } else {
        return [...prev, colId];
      }
    });
  };

  const handleShowAllColumns = () => {
    setVisibleColumns(AUDIT_COLUMNS.map(c => c.id));
  };

  const handleResetColumns = () => {
    setVisibleColumns(AUDIT_COLUMNS.filter(c => c.defaultVisible !== false).map(c => c.id));
  };

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGuardia, setFilterGuardia] = useState<'all' | 'guardia' | 'ordinario'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterSemaforo, setFilterSemaforo] = useState<'all' | 'verde' | 'naranja' | 'rojo' | 'neutro'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Multi-selection state for batch remitos consolidation & actions
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [remitoPasadoRecords, setRemitoPasadoRecords] = useState<TechnicalAuditRecord[]>([]);

  // Unique client names list
  const clientNames = useMemo(() => {
    return Array.from(new Set(technicalAuditRecords.map(r => r.clientName).filter(Boolean))).sort();
  }, [technicalAuditRecords]);

  // Selected records list and totals
  const selectedRecordsList = useMemo(() => {
    return technicalAuditRecords.filter(r => selectedRecordIds.includes(r.id));
  }, [technicalAuditRecords, selectedRecordIds]);

  const selectedDistinctClients = useMemo(() => {
    return Array.from(new Set(selectedRecordsList.map(r => r.clientName).filter(Boolean)));
  }, [selectedRecordsList]);

  const selectedTotalServicios = useMemo(() => {
    return roundCurrency(
      selectedRecordsList.reduce(
        (sum, r) => sum + ((r.billedPrice > 0 ? r.billedPrice : (r.suggestedPrice || r.laborDirectCost || 0)) || 0),
        0
      )
    );
  }, [selectedRecordsList]);

  const selectedTotalMateriales = useMemo(() => {
    return roundCurrency(
      selectedRecordsList.reduce(
        (sum, r) => sum + (r.materialsCost || 0),
        0
      )
    );
  }, [selectedRecordsList]);

  const selectedTotalFinal = useMemo(() => {
    return roundCurrency(selectedTotalServicios + selectedTotalMateriales);
  }, [selectedTotalServicios, selectedTotalMateriales]);

  // Active color picker popover id
  const [activePickerId, setActivePickerId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  // Close picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setActivePickerId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pagination & Sheet Management (10, 20, 50, 100 respuestas para achicar alto de tabla)
  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('bandiera_table_items_per_page');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if ([10, 20, 50, 100].includes(parsed)) return parsed;
      }
    } catch {}
    return 20; // Default 20 para achicar el alto y brindar equilibrio óptimo
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpToPageInput, setJumpToPageInput] = useState('');

  // Table horizontal scrolling, top runner, bottom sticky runner & keyboard navigation refs
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingTop = useRef(false);
  const isSyncingTable = useRef(false);
  const isSyncingBottom = useRef(false);
  const isTableHoveredRef = useRef(false);
  const [contentScrollWidth, setContentScrollWidth] = useState(1600);

  // Message Modal state for persistent remarks with blinking alerts
  const [activeMessageRecord, setActiveMessageRecord] = useState<TechnicalAuditRecord | null>(null);

  const handleOpenMessage = (record: TechnicalAuditRecord) => {
    setActiveMessageRecord(record);
  };

  const handleSaveMessage = (recordId: string, message: string, messageRead: boolean) => {
    updateTechnicalAuditRecord(recordId, {
      message,
      messageRead,
      messageDate: new Date().toISOString()
    });
    setToastMessage(message ? (messageRead ? 'Mensaje guardado y marcado como leído' : 'Mensaje guardado (activo/titilando)') : 'Mensaje eliminado');
    setTimeout(() => setToastMessage(null), 3500);
    setActiveMessageRecord(null);
  };

  // Selected Record for Detail View Modal
  const [selectedRecord, setSelectedRecord] = useState<TechnicalAuditRecord | null>(null);

  // Remito Pasado Printable Modal state
  const [remitoPasadoRecord, setRemitoPasadoRecord] = useState<TechnicalAuditRecord | null>(null);

  // Payment Modal state for Cobrado
  const [paymentRecord, setPaymentRecord] = useState<TechnicalAuditRecord | null>(null);

  // Full Edit Mode (FieldReportModal with recordToEdit)
  const [recordToEdit, setRecordToEdit] = useState<TechnicalAuditRecord | null>(null);

  // Pasar a Facturado Modal state
  const [facturarRecord, setFacturarRecord] = useState<TechnicalAuditRecord | null>(null);
  const [facturarRecords, setFacturarRecords] = useState<TechnicalAuditRecord[]>([]);

  // Delete Confirmation Modal state (In-app modal to replace blocked iframe window.confirm)
  const [recordToDelete, setRecordToDelete] = useState<TechnicalAuditRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Handle in-app delete confirmation
  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    const remitoId = recordToDelete.remitoId;
    const recordId = recordToDelete.id;
    setIsDeleting(true);
    try {
      deleteTechnicalAuditRecord(recordId);
      setToastMessage(`Reporte ${remitoId} eliminado correctamente.`);
      setTimeout(() => {
        setToastMessage(null);
      }, 4000);
    } catch (err) {
      console.error('Error deleting technical audit record:', err);
    } finally {
      setIsDeleting(false);
      setRecordToDelete(null);
    }
  };

  // Determine effective semáforo
  const getEffectiveSemaforo = (record: TechnicalAuditRecord): 'verde' | 'naranja' | 'rojo' | 'neutro' => {
    if (record.semaforo) return record.semaforo;
    if (record.status === 'Cobrado') return 'verde';
    if (record.status === 'Facturado') return 'naranja';
    if (record.status === 'Pasado') return 'naranja';
    if (record.status === 'Cargado') return 'rojo';
    return 'neutro';
  };

  // Cycle semáforo on single click
  const handleCycleSemaforo = (id: string, current: 'verde' | 'naranja' | 'rojo' | 'neutro') => {
    const sequence: ('neutro' | 'verde' | 'naranja' | 'rojo')[] = ['neutro', 'verde', 'naranja', 'rojo'];
    const currentIndex = sequence.indexOf(current);
    const next = sequence[(currentIndex + 1) % sequence.length];
    updateTechnicalAuditRecord(id, { semaforo: next });
  };

  // Set explicit semáforo
  const handleSetSemaforo = (id: string, color: 'verde' | 'naranja' | 'rojo' | 'neutro') => {
    updateTechnicalAuditRecord(id, { semaforo: color });
    setActivePickerId(null);
  };

  // Format date as DD/MM/YY (matches 31/08/26 from screenshot)
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`;
    }
    return dateStr;
  };

  // Filtros de la tabla. En la lista, los archivados se ocultan salvo al buscar o filtrar por "Archivado".
  // En la exportación a Excel los archivados siempre se incluyen (salvo que se filtre por otro estado).
  const filterAuditRecords = (forExport: boolean) => {
    return technicalAuditRecords.filter(record => {
      // Search
      const matchesSearch =
        !searchTerm ||
        record.remitoId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (record.remitoPapel && record.remitoPapel.toLowerCase().includes(searchTerm.toLowerCase())) ||
        record.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.siteLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.workPoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.leadTech.toLowerCase().includes(searchTerm.toLowerCase());

      // Guardia
      const matchesGuardia =
        filterGuardia === 'all' ||
        (filterGuardia === 'guardia' && record.isGuardia) ||
        (filterGuardia === 'ordinario' && !record.isGuardia);

      // Status. "Archivado" es un paso posterior a Cobrado: el remito conserva status "Cobrado".
      const matchesStatus =
        filterStatus === 'all' || filterStatus === 'Archivado' || record.status === filterStatus;

      // Archivados: se ocultan de la lista normal, pero siempre aparecen al buscar o al filtrar por "Archivado"
      const matchesArchive =
        filterStatus === 'Archivado'
          ? Boolean(record.archivado)
          : forExport || Boolean(searchTerm) || !record.archivado;

      // Client
      const matchesClient =
        filterClient === 'all' || record.clientName === filterClient;

      // Semáforo
      const effectiveSem = getEffectiveSemaforo(record);
      const matchesSemaforo =
        filterSemaforo === 'all' || effectiveSem === filterSemaforo;

      // Date Range
      const matchesStart = !startDate || record.date >= startDate;
      const matchesEnd = !endDate || record.date <= endDate;

      return matchesSearch && matchesGuardia && matchesStatus && matchesArchive && matchesClient && matchesSemaforo && matchesStart && matchesEnd;
    });
  };

  // Filtered Records
  const filteredRecords = useMemo(
    () => filterAuditRecords(false),
    [technicalAuditRecords, searchTerm, filterGuardia, filterStatus, filterClient, filterSemaforo, startDate, endDate]
  );

  // Semáforo counts
  const semaforoCounts = useMemo(() => {
    let verde = 0;
    let naranja = 0;
    let rojo = 0;
    let neutro = 0;
    technicalAuditRecords.forEach(r => {
      const s = getEffectiveSemaforo(r);
      if (s === 'verde') verde++;
      else if (s === 'naranja') naranja++;
      else if (s === 'rojo') rojo++;
      else neutro++;
    });
    return { verde, naranja, rojo, neutro, total: technicalAuditRecords.length };
  }, [technicalAuditRecords]);

  // Dynamic calculation of sheets (Hojas) based on itemsPerPage
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage));

  // Keep currentPage valid when records count or itemsPerPage changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const handleItemsPerPageChange = (val: number) => {
    setItemsPerPage(val);
    setCurrentPage(1);
    try {
      localStorage.setItem('bandiera_table_items_per_page', val.toString());
    } catch {}
  };

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpToPageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setJumpToPageInput('');
    }
  };

  const currentRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  // Sync scroll width between top runner and table container
  useEffect(() => {
    const updateWidth = () => {
      if (tableScrollRef.current) {
        setContentScrollWidth(tableScrollRef.current.scrollWidth);
      }
    };
    updateWidth();
    const timer = setTimeout(updateWidth, 120);
    window.addEventListener('resize', updateWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateWidth);
    };
  }, [visibleColumns, currentRecords]);

  // Sync top scrollbar with table container and bottom scrollbar
  const handleTopScroll = () => {
    if (isSyncingTop.current) return;
    isSyncingTable.current = true;
    if (tableScrollRef.current && topScrollRef.current) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    if (bottomScrollRef.current && topScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingTable.current = false;
    });
  };

  // Sync table container with top and bottom scrollbars
  const handleTableScroll = () => {
    if (isSyncingTable.current) return;
    isSyncingTop.current = true;
    if (topScrollRef.current && tableScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
    if (bottomScrollRef.current && tableScrollRef.current) {
      bottomScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingTop.current = false;
    });
  };

  // Sync bottom floating scrollbar with table and top scrollbars
  const handleBottomScroll = () => {
    if (isSyncingBottom.current) return;
    isSyncingTable.current = true;
    if (tableScrollRef.current && bottomScrollRef.current) {
      tableScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingTable.current = false;
    });
  };

  // Direct programmatic scroll function
  const scrollTableBy = (deltaX: number, deltaY: number = 0) => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollBy({ left: deltaX, top: deltaY, behavior: 'smooth' });
    }
  };

  // Keyboard navigation for arrow keys: Left, Right, Up, Down, PageUp, PageDown, Home, End
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (['INPUT', 'SELECT', 'TEXTAREA'].includes(activeEl.tagName) || activeEl.isContentEditable)
      ) {
        return;
      }

      const isFocusedInTable = tableScrollRef.current && tableScrollRef.current.contains(document.activeElement);
      if (!isTableHoveredRef.current && !isFocusedInTable) {
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        scrollTableBy(220, 0);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        scrollTableBy(-220, 0);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollTableBy(0, 100);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollTableBy(0, -100);
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        if (e.shiftKey) {
          scrollTableBy(500, 0);
        } else {
          setCurrentPage(prev => Math.min(totalPages, prev + 1));
        }
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        if (e.shiftKey) {
          scrollTableBy(-500, 0);
        } else {
          setCurrentPage(prev => Math.max(1, prev - 1));
        }
      } else if (e.key === 'Home' && !e.ctrlKey) {
        e.preventDefault();
        tableScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
      } else if (e.key === 'End' && !e.ctrlKey) {
        e.preventDefault();
        if (tableScrollRef.current) {
          tableScrollRef.current.scrollTo({ left: tableScrollRef.current.scrollWidth, behavior: 'smooth' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalPages]);

  // Smart page numbers calculation
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  // Export to Excel (.xlsx) with ONLY visible columns
  const handleExportExcel = () => {
    // El estado de cada remito (y la fecha de archivo) siempre figuran en el Excel, aunque la columna esté oculta en pantalla.
    const dataColumns = Array.from(new Set([...visibleColumns.filter(c => c !== 'acciones'), 'estado', 'fecha_archivo']));
    exportRemitosToExcel(filterAuditRecords(true), 'Auditoria_Tecnica_Bandiera', dataColumns);
  };

  // Archivar en bloque (cobrados que se ven con los filtros actuales) y desarchivar
  const archivableVisible = filteredRecords.filter(r => r.status === 'Cobrado' && !r.archivado);
  const archivedVisible = filteredRecords.filter(r => r.archivado);

  const handleBulkArchive = async (records: TechnicalAuditRecord[], archive: boolean) => {
    if (records.length === 0) return;
    const accion = archive ? 'archivarán' : 'desarchivarán';
    const detalle = archive
      ? 'Seguirán disponibles en la búsqueda y en el filtro "Archivado", y se pueden desarchivar cuando quiera.'
      : 'Vuelven a la lista de Cobrados.';
    if (!window.confirm(`Se ${accion} ${records.length} ${records.length === 1 ? 'remito' : 'remitos'}. ${detalle} ¿Continuar?`)) return;
    const changed = await bulkSetArchived(records.map(r => r.id), archive);
    setSelectedRecordIds(prev => prev.filter(id => !records.some(r => r.id === id)));
    setToastMessage(
      archive
        ? `${changed} ${changed === 1 ? 'remito archivado' : 'remitos archivados'}. Siguen disponibles en la búsqueda.`
        : `${changed} ${changed === 1 ? 'remito desarchivado' : 'remitos desarchivados'}.`
    );
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleStatusChange = (id: string, newStatus: 'Cargado' | 'Facturado' | 'Pasado' | 'Cobrado' | 'Archivado') => {
    const record = technicalAuditRecords.find(r => r.id === id);
    if (!record) return;

    // Paso extra: archivar un remito ya cobrado. Sigue en la búsqueda y en el filtro "Archivado".
    if (newStatus === 'Archivado') {
      if (record.status !== 'Cobrado') return;
      updateTechnicalAuditRecord(id, {
        archivado: true,
        fechaArchivado: new Date().toISOString().split('T')[0]
      });
      setToastMessage(`Remito ${record.remitoId} archivado. Sigue disponible en la búsqueda y en el filtro "Archivado".`);
      setTimeout(() => setToastMessage(null), 4500);
      return;
    }

    // Volver atrás desde Archivado: vuelve a la lista de Cobrados (o al estado elegido)
    if (record.archivado) {
      updateTechnicalAuditRecord(id, { archivado: false, fechaArchivado: '' });
      if (newStatus === 'Cobrado') {
        setToastMessage(`Remito ${record.remitoId} desarchivado: vuelve a Cobrado.`);
        setTimeout(() => setToastMessage(null), 3500);
        return;
      }
    }

    if (newStatus === 'Cobrado') {
      setPaymentRecord(record);
      return;
    }

    if (newStatus === 'Pasado') {
      const basePrice = record.billedPrice > 0 ? record.billedPrice : record.suggestedPrice;
      const updatedPrice = record.status !== 'Pasado' ? Math.round(basePrice * 1.07) : basePrice;
      updateTechnicalAuditRecord(id, { status: 'Pasado', semaforo: 'naranja', billedPrice: updatedPrice });
      return;
    }

    if (newStatus === 'Facturado') {
      setFacturarRecord(record);
      return;
    }

    updateTechnicalAuditRecord(id, { status: newStatus, semaforo: 'rojo' });
  };

  // Helper to determine the profit margin percentage of a record (either explicit or implicit from billed/operatingCost)
  const getRecordMarginPercentage = (record: TechnicalAuditRecord): number => {
    if (record.marginPercentage !== undefined && !isNaN(Number(record.marginPercentage)) && Number(record.marginPercentage) >= 0) {
      return Number(record.marginPercentage);
    }
    if (record.billedPrice > 0 && (record.operatingCost || 0) > 0) {
      const implicit = Math.round(((record.billedPrice - (record.operatingCost || 0)) / (record.operatingCost || 1)) * 100);
      if (implicit >= 0 && implicit <= 300) {
        return implicit;
      }
    }
    return technicalParameters.defaultMarginPercentage ?? 35;
  };

  // Helper to calculate new suggestedPrice and billedPrice (Facturado) when any table field changes
  const calculateNewBilledPrice = (record: TechnicalAuditRecord, newOperatingCost: number) => {
    const marginPct = getRecordMarginPercentage(record);
    const suggested = roundCurrency(newOperatingCost * (1 + marginPct / 100));
    let finalBilled = suggested;
    if (record.status === 'Pasado') {
      finalBilled = roundCurrency(suggested * 1.07);
    }
    return {
      billedPrice: finalBilled,
      suggestedPrice: suggested,
      marginPercentage: marginPct
    };
  };

  const getRecordHonorarios = (record: TechnicalAuditRecord): number => {
    return calculateRecordHonorarios(record, technicalParameters.defaultMarginPercentage ?? 35);
  };

  const getRecordCostoTotalRemito = (record: TechnicalAuditRecord): number => {
    return calculateCostoTotalRemito(record, technicalParameters.defaultMarginPercentage ?? 35);
  };

  // Automated calculation & persistent updating per operator base hourly rate
  const handleUpdateHours = (record: TechnicalAuditRecord, newHours: number) => {
    const costs = calculateAuditCosts(technicalParameters, {
      hoursWorked: newHours,
      travelHours: record.travelHours ?? 1,
      viajes: record.viajes,
      distanceKm: record.distanceKm ?? 0,
      isGuardia: record.isGuardia,
      guardiaType: record.guardiaType,
      guardiaMode: record.guardiaMode,
      guardiaAmount: record.guardiaAmount,
      guardiaSubtype: record.guardiaSubtype,
      helpersCount: record.teamMembers?.length || record.helpers?.length || 0,
      materialsCost: record.materialsCost || 0,
      leadTechName: record.leadTech,
      helperNames: record.helpers,
      teamMembers: record.teamMembers,
      workers,
      users
    });

    const cleanBaseCosts = roundCurrency((record.logisticsCost || 0) + costs.laborDirectCost + (record.materialsCost || 0));
    const capatazCommissionPct = record.capatazCommissionPct ?? 10;
    const capatazProfit = calculateCapatazProfit(costs.laborDirectCost, capatazCommissionPct);
    const honorarios = getRecordHonorarios(record);
    const newTotal = roundCurrency(cleanBaseCosts + honorarios);
    const newMargin = cleanBaseCosts > 0 ? Math.round((honorarios / cleanBaseCosts) * 100) : record.marginPercentage;

    updateTechnicalAuditRecord(record.id, {
      hoursWorked: newHours,
      techPay: costs.techPay,
      helperPay: costs.helperPay,
      laborDirectCost: costs.laborDirectCost,
      operatingCost: cleanBaseCosts,
      honorarios,
      suggestedPrice: newTotal,
      billedPrice: newTotal,
      marginPercentage: newMargin,
      capatazProfit,
      collectedPrice: record.status === 'Cobrado' ? newTotal : record.collectedPrice
    });
  };

  const handleToggleGuardia = (record: TechnicalAuditRecord) => {
    const nextGuardia = !record.isGuardia;
    const nextGuardiaType: GuardiaType = nextGuardia ? 'GUARDIA_50' : 'NO_GUARDIA';

    const costs = calculateAuditCosts(technicalParameters, {
      hoursWorked: record.hoursWorked ?? 4,
      travelHours: record.travelHours ?? 1,
      viajes: record.viajes,
      distanceKm: record.distanceKm ?? 0,
      isGuardia: nextGuardia,
      guardiaType: nextGuardiaType,
      guardiaMode: record.guardiaMode,
      guardiaAmount: record.guardiaAmount,
      guardiaSubtype: record.guardiaSubtype,
      helpersCount: record.teamMembers?.length || record.helpers?.length || 0,
      materialsCost: record.materialsCost || 0,
      leadTechName: record.leadTech,
      helperNames: record.helpers,
      teamMembers: record.teamMembers,
      workers,
      users
    });

    const cleanBaseCosts = roundCurrency((record.logisticsCost || 0) + costs.laborDirectCost + (record.materialsCost || 0));
    const capatazCommissionPct = record.capatazCommissionPct ?? 10;
    const capatazProfit = calculateCapatazProfit(costs.laborDirectCost, capatazCommissionPct);
    const honorarios = getRecordHonorarios(record);
    const newTotal = roundCurrency(cleanBaseCosts + honorarios);
    const newMargin = cleanBaseCosts > 0 ? Math.round((honorarios / cleanBaseCosts) * 100) : record.marginPercentage;

    updateTechnicalAuditRecord(record.id, {
      isGuardia: nextGuardia,
      guardiaType: nextGuardiaType,
      techPay: costs.techPay,
      helperPay: costs.helperPay,
      laborDirectCost: costs.laborDirectCost,
      operatingCost: cleanBaseCosts,
      honorarios,
      suggestedPrice: newTotal,
      billedPrice: newTotal,
      marginPercentage: newMargin,
      capatazProfit,
      collectedPrice: record.status === 'Cobrado' ? newTotal : record.collectedPrice
    });
  };

  const handleUpdateMaterials = (record: TechnicalAuditRecord, newMaterialsCost: number) => {
    const cleanMaterials = roundCurrency(newMaterialsCost);
    const cleanLabor = record.laborDirectCost ?? ((record.techPay || 0) + (record.helperPay || 0));
    const cleanBaseCosts = roundCurrency((record.logisticsCost || 0) + cleanLabor + cleanMaterials);
    const honorarios = getRecordHonorarios(record);
    const newTotal = roundCurrency(cleanBaseCosts + honorarios);
    const newMargin = cleanBaseCosts > 0 ? Math.round((honorarios / cleanBaseCosts) * 100) : record.marginPercentage;

    updateTechnicalAuditRecord(record.id, {
      materialsCost: cleanMaterials,
      operatingCost: cleanBaseCosts,
      honorarios,
      suggestedPrice: newTotal,
      billedPrice: newTotal,
      marginPercentage: newMargin,
      collectedPrice: record.status === 'Cobrado' ? newTotal : record.collectedPrice
    });
  };

  const handleUpdateLogistics = (record: TechnicalAuditRecord, newLogisticsCost: number) => {
    const cleanLogistics = roundCurrency(newLogisticsCost);
    const cleanLabor = record.laborDirectCost ?? ((record.techPay || 0) + (record.helperPay || 0));
    const cleanBaseCosts = roundCurrency(cleanLogistics + cleanLabor + (record.materialsCost || 0));
    const honorarios = getRecordHonorarios(record);
    const newTotal = roundCurrency(cleanBaseCosts + honorarios);
    const newMargin = cleanBaseCosts > 0 ? Math.round((honorarios / cleanBaseCosts) * 100) : record.marginPercentage;

    updateTechnicalAuditRecord(record.id, {
      logisticsCost: cleanLogistics,
      operatingCost: cleanBaseCosts,
      honorarios,
      suggestedPrice: newTotal,
      billedPrice: newTotal,
      marginPercentage: newMargin,
      collectedPrice: record.status === 'Cobrado' ? newTotal : record.collectedPrice
    });
  };

  // M.O. Capataz: el valor de las horas trabajadas por el oficial
  const handleUpdateMOCapataz = (record: TechnicalAuditRecord, newTechPay: number) => {
    const cleanTechPay = roundCurrency(newTechPay);
    const cleanHelperPay = roundCurrency(record.helperPay || 0);
    const cleanLaborDirect = roundCurrency(cleanTechPay + cleanHelperPay);
    const cleanBaseCosts = roundCurrency((record.logisticsCost || 0) + cleanLaborDirect + (record.materialsCost || 0));
    const capatazCommissionPct = record.capatazCommissionPct ?? 10;
    const capatazProfit = calculateCapatazProfit(cleanLaborDirect, capatazCommissionPct);
    const honorarios = getRecordHonorarios(record);
    const newTotal = roundCurrency(cleanBaseCosts + honorarios);
    const newMargin = cleanBaseCosts > 0 ? Math.round((honorarios / cleanBaseCosts) * 100) : record.marginPercentage;

    updateTechnicalAuditRecord(record.id, {
      techPay: cleanTechPay,
      laborDirectCost: cleanLaborDirect,
      operatingCost: cleanBaseCosts,
      honorarios,
      suggestedPrice: newTotal,
      billedPrice: newTotal,
      marginPercentage: newMargin,
      capatazProfit,
      collectedPrice: record.status === 'Cobrado' ? newTotal : record.collectedPrice
    });
  };

  // M.O. Ayudante: el valor de las horas trabajadas por el ayudante
  const handleUpdateMOAyudante = (record: TechnicalAuditRecord, newHelperPay: number) => {
    const cleanHelperPay = roundCurrency(newHelperPay);
    const cleanTechPay = roundCurrency(record.techPay || 0);
    const cleanLaborDirect = roundCurrency(cleanTechPay + cleanHelperPay);
    const cleanBaseCosts = roundCurrency((record.logisticsCost || 0) + cleanLaborDirect + (record.materialsCost || 0));
    const capatazCommissionPct = record.capatazCommissionPct ?? 10;
    const capatazProfit = calculateCapatazProfit(cleanLaborDirect, capatazCommissionPct);
    const honorarios = getRecordHonorarios(record);
    const newTotal = roundCurrency(cleanBaseCosts + honorarios);
    const newMargin = cleanBaseCosts > 0 ? Math.round((honorarios / cleanBaseCosts) * 100) : record.marginPercentage;

    updateTechnicalAuditRecord(record.id, {
      helperPay: cleanHelperPay,
      laborDirectCost: cleanLaborDirect,
      operatingCost: cleanBaseCosts,
      honorarios,
      suggestedPrice: newTotal,
      billedPrice: newTotal,
      marginPercentage: newMargin,
      capatazProfit,
      collectedPrice: record.status === 'Cobrado' ? newTotal : record.collectedPrice
    });
  };

  // Costo Honorarios: valor que nosotros ponemos de ganancia
  const handleUpdateHonorarios = (record: TechnicalAuditRecord, newHonorarios: number) => {
    const cleanHonorarios = Math.max(0, roundCurrency(newHonorarios));
    const cleanLabor = record.laborDirectCost ?? ((record.techPay || 0) + (record.helperPay || 0));
    const baseCosts = roundCurrency(
      (record.logisticsCost || 0) +
      cleanLabor +
      (record.materialsCost || 0)
    );
    const newTotal = roundCurrency(baseCosts + cleanHonorarios);
    const newMargin = baseCosts > 0 ? Math.round((cleanHonorarios / baseCosts) * 100) : 0;

    updateTechnicalAuditRecord(record.id, {
      honorarios: cleanHonorarios,
      suggestedPrice: newTotal,
      billedPrice: newTotal,
      marginPercentage: newMargin,
      collectedPrice: record.status === 'Cobrado' ? newTotal : record.collectedPrice
    });
  };

  // Costo total del remito: es la suma de todo lo otro
  const handleUpdateCostoTotalRemito = (record: TechnicalAuditRecord, newTotal: number) => {
    const cleanTotal = Math.max(0, roundCurrency(newTotal));
    const cleanLabor = record.laborDirectCost ?? ((record.techPay || 0) + (record.helperPay || 0));
    const baseCosts = roundCurrency(
      (record.logisticsCost || 0) +
      cleanLabor +
      (record.materialsCost || 0)
    );
    const newHonorarios = Math.max(0, roundCurrency(cleanTotal - baseCosts));
    const newMargin = baseCosts > 0 ? Math.round((newHonorarios / baseCosts) * 100) : 0;

    updateTechnicalAuditRecord(record.id, {
      honorarios: newHonorarios,
      billedPrice: cleanTotal,
      suggestedPrice: cleanTotal,
      marginPercentage: newMargin,
      collectedPrice: record.status === 'Cobrado' ? cleanTotal : record.collectedPrice
    });
  };

  const handleUpdateLaborDirect = (record: TechnicalAuditRecord, newLaborCost: number) => {
    handleUpdateMOCapataz(record, newLaborCost);
  };

  const handleUpdateHelperPay = (record: TechnicalAuditRecord, newHelperPay: number) => {
    handleUpdateMOAyudante(record, newHelperPay);
  };

  const handleUpdateTechPay = (record: TechnicalAuditRecord, newTechPay: number) => {
    handleUpdateMOCapataz(record, newTechPay);
  };

  const handleUpdateOperatingCost = (record: TechnicalAuditRecord, newOperatingCost: number) => {
    const cleanOperatingCost = roundCurrency(newOperatingCost);
    const { billedPrice, suggestedPrice, marginPercentage } = calculateNewBilledPrice(record, cleanOperatingCost);
    updateTechnicalAuditRecord(record.id, {
      operatingCost: cleanOperatingCost,
      suggestedPrice,
      billedPrice,
      marginPercentage,
      collectedPrice: record.status === 'Cobrado' ? billedPrice : record.collectedPrice
    });
  };

  const handleUpdateBilled = (record: TechnicalAuditRecord, newBilledPrice: number) => {
    handleUpdateCostoTotalRemito(record, newBilledPrice);
  };

  const handleUpdateLeadTech = (record: TechnicalAuditRecord, newLeadTech: string) => {
    const costs = calculateAuditCosts(technicalParameters, {
      hoursWorked: record.hoursWorked ?? 4,
      travelHours: record.travelHours ?? 1,
      viajes: record.viajes,
      distanceKm: record.distanceKm ?? 0,
      isGuardia: record.isGuardia,
      guardiaType: record.guardiaType,
      guardiaMode: record.guardiaMode,
      guardiaAmount: record.guardiaAmount,
      guardiaSubtype: record.guardiaSubtype,
      helpersCount: record.teamMembers?.length || record.helpers?.length || 0,
      materialsCost: record.materialsCost || 0,
      leadTechName: newLeadTech,
      helperNames: record.helpers,
      teamMembers: record.teamMembers,
      workers,
      users
    });

    const isCapatazLead = workers.some(w => w.name.toLowerCase() === newLeadTech.toLowerCase() && (w.role === 'Capataz' || w.category === 'Capataz')) || users.some(u => u.displayName.toLowerCase() === newLeadTech.toLowerCase() && (u.role === 'Capataz' || (u as any).category === 'Capataz'));
    const matchedWorker = workers.find(w => w.name.toLowerCase() === newLeadTech.toLowerCase());
    const matchedUser = users.find(u => u.displayName.toLowerCase() === newLeadTech.toLowerCase());
    const defaultPct = (newLeadTech.toLowerCase().includes('morales') || newLeadTech.toLowerCase().includes('quinteros')) ? 20 : 25;
    const capatazCommissionPct = isCapatazLead ? (matchedWorker?.capatazPercentage ?? matchedUser?.capatazPercentage ?? defaultPct) : undefined;
    const capatazProfit = isCapatazLead && capatazCommissionPct !== undefined ? calculateCapatazProfit(costs.laborDirectCost, capatazCommissionPct) : undefined;
    const cleanBaseCosts = roundCurrency((record.logisticsCost || 0) + costs.laborDirectCost + (record.materialsCost || 0));
    const honorarios = getRecordHonorarios(record);
    const newTotal = roundCurrency(cleanBaseCosts + honorarios);
    const newMargin = cleanBaseCosts > 0 ? Math.round((honorarios / cleanBaseCosts) * 100) : record.marginPercentage;

    updateTechnicalAuditRecord(record.id, {
      leadTech: newLeadTech,
      techPay: costs.techPay,
      laborDirectCost: costs.laborDirectCost,
      operatingCost: cleanBaseCosts,
      honorarios,
      suggestedPrice: newTotal,
      billedPrice: newTotal,
      marginPercentage: newMargin,
      capatazCommissionPct,
      capatazProfit,
      collectedPrice: record.status === 'Cobrado' ? newTotal : record.collectedPrice
    });
  };

  // Live totals for visible current page records (displayed in sticky floating bottom bar)
  const tableTotals = useMemo(() => {
    let hs = 0;
    let logistica = 0;
    let moCapataz = 0;
    let moAyudante = 0;
    let materiales = 0;
    let honorarios = 0;
    let costoTotal = 0;
    let facturado = 0;

    currentRecords.forEach(r => {
      hs += Number(r.hoursWorked) || 0;
      logistica += Number(r.logisticsCost) || 0;
      moCapataz += Number(r.techPay) || 0;
      moAyudante += Number(r.helperPay) || 0;
      materiales += Number(r.materialsCost) || 0;
      honorarios += getRecordHonorarios(r);
      costoTotal += getRecordCostoTotalRemito(r);
      facturado += Number(r.billedPrice) || 0;
    });

    return {
      count: currentRecords.length,
      hs: Math.round(hs * 10) / 10,
      logistica: roundCurrency(logistica),
      moCapataz: roundCurrency(moCapataz),
      moAyudante: roundCurrency(moAyudante),
      materiales: roundCurrency(materiales),
      honorarios: roundCurrency(honorarios),
      costoTotal: roundCurrency(costoTotal),
      facturado: roundCurrency(facturado)
    };
  }, [currentRecords]);

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por remito, cliente, punto de trabajo, técnico..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 font-medium"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Semáforo Filter Dropdown */}
            <select
              value={filterSemaforo}
              onChange={e => {
                setFilterSemaforo(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold"
            >
              <option value="all">Semáforo: Todos ({semaforoCounts.total})</option>
              <option value="verde">🟢 Verde ({semaforoCounts.verde})</option>
              <option value="naranja">🟠 Naranja ({semaforoCounts.naranja})</option>
              <option value="rojo">🔴 Rojo ({semaforoCounts.rojo})</option>
              <option value="neutro">⚪ Neutro ({semaforoCounts.neutro})</option>
            </select>

            <select
              value={filterGuardia}
              onChange={e => {
                setFilterGuardia(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
            >
              <option value="all">Todas las jornadas</option>
              <option value="guardia">Solo Guardias</option>
              <option value="ordinario">Solo Ordinarias</option>
            </select>

            <select
              value={filterStatus}
              onChange={e => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
            >
              <option value="all">Todos los estados</option>
              <option value="Cargado">CARGADO</option>
              <option value="Facturado">FACTURADO</option>
              <option value="Pasado">PASADO</option>
              <option value="Cobrado">COBRADO</option>
              <option value="Archivado">ARCHIVADO</option>
            </select>

            {archivableVisible.length > 0 && (
              <button
                type="button"
                onClick={() => handleBulkArchive(archivableVisible, true)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                title="Archiva todos los remitos cobrados que se ven con los filtros actuales"
              >
                Archivar cobrados ({archivableVisible.length})
              </button>
            )}
            {filterStatus === 'Archivado' && archivedVisible.length > 0 && (
              <button
                type="button"
                onClick={() => handleBulkArchive(archivedVisible, false)}
                className="px-3 py-2 text-xs rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer"
                title="Devuelve a la lista de Cobrados los archivados que se ven con los filtros actuales"
              >
                Desarchivar ({archivedVisible.length})
              </button>
            )}

            {/* Client Filter Dropdown */}
            <select
              value={filterClient}
              onChange={e => {
                setFilterClient(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold max-w-[200px] truncate"
              title="Filtrar por Cliente específico"
            >
              <option value="all">Todos los clientes ({clientNames.length})</option>
              {clientNames.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Quick client select button */}
            {filterClient !== 'all' && (
              <button
                type="button"
                onClick={() => {
                  const clientRecordIds = technicalAuditRecords
                    .filter(r => r.clientName === filterClient)
                    .map(r => r.id);
                  setSelectedRecordIds(clientRecordIds);
                }}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                title={`Seleccionar todos los remitos de ${filterClient}`}
              >
                + Seleccionar todos de {filterClient}
              </button>
            )}

            {/* Live Auto-save to Firebase indicator */}
            <div className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-bold" title="Sincronización automática con Firebase activa en tiempo real">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Auto-guardado activo</span>
            </div>

            {/* VISTA: Column Customization Dropdown Button (Matches user image 2) */}
            <div className="relative" ref={vistaRef}>
              <button
                type="button"
                onClick={() => setIsVistaOpen(!isVistaOpen)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border shadow-xs ${
                  isVistaOpen
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-[#00c2ff] dark:text-slate-950 dark:border-[#00c2ff]'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                }`}
                title="Configurar columnas visibles en la tabla y en la exportación"
              >
                <Eye className="w-3.5 h-3.5 text-[#00c2ff]" />
                <span>VISTA</span>
                {visibleColumns.length < AUDIT_COLUMNS.length && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00c2ff]"></span>
                )}
              </button>

              {/* VISTA Popover Menu (Matches user image 2) */}
              {isVistaOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 animate-in fade-in zoom-in-95 duration-150">
                  {/* Popover Header */}
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-[#00c2ff]">
                      <Table2 className="w-4 h-4 stroke-[2.5]" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-[#00c2ff]">
                        CONFIGURAR COLUMNAS
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsVistaOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Actions: Show All / Reset */}
                  <div className="flex items-center justify-between gap-1 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={handleShowAllColumns}
                      className="text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                    >
                      Mostrar todas ({AUDIT_COLUMNS.length})
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <button
                      type="button"
                      onClick={handleResetColumns}
                      className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                    >
                      Restablecer
                    </button>
                  </div>

                  {/* Scrollable Column Options with Image 2 style checkboxes */}
                  <div className="space-y-0.5 max-h-72 overflow-y-auto pr-1 select-none">
                    {AUDIT_COLUMNS.map(col => {
                      const isVisible = visibleColumns.includes(col.id);
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => toggleColumn(col.id)}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5">
                            {isVisible ? (
                              <div className="w-4 h-4 rounded-full bg-[#00c2ff] flex items-center justify-center text-white shrink-0 shadow-xs">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 group-hover:border-slate-400 shrink-0"></div>
                            )}
                            <span
                              className={`text-[11px] font-black uppercase tracking-wide ${
                                isVisible
                                  ? 'text-slate-800 dark:text-slate-200'
                                  : 'text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              {col.label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Export info notice */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-cyan-500 shrink-0 mt-0.5" />
                    <span>Al presionar <strong>EXCEL</strong>, solo se exportarán las columnas visibles en la vista.</span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs cursor-pointer"
              title={`Exportar a Excel (${visibleColumns.filter(c => c !== 'acciones').length} columnas seleccionadas)`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>EXCEL</span>
            </button>

            <button
              type="button"
              onClick={() => setIsUpdateDescModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 transition-all cursor-pointer"
              title="Recuperar o actualizar la descripción real de tareas desde tu planilla Excel"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">RECUPERAR TAREAS EXCEL</span>
            </button>

            <button
              onClick={onOpenNewReport}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>NUEVO REPORTE</span>
            </button>
          </div>
        </div>

        {/* Quick Semáforo chips bar & date filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Semáforo Interactive Chips */}
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Filtrar por Semáforo:</span>
            
            <button
              onClick={() => {
                setFilterSemaforo('all');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filterSemaforo === 'all'
                  ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Todos ({semaforoCounts.total})
            </button>

            <button
              onClick={() => {
                setFilterSemaforo(filterSemaforo === 'verde' ? 'all' : 'verde');
                setCurrentPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filterSemaforo === 'verde'
                  ? 'bg-[#00c04b] text-white shadow-xs ring-2 ring-[#00c04b]/30'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-100'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#00c04b] border border-white"></span>
              <span>Cobrado ({semaforoCounts.verde})</span>
            </button>

            <button
              onClick={() => {
                setFilterSemaforo(filterSemaforo === 'naranja' ? 'all' : 'naranja');
                setCurrentPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filterSemaforo === 'naranja'
                  ? 'bg-[#ff5500] text-white shadow-xs ring-2 ring-[#ff5500]/30'
                  : 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-500/30 hover:bg-orange-100'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5500] border border-white"></span>
              <span>Facturado ({semaforoCounts.naranja})</span>
            </button>

            <button
              onClick={() => {
                setFilterSemaforo(filterSemaforo === 'rojo' ? 'all' : 'rojo');
                setCurrentPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filterSemaforo === 'rojo'
                  ? 'bg-[#d20418] text-white shadow-xs ring-2 ring-[#d20418]/30'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-500/30 hover:bg-red-100'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#d20418] border border-white"></span>
              <span>Cargado / Alerta ({semaforoCounts.rojo})</span>
            </button>

            <button
              onClick={() => {
                setFilterSemaforo(filterSemaforo === 'neutro' ? 'all' : 'neutro');
                setCurrentPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filterSemaforo === 'neutro'
                  ? 'bg-slate-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 hover:bg-slate-200'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full border-2 border-slate-400"></span>
              <span>Neutro ({semaforoCounts.neutro})</span>
            </button>
          </div>

          {/* Date Filter Inputs */}
          <div className="flex flex-wrap items-center gap-2 text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1">
              <span className="text-[11px]">Desde:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px]">Hasta:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>
            {(startDate || endDate || searchTerm || filterGuardia !== 'all' || filterStatus !== 'all' || filterClient !== 'all' || filterSemaforo !== 'all') && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setSearchTerm('');
                  setFilterGuardia('all');
                  setFilterStatus('all');
                  setFilterClient('all');
                  setFilterSemaforo('all');
                }}
                className="text-cyan-500 hover:underline text-[11px] font-bold ml-1 cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Responsive Table with Dark Header & Integrated Spreadsheet Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        
        {/* TOP TOOLBAR: Hojas de cálculo, Selector 10-20-50, Navegación y Scroll Horizontal */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          
          {/* Left: Respuestas por Hoja (10, 20, 50, 100) + Indicador de Hoja */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-2 select-none">
                Filas por Hoja:
              </span>
              {[10, 20, 50, 100].map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleItemsPerPageChange(option)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    itemsPerPage === option
                      ? 'bg-[#00c2ff] text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                  title={`Mostrar ${option} respuestas por hoja para achicar el alto`}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
              <span className="font-bold text-slate-900 dark:text-white">
                Hoja {currentPage} de {totalPages}
              </span>
              <span className="text-slate-400 text-[11px] ml-1.5">
                ({filteredRecords.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredRecords.length)} de {filteredRecords.length} remitos)
              </span>
            </div>
          </div>

          {/* Middle/Right: Navegación de Hojas y Controles de Desplazamiento Horizontal */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Horizontal Scroll Buttons */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <button
                type="button"
                onClick={() => scrollTableBy(-280, 0)}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-cyan-500 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                title="Desplazar tabla a la izquierda (o usa flecha ← del teclado)"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Desplazar</span>
              </button>
              <button
                type="button"
                onClick={() => scrollTableBy(280, 0)}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-cyan-500 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                title="Desplazar tabla a la derecha (o usa flecha → del teclado)"
              >
                <span className="hidden sm:inline">Desplazar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Keyboard shortcut indicator */}
            <div
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-medium select-none"
              title="Puedes desplazarte con las teclas de flechas izquierda/derecha y arriba/abajo sin tener que ir hasta abajo de todo"
            >
              <Keyboard className="w-3.5 h-3.5 text-cyan-500" />
              <span>Flechas ◀ ▶ ▲ ▼</span>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Primera Hoja"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Hoja Anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1 px-1">
                {getPageNumbers().map((p, idx) => {
                  if (p === '...') {
                    return (
                      <span key={`top-ellipsis-${idx}`} className="px-1 text-slate-400 font-bold select-none text-xs">
                        …
                      </span>
                    );
                  }
                  const pageNum = p as number;
                  const isActive = pageNum === currentPage;
                  return (
                    <button
                      key={`top-page-${pageNum}`}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#00c2ff] text-slate-950 shadow-xs'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                      title={`Ir a Hoja ${pageNum}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Hoja Siguiente"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Última Hoja"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* TOP SYNCHRONIZED SCROLLBAR: Permite desplazarse horizontalmente sin ir hasta abajo */}
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="overflow-x-auto bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 select-none py-0.5"
          title="Desplazador horizontal superior sincronizado: muévelo o usa las teclas de flecha"
        >
          <div style={{ width: `${contentScrollWidth}px`, height: '5px' }} />
        </div>

        <div
          ref={tableScrollRef}
          tabIndex={0}
          onScroll={handleTableScroll}
          onMouseEnter={() => { isTableHoveredRef.current = true; }}
          onMouseLeave={() => { isTableHoveredRef.current = false; }}
          className="overflow-x-auto overflow-y-auto max-h-[72vh] focus:outline-none focus:ring-1 focus:ring-[#00c2ff]/40 scrollbar-thin"
          title="Planilla interactiva: desplázate con las flechas del teclado (← → ↑ ↓) o rueda del mouse"
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-20 shadow-sm">
              <tr className="bg-[#0c1527] border-b border-slate-700/80 font-black text-slate-200 text-[11px] tracking-wider uppercase whitespace-nowrap">
                <th className="p-3 text-center w-[44px]">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos los visibles"
                    checked={currentRecords.length > 0 && currentRecords.every(r => selectedRecordIds.includes(r.id))}
                    onChange={e => {
                      if (e.target.checked) {
                        const idsToAdd = currentRecords.map(r => r.id);
                        setSelectedRecordIds(prev => Array.from(new Set([...prev, ...idsToAdd])));
                      } else {
                        const idsToRemove = new Set(currentRecords.map(r => r.id));
                        setSelectedRecordIds(prev => prev.filter(id => !idsToRemove.has(id)));
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-400 text-amber-500 focus:ring-amber-500 cursor-pointer"
                  />
                </th>
                {isColVisible('semaforo') && <th className="p-3.5 text-center w-[90px]">SEMÁFORO</th>}
                {isColVisible('sistema') && <th className="p-3.5 italic">SISTEMA</th>}
                {isColVisible('papel') && <th className="p-3.5 text-[#ff7a00]">PAPEL</th>}
                {isColVisible('fecha') && <th className="p-3.5">FECHA</th>}
                {isColVisible('cliente') && <th className="p-3.5">CLIENTE / SEDE</th>}
                {isColVisible('punto') && <th className="p-3.5">PUNTO DE TRABAJO</th>}
                {isColVisible('descripcion') && <th className="p-3.5 min-w-[240px]">DESCRIPCIÓN DE TAREAS</th>}
                {isColVisible('guardia') && <th className="p-3.5 text-center">GUARDIA</th>}
                {isColVisible('hs') && <th className="p-3.5 text-right">HS</th>}
                {isColVisible('logistica') && <th className="p-3.5 text-right">LOGÍSTICA ($)</th>}
                {isColVisible('mo_dir') && <th className="p-3.5 text-right">M.O. CAPATAZ ($)</th>}
                {isColVisible('costo_ayudantes') && <th className="p-3.5 text-right">M.O. AYUDANTE ($)</th>}
                {isColVisible('mat') && <th className="p-3.5 text-right">MAT. ($)</th>}
                {isColVisible('equipo') && <th className="p-3.5">EQUIPO</th>}
                {isColVisible('costo_honorarios') && <th className="p-3.5 text-right">COSTO HONORARIOS ($)</th>}
                {isColVisible('costo_total_remito') && <th className="p-3.5 text-right">COSTO TOTAL DEL REMITO ($)</th>}
                {isColVisible('costo_op') && <th className="p-3.5 text-right">COSTO OP ($)</th>}
                {isColVisible('facturado') && <th className="p-3.5 text-right">FACTURADO ($)</th>}
                {isColVisible('pago_tec') && <th className="p-3.5 text-right">PAGO TÉC. ($)</th>}
                {isColVisible('estado') && <th className="p-3.5 text-center">ESTADO</th>}
                {isColVisible('fecha_archivo') && <th className="p-3.5 text-center">FECHA ARCHIVO</th>}
                {isColVisible('acciones') && <th className="p-3.5 text-center">ACCIONES</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {currentRecords.length === 0 ? (
                <tr>
                  <td colSpan={(visibleColumns.length + 1) || 1} className="p-8 text-center text-slate-400">
                    No se encontraron reportes técnicos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                currentRecords.map(record => {
                  const sem = getEffectiveSemaforo(record);

                  // Row background and typography classes depending on Semáforo
                  let rowClasses = 'transition-colors';
                  if (sem === 'verde') {
                    rowClasses += ' bg-[#00c04b] text-white hover:bg-[#00ad43] border-b border-[#00a83e]';
                  } else if (sem === 'naranja') {
                    rowClasses += ' bg-[#ff5500] text-white hover:bg-[#eb4e00] border-b border-[#e04a00]';
                  } else if (sem === 'rojo') {
                    rowClasses += ' bg-[#d20418] text-white hover:bg-[#bf0315] border-b border-[#b50314]';
                  } else {
                    rowClasses += ' bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800';
                  }

                  const isColoredRow = sem === 'verde' || sem === 'naranja' || sem === 'rojo';

                  return (
                    <tr key={record.id} className={rowClasses}>
                      
                      {/* MULTI-SELECT CHECKBOX */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar remito ${record.remitoId}`}
                          checked={selectedRecordIds.includes(record.id)}
                          onChange={e => {
                            e.stopPropagation();
                            setSelectedRecordIds(prev =>
                              prev.includes(record.id)
                                ? prev.filter(id => id !== record.id)
                                : [...prev, record.id]
                            );
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>

                      {/* SEMÁFORO & MENSAJE ICON COLUMN */}
                      {isColVisible('semaforo') && (
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="relative inline-flex items-center justify-center gap-1.5">
                            {/* Semáforo Interactive Button */}
                            <button
                              onClick={() => handleCycleSemaforo(record.id, sem)}
                              onContextMenu={e => {
                                e.preventDefault();
                                setActivePickerId(activePickerId === record.id ? null : record.id);
                              }}
                              className="cursor-pointer focus:outline-hidden transition-transform active:scale-95 group"
                              title={`Semáforo: ${sem.toUpperCase()} (Clic para alternar, o clic derecho para paleta)`}
                            >
                              {sem === 'verde' && (
                                <div className="w-7 h-7 rounded-full border-[3.5px] border-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
                                </div>
                              )}

                              {sem === 'naranja' && (
                                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
                                  <svg className="w-3.5 h-3.5 text-[#ff5500] fill-current" viewBox="0 0 24 24">
                                    <path d="M12 4l8.5 15a1 1 0 0 1-.87 1.5H4.37a1 1 0 0 1-.87-1.5L12 4z" />
                                  </svg>
                                </div>
                              )}

                              {sem === 'rojo' && (
                                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
                                  <X className="w-4 h-4 text-[#cc0010] stroke-[4]" />
                                </div>
                              )}

                              {sem === 'neutro' && (
                                <div className="w-7 h-7 rounded-full border-2 border-slate-300 dark:border-slate-600 group-hover:border-cyan-500 flex items-center justify-center transition-colors">
                                  <div className="w-2.5 h-2.5 rounded-full border-2 border-slate-300 dark:border-slate-600 group-hover:border-cyan-500"></div>
                                </div>
                              )}
                            </button>

                            {/* Quick palette trigger */}
                            <button
                              onClick={() => setActivePickerId(activePickerId === record.id ? null : record.id)}
                              className={`text-[10px] p-0.5 rounded-full transition-opacity opacity-40 hover:opacity-100 cursor-pointer ${
                                isColoredRow ? 'text-white hover:bg-white/20' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                              title="Seleccionar color de semáforo"
                            >
                              ▾
                            </button>

                            {/* ICONO DE MENSAJE AL LADO DEL SEMÁFORO (Titila si no está leído, persiste siempre) */}
                            {record.message ? (
                              !record.messageRead ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenMessage(record);
                                  }}
                                  className="relative p-1.5 rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-md shadow-amber-400/50 cursor-pointer animate-[pulse_1s_cubic-bezier(0.4,0,0.6,1)_infinite] hover:scale-110 transition-transform shrink-0"
                                  title={`¡Mensaje nuevo sin leer!: "${record.message.slice(0, 35)}..." (Clic para leer y marcar como leído)`}
                                >
                                  <MessageSquare className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-600 rounded-full animate-ping" />
                                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-600 rounded-full" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenMessage(record);
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                                    isColoredRow
                                      ? 'bg-white/25 text-white hover:bg-white/40'
                                      : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800'
                                  }`}
                                  title={`Mensaje leído: "${record.message.slice(0, 35)}..." (Clic para ver o editar)`}
                                >
                                  <MessageSquareText className="w-3.5 h-3.5" />
                                </button>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenMessage(record);
                                }}
                                className={`p-1 rounded-lg opacity-25 hover:opacity-100 transition-opacity cursor-pointer shrink-0 ${
                                  isColoredRow ? 'text-white hover:bg-white/20' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                                title="Agregar mensaje o nota a este remito"
                              >
                                <MessageSquarePlus className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Mini Palette Dropdown */}
                            {activePickerId === record.id && (
                              <div
                                ref={pickerRef}
                                className="absolute left-full top-0 ml-2 z-50 bg-slate-900 text-white rounded-xl shadow-2xl p-2 border border-slate-700 flex items-center gap-1.5 animate-in fade-in zoom-in-95"
                              >
                                <button
                                  onClick={() => handleSetSemaforo(record.id, 'verde')}
                                  title="Verde (Cobrado / OK)"
                                  className="w-6 h-6 rounded-full border-2 border-white bg-[#00c04b] hover:scale-110 transition-transform flex items-center justify-center cursor-pointer"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                </button>

                                <button
                                  onClick={() => handleSetSemaforo(record.id, 'naranja')}
                                  title="Naranja (Facturado / Pendiente)"
                                  className="w-6 h-6 rounded-full bg-[#ff5500] hover:scale-110 transition-transform flex items-center justify-center cursor-pointer"
                                >
                                  <span className="text-[9px] text-white font-bold">▲</span>
                                </button>

                                <button
                                  onClick={() => handleSetSemaforo(record.id, 'rojo')}
                                  title="Rojo (Cargado / Alerta)"
                                  className="w-6 h-6 rounded-full bg-[#d20418] hover:scale-110 transition-transform flex items-center justify-center cursor-pointer"
                                >
                                  <span className="text-[9px] text-white font-black">✕</span>
                                </button>

                                <button
                                  onClick={() => handleSetSemaforo(record.id, 'neutro')}
                                  title="Neutro (Sin color)"
                                  className="w-6 h-6 rounded-full border border-slate-400 bg-slate-800 hover:scale-110 transition-transform flex items-center justify-center cursor-pointer text-slate-300 text-[9px]"
                                >
                                  ⚪
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      )}

                      {/* SISTEMA (e.g. #376-2026, italic, bold) */}
                      {isColVisible('sistema') && (
                        <td className="p-3.5 whitespace-nowrap">
                          <span className={`font-black italic font-mono text-xs ${
                            isColoredRow ? 'text-white' : 'text-cyan-600 dark:text-cyan-400'
                          }`}>
                            {record.remitoId}
                          </span>
                        </td>
                      )}

                      {/* PAPEL (e.g. 2-11124, editable) */}
                      {isColVisible('papel') && (
                        <td className="p-3.5 whitespace-nowrap">
                          <EditableTextCell
                            value={record.remitoPapel || ''}
                            placeholder="N° Papel"
                            onSave={val => updateTechnicalAuditRecord(record.id, { remitoPapel: val })}
                            isColoredRow={isColoredRow}
                            bold
                            className={isColoredRow ? 'text-white' : 'text-[#ff7a00]'}
                            title="Editar N° Remito Papel"
                          />
                        </td>
                      )}

                      {/* FECHA (e.g. 31/08/26, editable) */}
                      {isColVisible('fecha') && (
                        <td className="p-3.5 whitespace-nowrap font-bold text-xs">
                          <EditableDateCell
                            value={record.date}
                            onSave={val => updateTechnicalAuditRecord(record.id, { date: val })}
                            isColoredRow={isColoredRow}
                          />
                        </td>
                      )}

                      {/* CLIENTE / SEDE (editable) */}
                      {isColVisible('cliente') && (
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-0.5">
                            <EditableTextCell
                              value={record.clientName}
                              placeholder="Nombre Cliente"
                              onSave={val => updateTechnicalAuditRecord(record.id, { clientName: val })}
                              isColoredRow={isColoredRow}
                              bold
                              uppercase
                              className={isColoredRow ? 'text-white' : 'text-slate-900 dark:text-white'}
                              title="Editar Cliente"
                            />
                            <EditableTextCell
                              value={record.siteLocation}
                              placeholder="Sede / Ubicación"
                              onSave={val => updateTechnicalAuditRecord(record.id, { siteLocation: val })}
                              isColoredRow={isColoredRow}
                              uppercase
                              className={isColoredRow ? 'text-white/90 text-[10px]' : 'text-slate-400 text-[10px]'}
                              title="Editar Sede"
                            />
                          </div>
                        </td>
                      )}

                      {/* PUNTO DE TRABAJO (editable) */}
                      {isColVisible('punto') && (
                        <td className="p-3.5 max-w-[190px]">
                          <EditableTextCell
                            value={record.workPoint}
                            placeholder="Punto de Trabajo"
                            onSave={val => updateTechnicalAuditRecord(record.id, { workPoint: val })}
                            isColoredRow={isColoredRow}
                            className={isColoredRow ? 'text-white font-medium' : 'text-slate-700 dark:text-slate-300'}
                            title="Editar Punto de Trabajo"
                          />
                        </td>
                      )}

                      {/* DESCRIPCIÓN DE TAREAS (editable) */}
                      {isColVisible('descripcion') && (
                        <td className="p-3.5 max-w-[280px] align-middle">
                          <EditableTextCell
                            value={record.description || ''}
                            placeholder="Descripción de tareas cargadas..."
                            onSave={val => updateTechnicalAuditRecord(record.id, { description: val })}
                            isColoredRow={isColoredRow}
                            className={isColoredRow ? 'text-white font-medium truncate max-w-[260px]' : 'text-slate-700 dark:text-slate-300 truncate max-w-[260px]'}
                            title="Editar descripción de tareas del reporte"
                          />
                        </td>
                      )}

                      {/* GUARDIA (editable / toggleable) */}
                      {isColVisible('guardia') && (
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleGuardia(record)}
                            title="Clic para alternar Guardia / Ordinario (recalcula operarios por hora base)"
                            className="cursor-pointer transition-transform active:scale-95"
                          >
                            {record.isGuardia ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border shadow-xs ${
                                isColoredRow
                                  ? 'bg-white text-[#d20418] border-white'
                                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25'
                              }`}>
                                <ShieldAlert className="w-2.5 h-2.5" />
                                GUARDIA
                              </span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                isColoredRow
                                  ? 'bg-white/20 text-white border-white/40 hover:bg-white/30'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                              }`}>
                                NO
                              </span>
                            )}
                          </button>
                        </td>
                      )}

                      {/* HS (Calcula operarios por su hora base) */}
                      {isColVisible('hs') && (
                        <td className="p-3.5 text-right font-mono font-bold whitespace-nowrap">
                          <EditableNumberCell
                            value={record.hoursWorked}
                            suffix="hs"
                            min={0}
                            step="any"
                            onSave={val => handleUpdateHours(record, val)}
                            isColoredRow={isColoredRow}
                            className={isColoredRow ? 'text-white' : 'text-slate-800 dark:text-slate-200'}
                            title="Editar horas (recalcula automáticamente operarios por hora base)"
                          />
                        </td>
                      )}

                      {/* LOGÍSTICA (editable) */}
                      {isColVisible('logistica') && (
                        <td className="p-3.5 text-right font-mono whitespace-nowrap">
                          <EditableNumberCell
                            value={record.logisticsCost || 0}
                            prefix="$"
                            step="any"
                            onSave={val => handleUpdateLogistics(record, val)}
                            isColoredRow={isColoredRow}
                            className={isColoredRow ? 'text-white/95' : 'text-slate-600 dark:text-slate-400'}
                            title="Editar costo de logística"
                          />
                        </td>
                      )}

                      {/* M.O. CAPATAZ (el valor de las horas trabajadas por el oficial) */}
                      {isColVisible('mo_dir') && (
                        <td className="p-3.5 text-right font-mono font-bold whitespace-nowrap">
                          <div className="flex flex-col items-end">
                            <EditableNumberCell
                              value={record.techPay || 0}
                              prefix="$"
                              step="any"
                              onSave={val => handleUpdateMOCapataz(record, val)}
                              isColoredRow={isColoredRow}
                              className={isColoredRow ? 'text-white font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}
                              title="Editar M.O. Capataz (valor de horas trabajadas por el oficial)"
                            />
                            {record.capatazProfit !== undefined && record.capatazProfit > 0 && (
                              <span
                                className={`text-[10px] font-bold ${isColoredRow ? 'text-amber-200' : 'text-amber-600 dark:text-amber-400'}`}
                                title={`Ganancia Capataz (${record.capatazCommissionPct || 10}% sobre M.O. Directa)`}
                              >
                                Gan. Cap: ${(record.capatazProfit || 0).toLocaleString('es-AR')} ({record.capatazCommissionPct || 10}%)
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* M.O. AYUDANTE (el valor de las horas trabajadas por el ayudante) */}
                      {isColVisible('costo_ayudantes') && (
                        <td className="p-3.5 text-right font-mono whitespace-nowrap text-xs font-bold">
                          <EditableNumberCell
                            value={record.helperPay || 0}
                            prefix="$"
                            step="any"
                            onSave={val => handleUpdateMOAyudante(record, val)}
                            isColoredRow={isColoredRow}
                            className={isColoredRow ? 'text-white/95 font-bold' : 'text-purple-600 dark:text-purple-400 font-bold'}
                            title="Editar M.O. Ayudante (valor de horas trabajadas por el ayudante)"
                          />
                        </td>
                      )}

                      {/* MAT (editable) */}
                      {isColVisible('mat') && (
                        <td className="p-3.5 text-right font-mono whitespace-nowrap">
                          <EditableNumberCell
                            value={record.materialsCost || 0}
                            prefix="$"
                            step="any"
                            onSave={val => handleUpdateMaterials(record, val)}
                            isColoredRow={isColoredRow}
                            className={isColoredRow ? 'text-white/90' : 'text-slate-600 dark:text-slate-400'}
                            title="Editar costo de materiales"
                          />
                        </td>
                      )}

                      {/* EQUIPO / RESPONSABLE (editable) */}
                      {isColVisible('equipo') && (
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex flex-col items-start">
                            <select
                              value={record.leadTech || ''}
                              onChange={e => handleUpdateLeadTech(record, e.target.value)}
                              className={`text-xs font-black uppercase rounded px-1.5 py-0.5 cursor-pointer border ${
                                isColoredRow
                                  ? 'bg-white/20 text-white border-white/40 focus:bg-slate-900 focus:text-white'
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 hover:border-slate-300'
                              }`}
                              title="Seleccionar Responsable Técnico / Capataz de Obra"
                            >
                              {/* Keep current leadTech if historical and not in capatacesNomina */}
                              {record.leadTech && !capatacesNomina.some(c => c.name.toLowerCase() === record.leadTech?.toLowerCase()) && (
                                <option value={record.leadTech}>{record.leadTech} (Asignado)</option>
                              )}
                              {capatacesNomina.map(c => (
                                <option key={c.id} value={c.name}>{c.name} (Capataz)</option>
                              ))}
                            </select>
                            {record.helpers && record.helpers.length > 0 && (
                              <div className={`text-[10px] truncate max-w-[140px] font-medium mt-0.5 ${
                                isColoredRow ? 'text-white/80' : 'text-slate-400'
                              }`}>
                                Ayud: {record.helpers.join(', ')}
                              </div>
                            )}
                          </div>
                        </td>
                      )}

                      {/* COSTO HONORARIOS (valor que nosotros ponemos de ganancia) */}
                      {isColVisible('costo_honorarios') && (
                        <td className="p-3.5 text-right font-mono font-bold whitespace-nowrap">
                          <div className="flex flex-col items-end">
                            <EditableNumberCell
                              value={getRecordHonorarios(record)}
                              prefix="$"
                              step="any"
                              onSave={val => handleUpdateHonorarios(record, val)}
                              isColoredRow={isColoredRow}
                              className={isColoredRow ? 'text-white font-bold' : 'text-indigo-600 dark:text-indigo-400 font-bold'}
                              title="Editar Costo Honorarios (valor que nosotros ponemos de ganancia)"
                            />
                            {(() => {
                              const cleanLabor = record.laborDirectCost ?? ((record.techPay || 0) + (record.helperPay || 0));
                              const baseCosts = (record.logisticsCost || 0) + cleanLabor + (record.materialsCost || 0);
                              const hon = getRecordHonorarios(record);
                              const pct = baseCosts > 0 ? Math.round((hon / baseCosts) * 100) : record.marginPercentage;
                              return pct !== undefined && pct > 0 ? (
                                <span
                                  className={`text-[10px] font-semibold ${isColoredRow ? 'text-indigo-200' : 'text-indigo-500/80 dark:text-indigo-400/80'}`}
                                  title={`Margen de ganancia: ${pct}%`}
                                >
                                  +{pct}% ganancia
                                </span>
                              ) : null;
                            })()}
                          </div>
                        </td>
                      )}

                      {/* COSTO TOTAL DEL REMITO (es la suma de todo lo otro) */}
                      {isColVisible('costo_total_remito') && (
                        <td className="p-3.5 text-right font-mono font-black whitespace-nowrap">
                          <EditableNumberCell
                            value={getRecordCostoTotalRemito(record)}
                            prefix="$"
                            step="any"
                            onSave={val => handleUpdateCostoTotalRemito(record, val)}
                            isColoredRow={isColoredRow}
                            className={isColoredRow ? 'text-white font-black' : 'text-slate-900 dark:text-white font-black'}
                            title="Editar Costo Total del Remito (suma de todo lo otro: Logística + M.O. Capataz + M.O. Ayudante + Materiales + Costo Honorarios)"
                          />
                        </td>
                      )}

                      {/* COSTO OPERATIVO (editable, opcional) */}
                      {isColVisible('costo_op') && (
                        <td className="p-3.5 text-right font-mono font-bold whitespace-nowrap">
                          <EditableNumberCell
                            value={record.operatingCost || 0}
                            prefix="$"
                            step="any"
                            onSave={val => handleUpdateOperatingCost(record, val)}
                            isColoredRow={isColoredRow}
                            className={isColoredRow ? 'text-white font-black' : 'text-amber-600 dark:text-amber-400 font-black'}
                            title="Editar costo operativo total"
                          />
                        </td>
                      )}

                      {/* FACTURADO (editable, opcional) */}
                      {isColVisible('facturado') && (
                        <td className="p-3.5 text-right font-mono font-black whitespace-nowrap">
                          <EditableNumberCell
                            value={record.billedPrice || 0}
                            prefix="$"
                            step="any"
                            onSave={val => handleUpdateBilled(record, val)}
                            isColoredRow={isColoredRow}
                            className={isColoredRow ? 'text-white' : 'text-slate-900 dark:text-white'}
                            title="Editar monto facturado"
                          />
                        </td>
                      )}

                      {/* PAGO TÉCNICO (editable, opcional) */}
                      {isColVisible('pago_tec') && (
                        <td className="p-3.5 text-right font-mono whitespace-nowrap text-[11px]">
                          <EditableNumberCell
                            value={record.techPay || 0}
                            prefix="$"
                            step="any"
                            onSave={val => handleUpdateTechPay(record, val)}
                            isColoredRow={isColoredRow}
                            className={isColoredRow ? 'text-white/95' : 'text-cyan-600 dark:text-cyan-400'}
                            title="Editar pago técnico"
                          />
                        </td>
                      )}

                      {/* ESTADO */}
                      {isColVisible('estado') && (
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <select
                            value={record.archivado ? 'Archivado' : record.status}
                            onChange={e => handleStatusChange(record.id, e.target.value as any)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer border ${
                              isColoredRow
                                ? 'bg-white/20 text-white border-white/40 focus:bg-slate-900 focus:text-white'
                                : record.archivado
                                ? 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30'
                                : record.status === 'Cobrado'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                : record.status === 'Facturado'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                                : record.status === 'Pasado'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                            }`}
                          >
                            <option value="Cargado" className="bg-slate-900 text-white">CARGADO</option>
                            <option value="Facturado" className="bg-slate-900 text-white">FACTURADO</option>
                            <option value="Pasado" className="bg-slate-900 text-white">PASADO</option>
                            <option value="Cobrado" className="bg-slate-900 text-white">COBRADO</option>
                            {record.status === 'Cobrado' && (
                              <option value="Archivado" className="bg-slate-900 text-white">ARCHIVADO</option>
                            )}
                          </select>
                        </td>
                      )}

                      {/* FECHA DE ARCHIVO */}
                      {isColVisible('fecha_archivo') && (
                        <td className="p-3.5 text-center whitespace-nowrap font-mono text-[11px]">
                          {record.archivado && record.fechaArchivado ? formatDisplayDate(record.fechaArchivado) : '—'}
                        </td>
                      )}

                      {/* ACCIONES */}
                      {isColVisible('acciones') && (
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Generar Recibo / Remito Pasado shortcut */}
                            <button
                              onClick={() => setRemitoPasadoRecord(record)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isColoredRow
                                  ? 'text-white hover:bg-white/20'
                                  : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                              }`}
                              title="Generar Recibo / Remito Pasado (con desglose de materiales)"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>

                            {/* Editar completamente el remito (Abre Registro de Campo) */}
                            <button
                              onClick={() => setRecordToEdit(record)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isColoredRow
                                  ? 'text-white hover:bg-white/20'
                                  : 'bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400'
                              }`}
                              title="Editar completamente el remito (abrir registro de campo tal cual fue cargado)"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* Cobrar / Forma de Pago shortcut */}
                            <button
                              onClick={() => setPaymentRecord(record)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isColoredRow
                                  ? 'text-white hover:bg-white/20'
                                  : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                              }`}
                              title="Cobrar / Registrar Múltiples Medios de Pago y Retenciones"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => setSelectedRecord(record)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isColoredRow
                                  ? 'text-white hover:bg-white/20'
                                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                              title="Ver Detalle Completo y Firma"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRecordToDelete(record);
                              }}
                              className={`p-1.5 rounded-lg transition-all cursor-pointer active:scale-90 ${
                                isColoredRow
                                  ? 'text-white hover:bg-white/20 hover:text-rose-200'
                                  : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                              }`}
                              title={`Eliminar reporte ${record.remitoId}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* STICKY FLOATING BOTTOM BAR: Acompaña el desplazamiento vertical mientras bajas */}
        <div className="sticky bottom-0 z-30 bg-slate-900/95 dark:bg-slate-950/98 backdrop-blur-md border-t-2 border-cyan-500/50 shadow-2xl p-2.5 text-white flex flex-col gap-2">
          {/* Fila 1: Barra de desplazamiento lateral interactiva sincronizada */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollTableBy(-350, 0)}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 border border-slate-700 transition-colors shrink-0 text-xs font-bold flex items-center gap-1 cursor-pointer"
              title="Desplazar tabla hacia la izquierda"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Desplazar Izq</span>
            </button>

            {/* Synchronized floating bottom scrollbar */}
            <div
              ref={bottomScrollRef}
              onScroll={handleBottomScroll}
              className="flex-1 overflow-x-auto select-none py-1 px-1 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-inner scrollbar-thin"
              title="Desplazador horizontal inferior: te acompaña al hacer scroll vertical"
            >
              <div style={{ width: `${contentScrollWidth}px`, height: '8px' }} />
            </div>

            <button
              type="button"
              onClick={() => scrollTableBy(350, 0)}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 border border-slate-700 transition-colors shrink-0 text-xs font-bold flex items-center gap-1 cursor-pointer"
              title="Desplazar tabla hacia la derecha"
            >
              <span className="hidden sm:inline">Desplazar Der</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Accesos rápidos a secciones de la tabla */}
            <div className="hidden lg:flex items-center gap-1 shrink-0 text-[10.5px]">
              <button
                type="button"
                onClick={() => tableScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' })}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer font-medium"
                title="Ir al inicio de la tabla (Semáforo, Sistema, Cliente)"
              >
                ◀ Inicio
              </button>
              <button
                type="button"
                onClick={() => tableScrollRef.current?.scrollTo({ left: contentScrollWidth * 0.35, behavior: 'smooth' })}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer font-medium"
                title="Ir a columna de Mano de Obra (Capataz y Ayudantes)"
              >
                M.O.
              </button>
              <button
                type="button"
                onClick={() => tableScrollRef.current?.scrollTo({ left: contentScrollWidth * 0.65, behavior: 'smooth' })}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer font-medium"
                title="Ir a Costo Total del Remito y Honorarios"
              >
                Costo Total
              </button>
              <button
                type="button"
                onClick={() => tableScrollRef.current?.scrollTo({ left: contentScrollWidth, behavior: 'smooth' })}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 cursor-pointer font-black"
                title="Ir al final (Facturado y Estado)"
              >
                Facturado ▶
              </button>
            </div>
          </div>

          {/* Fila 2: Totales en vivo (siempre visibles sin tener que subir o bajar) */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-black text-[11px] border border-cyan-500/40">
                TOTALES EN PANTALLA ({tableTotals.count} {tableTotals.count === 1 ? 'remito' : 'remitos'})
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                {tableTotals.hs} hs trabajadas
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-mono text-xs">
              {isColVisible('logistica') && (
                <div className="text-right">
                  <span className="text-[9px] uppercase text-slate-400 block font-sans">Logística</span>
                  <span className="text-white font-bold">${formatCurrency(tableTotals.logistica)}</span>
                </div>
              )}
              {isColVisible('mo_dir') && (
                <div className="text-right">
                  <span className="text-[9px] uppercase text-emerald-400 block font-sans">M.O. Capataz</span>
                  <span className="text-emerald-400 font-bold">${formatCurrency(tableTotals.moCapataz)}</span>
                </div>
              )}
              {isColVisible('costo_ayudantes') && (
                <div className="text-right">
                  <span className="text-[9px] uppercase text-purple-400 block font-sans">M.O. Ayudante</span>
                  <span className="text-purple-300 font-bold">${formatCurrency(tableTotals.moAyudante)}</span>
                </div>
              )}
              {isColVisible('mat') && (
                <div className="text-right">
                  <span className="text-[9px] uppercase text-amber-400 block font-sans">Materiales</span>
                  <span className="text-amber-300 font-bold">${formatCurrency(tableTotals.materiales)}</span>
                </div>
              )}
              {isColVisible('costo_honorarios') && (
                <div className="text-right">
                  <span className="text-[9px] uppercase text-indigo-300 block font-sans">Honorarios</span>
                  <span className="text-indigo-300 font-bold">${formatCurrency(tableTotals.honorarios)}</span>
                </div>
              )}
              {isColVisible('costo_total_remito') && (
                <div className="text-right px-2 py-0.5 rounded-lg bg-cyan-950/70 border border-cyan-500/50">
                  <span className="text-[9px] uppercase text-cyan-300 block font-sans font-black">Costo Total</span>
                  <span className="text-cyan-300 font-black text-sm">${formatCurrency(tableTotals.costoTotal)}</span>
                </div>
              )}
              {isColVisible('facturado') && (
                <div className="text-right px-2 py-0.5 rounded-lg bg-blue-950/70 border border-blue-500/50">
                  <span className="text-[9px] uppercase text-blue-300 block font-sans font-black">Facturado</span>
                  <span className="text-blue-300 font-black text-sm">${formatCurrency(tableTotals.facturado)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            {/* Rows per page selector */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1.5 select-none">
                Filas:
              </span>
              {[10, 20, 50, 100].map(option => (
                <button
                  key={`bottom-opt-${option}`}
                  type="button"
                  onClick={() => handleItemsPerPageChange(option)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    itemsPerPage === option
                      ? 'bg-[#00c2ff] text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <span className="font-medium text-slate-600 dark:text-slate-300">
              Mostrando <strong className="text-slate-900 dark:text-white">{currentRecords.length}</strong> de <strong className="text-slate-900 dark:text-white">{filteredRecords.length}</strong> registros
            </span>

            {/* Status Legend */}
            <div className="hidden lg:flex items-center gap-2.5 pl-3 border-l border-slate-200 dark:border-slate-700 text-[11px]">
              <span className="inline-flex items-center gap-1 font-bold text-[#00c04b]">
                <span className="w-2 h-2 rounded-full bg-[#00c04b]"></span> Verde: Cobrado
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-[#ff7a00]">
                <span className="w-2 h-2 rounded-full bg-[#ff5500]"></span> Naranja: Facturado
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-[#d20418]">
                <span className="w-2 h-2 rounded-full bg-[#d20418]"></span> Rojo: Cargado / Alerta
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-bold w-full md:w-auto justify-end">
            {/* Direct Jump to Page Form */}
            <form onSubmit={handleJumpToPage} className="hidden sm:flex items-center gap-1 mr-2 text-[11px]">
              <span className="text-slate-400 font-normal">Ir a Hoja:</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                value={jumpToPageInput}
                onChange={e => setJumpToPageInput(e.target.value)}
                placeholder={String(currentPage)}
                className="w-12 px-1.5 py-1 text-center font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
              />
              <button
                type="submit"
                className="px-2 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg cursor-pointer transition-colors text-[11px]"
              >
                Ir
              </button>
            </form>

            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Primera Hoja"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Hoja Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 px-1">
                {getPageNumbers().map((p, idx) => {
                  if (p === '...') {
                    return (
                      <span key={`bottom-ellipsis-${idx}`} className="px-1 text-slate-400 font-bold select-none text-xs">
                        …
                      </span>
                    );
                  }
                  const pageNum = p as number;
                  const isActive = pageNum === currentPage;
                  return (
                    <button
                      key={`bottom-page-${pageNum}`}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#00c2ff] text-slate-950 shadow-xs'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Hoja Siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Última Hoja"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Bar for Multi-Remito Selection & Consolidated Receipt */}
      {selectedRecordIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-5xl bg-slate-900/95 dark:bg-slate-900/98 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-amber-500/40 p-3 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex flex-wrap items-center gap-3 text-xs w-full md:w-auto">
            <div className="flex items-center gap-2 bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-500/40">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span className="font-black text-amber-300">
                {selectedRecordIds.length} {selectedRecordIds.length === 1 ? 'remito seleccionado' : 'remitos seleccionados'}
              </span>
            </div>

            <div className="text-slate-300 text-xs">
              {selectedDistinctClients.length === 1 ? (
                <span>
                  Cliente: <strong className="text-white">{selectedDistinctClients[0]}</strong>
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {selectedDistinctClients.length} clientes seleccionados
                </span>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-2 font-mono text-[11px] text-slate-300 bg-slate-800/80 px-3 py-1 rounded-xl border border-slate-700">
              <span>Serv: <strong className="text-white">${formatCurrency(selectedTotalServicios)}</strong></span>
              <span>+</span>
              <span>Mat: <strong className="text-amber-400">${formatCurrency(selectedTotalMateriales)}</strong></span>
              <span>=</span>
              <span className="font-black text-amber-300">${formatCurrency(selectedTotalFinal)} + IVA</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={() => {
                const sel = technicalAuditRecords.filter(r => selectedRecordIds.includes(r.id));
                setRemitoPasadoRecords(sel);
                setRemitoPasadoRecord(null);
              }}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white transition-all shadow-md shadow-amber-500/25 cursor-pointer"
              title="Generar comprobante consolidado con descripción de tareas para el cliente"
            >
              <FileText className="w-4 h-4" />
              <span>GENERAR COMPROBANTE OFICIAL ({selectedRecordIds.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const sel = technicalAuditRecords.filter(r => selectedRecordIds.includes(r.id));
                setFacturarRecords(sel);
                setFacturarRecord(null);
              }}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-md shadow-blue-500/25 cursor-pointer"
              title="Pasar todos los remitos seleccionados a Facturado con el mismo Nº de Factura y Fecha"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>PASAR A FACTURADO ({selectedRecordIds.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const firstSel = technicalAuditRecords.find(r => selectedRecordIds.includes(r.id));
                if (firstSel) setPaymentRecord(firstSel);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs cursor-pointer"
              title="Registrar cobro de remitos"
            >
              <DollarSign className="w-4 h-4" />
              <span>Cobrar ({selectedRecordIds.length})</span>
            </button>

            {technicalAuditRecords.some(r => selectedRecordIds.includes(r.id) && r.status === 'Cobrado' && !r.archivado) && (
              <button
                type="button"
                onClick={() =>
                  handleBulkArchive(
                    technicalAuditRecords.filter(r => selectedRecordIds.includes(r.id) && r.status === 'Cobrado' && !r.archivado),
                    true
                  )
                }
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-600 hover:bg-slate-500 text-white transition-all shadow-xs cursor-pointer"
                title="Archivar los remitos cobrados seleccionados"
              >
                <span>
                  Archivar ({technicalAuditRecords.filter(r => selectedRecordIds.includes(r.id) && r.status === 'Cobrado' && !r.archivado).length})
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedRecordIds([])}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              Desmarcar
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[96vh] sm:max-h-[92vh] overflow-y-auto my-auto space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-500">
                  Auditoría Técnica - JOB Martin Bandiera
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Remito: {selectedRecord.remitoId}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-400 block text-[10px]">Cliente / Sede:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedRecord.clientName}</span>
                <span className="block text-slate-500 text-[11px]">{selectedRecord.siteLocation}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-400 block text-[10px]">Punto de Trabajo:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedRecord.workPoint}</span>
                <span className="block text-slate-500 text-[11px]">Fecha: {selectedRecord.date}</span>
              </div>
            </div>

            {/* Crew Details */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Responsable Técnico:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedRecord.leadTech}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Equipo de Ayudantes:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {(selectedRecord.helpers || []).join(', ') || 'Sin ayudantes'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Horas Trabajadas:</span>
                <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                  {selectedRecord.hoursWorked} HS ({selectedRecord.horaEntrada || '08:00'} a {selectedRecord.horaSalida || '13:30'})
                </span>
              </div>
            </div>

            {/* Financial Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                <span className="text-[10px] text-slate-400 block font-bold">Logística ($)</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  ${(selectedRecord.logisticsCost || 0).toLocaleString('es-AR')}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                <span className="text-[10px] text-slate-400 block font-bold">M.O. Capataz ($)</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  ${(selectedRecord.techPay || 0).toLocaleString('es-AR')}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                <span className="text-[10px] text-slate-400 block font-bold">M.O. Ayudante ($)</span>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                  ${(selectedRecord.helperPay || 0).toLocaleString('es-AR')}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-500/20">
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 block font-bold">Honorarios ($)</span>
                <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                  ${getRecordHonorarios(selectedRecord).toLocaleString('es-AR')}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-500/20 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-bold">Costo Total ($)</span>
                <span className="font-mono font-black text-amber-700 dark:text-amber-300">
                  ${getRecordCostoTotalRemito(selectedRecord).toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* Semáforo Setting in Modal */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs flex items-center justify-between">
              <span className="font-bold text-slate-700 dark:text-slate-300">Estado de Semáforo:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleSetSemaforo(selectedRecord.id, 'verde');
                    setSelectedRecord(prev => prev ? { ...prev, semaforo: 'verde' } : null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    getEffectiveSemaforo(selectedRecord) === 'verde'
                      ? 'bg-[#00c04b] text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  🟢 Verde
                </button>
                <button
                  onClick={() => {
                    handleSetSemaforo(selectedRecord.id, 'naranja');
                    setSelectedRecord(prev => prev ? { ...prev, semaforo: 'naranja' } : null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    getEffectiveSemaforo(selectedRecord) === 'naranja'
                      ? 'bg-[#ff5500] text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  🟠 Naranja
                </button>
                <button
                  onClick={() => {
                    handleSetSemaforo(selectedRecord.id, 'rojo');
                    setSelectedRecord(prev => prev ? { ...prev, semaforo: 'rojo' } : null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    getEffectiveSemaforo(selectedRecord) === 'rojo'
                      ? 'bg-[#d20418] text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  🔴 Rojo
                </button>
                <button
                  onClick={() => {
                    handleSetSemaforo(selectedRecord.id, 'neutro');
                    setSelectedRecord(prev => prev ? { ...prev, semaforo: 'neutro' } : null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    getEffectiveSemaforo(selectedRecord) === 'neutro'
                      ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  ⚪ Neutro
                </button>
              </div>
            </div>

            {/* Description */}
            {selectedRecord.description && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                <span className="text-slate-400 block text-[10px] mb-0.5">Descripción de la Intervención:</span>
                <p className="text-slate-700 dark:text-slate-200">{selectedRecord.description}</p>
              </div>
            )}

            {/* Signature */}
            {selectedRecord.signatureUrl && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                <span className="text-slate-400 block text-[10px] mb-1">Firma de Conformidad en Sitio:</span>
                <div className="bg-slate-950 p-2 rounded-xl border border-slate-700 flex justify-center">
                  <img
                    src={selectedRecord.signatureUrl}
                    alt="Firma de Conformidad"
                    className="max-h-24 object-contain"
                  />
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remito Pasado Printable Modal (Single or Consolidated Multi-Select) */}
      {(remitoPasadoRecord || remitoPasadoRecords.length > 0) && (
        <RemitoPasadoModal
          isOpen={!!remitoPasadoRecord || remitoPasadoRecords.length > 0}
          onClose={() => {
            setRemitoPasadoRecord(null);
            setRemitoPasadoRecords([]);
          }}
          record={remitoPasadoRecord}
          records={remitoPasadoRecords}
        />
      )}

      {/* Payment / Cobrado Modal */}
      {paymentRecord && (
        <PaymentModal
          isOpen={!!paymentRecord}
          onClose={() => setPaymentRecord(null)}
          records={[paymentRecord]}
          onSuccess={() => setPaymentRecord(null)}
        />
      )}

      {/* Full Edit Modal (FieldReportModal in edit mode) */}
      {recordToEdit && (
        <FieldReportModal
          isOpen={!!recordToEdit}
          onClose={() => setRecordToEdit(null)}
          recordToEdit={recordToEdit}
        />
      )}

      {/* Pasar a Facturado Modal */}
      {(facturarRecord || facturarRecords.length > 0) && (
        <PasarAFacturadoModal
          isOpen={!!facturarRecord || facturarRecords.length > 0}
          onClose={() => {
            setFacturarRecord(null);
            setFacturarRecords([]);
          }}
          record={facturarRecord}
          records={facturarRecords}
          onConfirm={async (recordIds, num, date, billing) => {
            await bulkPassToFacturado(recordIds, num, date, billing);
            setToastMessage(
              recordIds.length === 1
                ? `Remito pasado a Facturado (Factura: ${num}, Fecha: ${date})`
                : `${recordIds.length} remitos pasados a Facturado con éxito (Factura: ${num}, Fecha: ${date})`
            );
            setSelectedRecordIds([]);
            setTimeout(() => setToastMessage(null), 4000);
            setFacturarRecord(null);
            setFacturarRecords([]);
          }}
        />
      )}

      {/* Actualizar Descripciones desde Excel Modal */}
      <ActualizarDescripcionesModal
        isOpen={isUpdateDescModalOpen}
        onClose={() => setIsUpdateDescModalOpen(false)}
      />

      {/* Remito Message Modal with Read/Unread Status */}
      {activeMessageRecord && (
        <RemitoMessageModal
          isOpen={!!activeMessageRecord}
          onClose={() => setActiveMessageRecord(null)}
          record={activeMessageRecord}
          onSave={handleSaveMessage}
        />
      )}

      {/* In-App Delete Confirmation Modal (Independent of browser iframe window.confirm) */}
      {recordToDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in"
          onClick={() => !isDeleting && setRecordToDelete(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-left animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-900/60 shadow-xs">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 block">Confirmar Eliminación</span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5 truncate">
                  ¿Eliminar reporte {recordToDelete.remitoId}?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Esta acción eliminará el registro de la planilla técnica y desvinculará sus registros financieros de forma permanente.
                </p>
              </div>
            </div>

            {/* Service Summary Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">Cliente:</span>
                <span className="font-black text-slate-900 dark:text-white truncate max-w-[220px]">{recordToDelete.clientName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">Fecha:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{formatDisplayDate(recordToDelete.date)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">Técnico a Cargo:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[220px]">{recordToDelete.leadTech}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">Estado:</span>
                <span className="px-2 py-0.5 rounded-md font-black text-[10px] uppercase bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                  {recordToDelete.status}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700/60 pt-2 mt-1">
                <span className="text-slate-500 font-bold">Facturado / Sugerido:</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">
                  ${Math.round(recordToDelete.billedPrice || recordToDelete.suggestedPrice || 0).toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sí, Eliminar Reporte</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-rose-500 flex items-center gap-3 text-xs font-bold animate-in slide-in-from-bottom-3">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

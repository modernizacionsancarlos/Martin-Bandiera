import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Users,
  ShoppingCart,
  Trash2,
  Clock,
  MapPin,
  Calendar,
  CheckCircle2,
  RotateCcw,
  UserCheck,
  Shield,
  ShieldAlert,
  Plus,
  Info,
  AlertTriangle,
  Award,
  DollarSign,
  Wrench,
  Car
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth, getDeletedUsersTombstone } from '../context/AuthContext';
import { calculateAuditCosts, isWorkerOficial, roundCurrency, formatCurrency, isAdministrativeProfile, normalizeWorkerName } from '../utils/calculationUtils';
import { ClientItem, UserRole, TeamMemberAssigned, TechnicalAuditRecord } from '../types';

interface FieldReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordToEdit?: TechnicalAuditRecord | null;
}

interface JornadaItem {
  id: string;
  entrada: string;
  salida: string;
  viajes: number;
}

export const FieldReportModal: React.FC<FieldReportModalProps> = ({ isOpen, onClose, recordToEdit }) => {
  const { workers, materials, technicalParameters, technicalAuditRecords, addTechnicalAuditRecord, updateTechnicalAuditRecord, clients } = useData();
  const { currentUser, users, createUser } = useAuth();

  // Dynamic next Remito ID (e.g. #380-2026)
  const nextRemitoNum = technicalAuditRecords.reduce((max, r) => {
    const m = r.remitoId.match(/#?(\d+)-2026/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 379) + 1;
  const currentRemitoId = recordToEdit ? recordToEdit.remitoId : `#${nextRemitoNum}-2026`;

  // 1. CONFIGURACIÓN INICIAL
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [remitoPapel, setRemitoPapel] = useState<string>('');
  const [isGuardia, setIsGuardia] = useState<boolean>(false);
  const [guardiaMode, setGuardiaMode] = useState<'fijo' | 'por_hora'>('fijo');
  const [guardiaAmount, setGuardiaAmount] = useState<number>(35000);
  const [guardiaSubtype, setGuardiaSubtype] = useState<'adicional' | 'plano'>('adicional');
  const [marginPercentage, setMarginPercentage] = useState<number>(technicalParameters.defaultMarginPercentage ?? 35);
  const [marginValue, setMarginValue] = useState<number | null>(null);
  const [customSuggestedPrice, setCustomSuggestedPrice] = useState<number | null>(null);
  const [leadTech, setLeadTech] = useState<string>(currentUser.displayName || 'Carlos Gómez');
  const [customTechHourlyRate, setCustomTechHourlyRate] = useState<number | null>(null);
  const [capatazCommissionPct, setCapatazCommissionPct] = useState<number>(10);

  // Helper quick add form state
  const [newHelperName, setNewHelperName] = useState<string>('');
  const [newHelperRole, setNewHelperRole] = useState<'Oficial' | 'Ayudante'>('Ayudante');
  const [isAddingHelper, setIsAddingHelper] = useState<boolean>(false);

  // 2. UBICACIÓN Y SEDE
  const [searchClient, setSearchClient] = useState<string>('');
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);
  const [clientName, setClientName] = useState<string>(clients[0]?.razonSocial || 'BANCO NACION EUGENIO BUSTOS');
  const [siteLocation, setSiteLocation] = useState<string>(clients[0]?.fincaLocacion || clients[0]?.direccionFiscal || 'EUGENIO BUSTOS');
  const [cuit, setCuit] = useState<string>(clients[0]?.cuit || '');
  const [distanceKm, setDistanceKm] = useState<number>(clients[0]?.distanciaKm || 15);
  const [workPoint, setWorkPoint] = useState<string>('');

  // 3. JORNADA DE TRABAJO (Support multiple jornadas / viajes)
  const [jornadas, setJornadas] = useState<JornadaItem[]>([
    { id: '1', entrada: '08:00', salida: '13:30', viajes: 1 }
  ]);

  // 4. EQUIPO DE OPERARIOS EN CAMPO (Diferenciando Oficial vs Ayudante)
  const [teamMembers, setTeamMembers] = useState<TeamMemberAssigned[]>([
    {
      name: 'MARCELO QUINTEROS',
      role: 'Ayudante',
      rate: technicalParameters.pagoAyudanteHora || 5500
    }
  ]);

  // 5. SUMINISTROS Y MATERIALES
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [materialQty, setMaterialQty] = useState<number>(1);
  const [materialsList, setMaterialsList] = useState<{ id: string; name: string; qty: number; cost: number }[]>([]);

  // 6. DESCRIPCIÓN DE TAREAS
  const [description, setDescription] = useState<string>('');

  // 7. FIRMA DE CONFORMIDAD
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Pre-populate all fields when editing an existing technical audit record
  useEffect(() => {
    if (!isOpen) return;

    if (recordToEdit) {
      setDate(recordToEdit.date || new Date().toISOString().split('T')[0]);
      setRemitoPapel(recordToEdit.remitoPapel || '');
      setIsGuardia(!!recordToEdit.isGuardia);
      setGuardiaMode(recordToEdit.guardiaMode || 'fijo');
      setGuardiaAmount(recordToEdit.guardiaAmount || 35000);
      setGuardiaSubtype(recordToEdit.guardiaSubtype || 'adicional');
      setMarginPercentage(recordToEdit.marginPercentage ?? (technicalParameters.defaultMarginPercentage ?? 35));
      setLeadTech(recordToEdit.leadTech || currentUser.displayName || 'Carlos Gómez');
      setClientName(recordToEdit.clientName || 'CLIENTE GENERAL');
      setSiteLocation(recordToEdit.siteLocation || 'MENDOZA');
      setWorkPoint(recordToEdit.workPoint || '');
      setDistanceKm(recordToEdit.distanceKm || 15);
      setDescription(recordToEdit.description || '');

      if (recordToEdit.horaEntrada && recordToEdit.horaSalida) {
        setJornadas([
          {
            id: '1',
            entrada: recordToEdit.horaEntrada,
            salida: recordToEdit.horaSalida,
            viajes: recordToEdit.viajes ?? 1
          }
        ]);
      } else {
        setJornadas([{ id: '1', entrada: '08:00', salida: '13:30', viajes: recordToEdit.viajes ?? 1 }]);
      }

      if (recordToEdit.teamMembers && recordToEdit.teamMembers.length > 0) {
        setTeamMembers(recordToEdit.teamMembers);
      } else if (recordToEdit.helpers && recordToEdit.helpers.length > 0) {
        setTeamMembers(
          recordToEdit.helpers.map(h => {
            const isOf = isWorkerOficial(h, workers, users);
            return {
              name: h,
              role: isOf ? 'Oficial' : 'Ayudante',
              rate: isOf
                ? (technicalParameters.horaOficial || 9400)
                : (technicalParameters.pagoAyudanteHora || 5500)
            };
          })
        );
      } else {
        setTeamMembers([]);
      }

      if (recordToEdit.materialsDetails) {
        const parts = recordToEdit.materialsDetails.split(',').map(s => s.trim()).filter(Boolean);
        const parsed = parts.map((p, idx) => {
          const match = p.match(/^(\d+)x\s*(.*)$/);
          if (match) {
            return { id: `m-${idx}`, name: match[2], qty: parseInt(match[1], 10) || 1, cost: (recordToEdit.materialsCost || 0) / (parts.length || 1) };
          }
          return { id: `m-${idx}`, name: p, qty: 1, cost: (recordToEdit.materialsCost || 0) / (parts.length || 1) };
        });
        setMaterialsList(parsed);
      } else if (recordToEdit.materialsCost && recordToEdit.materialsCost > 0) {
        setMaterialsList([{ id: 'm-0', name: 'Materiales varios', qty: 1, cost: recordToEdit.materialsCost }]);
      } else {
        setMaterialsList([]);
      }

      const calculatedHon = recordToEdit.honorarios ?? null;
      setMarginValue(calculatedHon);
      setCustomSuggestedPrice(recordToEdit.billedPrice || recordToEdit.suggestedPrice || null);
      if (recordToEdit.capatazCommissionPct !== undefined) {
        setCapatazCommissionPct(recordToEdit.capatazCommissionPct);
      }

      if (recordToEdit.signatureUrl) {
        setHasSignature(true);
        setTimeout(() => {
          if (canvasRef.current && recordToEdit.signatureUrl) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
                ctx.drawImage(img, 0, 0);
              };
              img.src = recordToEdit.signatureUrl;
            }
          }
        }, 150);
      } else {
        setHasSignature(false);
      }
    } else {
      setDate(new Date().toISOString().split('T')[0]);
      setRemitoPapel('');
      setIsGuardia(false);
      setGuardiaMode('fijo');
      setGuardiaAmount(35000);
      setGuardiaSubtype('adicional');
      setMarginPercentage(technicalParameters.defaultMarginPercentage ?? 35);
      setMarginValue(null);
      setCustomSuggestedPrice(null);
      
      const defaultCap = capatazUsers.length > 0 ? capatazUsers[0] : null;
      setLeadTech(defaultCap?.displayName || 'RAMON BARROSO');
      setCapatazCommissionPct(defaultCap?.capatazPercentage ?? 25);

      setClientName(clients[0]?.razonSocial || 'BANCO NACION EUGENIO BUSTOS');
      setSiteLocation(clients[0]?.fincaLocacion || clients[0]?.direccionFiscal || 'EUGENIO BUSTOS');
      setCuit(clients[0]?.cuit || '');
      setDistanceKm(clients[0]?.distanciaKm || 15);
      setWorkPoint('');
      setJornadas([{ id: '1', entrada: '08:00', salida: '13:30', viajes: 1 }]);
      setTeamMembers([]);
      setMaterialsList([]);
      setDescription('');
      setHasSignature(false);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [isOpen, recordToEdit]);

  // Calculate real hours worked across all jornadas
  const calculateJornadaHours = (entrada: string, salida: string): number => {
    if (!entrada || !salida) return 0;
    try {
      const [hIn, mIn] = entrada.split(':').map(Number);
      const [hOut, mOut] = salida.split(':').map(Number);
      if (isNaN(hIn) || isNaN(mIn) || isNaN(hOut) || isNaN(mOut)) return 0;
      const startMin = hIn * 60 + mIn;
      const endMin = hOut * 60 + mOut;
      const diffMin = endMin >= startMin ? endMin - startMin : 24 * 60 - startMin + endMin;
      return Math.round((diffMin / 60) * 10) / 10;
    } catch {
      return 0;
    }
  };

  const totalRealHours = jornadas.reduce((acc, j) => acc + calculateJornadaHours(j.entrada, j.salida), 0);
  const totalViajes = jornadas.reduce((acc, j) => acc + (Number(j.viajes) || 0), 0);
  const totalMaterialsCost = materialsList.reduce((acc, m) => acc + m.cost, 0);

  // Add Jornada / Viaje
  const handleAddJornada = () => {
    setJornadas(prev => [
      ...prev,
      { id: Date.now().toString(), entrada: '08:00', salida: '12:00', viajes: 1 }
    ]);
  };

  // Remove Jornada / Viaje: permits deleting any journey or resetting to 0
  const handleRemoveJornada = (id: string) => {
    if (jornadas.length <= 1) {
      setJornadas([{ id: Date.now().toString(), entrada: '', salida: '', viajes: 0 }]);
      return;
    }
    setJornadas(prev => prev.filter(j => j.id !== id));
  };

  const handleUpdateJornada = (id: string, field: 'entrada' | 'salida' | 'viajes', value: any) => {
    setJornadas(prev =>
      prev.map(j => (j.id === id ? { ...j, [field]: value } : j))
    );
  };

  // Team member management
  const toggleTeamMember = (name: string, forcedRole?: 'Oficial' | 'Ayudante') => {
    setTeamMembers(prev => {
      const exists = prev.some(m => m.name.toLowerCase() === name.toLowerCase());
      if (exists) {
        return prev.filter(m => m.name.toLowerCase() !== name.toLowerCase());
      } else {
        const foundWorker = workers.find(w => w.name.toLowerCase().trim() === name.toLowerCase().trim());
        const isOf = forcedRole ? forcedRole === 'Oficial' : isWorkerOficial(name, workers, users);
        const role = isOf ? 'Oficial' : 'Ayudante';
        const rate = (foundWorker?.hourlyRate && foundWorker.hourlyRate > 0)
          ? foundWorker.hourlyRate
          : isOf
            ? (technicalParameters.horaOficial || 9400)
            : (technicalParameters.pagoAyudanteHora || 5500);
        return [...prev, { name, role, rate }];
      }
    });
  };

  const updateTeamMemberRole = (name: string, role: 'Oficial' | 'Ayudante') => {
    setTeamMembers(prev =>
      prev.map(m => {
        if (m.name.toLowerCase() === name.toLowerCase()) {
          const foundWorker = workers.find(w => w.name.toLowerCase().trim() === name.toLowerCase().trim());
          const defaultRate = (foundWorker?.hourlyRate && foundWorker.hourlyRate > 0)
            ? foundWorker.hourlyRate
            : role === 'Oficial'
              ? (technicalParameters.horaOficial || 9400)
              : (technicalParameters.pagoAyudanteHora || 5500);
          return { ...m, role, rate: m.rate > 0 ? m.rate : defaultRate };
        }
        return m;
      })
    );
  };

  const updateTeamMemberRate = (name: string, rate: number) => {
    setTeamMembers(prev =>
      prev.map(m => {
        if (m.name.toLowerCase() === name.toLowerCase()) {
          return { ...m, rate };
        }
        return m;
      })
    );
  };

  const removeTeamMember = (name: string) => {
    setTeamMembers(prev => prev.filter(m => m.name.toLowerCase() !== name.toLowerCase()));
  };

  // Keep selectedHelpers in sync as string array for backward compatibility
  const selectedHelpers = useMemo(() => teamMembers.map(m => m.name), [teamMembers]);

  // Dynamic user groupings for Lead Technician & Capataz combining users and workers
  const capatazUsers = useMemo(() => {
    const { uids: deletedUids, emails: deletedEmails, names: deletedNames } = getDeletedUsersTombstone();
    const list: { id: string; displayName: string; cuadrilla: string; capatazPercentage: number }[] = [];
    const seen = new Set<string>();

    const processCapataz = (id: string, name: string, cuadrilla?: string, capPct?: number) => {
      const norm = normalizeWorkerName(name);
      if (!norm || seen.has(norm)) return;
      seen.add(norm);
      const defaultPct = (norm.includes('morales') || norm.includes('quinteros')) ? 20 : 25;
      list.push({
        id,
        displayName: name,
        cuadrilla: cuadrilla || 'Cuadrilla Campo',
        capatazPercentage: capPct ?? defaultPct
      });
    };

    // 1. From Workers
    workers.filter(w => {
      const isCap = w.role === 'Capataz' || w.category === 'Capataz';
      if (!isCap || w.active === false || w.isAdministrative || isAdministrativeProfile(w)) return false;
      const em = (w.email || '').toLowerCase().trim();
      const nm = (w.name || '').toLowerCase().trim();
      if (deletedUids.has(w.id) || (em && deletedEmails.has(em)) || (nm && deletedNames.has(nm))) return false;
      return true;
    }).forEach(w => {
      processCapataz(w.id || `w-cap-${w.name}`, w.name, w.cuadrilla, w.capatazPercentage);
    });

    // 2. From Users
    users.filter(u => {
      const isCap = u.role === 'Capataz' || (u as any).category === 'Capataz';
      if (!isCap || u.active === false || u.isAdministrative || isAdministrativeProfile(u)) return false;
      const em = (u.email || '').toLowerCase().trim();
      const nm = (u.displayName || '').toLowerCase().trim();
      if (deletedUids.has(u.uid) || (em && deletedEmails.has(em)) || (nm && deletedNames.has(nm))) return false;
      return true;
    }).forEach(u => {
      processCapataz(u.uid || `cap-${u.displayName}`, u.displayName, u.cuadrilla, u.capatazPercentage);
    });

    return list.sort((a, b) => a.displayName.localeCompare(b.displayName, 'es', { sensitivity: 'base' }));
  }, [users, workers]);

  // Selected lead tech user/worker profile
  const selectedLeadUser = useMemo(() => {
    const foundUser = users.find(u => normalizeWorkerName(u.displayName) === normalizeWorkerName(leadTech));
    if (foundUser) return foundUser;
    const foundWorker = workers.find(w => normalizeWorkerName(w.name) === normalizeWorkerName(leadTech));
    if (foundWorker) {
      return {
        uid: foundWorker.id,
        displayName: foundWorker.name,
        role: foundWorker.role,
        cargo: foundWorker.cargo,
        specialty: foundWorker.specialty,
        cuadrilla: foundWorker.cuadrilla,
        hourlyRate: foundWorker.hourlyRate,
        capatazPercentage: foundWorker.capatazPercentage
      } as any;
    }
    return undefined;
  }, [users, workers, leadTech]);

  const isLeadTechCapataz = selectedLeadUser?.role === 'Capataz' || leadTech.toLowerCase().includes('capataz');

  // Automatically load Capataz commission % configured in personal/cuadrilla settings (for new remitos or lead changes)
  useEffect(() => {
    if (isLeadTechCapataz && !recordToEdit) {
      const configuredPct = selectedLeadUser?.capatazPercentage ?? (leadTech.toLowerCase().includes('morales') || leadTech.toLowerCase().includes('quinteros') ? 20 : 25);
      setCapatazCommissionPct(configuredPct);
    }
  }, [isLeadTechCapataz, selectedLeadUser, recordToEdit, leadTech]);

  // Dynamic available helpers strictly derived from active operational database personnel (excluding administrative)
  const dynamicAvailableHelpers = useMemo(() => {
    const { uids: deletedUids, emails: deletedEmails, names: deletedNames } = getDeletedUsersTombstone();
    const list: { name: string; role: string; cuadrilla: string; specialty: string }[] = [];
    const seenNames = new Set<string>();

    const addHelper = (name: string, role: string, cuadrilla?: string, specialty?: string) => {
      const clean = (name || '').trim();
      const norm = normalizeWorkerName(clean);
      if (!norm || seenNames.has(norm)) return;
      seenNames.add(norm);
      list.push({
        name: clean,
        role: role || 'Ayudante',
        cuadrilla: cuadrilla || 'Cuadrilla de Campo',
        specialty: specialty || (role === 'Capataz' ? 'Capataz de Obra' : 'Ayudante')
      });
    };

    // 1. Add active operational workers (exclude administrative)
    workers
      .filter(w => {
        if (w.active === false || w.isAdministrative || isAdministrativeProfile(w)) return false;
        const em = (w.email || '').toLowerCase().trim();
        const nm = (w.name || '').toLowerCase().trim();
        if (deletedUids.has(w.id) || (em && deletedEmails.has(em)) || (nm && deletedNames.has(nm))) return false;
        return true;
      })
      .forEach(w => {
        addHelper(w.name, w.role, w.cuadrilla, w.cargo || w.specialty);
      });

    // 2. Add active operational users (exclude administrative)
    users
      .filter(u => {
        if (u.active === false || u.isAdministrative || isAdministrativeProfile(u)) return false;
        const em = (u.email || '').toLowerCase().trim();
        const nm = (u.displayName || '').toLowerCase().trim();
        if (deletedUids.has(u.uid) || (em && deletedEmails.has(em)) || (nm && deletedNames.has(nm))) return false;
        return true;
      })
      .forEach(u => {
        addHelper(u.displayName, u.role, u.cuadrilla, u.cargo || u.specialty);
      });

    return list.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }, [users, workers]);

  // Quick Register and Assign Helper to Cuadrilla in database
  const handleQuickAddHelper = () => {
    const trimmed = newHelperName.trim();
    if (!trimmed) return;

    const rate = newHelperRole === 'Oficial'
      ? (technicalParameters.horaOficial || 9400)
      : (technicalParameters.pagoAyudanteHora || 5500);

    const normTrimmed = normalizeWorkerName(trimmed);
    const existingWorker = workers.find(w => normalizeWorkerName(w.name) === normTrimmed);
    const existingUser = users.find(u => normalizeWorkerName(u.displayName) === normTrimmed);
    const matchedName = existingWorker?.name || existingUser?.displayName || trimmed;

    if (existingWorker || existingUser) {
      if (!teamMembers.some(m => normalizeWorkerName(m.name) === normTrimmed)) {
        setTeamMembers(prev => [...prev, { name: matchedName, role: newHelperRole, rate }]);
      }
    } else {
      // Create and persist user in DB with role Empleado linked to cuadrilla
      const safeEmail = `${trimmed.toLowerCase().replace(/[^a-z0-9]/g, '.')}@bandiera.com`;
      createUser({
        displayName: trimmed,
        email: safeEmail,
        role: 'Empleado',
        category: newHelperRole === 'Oficial' ? 'Oficial' : 'Ayudante',
        isAdministrative: false,
        specialty: newHelperRole === 'Oficial' ? 'Oficial Especialista' : 'Ayudante de Cuadrilla',
        cargo: newHelperRole === 'Oficial' ? 'Oficial Técnico' : 'Ayudante de Cuadrilla',
        cuadrilla: selectedLeadUser?.cuadrilla || 'Cuadrilla 1 - Valle de Uco',
        active: true
      });
      setTeamMembers(prev => [...prev, { name: trimmed, role: newHelperRole, rate }]);
    }

    setNewHelperName('');
    setIsAddingHelper(false);
  };

  // Live real-time audit cost calculations matching execution formulas
  const calculatedHours = totalRealHours > 0 ? totalRealHours : 4.0;
  const effectiveDistanceKm = !isNaN(Number(distanceKm)) ? Math.max(0, Number(distanceKm)) : 0;

  const selectedLeadWorker = workers.find(w => normalizeWorkerName(w.name) === normalizeWorkerName(leadTech));
  const defaultLeadRate = selectedLeadWorker?.hourlyRate && selectedLeadWorker.hourlyRate > 0
    ? selectedLeadWorker.hourlyRate
    : selectedLeadUser?.hourlyRate && selectedLeadUser.hourlyRate > 0
      ? selectedLeadUser.hourlyRate
      : (technicalParameters.horaOficial || technicalParameters.horaBase || 9400);

  const effectiveTechHourlyRate = customTechHourlyRate !== null
    ? customTechHourlyRate
    : defaultLeadRate;

  const liveCosts = calculateAuditCosts(technicalParameters, {
    hoursWorked: calculatedHours,
    travelHours: totalViajes * 1.5,
    viajes: totalViajes,
    distanceKm: effectiveDistanceKm,
    isGuardia,
    guardiaType: isGuardia ? 'GUARDIA_50' : 'NO_GUARDIA',
    guardiaMode: isGuardia ? guardiaMode : undefined,
    guardiaAmount: isGuardia ? guardiaAmount : undefined,
    guardiaSubtype: isGuardia ? guardiaSubtype : undefined,
    marginPercentage: marginPercentage,
    helpersCount: teamMembers.length,
    materialsCost: totalMaterialsCost,
    leadTechName: leadTech,
    helperNames: selectedHelpers,
    teamMembers: teamMembers,
    workers,
    users,
    customTechHourlyRate: effectiveTechHourlyRate
  });

  // Calculate default margin value in $
  const defaultMarginValue = roundCurrency((liveCosts.operatingCost || 0) * ((technicalParameters.defaultMarginPercentage ?? 35) / 100));

  const effectiveMarginValue = marginValue !== null
    ? marginValue
    : customSuggestedPrice !== null
      ? Math.max(0, customSuggestedPrice - (liveCosts.operatingCost || 0))
      : defaultMarginValue;

  const effectiveSuggestedPrice = customSuggestedPrice !== null
    ? customSuggestedPrice
    : roundCurrency((liveCosts.operatingCost || 0) + effectiveMarginValue);

  // Capataz Profit calculated strictly on Costo de Servicio / M.O. Directa
  const estimatedCapatazProfit = isLeadTechCapataz
    ? roundCurrency(liveCosts.laborDirectCost * (capatazCommissionPct / 100))
    : 0;

  // Materials logic
  const handleAddMaterial = () => {
    if (!selectedMaterialId) return;
    const mat = materials.find(m => m.id === selectedMaterialId);
    if (!mat) return;

    const cost = mat.unitPrice * materialQty;
    setMaterialsList(prev => [
      ...prev,
      { id: mat.id, name: mat.name, qty: materialQty, cost }
    ]);
    setSelectedMaterialId('');
    setMaterialQty(1);
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterialsList(prev => prev.filter((_, i) => i !== index));
  };

  // Client search filter connected directly to the Client Database
  const filteredClients = clients.filter(c =>
    c.razonSocial.toLowerCase().includes(searchClient.toLowerCase()) ||
    c.fincaLocacion.toLowerCase().includes(searchClient.toLowerCase()) ||
    c.cuit.includes(searchClient) ||
    c.direccionFiscal.toLowerCase().includes(searchClient.toLowerCase())
  );

  const handleSelectClient = (client: ClientItem) => {
    setClientName(client.razonSocial);
    setSiteLocation(client.fincaLocacion || client.direccionFiscal || '');
    setCuit(client.cuit || '');
    setDistanceKm(client.distanciaKm || 0);
    setSearchClient(client.razonSocial);
    setShowClientDropdown(false);
  };

  // Canvas Drawing Handlers (Touch + Mouse support for mobile & tablet)
  const getCanvasCoords = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    } else if ('clientX' in e) {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasSignature(true);
    const coords = getCanvasCoords(e.nativeEvent, canvas);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e.nativeEvent, canvas);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let signatureUrl = '';
    if (canvasRef.current && hasSignature) {
      signatureUrl = canvasRef.current.toDataURL('image/png');
    }

    const effectiveCapatazCommissionPct = isLeadTechCapataz ? capatazCommissionPct : undefined;
    const effectiveCapatazProfit = isLeadTechCapataz ? estimatedCapatazProfit : undefined;
    const effectiveHonorarios = effectiveMarginValue;

    if (recordToEdit) {
      updateTechnicalAuditRecord(recordToEdit.id, {
        remitoPapel: remitoPapel.trim() || undefined,
        date,
        clientName: clientName || 'CLIENTE GENERAL',
        siteLocation: siteLocation || 'MENDOZA',
        workPoint: workPoint || 'SERVICIO GENERAL EN PLANTA',
        isGuardia,
        guardiaType: isGuardia ? 'GUARDIA_50' : 'NO_GUARDIA',
        guardiaMode: isGuardia ? guardiaMode : undefined,
        guardiaAmount: isGuardia ? guardiaAmount : undefined,
        guardiaSubtype: isGuardia ? guardiaSubtype : undefined,
        marginPercentage: marginPercentage,
        honorarios: effectiveHonorarios,
        hoursWorked: calculatedHours,
        travelHours: totalViajes * 1.5,
        viajes: totalViajes,
        distanceKm: effectiveDistanceKm,
        horaEntrada: jornadas[0]?.entrada || '08:00',
        horaSalida: jornadas[0]?.salida || '13:30',
        materialsCost: totalMaterialsCost,
        materialsDetails: materialsList.map(m => `${m.qty}x ${m.name}`).join(', ') || undefined,
        description: description || 'Mantenimiento técnico e inspección electromecánica.',
        billedPrice: effectiveSuggestedPrice,
        logisticsCost: liveCosts.logisticsCost,
        fuelCost: liveCosts.fuelCost,
        seguroCost: liveCosts.seguroCost,
        amortizacionCost: liveCosts.amortizacionCost,
        laborDirectCost: liveCosts.laborDirectCost,
        operatingCost: liveCosts.operatingCost,
        suggestedPrice: effectiveSuggestedPrice,
        helperPay: liveCosts.helperPay,
        techPay: liveCosts.techPay,
        leadTech: leadTech || 'Carlos Gómez',
        helpers: selectedHelpers,
        teamMembers: teamMembers,
        signatureUrl: signatureUrl || recordToEdit.signatureUrl || undefined,
        capatazCommissionPct: effectiveCapatazCommissionPct,
        capatazProfit: effectiveCapatazProfit
      });
    } else {
      addTechnicalAuditRecord({
        remitoId: currentRemitoId,
        remitoPapel: remitoPapel.trim() || undefined,
        date,
        clientName: clientName || 'CLIENTE GENERAL',
        siteLocation: siteLocation || 'MENDOZA',
        workPoint: workPoint || 'SERVICIO GENERAL EN PLANTA',
        isGuardia,
        guardiaType: isGuardia ? 'GUARDIA_50' : 'NO_GUARDIA',
        guardiaMode: isGuardia ? guardiaMode : undefined,
        guardiaAmount: isGuardia ? guardiaAmount : undefined,
        guardiaSubtype: isGuardia ? guardiaSubtype : undefined,
        marginPercentage: marginPercentage,
        honorarios: effectiveHonorarios,
        hoursWorked: calculatedHours,
        travelHours: totalViajes * 1.5,
        viajes: totalViajes,
        distanceKm: effectiveDistanceKm,
        horaEntrada: jornadas[0]?.entrada || '08:00',
        horaSalida: jornadas[0]?.salida || '13:30',
        materialsCost: totalMaterialsCost,
        materialsDetails: materialsList.map(m => `${m.qty}x ${m.name}`).join(', ') || undefined,
        description: description || 'Mantenimiento técnico e inspección electromecánica.',
        billedPrice: effectiveSuggestedPrice,
        collectedPrice: 0,
        logisticsCost: liveCosts.logisticsCost,
        fuelCost: liveCosts.fuelCost,
        seguroCost: liveCosts.seguroCost,
        amortizacionCost: liveCosts.amortizacionCost,
        laborDirectCost: liveCosts.laborDirectCost,
        operatingCost: liveCosts.operatingCost,
        suggestedPrice: effectiveSuggestedPrice,
        helperPay: liveCosts.helperPay,
        techPay: liveCosts.techPay,
        leadTech: leadTech || 'Carlos Gómez',
        helpers: selectedHelpers,
        teamMembers: teamMembers,
        signatureUrl: signatureUrl || undefined,
        status: 'Cargado',
        semaforo: 'rojo',
        capatazCommissionPct: effectiveCapatazCommissionPct,
        capatazProfit: effectiveCapatazProfit
      });
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-[#f0f9ff] dark:bg-slate-900 border border-cyan-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-3xl my-auto shadow-2xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh] animate-in fade-in zoom-in-95">
        
        {/* HEADER BAR (Vibrant Cyan Banner matching Image 1) */}
        <div className="bg-[#00c2ff] px-6 py-4 flex items-center justify-between shadow-md shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-black italic tracking-wide text-white drop-shadow-xs">
              {recordToEdit ? 'EDITAR REGISTRO DE CAMPO' : 'REGISTRO DE CAMPO'}
            </h2>
            <p className="text-white/80 text-[11px] font-medium hidden sm:block">
              {recordToEdit
                ? `Modificación integral de todos los campos del remito ${recordToEdit.remitoId}`
                : 'Parte diario operativo, cuadrilla técnica y costos en tiempo real'}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="bg-white/20 backdrop-blur-xs text-white font-mono font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-inner">
              SISTEMA {currentRemitoId}
            </span>
            {remitoPapel.trim() && (
              <span className="bg-amber-400 text-slate-950 font-mono font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-md hidden sm:inline-flex items-center gap-1">
                <span>📄 PAPEL:</span>
                <span>#{remitoPapel.trim()}</span>
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SCROLLABLE FORM BODY */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* 1. CONFIGURACIÓN INICIAL */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#00c2ff] border-b border-cyan-200 dark:border-cyan-900 pb-1.5">
              CONFIGURACIÓN INICIAL
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Fecha de Servicio */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  Fecha de Servicio
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-medium shadow-xs focus:ring-2 focus:ring-[#00c2ff] focus:outline-none"
                  />
                </div>
              </div>

              {/* Nº Remito Papel (Carga Manual Obligatoria/Opcional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    Nº Remito Papel (Carga Manual)
                  </label>
                  <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-200 dark:border-cyan-800">
                    Talonario Físico
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ej: 0001-00004523 ó 4523"
                    value={remitoPapel}
                    onChange={e => setRemitoPapel(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-cyan-300 dark:border-cyan-700 text-slate-900 dark:text-white placeholder-slate-400 font-mono font-black shadow-xs focus:ring-2 focus:ring-[#00c2ff] focus:outline-none"
                  />
                </div>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1">
                  Ingrese el número físico del talonario o remito de papel firmado a mano.
                </p>
              </div>

              {/* ¿Es Trabajo de Guardia? */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>¿Es Trabajo de Guardia?</span>
                  {isGuardia && (
                    <span className="text-[10px] font-black text-[#00c2ff] uppercase bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                      Modo Manual Activo
                    </span>
                  )}
                </label>
                <select
                  value={isGuardia ? 'SI' : 'NO'}
                  onChange={e => setIsGuardia(e.target.value === 'SI')}
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-black uppercase shadow-xs focus:ring-2 focus:ring-[#00c2ff] focus:outline-none cursor-pointer"
                >
                  <option value="NO">GUARDIA NO</option>
                  <option value="SI">GUARDIA SÍ (VALOR MANUAL / POR HORAS)</option>
                </select>

                {/* Sub-panel de Guardia Manual si está activo */}
                {isGuardia && (
                  <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-br from-cyan-950/20 to-slate-900/40 dark:bg-cyan-950/30 border border-cyan-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-[#00c2ff] flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-[#00c2ff]" />
                        Valoración de Guardia
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Sin recargo automático fijo
                      </span>
                    </div>

                    {/* Selector de Modalidad: Monto Fijo vs Según Horas Trabajadas */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setGuardiaMode('fijo')}
                        className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border ${
                          guardiaMode === 'fijo'
                            ? 'bg-[#00c2ff] text-white border-[#00c2ff] shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        💰 Monto Fijo ($)
                      </button>
                      <button
                        type="button"
                        onClick={() => setGuardiaMode('por_hora')}
                        className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border ${
                          guardiaMode === 'por_hora'
                            ? 'bg-[#00c2ff] text-white border-[#00c2ff] shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        ⏱️ Según Horas ($/h)
                      </button>
                    </div>

                    {/* Controles según modalidad */}
                    {guardiaMode === 'fijo' ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Monto Fijo Total de Guardia ($)
                          </label>
                          {/* Botones de montos sugeridos rápidos */}
                          <div className="flex items-center gap-1">
                            {[25000, 35000, 50000, 75000].map(amt => (
                              <button
                                key={amt}
                                type="button"
                                onClick={() => setGuardiaAmount(amt)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-all ${
                                  guardiaAmount === amt
                                    ? 'bg-[#00c2ff] text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                                }`}
                              >
                                ${(amt / 1000)}k
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400">$</span>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={guardiaAmount === 0 ? '' : guardiaAmount}
                            onChange={e => setGuardiaAmount(Math.max(0, Number(e.target.value) || 0))}
                            placeholder="Ej: 35000"
                            className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-black text-sm focus:ring-2 focus:ring-[#00c2ff] focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-[11px] pt-1">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-semibold">
                            <input
                              type="radio"
                              name="guardiaSubtype"
                              checked={guardiaSubtype === 'adicional'}
                              onChange={() => setGuardiaSubtype('adicional')}
                              className="text-[#00c2ff] focus:ring-[#00c2ff]"
                            />
                            <span>Adicional a horas de cuadrilla (+${(guardiaAmount || 0).toLocaleString('es-AR')})</span>
                          </label>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-semibold">
                            <input
                              type="radio"
                              name="guardiaSubtype"
                              checked={guardiaSubtype === 'plano'}
                              onChange={() => setGuardiaSubtype('plano')}
                              className="text-[#00c2ff] focus:ring-[#00c2ff]"
                            />
                            <span>Tarifa total cerrada de M.O. (${(guardiaAmount || 0).toLocaleString('es-AR')})</span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Valor de Guardia por Hora Trabajada ($/h)
                          </label>
                          {/* Botones de tarifas horarias sugeridas */}
                          <div className="flex items-center gap-1">
                            {[10000, 15000, 20000, 25000].map(rate => (
                              <button
                                key={rate}
                                type="button"
                                onClick={() => setGuardiaAmount(rate)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-all ${
                                  guardiaAmount === rate
                                    ? 'bg-[#00c2ff] text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                                }`}
                              >
                                ${(rate / 1000)}k/h
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400">$</span>
                          <input
                            type="number"
                            min="0"
                            step="500"
                            value={guardiaAmount === 0 ? '' : guardiaAmount}
                            onChange={e => setGuardiaAmount(Math.max(0, Number(e.target.value) || 0))}
                            placeholder="Ej: 15000"
                            className="w-full pl-8 pr-16 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-black text-sm focus:ring-2 focus:ring-[#00c2ff] focus:outline-none"
                          />
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">/ hora</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-[11px] pt-1">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-semibold">
                            <input
                              type="radio"
                              name="guardiaSubtype"
                              checked={guardiaSubtype === 'adicional'}
                              onChange={() => setGuardiaSubtype('adicional')}
                              className="text-[#00c2ff] focus:ring-[#00c2ff]"
                            />
                            <span>Adicional por hora ({calculatedHours}h × ${(guardiaAmount || 0).toLocaleString('es-AR')})</span>
                          </label>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-semibold">
                            <input
                              type="radio"
                              name="guardiaSubtype"
                              checked={guardiaSubtype === 'plano'}
                              onChange={() => setGuardiaSubtype('plano')}
                              className="text-[#00c2ff] focus:ring-[#00c2ff]"
                            />
                            <span>Tarifa horaria directa</span>
                          </label>
                        </div>
                        <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">
                          Total de guardia: {calculatedHours} hs × ${(guardiaAmount || 0).toLocaleString('es-AR')} = <strong>${(calculatedHours * (guardiaAmount || 0)).toLocaleString('es-AR')}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Responsable Técnico vinculado a Usuarios y Roles */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>Responsable Técnico / Capataz</span>
                  {selectedLeadUser && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-cyan-100 dark:bg-cyan-900/60 text-[#00c2ff]">
                      {selectedLeadUser.role}
                    </span>
                  )}
                </label>
                <select
                  value={leadTech}
                  onChange={e => {
                    const chosen = e.target.value;
                    setLeadTech(chosen);
                    const matchedCap = capatazUsers.find(c => c.displayName.toLowerCase() === chosen.toLowerCase());
                    if (matchedCap && matchedCap.capatazPercentage !== undefined) {
                      setCapatazCommissionPct(matchedCap.capatazPercentage);
                    } else {
                      const userObj = users.find(u => u.displayName.toLowerCase() === chosen.toLowerCase());
                      const workerObj = workers.find(w => w.name.toLowerCase() === chosen.toLowerCase());
                      const isCap = userObj?.role === 'Capataz' || (userObj as any)?.category === 'Capataz' || workerObj?.role === 'Capataz' || workerObj?.category === 'Capataz';
                      if (isCap) {
                        const pct = workerObj?.capatazPercentage ?? userObj?.capatazPercentage ?? (chosen.toLowerCase().includes('morales') || chosen.toLowerCase().includes('quinteros') ? 20 : 25);
                        setCapatazCommissionPct(pct);
                      }
                    }
                  }}
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium shadow-xs focus:ring-2 focus:ring-[#00c2ff] focus:outline-none cursor-pointer"
                >
                  <option value="">Seleccionar Capataz de Obra...</option>

                  {/* Responsable histórico si está asignado previamente */}
                  {leadTech && !capatazUsers.some(u => u.displayName.toLowerCase() === leadTech.toLowerCase()) && (
                    <option value={leadTech}>
                      {leadTech} (Asignado en remito)
                    </option>
                  )}

                  {/* Únicamente Nómina de Capataces de Obra */}
                  {capatazUsers.length > 0 ? (
                    <optgroup label="👷 Capataces de Obra Habilitados (Nómina)">
                      {capatazUsers.map(u => (
                        <option key={`cap-${u.id}`} value={u.displayName}>
                          {u.displayName} ({u.cuadrilla || 'Cuadrilla Campo'}) — {u.capatazPercentage}% Ganancia
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    <option value="" disabled>
                      No hay capataces registrados (Cárguelos en Gestión de Personal)
                    </option>
                  )}
                </select>

                {/* Tarifa $/h editable del Responsable Técnico según quien se seleccione */}
                {leadTech && (
                  <div className="mt-2.5 flex items-center justify-between gap-2 p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-[#00c2ff] shrink-0" />
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        Tarifa $/h del Responsable ({leadTech}):
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-cyan-400">
                        <span className="font-mono font-bold text-slate-400 text-xs">$</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={effectiveTechHourlyRate}
                          onChange={e => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value.replace(',', '.')) || 0;
                            setCustomTechHourlyRate(val);
                          }}
                          className="w-20 font-mono font-black text-xs text-slate-900 dark:text-white text-center focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-400 font-bold">/h</span>
                      </div>
                      {customTechHourlyRate !== null && (
                        <button
                          type="button"
                          onClick={() => setCustomTechHourlyRate(null)}
                          className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline font-bold cursor-pointer"
                          title="Restablecer a la tarifa base configurada"
                        >
                          ↺ Restablecer
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Ficha Dinámica si el Responsable es Capataz */}
            {isLeadTechCapataz && (
              <div className="mt-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2.5 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      Liquidación Capataz de Obra: {selectedLeadUser?.displayName || leadTech}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    {selectedLeadUser?.cuadrilla || 'Cuadrilla 1 - Valle de Uco'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-amber-500/20">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span>% Comisión Capataz sobre Costo de Servicio (M.O. Directa):</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="relative w-28">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={capatazCommissionPct}
                        onChange={e => setCapatazCommissionPct(Number(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 pr-7 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 font-black text-xs text-amber-600 dark:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-right"
                      />
                      <span className="absolute right-2.5 top-1.5 text-xs font-bold text-slate-400">%</span>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase">Ganancia Capataz:</div>
                      <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                        ${estimatedCapatazProfit.toLocaleString('es-AR')}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[10.5px] text-slate-600 dark:text-slate-400 italic">
                  ℹ️ El cálculo de la auditoría técnica liquida la comisión estrictamente sobre el Costo de Servicio / M.O. Directa (${liveCosts.laborDirectCost.toLocaleString('es-AR')}), excluyendo logística y materiales.
                </p>
              </div>
            )}
          </div>

          {/* 2. UBICACIÓN Y SEDE */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#00c2ff] border-b border-cyan-200 dark:border-cyan-900 pb-1.5">
              UBICACIÓN Y SEDE
            </h3>

            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 shadow-xs space-y-3.5">
              {/* Search input with bold italic uppercase placeholder */}
              <div className="relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="BUSCAR CLIENTE DE LA BASE DE DATOS (POR RAZÓN SOCIAL, CUIT O FINCA)..."
                  value={searchClient}
                  onFocus={() => setShowClientDropdown(true)}
                  onChange={e => {
                    setSearchClient(e.target.value);
                    setShowClientDropdown(true);
                  }}
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 font-bold italic uppercase shadow-xs focus:ring-2 focus:ring-[#00c2ff] focus:outline-none text-xs"
                />

                {/* Autocomplete Dropdown */}
                {showClientDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-56 overflow-y-auto z-30 p-1 divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredClients.length > 0 ? (
                      filteredClients.map((c, cIdx) => (
                        <div
                          key={c.id ? `client-${c.id}` : `client-${c.razonSocial}-${cIdx}`}
                          onClick={() => handleSelectClient(c)}
                          className="px-3.5 py-2.5 hover:bg-cyan-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer flex items-center justify-between text-xs transition"
                        >
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white uppercase">{c.razonSocial}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {c.fincaLocacion && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                                  <MapPin className="w-3 h-3 text-rose-500" />
                                  {c.fincaLocacion}
                                </span>
                              )}
                              {c.cuit && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  CUIT: {c.cuit}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50 px-2 py-0.5 rounded-lg border border-cyan-200 dark:border-cyan-800 shrink-0">
                            {c.distanciaKm} km
                          </span>
                        </div>
                      ))
                    ) : (
                      <div
                        onClick={() => {
                          setClientName(searchClient.toUpperCase());
                          setShowClientDropdown(false);
                        }}
                        className="px-3.5 py-2.5 hover:bg-cyan-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer text-xs font-bold text-cyan-600 uppercase"
                      >
                        + Usar cliente manual: "{searchClient}"
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Client Info Card with Distance KM */}
              <div className="p-3.5 rounded-2xl bg-cyan-50/80 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <span className="text-[10px] font-black uppercase text-cyan-700 dark:text-cyan-400 block mb-0.5">
                    Cliente Seleccionado
                  </span>
                  <p className="font-bold text-slate-900 dark:text-white text-xs uppercase">
                    {clientName || 'Sin seleccionar'}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                    <span>{siteLocation || 'Ubicación no especificada'}</span>
                    {cuit && <span className="ml-1 font-mono text-[10px]">({cuit})</span>}
                  </p>
                </div>

                <div className="flex flex-col justify-center">
                  <label className="text-[10px] font-black uppercase text-cyan-700 dark:text-cyan-400 mb-1 flex items-center justify-between">
                    <span>Distancia Viaje</span>
                    <span className="text-[9px] text-slate-400 font-normal">Auto-vinculado</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={distanceKm}
                      onChange={e => setDistanceKm(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 font-mono font-bold text-xs text-cyan-800 dark:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-[#00c2ff]"
                    />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">KM</span>
                  </div>
                </div>
              </div>

              {/* Ubicación Específica / Punto de Trabajo */}
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#00c2ff]">
                  UBICACIÓN ESPECÍFICA / PUNTO DE TRABAJO
                </label>
                <input
                  type="text"
                  placeholder="EJ: TABLERO PRINCIPAL, POZO SECTOR NORTE, GALPÓN B..."
                  value={workPoint}
                  onChange={e => setWorkPoint(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 font-medium shadow-xs focus:ring-2 focus:ring-[#00c2ff] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. JORNADA DE TRABAJO Y TRASLADOS */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-200 dark:border-cyan-900 pb-1.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#00c2ff]">
                JORNADA DE TRABAJO Y VIAJES
              </h3>
              <div className="flex items-center gap-2">
                <span className="bg-[#00c2ff] text-white font-black text-xs px-3.5 py-1 rounded-full uppercase shadow-xs">
                  {totalRealHours} HS REALES
                </span>
                <span
                  className={`font-black text-xs px-3.5 py-1 rounded-full uppercase shadow-xs transition-colors ${
                    totalViajes > 0 ? 'bg-[#ff7a00] text-white' : 'bg-slate-500 text-white'
                  }`}
                >
                  {totalViajes > 0 ? `${totalViajes} ${totalViajes === 1 ? 'VIAJE' : 'VIAJES'}` : '0 VIAJES (SIN LOGÍSTICA)'}
                </span>
              </div>
            </div>

            {/* Jornada Items Cards */}
            <div className="space-y-2.5">
              {jornadas.map((j, idx) => (
                <div
                  key={j.id}
                  className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-3.5 shadow-xs flex flex-wrap sm:flex-nowrap items-center gap-3"
                >
                  <div className="flex-1 min-w-[110px]">
                    <span className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase mb-1">
                      ENTRADA {jornadas.length > 1 ? `#${idx + 1}` : ''}
                    </span>
                    <input
                      type="time"
                      value={j.entrada}
                      onChange={e => handleUpdateJornada(j.id, 'entrada', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold text-xs"
                    />
                  </div>

                  <div className="flex-1 min-w-[110px]">
                    <span className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase mb-1">
                      SALIDA {jornadas.length > 1 ? `#${idx + 1}` : ''}
                    </span>
                    <input
                      type="time"
                      value={j.salida}
                      onChange={e => handleUpdateJornada(j.id, 'salida', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold text-xs"
                    />
                  </div>

                  <div className="w-28">
                    <div className="flex items-center justify-between mb-1">
                      <span className="block text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">VIAJES</span>
                      {j.viajes > 0 && (
                        <button
                          type="button"
                          onClick={() => handleUpdateJornada(j.id, 'viajes', 0)}
                          className="text-[9px] text-rose-500 hover:underline font-bold"
                          title="Fijar en 0 viajes"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={j.viajes}
                      onChange={e => handleUpdateJornada(j.id, 'viajes', Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-black text-xs text-center"
                    />
                  </div>

                  {/* Botón Eliminar Tramo / Viaje */}
                  <div className="flex items-center self-end mb-0.5">
                    <button
                      type="button"
                      onClick={() => handleRemoveJornada(j.id)}
                      className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                      title="Eliminar este tramo / viaje"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="sm:hidden">Eliminar</span>
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleAddJornada}
                  className="flex-1 w-full py-2.5 rounded-2xl border-2 border-dashed border-cyan-300 dark:border-cyan-800 bg-cyan-50/30 dark:bg-cyan-950/20 text-[#00c2ff] font-black text-xs flex items-center justify-center gap-1.5 hover:bg-cyan-50/60 transition-colors uppercase cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>AÑADIR JORNADA / VIAJE</span>
                </button>

                {totalViajes > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setJornadas(prev => prev.map(j => ({ ...j, viajes: 0 })));
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer whitespace-nowrap"
                    title="Eliminar todos los viajes de este reporte (logística, combustible y seguros $0)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar Todos los Viajes</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 4. EQUIPO DE OPERARIOS EN CAMPO (Diferenciando Oficial vs Ayudante) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-200 dark:border-cyan-900 pb-1.5">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#00c2ff]">
                  EQUIPO DE OPERARIOS EN CAMPO
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Diferencie entre <strong className="text-cyan-600 dark:text-cyan-400">Oficial</strong> (${(technicalParameters.horaOficial || 9400).toLocaleString('es-AR')}/h) y <strong className="text-purple-600 dark:text-purple-400">Ayudante</strong> (${(technicalParameters.pagoAyudanteHora || 5500).toLocaleString('es-AR')}/h)
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                {teamMembers.length} {teamMembers.length === 1 ? 'operario asignado' : 'operarios asignados'}
              </span>
            </div>

            {/* Operarios Activos con Selector de Rol Oficial / Ayudante y Tarifa $/h Editable */}
            <div className="space-y-2">
              {teamMembers.map(member => {
                const isOficial = member.role === 'Oficial';
                const foundWorker = workers.find(w => w.name.toLowerCase().trim() === member.name.toLowerCase().trim());
                const defaultRate = (foundWorker?.hourlyRate && foundWorker.hourlyRate > 0)
                  ? foundWorker.hourlyRate
                  : isOficial
                    ? (technicalParameters.horaOficial || 9400)
                    : (technicalParameters.pagoAyudanteHora || 5500);
                const currentRate = member.rate !== undefined && member.rate > 0 ? member.rate : defaultRate;
                const subtotal = Math.round(currentRate * calculatedHours);

                return (
                  <div
                    key={member.name}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap sm:flex-nowrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-[180px]">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        isOficial
                          ? 'bg-cyan-500 text-white'
                          : 'bg-purple-600 text-white'
                      }`}>
                        {isOficial ? <Wrench className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-wide">
                          {member.name}
                        </div>
                        <div className="text-[10.5px] text-slate-600 dark:text-slate-300 font-mono mt-0.5 flex items-center gap-1">
                          <span>{calculatedHours}h =</span>
                          <strong className="text-cyan-700 dark:text-cyan-400 font-bold">${subtotal.toLocaleString('es-AR')}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Tarifa $/h individual editable */}
                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Tarifa $/h:</span>
                      <div className="flex items-center gap-0.5">
                        <span className="text-xs font-mono font-bold text-slate-400">$</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={currentRate}
                          onChange={e => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value.replace(',', '.')) || 0;
                            updateTeamMemberRate(member.name, val);
                          }}
                          className="w-20 px-1.5 py-0.5 font-mono font-bold text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-right focus:outline-none focus:ring-1 focus:ring-cyan-400"
                          title="Editar valor hora de este empleado"
                        />
                      </div>
                    </div>

                    {/* Selector interactivo de categoría: OFICIAL vs AYUDANTE */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateTeamMemberRole(member.name, 'Oficial')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                          isOficial
                            ? 'bg-[#00c2ff] text-slate-950 font-black shadow-sm ring-2 ring-cyan-400'
                            : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Oficial</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateTeamMemberRole(member.name, 'Ayudante')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                          !isOficial
                            ? 'bg-purple-600 text-white font-black shadow-sm ring-2 ring-purple-400'
                            : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Ayudante</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => removeTeamMember(member.name)}
                        className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer ml-1"
                        title="Eliminar de esta orden"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {teamMembers.length === 0 && (
                <div className="p-3.5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
                  Sin operarios adicionales asignados. (Solo el responsable técnico).
                </div>
              )}
            </div>

            {/* Chips para agregar más operarios desde la base de datos */}
            <div className="pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                Agregar operario a la cuadrilla:
              </span>
              <div className="flex flex-wrap gap-2">
                {dynamicAvailableHelpers
                  .filter(h => h.name.toLowerCase() !== leadTech.toLowerCase() && !teamMembers.some(m => m.name.toLowerCase() === h.name.toLowerCase()))
                  .map(helper => (
                    <button
                      key={helper.name}
                      type="button"
                      onClick={() => toggleTeamMember(helper.name)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-cyan-400 hover:text-[#00c2ff] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3 h-3 text-[#00c2ff]" />
                      <span>{helper.name}</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 font-mono">
                        {helper.role}
                      </span>
                    </button>
                  ))}
              </div>
            </div>

            {/* Alta rápida de ayudante u oficial directamente a la Base de Datos */}
            <div className="pt-2">
              {isAddingHelper ? (
                <div className="flex flex-col sm:flex-row items-center gap-2 p-3 rounded-2xl bg-cyan-50/50 dark:bg-slate-800/80 border border-cyan-300 dark:border-cyan-800">
                  <input
                    type="text"
                    placeholder="Nombre y apellido del operario..."
                    value={newHelperName}
                    onChange={e => setNewHelperName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleQuickAddHelper();
                      }
                    }}
                    className="flex-1 w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00c2ff]"
                  />

                  {/* Selector de Rol al dar de alta */}
                  <select
                    value={newHelperRole}
                    onChange={e => setNewHelperRole(e.target.value as 'Oficial' | 'Ayudante')}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00c2ff] cursor-pointer"
                  >
                    <option value="Ayudante">Ayudante ($5.500/h)</option>
                    <option value="Oficial">Oficial ($9.400/h)</option>
                  </select>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleQuickAddHelper}
                      className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-[#00c2ff] hover:bg-cyan-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Registrar en BD</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingHelper(false);
                        setNewHelperName('');
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingHelper(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00c2ff] hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Registrar nuevo operario directamente en Base de Datos (Oficial / Ayudante)</span>
                </button>
              )}
            </div>
          </div>

          {/* 5. SUMINISTROS Y MATERIALES */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-cyan-200 dark:border-cyan-900 pb-1.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#00c2ff]">
                SUMINISTROS Y MATERIALES UTILIZADOS
              </h3>
              {materialsList.length > 0 && (
                <span className="text-[11px] font-mono font-bold text-cyan-500 dark:text-cyan-400">
                  {materialsList.length} {materialsList.length === 1 ? 'material vinculado' : 'materiales vinculados'}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <ShoppingCart className="w-4 h-4 text-[#00c2ff] absolute left-3.5 top-3.5" />
                <select
                  value={selectedMaterialId}
                  onChange={e => setSelectedMaterialId(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-medium shadow-xs focus:ring-2 focus:ring-[#00c2ff] focus:outline-none cursor-pointer"
                >
                  <option value="">Seleccionar material del stock maestro...</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} — ${m.unitPrice.toLocaleString('es-AR')} (Disp: {m.stock} {m.unit})
                    </option>
                  ))}
                </select>
              </div>

              {selectedMaterialId && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Cant:</span>
                    <input
                      type="number"
                      min="1"
                      value={materialQty}
                      onChange={e => setMaterialQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 px-1 text-slate-800 dark:text-white text-center font-bold text-xs bg-transparent focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMaterial}
                    className="px-4 py-3 rounded-2xl bg-[#00c2ff] hover:bg-cyan-400 text-slate-950 font-black transition-all cursor-pointer whitespace-nowrap text-xs shadow-md shadow-cyan-500/20 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar</span>
                  </button>
                </div>
              )}
            </div>

            {/* List of added materials - HIGH VISIBILITY & CLARITY */}
            {materialsList.length > 0 ? (
              <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 overflow-hidden shadow-sm">
                {/* Header with Subtotal */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-200/80 dark:bg-slate-800/90 border-b border-slate-300 dark:border-slate-700">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <ShoppingCart className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    Materiales en este Remito ({materialsList.length})
                  </span>
                  <span className="text-xs font-mono font-black text-amber-600 dark:text-amber-400">
                    Subtotal: ${materialsList.reduce((acc, m) => acc + m.cost, 0).toLocaleString('es-AR')}
                  </span>
                </div>

                {/* List items with high contrast */}
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {materialsList.map((m, idx) => (
                    <div
                      key={`mat-list-item-${m.id}-${idx}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 dark:bg-cyan-500/20 border border-cyan-500/40 text-cyan-800 dark:text-cyan-300 font-mono font-black text-xs shrink-0">
                          {m.qty}x
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
                            {m.name}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            ${Math.round(m.cost / m.qty).toLocaleString('es-AR')} c/u
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="font-mono font-black text-xs text-amber-600 dark:text-amber-400">
                          ${m.cost.toLocaleString('es-AR')}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterial(idx)}
                          className="p-1.5 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/15 transition-colors cursor-pointer"
                          title="Eliminar material"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-3.5 px-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <ShoppingCart className="w-4 h-4 text-slate-400 opacity-60" />
                <span>No se han cargado materiales a este reporte aún (opcional)</span>
              </div>
            )}
          </div>

          {/* 6. DESCRIPCIÓN DE TAREAS */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              DESCRIPCIÓN DE TAREAS
            </h3>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describa el trabajo realizado..."
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 font-medium shadow-xs focus:ring-2 focus:ring-[#00c2ff] focus:outline-none min-h-[90px]"
            />
          </div>

          {/* 7. FIRMA DE CONFORMIDAD */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#00c2ff] border-b border-cyan-200 dark:border-cyan-900 pb-1.5">
              FIRMA DE CONFORMIDAD
            </h3>

            <div className="bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-600 p-2 relative shadow-xs">
              <canvas
                ref={canvasRef}
                width={650}
                height={160}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-36 bg-transparent rounded-2xl cursor-crosshair touch-none"
              />

              <button
                type="button"
                onClick={clearSignature}
                className="absolute right-4 bottom-3 text-xs font-black text-slate-900 dark:text-white hover:text-[#00c2ff] transition-colors cursor-pointer uppercase tracking-wider"
              >
                LIMPIAR
              </button>
            </div>
          </div>

          {/* 8. PRE-AUDITORÍA TÉCNICA Y RESUMEN OPERATIVO EN VIVO */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-cyan-500/40 rounded-3xl p-5 text-white shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#00c2ff]/20 flex items-center justify-center text-[#00c2ff]">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#00c2ff]">
                    Auditoría Técnica en Vivo (Cálculo Automático)
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    Cómputo en tiempo real vinculado a base de datos y roles seleccionados
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Remito {currentRemitoId}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
              {/* 1. Logística */}
              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 mb-1">
                  <span>1. Logística</span>
                  <span className="font-mono text-[9px] text-cyan-400">{effectiveDistanceKm} km</span>
                </div>
                <div className="text-sm font-black text-white">
                  ${formatCurrency(liveCosts.logisticsCost || 0)}
                </div>
                <div className="text-[9px] text-slate-300 mt-1 leading-tight">
                  {totalViajes === 0 ? (
                    <span className="text-emerald-400 font-medium">Sin viajes</span>
                  ) : (
                    <span>
                      {totalViajes} {totalViajes === 1 ? 'viaje' : 'viajes'} (Comb + Seg)
                    </span>
                  )}
                </div>
              </div>

              {/* 2. M.O. Capataz */}
              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 mb-1">
                  <span>2. M.O. Capataz</span>
                  <span className="font-mono text-[9px] text-cyan-300">{calculatedHours}h</span>
                </div>
                <div className="text-sm font-black text-cyan-300">
                  ${formatCurrency(liveCosts.techPay || 0)}
                </div>
                <div className="text-[9px] text-slate-300 mt-1 leading-tight">
                  {calculatedHours}h × ${formatCurrency(effectiveTechHourlyRate)}/h{isGuardia ? ' × 1.5' : ''}
                </div>
              </div>

              {/* 3. M.O. Ayudante */}
              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 mb-1">
                  <span>3. M.O. Ayudante</span>
                  <span className="font-mono text-[9px] text-cyan-300">{teamMembers.length} op</span>
                </div>
                <div className="text-sm font-black text-cyan-300">
                  ${formatCurrency(liveCosts.helperPay || 0)}
                </div>
                <div className="text-[9px] text-slate-300 mt-1 leading-tight truncate">
                  {teamMembers.length > 0 ? `${teamMembers.map(m => m.name.split(' ')[0]).join(', ')}` : 'Sin ayudantes'}
                </div>
              </div>

              {/* 4. Materiales */}
              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 mb-1">
                  <span>4. Materiales</span>
                  <span className="font-mono text-[9px] text-amber-300">{materialsList.length} ítems</span>
                </div>
                <div className="text-sm font-black text-amber-300">
                  ${formatCurrency(totalMaterialsCost || 0)}
                </div>
                <div className="text-[9px] text-slate-300 mt-1 leading-tight">
                  {totalMaterialsCost > 0 ? 'Insumos / repuestos' : 'Sin materiales'}
                </div>
              </div>

              {/* 5. Costo Honorarios */}
              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-emerald-400 mb-1">
                  <span>5. Honorarios</span>
                  <span className="font-mono text-[9px] text-emerald-300">Margen</span>
                </div>
                <div className="text-sm font-black text-emerald-400">
                  ${formatCurrency(effectiveMarginValue || 0)}
                </div>
                <div className="text-[9px] text-slate-300 mt-1 leading-tight">
                  Ganancia sugerida
                </div>
              </div>

              {/* 6. Costo Total del Remito */}
              <div className="bg-cyan-500/15 p-3 rounded-2xl border border-cyan-500/30">
                <div className="text-[10px] uppercase font-extrabold text-cyan-300 mb-1">6. Total Remito</div>
                <div className="text-base font-black text-[#00c2ff]">
                  ${formatCurrency(effectiveSuggestedPrice || 0)}
                </div>
                <div className="text-[9px] text-cyan-200/80 mt-1">
                  Suma 1+2+3+4+5
                </div>
              </div>
            </div>

            {/* Fila de Capataz si aplica */}
            {isLeadTechCapataz && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-xs">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-200">
                      Liquidación Capataz (s/ Costo de Servicio):
                    </span>
                    <span className="text-[10.5px] text-amber-300/80 block">
                      Costo de Servicio: ${formatCurrency(liveCosts.laborDirectCost || 0)}
                    </span>
                  </div>
                </div>
                <div className="text-base font-black text-amber-300">
                  ${formatCurrency(estimatedCapatazProfit || 0)}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3 border-t border-cyan-500/20 bg-cyan-950/40 -mx-5 -mb-5 p-4 rounded-b-3xl">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10.5px] uppercase tracking-wider text-slate-300 font-extrabold">
                    PRECIO SUGERIDO FACTURACIÓN
                  </span>
                  <div className="flex items-center gap-1.5 bg-cyan-500/20 px-2.5 py-1 rounded-lg border border-cyan-500/40">
                    <span className="text-[11px] font-bold text-cyan-300">Margen ($):</span>
                    <span className="text-xs font-mono font-bold text-cyan-300">$</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={effectiveMarginValue}
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value.replace(',', '.')) || 0;
                        setMarginValue(val);
                        setCustomSuggestedPrice(null);
                      }}
                      className="w-24 bg-transparent text-right font-mono font-black text-xs text-white border-b border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Preajustes rápidos de margen expresados en VALOR monetario */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">Margen sugerido ($):</span>
                  {[0.20, 0.25, 0.30, 0.35, 0.40, 0.50].map((factor, idx) => {
                    const presetVal = roundCurrency((liveCosts.operatingCost || 0) * factor);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setMarginValue(presetVal);
                          setCustomSuggestedPrice(null);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          effectiveMarginValue === presetVal && customSuggestedPrice === null
                            ? 'bg-[#00c2ff] text-slate-950 shadow-xs'
                            : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}
                      >
                        +${formatCurrency(presetVal)}
                      </button>
                    );
                  })}
                </div>

                <div className="text-[11px] text-slate-300 leading-tight">
                  {isGuardia ? '⚡ Incluye cálculo manual de Guardia | ' : ''}
                  Costo Op. (${formatCurrency(liveCosts.operatingCost || 0)}) + Margen (${formatCurrency(effectiveMarginValue)}) = ${formatCurrency(effectiveSuggestedPrice)}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="relative inline-block">
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-2xl sm:text-3xl font-black font-mono text-[#00c2ff]">$</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={effectiveSuggestedPrice}
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value.replace(',', '.')) || 0;
                        setCustomSuggestedPrice(val);
                        const computedMarginVal = Math.max(0, roundCurrency(val - (liveCosts.operatingCost || 0)));
                        setMarginValue(computedMarginVal);
                      }}
                      className="w-44 text-right text-2xl sm:text-3xl font-black font-mono text-[#00c2ff] bg-transparent border-b-2 border-cyan-500/50 focus:border-[#00c2ff] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                  {customSuggestedPrice !== null || marginValue !== null ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomSuggestedPrice(null);
                        setMarginValue(null);
                      }}
                      className="text-cyan-400 hover:underline cursor-pointer"
                    >
                      ↺ Restablecer margen base (${formatCurrency(defaultMarginValue)})
                    </button>
                  ) : (
                    <span>Monto sugerido con margen de ${effectiveMarginValue.toLocaleString('es-AR')}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* FINAL ACTION BUTTON (Image 4) */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-4 rounded-full bg-[#00c2ff] hover:brightness-105 active:scale-[0.99] text-white font-black italic uppercase tracking-wider text-sm sm:text-base shadow-xl shadow-cyan-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {recordToEdit ? 'GUARDAR CAMBIOS DEL REPORTE TÉCNICO' : 'FINALIZAR REPORTE TÉCNICO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

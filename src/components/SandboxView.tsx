import React, { useState, useEffect, useMemo } from 'react';
import {
  FlaskConical,
  ShieldCheck,
  Play,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Users,
  Wrench,
  Car,
  Sparkles,
  Send,
  Eye,
  FileText,
  Layers,
  Fuel,
  ShieldAlert,
  Info,
  Camera
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { calculateAuditCosts, formatCurrency } from '../utils/calculationUtils';
import { TeamMemberAssigned, TechnicalAuditRecord } from '../types';
import { SandboxRemitoOcr } from './SandboxRemitoOcr';

const SANDBOX_STORAGE_KEY = 'job_martin_bandiera_sandbox_records_v1';

/** Remito de prueba. Cuando se pasa a producción queda marcado para que no se pueda pasar dos veces. */
type SandboxRecord = TechnicalAuditRecord & { promotedTo?: string; promotedAt?: string };

export const SandboxView: React.FC = () => {
  const { technicalParameters, workers, clients, technicalAuditRecords, addTechnicalAuditRecord } = useData();
  const { currentUser, users, permissions } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'escaner_ia' | 'simulador' | 'remitos'>('escaner_ia');

  // --- STATE FOR FORMULA SIMULATOR ---
  const [simKm, setSimKm] = useState<number>(45);
  const [simViajes, setSimViajes] = useState<number>(1);
  const [simHours, setSimHours] = useState<number>(4.5);
  const [simIsGuardia, setSimIsGuardia] = useState<boolean>(false);
  const [simLeadRole, setSimLeadRole] = useState<'Tecnico' | 'Capataz'>('Tecnico');
  const [simCapatazPct, setSimCapatazPct] = useState<number>(10);
  const [simMaterialsCost, setSimMaterialsCost] = useState<number>(15000);

  // Cuadrilla in simulator: differentiate Oficial vs Ayudante
  const [simTeam, setSimTeam] = useState<TeamMemberAssigned[]>([
    { name: 'MARCELO QUINTEROS', role: 'Ayudante', rate: technicalParameters.pagoAyudanteHora || 5500 },
    { name: 'CARLOS GÓMEZ', role: 'Oficial', rate: technicalParameters.horaOficial || 9400 }
  ]);
  const [newSimMemberName, setNewSimMemberName] = useState<string>('');
  const [newSimMemberRole, setNewSimMemberRole] = useState<'Oficial' | 'Ayudante'>('Ayudante');

  // Calculate live costs for simulator
  const simCalculation = useMemo(() => {
    return calculateAuditCosts(technicalParameters, {
      hoursWorked: simHours,
      travelHours: simViajes * 1.5,
      viajes: simViajes,
      distanceKm: simKm,
      isGuardia: simIsGuardia,
      guardiaType: simIsGuardia ? 'GUARDIA_50' : 'NO_GUARDIA',
      helpersCount: simTeam.length,
      materialsCost: simMaterialsCost,
      leadTechName: 'LÍDER SIMULADOR',
      helperNames: simTeam.map(m => m.name),
      teamMembers: simTeam,
      workers,
      users
    });
  }, [technicalParameters, simHours, simViajes, simKm, simIsGuardia, simTeam, simMaterialsCost, workers, users]);

  // Capataz commission in simulator
  const simCapatazCommission = simLeadRole === 'Capataz'
    ? Math.round(simCalculation.laborDirectCost * (simCapatazPct / 100))
    : 0;

  // --- STATE FOR SANDBOX TEST RECORDS (ISOLATED) ---
  const [sandboxRecords, setSandboxRecords] = useState<SandboxRecord[]>(() => {
    try {
      const stored = localStorage.getItem(SANDBOX_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return [
      {
        id: 'sandbox-1',
        remitoId: 'TEST-#901-2026',
        remitoPapel: '0001-0004523',
        date: new Date().toISOString().split('T')[0],
        clientName: 'FINCA LA CONSULTA (TEST)',
        siteLocation: 'SAN CARLOS, VALLE DE UCO',
        workPoint: 'POZO Nº 4 - TABLERO PRINCIPAL',
        isGuardia: false,
        guardiaType: 'NO_GUARDIA',
        hoursWorked: 4.5,
        travelHours: 1.5,
        viajes: 1,
        distanceKm: 45,
        horaEntrada: '08:00',
        horaSalida: '12:30',
        logisticsCost: 40660,
        fuelCost: 28068,
        seguroCost: 1319,
        amortizacionCost: 7588,
        laborDirectCost: 109350,
        operatingCost: 149010,
        materialsCost: 0,
        description: 'Prueba de mantenimiento en banco y tablero con 1 Oficial y 1 Ayudante.',
        suggestedPrice: 229246,
        billedPrice: 229246,
        collectedPrice: 0,
        helperPay: 24750,
        techPay: 42300,
        leadTech: 'Carlos Gómez',
        helpers: ['MARCELO QUINTEROS', 'JUAN PÉREZ'],
        teamMembers: [
          { name: 'MARCELO QUINTEROS', role: 'Ayudante', rate: 5500 },
          { name: 'JUAN PÉREZ', role: 'Oficial', rate: 9400 }
        ],
        status: 'Cargado',
        semaforo: 'rojo'
      }
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(sandboxRecords));
    } catch {
      // ignore
    }
  }, [sandboxRecords]);

  // Form state for creating a new test record
  const [testRemitoPapel, setTestRemitoPapel] = useState<string>('');
  const [testClientName, setTestClientName] = useState<string>('BODEGA VALLE DE UCO (TEST)');
  const [testLocation, setTestLocation] = useState<string>('TUPUNGATO');
  const [testWorkPoint, setTestWorkPoint] = useState<string>('SALA DE MÁQUINAS');
  const [testKm, setTestKm] = useState<number>(35);
  const [testViajes, setTestViajes] = useState<number>(1);
  const [testHours, setTestHours] = useState<number>(4.0);
  const [testIsGuardia, setTestIsGuardia] = useState<boolean>(false);
  const [testLeadTech, setTestLeadTech] = useState<string>(currentUser.displayName || 'Técnico de Prueba');
  const [testTeam, setTestTeam] = useState<TeamMemberAssigned[]>([
    { name: 'OPERARIO OFICIAL TEST', role: 'Oficial', rate: technicalParameters.horaOficial || 9400 },
    { name: 'OPERARIO AYUDANTE TEST', role: 'Ayudante', rate: technicalParameters.pagoAyudanteHora || 5500 }
  ]);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleAddTestMember = () => {
    if (!newSimMemberName.trim()) return;
    const rate = newSimMemberRole === 'Oficial'
      ? (technicalParameters.horaOficial || 9400)
      : (technicalParameters.pagoAyudanteHora || 5500);

    setSimTeam(prev => [
      ...prev,
      { name: newSimMemberName.trim(), role: newSimMemberRole, rate }
    ]);
    setNewSimMemberName('');
  };

  const handleToggleMemberRole = (index: number) => {
    setSimTeam(prev =>
      prev.map((m, i) => {
        if (i === index) {
          const nextRole = m.role === 'Oficial' ? 'Ayudante' : 'Oficial';
          const rate = nextRole === 'Oficial'
            ? (technicalParameters.horaOficial || 9400)
            : (technicalParameters.pagoAyudanteHora || 5500);
          return { ...m, role: nextRole, rate };
        }
        return m;
      })
    );
  };

  const handleRemoveSimMember = (index: number) => {
    setSimTeam(prev => prev.filter((_, i) => i !== index));
  };

  // Create test report in Sandbox
  const handleCreateSandboxRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const nextNum = sandboxRecords.length + 901;
    const testCosts = calculateAuditCosts(technicalParameters, {
      hoursWorked: testHours,
      travelHours: testViajes * 1.5,
      viajes: testViajes,
      distanceKm: testKm,
      isGuardia: testIsGuardia,
      guardiaType: testIsGuardia ? 'GUARDIA_50' : 'NO_GUARDIA',
      helpersCount: testTeam.length,
      materialsCost: 0,
      leadTechName: testLeadTech,
      helperNames: testTeam.map(m => m.name),
      teamMembers: testTeam,
      workers,
      users
    });

    const newRecord: TechnicalAuditRecord = {
      id: `sandbox-${Date.now()}`,
      remitoId: `TEST-#${nextNum}-2026`,
      remitoPapel: testRemitoPapel.trim() || undefined,
      date: new Date().toISOString().split('T')[0],
      clientName: testClientName,
      siteLocation: testLocation,
      workPoint: testWorkPoint,
      isGuardia: testIsGuardia,
      guardiaType: testIsGuardia ? 'GUARDIA_50' : 'NO_GUARDIA',
      hoursWorked: testHours,
      travelHours: testViajes * 1.5,
      viajes: testViajes,
      distanceKm: testKm,
      horaEntrada: '08:00',
      horaSalida: '12:00',
      logisticsCost: testCosts.logisticsCost,
      fuelCost: testCosts.fuelCost,
      seguroCost: testCosts.seguroCost,
      amortizacionCost: testCosts.amortizacionCost,
      laborDirectCost: testCosts.laborDirectCost,
      operatingCost: testCosts.operatingCost,
      materialsCost: 0,
      description: 'Reporte simulado creado en el Espacio de Prueba seguro.',
      suggestedPrice: testCosts.suggestedPrice,
      billedPrice: testCosts.suggestedPrice,
      collectedPrice: 0,
      helperPay: testCosts.helperPay,
      techPay: testCosts.techPay,
      leadTech: testLeadTech,
      helpers: testTeam.map(m => m.name),
      teamMembers: testTeam,
      status: 'Cargado',
      semaforo: 'rojo'
    };

    setSandboxRecords(prev => [newRecord, ...prev]);
    setTestRemitoPapel('');
    showNotification(`¡Remito de prueba ${newRecord.remitoId} guardado con éxito en el Sandbox!`);
  };

  // Pasar un remito de prueba a producción: siempre con confirmación, con un cliente real de la base
  // y con el número siguiente de la secuencia real (nunca el número de prueba).
  const [promoting, setPromoting] = useState<SandboxRecord | null>(null);
  const [promoteClient, setPromoteClient] = useState<string>('');

  const nextProductionRemitoId = (): string => {
    const max = technicalAuditRecords.reduce((acc, r) => {
      const m = r.remitoId.match(/#?(\d+)-2026/);
      return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
    }, 379);
    return `#${max + 1}-2026`;
  };

  const handleOpenPromote = (record: SandboxRecord) => {
    if (record.promotedTo) return;
    const match = clients.find(c => c.razonSocial.trim().toLowerCase() === record.clientName.trim().toLowerCase());
    setPromoteClient(match?.razonSocial || '');
    setPromoting(record);
  };

  const handleConfirmPromote = () => {
    const record = promoting;
    const client = clients.find(c => c.razonSocial === promoteClient);
    if (!record || !client || record.promotedTo) return;
    const remitoId = nextProductionRemitoId();
    // Se arma un remito limpio: sin ids de prueba, y con el precio recalculado con las tarifas vigentes.
    addTechnicalAuditRecord({
      remitoId,
      remitoPapel: record.remitoPapel,
      date: record.date,
      clientName: client.razonSocial,
      siteLocation: record.siteLocation || client.fincaLocacion,
      workPoint: record.workPoint,
      isGuardia: record.isGuardia,
      guardiaType: record.guardiaType,
      hoursWorked: record.hoursWorked,
      travelHours: record.travelHours,
      viajes: record.viajes,
      distanceKm: record.distanceKm,
      horaEntrada: record.horaEntrada,
      horaSalida: record.horaSalida,
      materialsCost: record.materialsCost,
      materialsDetails: record.materialsDetails,
      description: record.description,
      leadTech: record.leadTech,
      helpers: record.helpers,
      teamMembers: record.teamMembers,
      logisticsCost: 0,
      laborDirectCost: 0,
      operatingCost: 0,
      suggestedPrice: 0,
      billedPrice: 0,
      collectedPrice: 0,
      helperPay: 0,
      techPay: 0,
      status: 'Cargado',
      semaforo: 'rojo'
    } as any);
    setSandboxRecords(prev =>
      prev.map(r => (r.id === record.id ? { ...r, promotedTo: remitoId, promotedAt: new Date().toISOString() } : r))
    );
    setPromoting(null);
    showNotification(`El remito de prueba ${record.remitoId} se cargó en producción como ${remitoId}.`);
  };

  // Delete record from Sandbox
  const handleDeleteSandboxRecord = (id: string) => {
    setSandboxRecords(prev => prev.filter(r => r.id !== id));
    showNotification('Remito de prueba eliminado del espacio seguro.');
  };

  // Clear all sandbox records
  const handleClearSandbox = () => {
    if (window.confirm('¿Está seguro de limpiar todos los registros del espacio de prueba?')) {
      setSandboxRecords([]);
      showNotification('Espacio de prueba reiniciado por completo.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* NOTIFICATION TOAST */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-amber-500/50 flex items-center gap-3 animate-in slide-in-from-bottom-3 text-xs font-bold">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* CONFIRMAR PASO A PRODUCCIÓN */}
      {promoting && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="promote-title">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl space-y-4 text-xs">
            <h2 id="promote-title" className="text-lg font-black text-slate-900 dark:text-white">Cargar en producción</h2>
            <p className="text-slate-600 dark:text-slate-300">
              Se creará un remito <strong>real</strong> en Auditoría Técnica con el número <strong className="font-mono">{nextProductionRemitoId()}</strong>.
              Los costos y el precio se recalculan con las tarifas vigentes. Esta acción no se puede deshacer desde acá.
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
              <dt className="text-slate-500">Fecha</dt><dd className="font-bold text-slate-900 dark:text-white">{promoting.date.split('-').reverse().join('/')}</dd>
              <dt className="text-slate-500">Papel</dt><dd className="font-bold text-slate-900 dark:text-white">{promoting.remitoPapel || '—'}</dd>
              <dt className="text-slate-500">Horas / km / viajes</dt><dd className="font-bold text-slate-900 dark:text-white">{promoting.hoursWorked} h · {promoting.distanceKm} km · {promoting.viajes ?? 1}</dd>
              <dt className="text-slate-500">Responsable</dt><dd className="font-bold text-slate-900 dark:text-white">{promoting.leadTech}</dd>
              <dt className="text-slate-500">Personal</dt><dd className="font-bold text-slate-900 dark:text-white">{(promoting.teamMembers || []).map(m => `${m.name} (${m.role})`).join(', ') || '—'}</dd>
              <dt className="text-slate-500">Materiales</dt><dd className="font-bold text-slate-900 dark:text-white">{promoting.materialsDetails || 'Sin materiales detallados'}</dd>
            </dl>
            <div>
              <label htmlFor="promote-client" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Cliente real (obligatorio)
              </label>
              <select
                id="promote-client"
                value={promoteClient}
                onChange={e => setPromoteClient(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="">Elegir cliente de la base…</option>
                {clients.map(c => (
                  <option key={c.id} value={c.razonSocial}>{c.razonSocial}</option>
                ))}
              </select>
              {!clients.some(c => c.razonSocial.trim().toLowerCase() === promoting.clientName.trim().toLowerCase()) && (
                <p className="mt-1 text-amber-600 dark:text-amber-400 font-bold">
                  El cliente "{promoting.clientName}" no existe en la base de clientes: elegí uno real.
                </p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setPromoting(null)} className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-black text-slate-700 dark:text-slate-200 cursor-pointer">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPromote}
                disabled={!promoteClient}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black cursor-pointer"
              >
                Confirmar y cargar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP HEADER / BANNER */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-cyan-500/10 border border-amber-500/30 dark:border-amber-500/20 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Espacio de Prueba Exclusivo (Sandbox)
                </h1>
                <span className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-xs">
                  Entorno Aislado Seguro
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Este espacio fue diseñado especialmente para ti ({currentUser.email}). Aquí puedes verificar cómo coinciden las fórmulas de combustible, seguros, amortización y mano de obra (Oficial vs Ayudante), probar remitos manuales de papel y eliminar viajes sin afectar la base de datos de producción.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
            <button
              onClick={() => setActiveSubTab('escaner_ia')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'escaner_ia'
                  ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-slate-750'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Escanear Remito Papel (IA)</span>
            </button>

            <button
              onClick={() => setActiveSubTab('simulador')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'simulador'
                  ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-slate-750'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Simulador de Fórmulas</span>
            </button>

            <button
              onClick={() => setActiveSubTab('remitos')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'remitos'
                  ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-slate-750'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Órdenes de Prueba ({sandboxRecords.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUB-TAB 0: ESCÁNER IA DE REMITOS EN PAPEL */}
      {activeSubTab === 'escaner_ia' && (
        <SandboxRemitoOcr
          onSaveToSandbox={newRecord => {
            setSandboxRecords(prev => [newRecord, ...prev]);
            showNotification(`¡Remito ${newRecord.remitoId} guardado con éxito en el Sandbox!`);
            setActiveSubTab('remitos');
          }}
          nextRemitoNumber={sandboxRecords.length + 901}
        />
      )}

      {/* SUB-TAB 1: SIMULADOR DE FÓRMULAS */}
      {activeSubTab === 'simulador' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* CONTROLES DE ENTRADA (COL 5) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-500" />
                  <span>Variables de Prueba</span>
                </h3>
                <span className="text-[10px] font-bold text-slate-400">Modifica y observa el cálculo</span>
              </div>

              {/* Distancia y Viajes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Distancia Ida (KM)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={simKm}
                    onChange={e => setSimKm(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Viajes Realizados
                    </label>
                    {simViajes > 0 && (
                      <button
                        onClick={() => setSimViajes(0)}
                        className="text-[9.5px] text-rose-500 hover:underline font-bold"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSimViajes(0)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold ${
                        simViajes === 0 ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                      }`}
                    >
                      0
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={simViajes}
                      onChange={e => setSimViajes(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-xs text-center text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Horas y Guardia */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Horas de Trabajo (hs)
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={simHours}
                    onChange={e => setSimHours(Math.max(0.5, parseFloat(e.target.value) || 0.5))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ¿Es Guardia? (+50%)
                  </label>
                  <select
                    value={simIsGuardia ? 'SI' : 'NO'}
                    onChange={e => setSimIsGuardia(e.target.value === 'SI')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="NO">Normal (Sin recargo)</option>
                    <option value="SI">Guardia (+50% M.O.)</option>
                  </select>
                </div>
              </div>

              {/* Materiales y Rol Líder */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Costo Materiales ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={simMaterialsCost}
                    onChange={e => setSimMaterialsCost(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Responsable Técnico
                  </label>
                  <select
                    value={simLeadRole}
                    onChange={e => setSimLeadRole(e.target.value as 'Tecnico' | 'Capataz')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="Tecnico">Técnico Base</option>
                    <option value="Capataz">Capataz (con % comisión)</option>
                  </select>
                </div>
              </div>

              {/* SECCIÓN OPERARIOS (OFICIAL VS AYUDANTE) */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200">
                    Operarios en Cuadrilla ({simTeam.length})
                  </span>
                  <span className="text-[10px] text-slate-400">Clic en rol para alternar</span>
                </div>

                <div className="space-y-2">
                  {simTeam.map((m, idx) => {
                    const isOf = m.role === 'Oficial';
                    const rate = isOf
                      ? (technicalParameters.horaOficial || 9400)
                      : (technicalParameters.pagoAyudanteHora || 5500);

                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-black ${
                            isOf ? 'bg-cyan-500' : 'bg-purple-600'
                          }`}>
                            {isOf ? 'O' : 'A'}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white block">
                              {m.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ${rate.toLocaleString('es-AR')}/h × {simHours}h = ${Math.round(rate * simHours * (simIsGuardia ? 1.5 : 1)).toLocaleString('es-AR')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleMemberRole(idx)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                              isOf
                                ? 'bg-cyan-500 text-white'
                                : 'bg-purple-600 text-white'
                            }`}
                            title="Alternar entre Oficial y Ayudante"
                          >
                            {m.role}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSimMember(idx)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Quitar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Agregar nuevo miembro a la cuadrilla de prueba */}
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Nombre operario..."
                    value={newSimMemberName}
                    onChange={e => setNewSimMemberName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                  <select
                    value={newSimMemberRole}
                    onChange={e => setNewSimMemberRole(e.target.value as 'Oficial' | 'Ayudante')}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="Ayudante">Ayudante ($5.500/h)</option>
                    <option value="Oficial">Oficial ($9.400/h)</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddTestMember}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer shadow-xs"
                  >
                    + Agregar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RESULTADOS Y EXPLICACIÓN DE FÓRMULAS (COL 7) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* CARDS DE CÁLCULO EN TIEMPO REAL */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 border border-amber-500/40 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase text-amber-400">
                      Resultados del Algoritmo de Costos
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Coincide 100% con la planilla técnica y los registros de campo
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-slate-800 text-amber-300 font-bold">
                  {simViajes} {simViajes === 1 ? 'viaje' : 'viajes'} | {simKm} km
                </span>
              </div>

              {/* Grid 4 KPI principales */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                
                {/* Logística */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Logística</div>
                  <div className="text-lg font-black text-white mt-1">
                    ${formatCurrency(simCalculation.logisticsCost)}
                  </div>
                  <div className="text-[9.5px] text-slate-400 mt-1">
                    {simViajes === 0 ? 'Sin viajes ($0)' : `Comb + Seg + Amort`}
                  </div>
                </div>

                {/* M.O. Directa */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">M.O. Directa</div>
                  <div className="text-lg font-black text-cyan-400 mt-1">
                    ${formatCurrency(simCalculation.laborDirectCost)}
                  </div>
                  <div className="text-[9.5px] text-slate-400 mt-1">
                    {simHours} hs {simIsGuardia ? '(+50%)' : ''}
                  </div>
                </div>

                {/* Costo Operativo Total */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Costo Operativo</div>
                  <div className="text-lg font-black text-amber-300 mt-1">
                    ${formatCurrency(simCalculation.operatingCost)}
                  </div>
                  <div className="text-[9.5px] text-slate-400 mt-1">
                    Log + MO + Mat
                  </div>
                </div>

                {/* Precio Sugerido */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Facturación (35%)</div>
                  <div className="text-lg font-black text-emerald-400 mt-1">
                    ${formatCurrency(simCalculation.suggestedPrice)}
                  </div>
                  <div className="text-[9.5px] text-slate-400 mt-1">
                    Margen Comercial
                  </div>
                </div>
              </div>

              {/* DESGLOSE EXACTO PASO A PASO */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                  Desglose Matemático de Fórmulas:
                </h5>

                {/* 1. Combustible */}
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Fuel className="w-3.5 h-3.5 text-amber-400" />
                      <span>Combustible ({simViajes} viajes):</span>
                    </span>
                    <span className="font-mono font-black text-amber-300">
                      ${formatCurrency(simCalculation.fuelCost)}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 font-mono">
                    {simViajes === 0
                      ? '0 viajes = $0'
                      : `${simKm} km × 2 (ida y vuelta) × ${simViajes} viaje(s) × ${technicalParameters.consumoLKm} L/km × $${technicalParameters.dieselPrice} / L = $${formatCurrency(simCalculation.fuelCost)}`}
                  </p>
                </div>

                {/* 2. Seguros y Amortización */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">Seguros:</span>
                      <span className="font-mono font-black text-white">
                        ${formatCurrency(simCalculation.seguroCost)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {simViajes} viaje(s) × ${formatCurrency(technicalParameters.seguroViaje || 1318.78)}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">Amortización:</span>
                      <span className="font-mono font-black text-white">
                        ${formatCurrency(simCalculation.amortizacionCost)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {simViajes} viaje(s) × ${formatCurrency(technicalParameters.amortizacionViaje || 7587.88)}
                    </p>
                  </div>
                </div>

                {/* 3. Mano de Obra Desglosada por Rol */}
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Mano de Obra Directa (Oficial vs Ayudante):</span>
                    </span>
                    <span className="font-mono font-black text-cyan-300">
                      ${simCalculation.laborDirectCost.toLocaleString('es-AR')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10.5px]">
                    <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-700">
                      <span className="block text-slate-400 font-bold">Responsable Técnico:</span>
                      <span className="font-mono font-black text-white text-xs">
                        ${simCalculation.techPay.toLocaleString('es-AR')}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-700">
                      <span className="block text-cyan-400 font-bold">Oficiales ({simTeam.filter(m => m.role === 'Oficial').length}):</span>
                      <span className="font-mono font-black text-white text-xs">
                        ${simCalculation.oficialsPay.toLocaleString('es-AR')}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-700">
                      <span className="block text-purple-400 font-bold">Ayudantes ({simTeam.filter(m => m.role !== 'Oficial').length}):</span>
                      <span className="font-mono font-black text-white text-xs">
                        ${simCalculation.ayudantesPay.toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Capataz si aplica */}
                {simLeadRole === 'Capataz' && (
                  <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-amber-200 block">
                        Comisión Capataz ({simCapatazPct}% sobre Costo de Servicio):
                      </span>
                      <span className="text-[10px] text-amber-300/80">
                        ${simCalculation.laborDirectCost.toLocaleString('es-AR')} × {simCapatazPct}%
                      </span>
                    </div>
                    <div className="text-base font-black text-amber-300 font-mono">
                      ${simCapatazCommission.toLocaleString('es-AR')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: LABORATORIO DE REMITOS DE PRUEBA (BORRADORES) */}
      {activeSubTab === 'remitos' && (
        <div className="space-y-6">
          
          {/* FORMULARIO CREAR REMITO DE PRUEBA */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  <span>Cargar Nuevo Remito de Prueba en Sandbox</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Prueba ingresar el número de remito de papel manual y elimina viajes con total seguridad
                </p>
              </div>

              <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                100% Aislado de Producción
              </span>
            </div>

            <form onSubmit={handleCreateSandboxRecord} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* Nº Remito Papel (Manual) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nº Remito Papel (Manual)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 0001-0004523"
                    value={testRemitoPapel}
                    onChange={e => setTestRemitoPapel(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Cliente */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Cliente / Finca
                  </label>
                  <input
                    type="text"
                    value={testClientName}
                    onChange={e => setTestClientName(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
                  />
                </div>

                {/* Ubicación */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Ubicación / Finca
                  </label>
                  <input
                    type="text"
                    value={testLocation}
                    onChange={e => setTestLocation(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {/* Distancia KM */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Distancia (KM)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={testKm}
                    onChange={e => setTestKm(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                {/* Viajes */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Viajes
                    </label>
                    <button
                      type="button"
                      onClick={() => setTestViajes(0)}
                      className="text-[9.5px] text-rose-500 hover:underline font-bold cursor-pointer"
                    >
                      Sin viajes (0)
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={testViajes}
                    onChange={e => setTestViajes(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-center text-slate-900 dark:text-white"
                  />
                </div>

                {/* Horas */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Horas Trabajadas
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={testHours}
                    onChange={e => setTestHours(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                {/* ¿Guardia? */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    ¿Guardia?
                  </label>
                  <select
                    value={testIsGuardia ? 'SI' : 'NO'}
                    onChange={e => setTestIsGuardia(e.target.value === 'SI')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
                  >
                    <option value="NO">Normal</option>
                    <option value="SI">Guardia (+50%)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Guardar Remito en Sandbox</span>
                </button>
              </div>
            </form>
          </div>

          {/* LISTADO DE REMITOS EN EL SANDBOX */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Remitos en Espacio de Prueba ({sandboxRecords.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Ninguno de estos registros se muestra en la auditoría real ni altera las finanzas.
                </p>
              </div>

              {sandboxRecords.length > 0 && (
                <button
                  onClick={handleClearSandbox}
                  className="px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpiar Sandbox</span>
                </button>
              )}
            </div>

            {sandboxRecords.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                <p className="text-xs text-slate-500">No hay remitos de prueba creados en el Sandbox.</p>
                <p className="text-[11px] text-slate-400">Usa el formulario superior para cargar una orden simulada.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400">
                      <th className="pb-3 px-3">Remito Sist. / Papel</th>
                      <th className="pb-3 px-3">Cliente & Ubicación</th>
                      <th className="pb-3 px-3">Viajes / KM</th>
                      <th className="pb-3 px-3">Cuadrilla (Oficial / Ayudante)</th>
                      <th className="pb-3 px-3 text-right">Logística</th>
                      <th className="pb-3 px-3 text-right">M.O. Directa</th>
                      <th className="pb-3 px-3 text-right">Precio Sugerido</th>
                      <th className="pb-3 px-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sandboxRecords.map(r => (
                      <tr key={r.id} className="hover:bg-amber-50/20 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3">
                          <span className="font-mono font-black text-amber-600 dark:text-amber-400 block">
                            {r.remitoId}
                          </span>
                          {r.remitoPapel ? (
                            <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded font-bold">
                              📄 #{r.remitoPapel}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Sin papel manual</span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 dark:text-white block uppercase">
                            {r.clientName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {r.siteLocation}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            (r.viajes ?? 1) > 0 ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}>
                            {(r.viajes ?? 1)} viajes
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {r.distanceKm} km ({r.hoursWorked}h)
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1">
                            {(r.teamMembers || []).map((m, i) => (
                              <span
                                key={i}
                                className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                  m.role === 'Oficial'
                                    ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300'
                                    : 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                }`}
                              >
                                {m.name} ({m.role})
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                          ${r.logisticsCost.toLocaleString('es-AR')}
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-cyan-600 dark:text-cyan-400">
                          ${r.laborDirectCost.toLocaleString('es-AR')}
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                          ${r.suggestedPrice.toLocaleString('es-AR')}
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {r.promotedTo ? (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black text-[10px] uppercase flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>En producción {r.promotedTo}</span>
                              </span>
                            ) : permissions.createRemito ? (
                              <button
                                type="button"
                                onClick={() => handleOpenPromote(r)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase flex items-center gap-1 cursor-pointer"
                                title="Cargar este remito en la base de datos real (pide confirmación)"
                              >
                                <Send className="w-3 h-3" />
                                <span>A Producción</span>
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => handleDeleteSandboxRecord(r.id)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer transition-colors"
                              title="Eliminar de pruebas"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

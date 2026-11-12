import { TechnicalCostParameters, TechnicalAuditRecord, GuardiaType, WorkerItem, UserProfile, TeamMemberAssigned, UserRole, WorkerCategory } from '../types';

/**
 * Rounds monetary values preserving exactly 2 decimal places (centavos)
 * while preventing floating point inaccuracies.
 */
export function roundCurrency(val: number): number {
  return Math.round((Number(val || 0) + Number.EPSILON) * 100) / 100;
}

/**
 * Formats a monetary number in standard Argentine format ($ 1.234,56 or $ 1.234 if whole)
 */
export function formatCurrency(val: number, withSymbol: boolean = false): string {
  const num = Number(val || 0);
  const hasDecimals = !Number.isInteger(num);
  const formatted = num.toLocaleString('es-AR', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  });
  return withSymbol ? `$${formatted}` : formatted;
}

/**
 * Checks if a worker is classified as 'Oficial'
 */
export function isWorkerOficial(
  name: string | undefined,
  workers?: WorkerItem[],
  users?: UserProfile[]
): boolean {
  if (!name) return false;
  const lower = name.trim().toLowerCase();

  if (workers && workers.length > 0) {
    const found = workers.find(w => w.name.toLowerCase() === lower);
    if (found) {
      if (found.category === 'Oficial') return true;
      if (found.cargo?.toLowerCase().includes('oficial')) return true;
      if (found.specialty?.toLowerCase().includes('oficial')) return true;
    }
  }

  if (users && users.length > 0) {
    const found = users.find(u => u.displayName.toLowerCase() === lower);
    if (found) {
      if ((found as any).category === 'Oficial') return true;
      if ((found as any).cargo?.toLowerCase().includes('oficial')) return true;
    }
  }

  return false;
}

/**
 * Checks if a worker or user has an administrative profile (office / management / billing),
 * meaning they should NOT be loaded or selectable in field reports (reportes de campo).
 */
export function isAdministrativeProfile(
  item?: {
    name?: string;
    displayName?: string;
    email?: string;
    role?: string;
    category?: string;
    isAdministrative?: boolean;
    cargo?: string;
    specialty?: string;
  } | null
): boolean {
  if (!item) return false;

  const email = (item.email || '').toLowerCase().trim();
  if (email === 'admin@admin.com') return true;

  if (item.isAdministrative === true) return true;
  if (item.category === 'Administrativo') return true;

  const role = item.role || '';
  if (['SuperAdmin', 'Owner', 'Gerente', 'Admin'].includes(role)) {
    if (item.category !== 'Oficial' && item.category !== 'Ayudante' && item.category !== 'Capataz') {
      return true;
    }
  }

  const nameLower = (item.name || item.displayName || '').toLowerCase();
  if (nameLower === 'juan pablo' || nameLower.includes('administrador')) {
    return true;
  }

  const cargoLower = (item.cargo || '').toLowerCase();
  const specLower = (item.specialty || '').toLowerCase();
  if (
    cargoLower.includes('administrativ') ||
    specLower.includes('administrativ') ||
    cargoLower.includes('administración') ||
    specLower.includes('administración') ||
    cargoLower.includes('contable') ||
    specLower.includes('contable') ||
    cargoLower.includes('facturación') ||
    specLower.includes('facturación') ||
    cargoLower.includes('oficina') ||
    specLower.includes('oficina') ||
    cargoLower.includes('gerencia') ||
    specLower.includes('gerencia') ||
    cargoLower.includes('dirección') ||
    specLower.includes('dirección')
  ) {
    return true;
  }

  return false;
}

/**
 * Returns the configured base hourly rate for a specific worker/operator,
 * or the system default if not customized.
 */
export function getWorkerBaseHourlyRate(
  name: string | undefined,
  defaultRate: number,
  workers?: WorkerItem[],
  users?: UserProfile[]
): number {
  if (!name) return defaultRate;
  const lower = name.trim().toLowerCase();

  if (workers && workers.length > 0) {
    const found = workers.find(w => w.name.toLowerCase() === lower);
    if (found?.hourlyRate && found.hourlyRate > 0) return found.hourlyRate;
  }

  if (users && users.length > 0) {
    const found = users.find(u => u.displayName.toLowerCase() === lower);
    if (found?.hourlyRate && found.hourlyRate > 0) return found.hourlyRate;
  }

  return defaultRate;
}

/**
 * Calculates all technical cost components based on current cost parameters,
 * computing operator labor strictly by hour according to each worker's role
 * (Oficial vs Ayudante) and base rate, and fuel, insurance, and amortization per trip.
 */
export function calculateAuditCosts(
  params: TechnicalCostParameters,
  input: {
    hoursWorked: number;
    travelHours?: number;
    viajes?: number;
    distanceKm: number;
    isGuardia: boolean;
    guardiaType?: GuardiaType;
    guardiaMode?: 'fijo' | 'por_hora';
    guardiaAmount?: number;
    guardiaSubtype?: 'adicional' | 'plano';
    marginPercentage?: number;
    helpersCount?: number;
    materialsCost: number;
    leadTechName?: string;
    helperNames?: string[];
    teamMembers?: TeamMemberAssigned[];
    workers?: WorkerItem[];
    users?: UserProfile[];
    customTechHourlyRate?: number;
    customHelperHourlyRate?: number;
  }
) {
  const {
    hoursWorked,
    travelHours,
    viajes,
    distanceKm,
    isGuardia,
    guardiaType,
    guardiaMode,
    guardiaAmount,
    guardiaSubtype = 'adicional',
    marginPercentage,
    helpersCount = 0,
    materialsCost,
    leadTechName,
    helperNames,
    teamMembers,
    workers,
    users,
    customTechHourlyRate,
    customHelperHourlyRate
  } = input;

  // Determine effective guardia mode
  const effectiveGuardiaType: GuardiaType = guardiaType || (isGuardia ? 'GUARDIA_50' : 'NO_GUARDIA');
  const is50 = effectiveGuardiaType === 'GUARDIA_50';
  const is100 = effectiveGuardiaType === 'GUARDIA_100';

  // 1. Logística ($):
  // Cada viaje cuenta ida y vuelta: roundTripKm = distanceKm * 2
  // Combustible ($) = (Km ida y vuelta * Consumo L/Km * Precio Diesel) * Viajes
  // Seguros ($) = SeguroViaje * Viajes
  // Amortización ($) = AmortizaciónViaje * Viajes
  const effectiveViajes = viajes !== undefined && viajes >= 0
    ? viajes
    : travelHours && travelHours > 0
      ? Math.max(1, Math.round(travelHours / 1.5))
      : 1;

  const safeKm = (distanceKm !== undefined && distanceKm !== null && !isNaN(Number(distanceKm)))
    ? Math.max(0, Number(distanceKm))
    : 0;

  // Exact round trip Km per trip (Ida + Vuelta = distanceKm * 2)
  const roundTripKm = safeKm * 2;

  // Exact Fuel Cost: (Km ida y vuelta * Consumo L/Km * Precio Diesel) * Viajes
  // e.g. 1 km * 2 * 0.13 L/km * $2399/L * 1 viaje = $623.74
  const fuelCost = (effectiveViajes === 0 || roundTripKm === 0)
    ? 0
    : roundCurrency(roundTripKm * params.consumoLKm * params.dieselPrice * effectiveViajes);

  const seguroCost = effectiveViajes === 0 ? 0 : roundCurrency((params.seguroViaje || 1318.78) * effectiveViajes);
  const amortizacionCost = effectiveViajes === 0 ? 0 : roundCurrency((params.amortizacionViaje || 7587.88) * effectiveViajes);
  const logisticsCost = roundCurrency(fuelCost + seguroCost + amortizacionCost);

  // 2. M.O. Directa ($) (Costo de Servicio Técnico y Operativo)
  // Check if manual guardia input is active
  const hasManualGuardia = isGuardia && (guardiaMode !== undefined || guardiaAmount !== undefined);
  
  // Check if job is without foreman/capataz (only crew employees)
  const hasNoCapataz = !leadTechName || leadTechName.trim() === '' || leadTechName.toLowerCase() === 'sin capataz' || leadTechName.toLowerCase() === 'ninguno';

  // Base rates:
  const leadBaseRate = hasNoCapataz
    ? 0
    : (customTechHourlyRate && customTechHourlyRate > 0
        ? customTechHourlyRate
        : getWorkerBaseHourlyRate(leadTechName, params.horaOficial || params.horaBase, workers, users));
  const defaultOficialRate = params.horaOficial || params.horaBase || 9400;
  const defaultAyudanteRate = params.pagoAyudanteHora || 5500;

  let techPay = 0;
  let helperPay = 0;
  let oficialsPay = 0;
  let ayudantesPay = 0;
  let guardiaCost = 0;

  if (hasManualGuardia) {
    // MANUAL GUARDIA MODE: No arbitrary automatic +50% multiplier!
    const manualVal = Number(guardiaAmount) || 0;
    
    if (guardiaMode === 'fijo') {
      guardiaCost = manualVal;
      if (guardiaSubtype === 'plano') {
        // Flat rate fee covers labor
        if (hasNoCapataz) {
          techPay = 0;
          helperPay = manualVal;
        } else {
          techPay = manualVal;
          helperPay = 0;
        }
      } else {
        // Surcharge added on top of base hours
        techPay = hasNoCapataz ? 0 : roundCurrency(hoursWorked * leadBaseRate);
      }
    } else {
      // 'por_hora': manual rate per hour worked
      guardiaCost = roundCurrency(hoursWorked * manualVal);
      if (guardiaSubtype === 'plano') {
        if (hasNoCapataz) {
          techPay = 0;
          helperPay = guardiaCost;
        } else {
          techPay = guardiaCost;
          helperPay = 0;
        }
      } else {
        techPay = hasNoCapataz ? 0 : roundCurrency(hoursWorked * leadBaseRate);
      }
    }

    // Helpers at base rate (multiplier 1.0) if not flat rate
    if (guardiaSubtype !== 'plano') {
      if (teamMembers && teamMembers.length > 0) {
        teamMembers.forEach(member => {
          const isOficial = member.role === 'Oficial' || member.role?.toLowerCase().includes('oficial');
          const defaultRate = isOficial ? defaultOficialRate : defaultAyudanteRate;
          const rate = member.rate && member.rate > 0
            ? member.rate
            : getWorkerBaseHourlyRate(member.name, defaultRate, workers, users);
          const pay = roundCurrency(hoursWorked * rate);
          if (isOficial) oficialsPay += pay;
          else ayudantesPay += pay;
          helperPay = roundCurrency(helperPay + pay);
        });
      } else if (helperNames && helperNames.length > 0) {
        helperNames.forEach(hName => {
          const isOficial = isWorkerOficial(hName, workers, users);
          const defaultRate = isOficial ? defaultOficialRate : defaultAyudanteRate;
          const rate = customHelperHourlyRate && customHelperHourlyRate > 0
            ? customHelperHourlyRate
            : getWorkerBaseHourlyRate(hName, defaultRate, workers, users);
          const pay = roundCurrency(hoursWorked * rate);
          if (isOficial) oficialsPay += pay;
          else ayudantesPay += pay;
          helperPay = roundCurrency(helperPay + pay);
        });
      } else {
        const effectiveCount = Math.max(0, helpersCount);
        ayudantesPay = roundCurrency(effectiveCount * hoursWorked * defaultAyudanteRate);
        helperPay = ayudantesPay;
      }
    }
  } else {
    // LEGACY / AUTOMATIC MULTIPLIER MODE:
    const techMultiplier = is100 ? 2.0 : is50 ? (params.guardiaMultiplier || 1.5) : 1.0;
    techPay = hasNoCapataz ? 0 : roundCurrency(hoursWorked * leadBaseRate * techMultiplier);

    const helperMultiplier = is100 ? 1.6 : is50 ? 1.3 : 1.0;
    if (teamMembers && teamMembers.length > 0) {
      teamMembers.forEach(member => {
        const isOficial = member.role === 'Oficial' || member.role?.toLowerCase().includes('oficial');
        const defaultRate = isOficial ? defaultOficialRate : defaultAyudanteRate;
        const rate = member.rate && member.rate > 0
          ? member.rate
          : getWorkerBaseHourlyRate(member.name, defaultRate, workers, users);
        const pay = roundCurrency(hoursWorked * rate * helperMultiplier);
        if (isOficial) oficialsPay += pay;
        else ayudantesPay += pay;
        helperPay = roundCurrency(helperPay + pay);
      });
    } else if (helperNames && helperNames.length > 0) {
      helperNames.forEach(hName => {
        const isOficial = isWorkerOficial(hName, workers, users);
        const defaultRate = isOficial ? defaultOficialRate : defaultAyudanteRate;
        const rate = customHelperHourlyRate && customHelperHourlyRate > 0
          ? customHelperHourlyRate
          : getWorkerBaseHourlyRate(hName, defaultRate, workers, users);
        const pay = roundCurrency(hoursWorked * rate * helperMultiplier);
        if (isOficial) oficialsPay += pay;
        else ayudantesPay += pay;
        helperPay = roundCurrency(helperPay + pay);
      });
    } else {
      const effectiveCount = Math.max(0, helpersCount);
      ayudantesPay = roundCurrency(effectiveCount * hoursWorked * defaultAyudanteRate * helperMultiplier);
      helperPay = ayudantesPay;
    }
  }

  const laborDirectCost = roundCurrency(hasManualGuardia && guardiaSubtype !== 'plano'
    ? (techPay + helperPay + guardiaCost)
    : (techPay + helperPay));

  // 3. Costo Operativo ($): Logística + M.O. Directa + Materiales
  const operatingCost = roundCurrency(logisticsCost + laborDirectCost + (materialsCost || 0));

  // 4. Precio Sugerido / Facturado ($): Margen comercial de facturación editable
  const effectiveMargin = marginPercentage !== undefined && !isNaN(Number(marginPercentage))
    ? Number(marginPercentage)
    : (params.defaultMarginPercentage ?? 35);

  const suggestedPrice = roundCurrency(operatingCost * (1 + (effectiveMargin / 100)));

  return {
    logisticsCost,
    fuelCost,
    seguroCost,
    amortizacionCost,
    effectiveViajes,
    techPay,
    helperPay,
    oficialsPay,
    ayudantesPay,
    laborDirectCost,
    operatingCost,
    suggestedPrice,
    effectiveGuardiaType,
    leadBaseRate,
    guardiaCost,
    effectiveMargin
  };
}

/**
 * Calculates Capataz profit percentage strictly based on "COSTO DE SERVICIO" (laborDirectCost)
 * and NOT on the grand total.
 */
export function calculateCapatazProfit(laborDirectCost: number, commissionPercentage: number = 10): number {
  return roundCurrency((laborDirectCost || 0) * (commissionPercentage / 100));
}

/**
 * Recalculates an entire list of technical audit records when fixed cost parameters change
 */
export function recalculateAllAuditRecords(
  records: TechnicalAuditRecord[],
  newParams: TechnicalCostParameters,
  workers?: WorkerItem[],
  users?: UserProfile[]
): TechnicalAuditRecord[] {
  return records.map(record => {
    const calc = calculateAuditCosts(newParams, {
      hoursWorked: record.hoursWorked,
      travelHours: record.travelHours,
      viajes: record.viajes,
      distanceKm: record.distanceKm,
      isGuardia: record.isGuardia,
      guardiaType: record.guardiaType,
      guardiaMode: record.guardiaMode,
      guardiaAmount: record.guardiaAmount,
      guardiaSubtype: record.guardiaSubtype,
      marginPercentage: record.marginPercentage,
      helpersCount: record.helpers?.length || 0,
      materialsCost: record.materialsCost || 0,
      leadTechName: record.leadTech,
      helperNames: record.helpers,
      teamMembers: record.teamMembers,
      workers,
      users
    });

    const baseCosts = roundCurrency(
      calc.logisticsCost + calc.techPay + calc.helperPay + (record.materialsCost || 0)
    );
    const effectiveMargin = record.marginPercentage !== undefined && !isNaN(Number(record.marginPercentage))
      ? Number(record.marginPercentage)
      : (newParams.defaultMarginPercentage ?? 35);
    const calculatedHonorarios = record.honorarios !== undefined && !isNaN(Number(record.honorarios))
      ? roundCurrency(Number(record.honorarios))
      : roundCurrency(baseCosts * (effectiveMargin / 100));
    const finalTotal = roundCurrency(baseCosts + calculatedHonorarios);

    return {
      ...record,
      logisticsCost: calc.logisticsCost,
      fuelCost: calc.fuelCost,
      seguroCost: calc.seguroCost,
      amortizacionCost: calc.amortizacionCost,
      laborDirectCost: calc.laborDirectCost,
      operatingCost: calc.operatingCost,
      techPay: calc.techPay,
      helperPay: calc.helperPay,
      honorarios: calculatedHonorarios,
      suggestedPrice: finalTotal,
      billedPrice: finalTotal,
      collectedPrice: record.status === 'Cobrado' ? finalTotal : record.collectedPrice
    };
  });
}

/**
 * Computes Costo Honorarios (valor puesto como ganancia) for a remito record
 */
export function calculateRecordHonorarios(
  record: Partial<TechnicalAuditRecord>,
  defaultMarginPct: number = 35
): number {
  if (record.honorarios !== undefined && !isNaN(Number(record.honorarios)) && Number(record.honorarios) >= 0) {
    return roundCurrency(Number(record.honorarios));
  }
  const baseCosts = roundCurrency(
    (Number(record.logisticsCost) || 0) +
    (Number(record.techPay) || 0) +
    (Number(record.helperPay) || 0) +
    (Number(record.materialsCost) || 0)
  );
  const total = Number(record.billedPrice) > 0 ? Number(record.billedPrice) : Number(record.suggestedPrice) || 0;
  if (total > baseCosts) {
    return roundCurrency(total - baseCosts);
  }
  const margin = record.marginPercentage !== undefined && !isNaN(Number(record.marginPercentage))
    ? Number(record.marginPercentage)
    : defaultMarginPct;
  return roundCurrency(baseCosts * (margin / 100));
}

/**
 * Costo Total del Remito: the stored price (billedPrice), the same value the comprobante, Facturado, PDFs and
 * reports use. Only a remito without a price falls back to Logística + M.O. Capataz + M.O. Ayudante + Materiales + Honorarios.
 */
export function calculateCostoTotalRemito(
  record: Partial<TechnicalAuditRecord>,
  defaultMarginPct: number = 35
): number {
  const stored = Number(record.billedPrice) > 0 ? Number(record.billedPrice) : Number(record.suggestedPrice) || 0;
  if (stored > 0) return roundCurrency(stored);
  const baseCosts = roundCurrency(
    (Number(record.logisticsCost) || 0) +
    (Number(record.techPay) || 0) +
    (Number(record.helperPay) || 0) +
    (Number(record.materialsCost) || 0)
  );
  const honorarios = calculateRecordHonorarios(record, defaultMarginPct);
  return roundCurrency(baseCosts + honorarios);
}

/**
 * Normalizes a worker or user name for robust, accent-agnostic, case-agnostic comparison
 */
export function normalizeWorkerName(name?: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Master list of the 14 authorized field workers (Capataces y Ayudantes)
 * as established in the organizational structure image:
 * - 4 Capataces (9400 $/h, with 25% or 20% capataz commission)
 * - 10 Ayudantes (9400 $/h)
 */
export const AUTHORIZED_14_FIELD_WORKERS = [
  { id: 'WRK-01', name: 'RAMON BARROSO', role: 'Capataz' as const, category: 'Capataz' as const, hourlyRate: 9400, capatazPercentage: 25 },
  { id: 'WRK-02', name: 'JEREMÍAS POLLA', role: 'Capataz' as const, category: 'Capataz' as const, hourlyRate: 9400, capatazPercentage: 25 },
  { id: 'WRK-03', name: 'FACUNDO MORALES', role: 'Capataz' as const, category: 'Capataz' as const, hourlyRate: 9400, capatazPercentage: 20 },
  { id: 'WRK-04', name: 'MARCELO QUINTEROS', role: 'Capataz' as const, category: 'Capataz' as const, hourlyRate: 9400, capatazPercentage: 20 },
  { id: 'WRK-05', name: 'MATIAS CALDERON', role: 'Empleado' as const, category: 'Ayudante' as const, hourlyRate: 9400, capatazPercentage: 0 },
  { id: 'WRK-06', name: 'MATÍAS VAZQUEZ', role: 'Empleado' as const, category: 'Ayudante' as const, hourlyRate: 9400, capatazPercentage: 0 },
  { id: 'WRK-07', name: 'GABRIEL RODRIGUEZ', role: 'Empleado' as const, category: 'Ayudante' as const, hourlyRate: 9400, capatazPercentage: 0 },
  { id: 'WRK-08', name: 'ULISES PARTUCCI', role: 'Empleado' as const, category: 'Ayudante' as const, hourlyRate: 9400, capatazPercentage: 0 },
  { id: 'WRK-09', name: 'FACUNDO SOSA', role: 'Empleado' as const, category: 'Ayudante' as const, hourlyRate: 9400, capatazPercentage: 0 },
  { id: 'WRK-10', name: 'PABLO MUÑOZ', role: 'Empleado' as const, category: 'Ayudante' as const, hourlyRate: 9400, capatazPercentage: 0 },
  { id: 'WRK-11', name: 'AGUSTIN SOSA', role: 'Empleado' as const, category: 'Ayudante' as const, hourlyRate: 9400, capatazPercentage: 0 },
  { id: 'WRK-12', name: 'MATIAS SALINAS', role: 'Empleado' as const, category: 'Ayudante' as const, hourlyRate: 9400, capatazPercentage: 0 },
  { id: 'WRK-13', name: 'MBB', role: 'Empleado' as const, category: 'Ayudante' as const, hourlyRate: 9400, capatazPercentage: 0 },
  { id: 'WRK-14', name: 'CGV', role: 'Empleado' as const, category: 'Ayudante' as const, hourlyRate: 9400, capatazPercentage: 0 }
];

export const AUTHORIZED_14_WORKERS_MAP = new Map(
  AUTHORIZED_14_FIELD_WORKERS.map(w => [normalizeWorkerName(w.name), w])
);

/**
 * Checks whether a worker or user is valid according to the business rule:
 * - One of the 14 authorized field workers (Capataces y Ayudantes)
 * - An administrative user / staff profile (Oficina, Facturación, Gerencia, SuperAdmin, Owner)
 * - The primary admin account (admin@admin.com)
 * Any non-matching field record should be excluded or removed.
 */
export function isAuthorizedWorkerOrStaff(item?: {
  id?: string;
  name?: string;
  displayName?: string;
  email?: string;
  role?: string;
  category?: string;
  cargo?: string;
  specialty?: string;
  isAdministrative?: boolean;
} | null): boolean {
  if (!item) return false;

  const email = (item.email || '').toLowerCase().trim();
  if (email === 'admin@admin.com') return true;

  const rawName = item.name || item.displayName || '';
  const norm = normalizeWorkerName(rawName);

  if (AUTHORIZED_14_WORKERS_MAP.has(norm)) {
    return true;
  }

  // Administrative / Directivos profiles
  if (
    item.isAdministrative === true ||
    item.category === 'Administrativo' ||
    isAdministrativeProfile(item) ||
    ['SuperAdmin', 'Owner', 'Gerente', 'Admin'].includes(item.role || '')
  ) {
    return true;
  }

  // Any worker registered in the system (e.g. added via UI or Excel)
  if (item.id && (item.id.startsWith('WRK-') || item.id.length >= 3)) {
    return true;
  }

  return false;
}

/**
 * Deduplicates a list of WorkerItem objects strictly by normalized name and clean email.
 * Merges duplicate properties intelligently:
 * - Prefers canonical master IDs (WRK-01 to WRK-14 or WRK-ADMIN).
 * - Prefers WRK- IDs over usr_ IDs.
 * - Retains phone numbers, custom hourly rates, commissions, and specific categories.
 */
export function deduplicateWorkersList(workersList: WorkerItem[]): WorkerItem[] {
  if (!Array.isArray(workersList) || workersList.length === 0) {
    return [];
  }

  const primaryMap = new Map<string, WorkerItem>();
  const emailToKeyMap = new Map<string, string>();

  for (const w of workersList) {
    if (!w || !w.name) continue;

    const normName = normalizeWorkerName(w.name);
    const cleanEmail = (w.email || '').toLowerCase().trim();

    // Determine canonical key: first by normalized name, or by known email
    let key = normName;
    if (!key && cleanEmail) {
      key = cleanEmail;
    }
    if (!key) continue;

    // Check if we've seen this email associated with another key
    if (cleanEmail && emailToKeyMap.has(cleanEmail)) {
      key = emailToKeyMap.get(cleanEmail)!;
    }

    const existing = primaryMap.get(key);
    if (!existing) {
      primaryMap.set(key, { ...w });
      if (cleanEmail) {
        emailToKeyMap.set(cleanEmail, key);
      }
    } else {
      // Merge with existing
      const master = AUTHORIZED_14_WORKERS_MAP.get(normName);

      // Determine best ID: Master ID > WRK- ID > usr_ ID > existing ID
      let bestId = existing.id;
      if (master && master.id) {
        bestId = master.id;
      } else if (w.id && (w.id.startsWith('WRK-0') || w.id.startsWith('WRK-1'))) {
        bestId = w.id;
      } else if (w.id && w.id.startsWith('WRK-') && (!existing.id || existing.id.startsWith('usr_'))) {
        bestId = w.id;
      }

      // Best category & role
      const isMaster = !!master;
      const finalRole: UserRole = w.role || existing.role || (isMaster ? master.role : 'Empleado');
      const finalCategory: WorkerCategory = w.category || existing.category || (isMaster ? master.category : 'Ayudante');

      const merged: WorkerItem = {
        ...existing,
        ...w,
        id: bestId,
        name: existing.name || w.name || (isMaster ? master.name : ''),
        role: finalRole,
        category: finalCategory,
        email: cleanEmail || existing.email || w.email,
        phone: (w.phone && w.phone.trim() !== '') ? w.phone : (existing.phone || ''),
        cuadrilla: (w.cuadrilla && w.cuadrilla.trim() !== '') ? w.cuadrilla : (existing.cuadrilla || 'Cuadrilla 1 - Valle de Uco'),
        cargo: w.cargo || existing.cargo || w.specialty || existing.specialty,
        specialty: w.specialty || existing.specialty || w.cargo || existing.cargo,
        capatazPercentage: (w.capatazPercentage !== undefined)
          ? w.capatazPercentage
          : (existing.capatazPercentage !== undefined ? existing.capatazPercentage : (isMaster ? master.capatazPercentage : undefined)),
        hourlyRate: (w.hourlyRate !== undefined && w.hourlyRate > 0)
          ? w.hourlyRate
          : (existing.hourlyRate !== undefined && existing.hourlyRate > 0 ? existing.hourlyRate : (isMaster ? master.hourlyRate : undefined)),
        salaryMonthly: w.salaryMonthly || existing.salaryMonthly || 980000,
        active: w.active !== false && existing.active !== false
      };

      primaryMap.set(key, merged);
      if (cleanEmail) {
        emailToKeyMap.set(cleanEmail, key);
      }
    }
  }

  return Array.from(primaryMap.values());
}

/**
 * Given a raw list of workers (e.g. from Firestore), returns the list of secondary
 * duplicate document IDs that should be purged from Firestore.
 */
export function getDuplicateWorkerDocIds(rawWorkers: WorkerItem[]): string[] {
  if (!Array.isArray(rawWorkers) || rawWorkers.length <= 1) return [];

  const deduplicated = deduplicateWorkersList(rawWorkers);
  const canonicalIds = new Set(deduplicated.map(w => w.id));

  const duplicateIds: string[] = [];
  for (const raw of rawWorkers) {
    if (raw && raw.id && !canonicalIds.has(raw.id)) {
      duplicateIds.push(raw.id);
    }
  }

  return duplicateIds;
}



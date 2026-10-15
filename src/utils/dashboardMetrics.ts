import { TechnicalAuditRecord } from '../types';

/**
 * Cálculos del "Panel de Estado". Funciones puras sobre los remitos: no leen el sistema ni escriben nada.
 *
 * Etapas de un remito, en el orden en que avanza en el sistema:
 * Cargado, Facturado, Pasado, Cobrado y Archivado. "Archivado" es un paso posterior a Cobrado:
 * por dentro el remito conserva el estado "Cobrado" y tiene la marca `archivado`.
 */
export type Stage = 'Cargado' | 'Facturado' | 'Pasado' | 'Cobrado' | 'Archivado';
export const STAGES: Stage[] = ['Cargado', 'Facturado', 'Pasado', 'Cobrado', 'Archivado'];

export const stageOf = (record: TechnicalAuditRecord): Stage =>
  record.archivado ? 'Archivado' : ((record.status as Stage) || 'Cargado');

/** Importe que representa el remito según su etapa (lo previsto, lo facturado o lo cobrado). */
export const amountOf = (record: TechnicalAuditRecord): number => {
  switch (stageOf(record)) {
    case 'Cargado':
      return record.suggestedPrice || record.billedPrice || 0;
    case 'Facturado':
    case 'Pasado':
      return record.billedPrice || record.suggestedPrice || 0;
    default:
      return record.collectedPrice || record.billedPrice || 0;
  }
};

/** Mes del remito como "AAAA-MM". Devuelve null si la fecha falta o es inválida (por ejemplo, año 0009). */
export const monthKey = (date?: string): string | null => {
  if (!date || !/^\d{4}-\d{2}/.test(date)) return null;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return date.slice(0, 7);
};

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const monthLabel = (key: string, long = false): string => {
  const [year, month] = key.split('-').map(Number);
  return long ? `${MONTHS_LONG[month - 1]} ${year}` : `${MONTHS_SHORT[month - 1]} ${String(year).slice(-2)}`;
};

export const shiftMonth = (key: string, delta: number): string => {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const currentMonthKey = (now = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

/** Meses con remitos, de más viejo a más nuevo. */
export const listMonths = (records: TechnicalAuditRecord[]): string[] =>
  Array.from(new Set(records.map(r => monthKey(r.date)).filter((k): k is string => Boolean(k)))).sort();

/** Mes inicial del panel: el actual si tiene remitos; si no, el último mes que tenga. */
export const defaultMonth = (records: TechnicalAuditRecord[], now = new Date()): string | null => {
  const months = listMonths(records);
  if (months.length === 0) return null;
  const current = currentMonthKey(now);
  if (months.includes(current)) return current;
  const past = months.filter(m => m <= current);
  return past.length ? past[past.length - 1] : months[months.length - 1];
};

export interface StageTotals {
  count: number;
  amount: number;
}
export type StageSummary = Record<Stage, StageTotals>;

export const emptySummary = (): StageSummary =>
  STAGES.reduce((acc, s) => ({ ...acc, [s]: { count: 0, amount: 0 } }), {} as StageSummary);

export const summarize = (records: TechnicalAuditRecord[]): StageSummary => {
  const summary = emptySummary();
  records.forEach(r => {
    const stage = stageOf(r);
    summary[stage].count += 1;
    summary[stage].amount += amountOf(r);
  });
  return summary;
};

export const recordsOfMonth = (records: TechnicalAuditRecord[], key: string | 'all'): TechnicalAuditRecord[] =>
  key === 'all' ? records : records.filter(r => monthKey(r.date) === key);

export interface MonthlyPoint {
  month: string;
  counts: Record<Stage, number>;
  total: number;
}

/** Cantidad de remitos por etapa en cada uno de los últimos `n` meses que terminan en `endKey`. */
export const monthlySeries = (records: TechnicalAuditRecord[], endKey: string, n = 6): MonthlyPoint[] => {
  const months = Array.from({ length: n }, (_, i) => shiftMonth(endKey, i - (n - 1)));
  return months.map(month => {
    const counts = STAGES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {} as Record<Stage, number>);
    records.forEach(r => {
      if (monthKey(r.date) === month) counts[stageOf(r)] += 1;
    });
    return { month, counts, total: STAGES.reduce((sum, s) => sum + counts[s], 0) };
  });
};

export interface ClientPending {
  client: string;
  amount: number;
  count: number;
}

/** Clientes con importe facturado (Facturado + Pasado) que todavía no se cobró, de mayor a menor. */
export const pendingByClient = (records: TechnicalAuditRecord[], limit = 6): ClientPending[] => {
  const map = new Map<string, ClientPending>();
  records.forEach(r => {
    const stage = stageOf(r);
    if (stage !== 'Facturado' && stage !== 'Pasado') return;
    const entry = map.get(r.clientName) || { client: r.clientName, amount: 0, count: 0 };
    entry.amount += amountOf(r);
    entry.count += 1;
    map.set(r.clientName, entry);
  });
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, limit);
};

/** Porcentaje cobrado sobre lo facturado. null si todavía no se facturó nada. */
export const collectionRate = (summary: StageSummary): number | null => {
  const billed =
    summary.Facturado.amount + summary.Pasado.amount + summary.Cobrado.amount + summary.Archivado.amount;
  const collected = summary.Cobrado.amount + summary.Archivado.amount;
  return billed > 0 ? (collected / billed) * 100 : null;
};

const daysBetween = (from: string, to: Date): number => {
  const start = new Date(from + 'T00:00:00');
  return Math.floor((to.getTime() - start.getTime()) / 86_400_000);
};

export interface AgingAlert {
  count: number;
  oldestDays: number;
}

/**
 * Remitos que llevan demasiado tiempo en una etapa:
 * cargados sin facturar y facturados sin cobrar (según los días indicados).
 */
export const agingAlerts = (
  records: TechnicalAuditRecord[],
  now = new Date(),
  limits = { cargadoDias: 30, facturadoDias: 45 }
): { cargadosSinFacturar: AgingAlert; facturadosSinCobrar: AgingAlert } => {
  const result = {
    cargadosSinFacturar: { count: 0, oldestDays: 0 },
    facturadosSinCobrar: { count: 0, oldestDays: 0 }
  };
  records.forEach(r => {
    const stage = stageOf(r);
    if (stage === 'Cargado' && monthKey(r.date)) {
      const days = daysBetween(r.date, now);
      if (days > limits.cargadoDias) {
        result.cargadosSinFacturar.count += 1;
        result.cargadosSinFacturar.oldestDays = Math.max(result.cargadosSinFacturar.oldestDays, days);
      }
    }
    if (stage === 'Facturado' || stage === 'Pasado') {
      const base = r.fechaFactura && monthKey(r.fechaFactura) ? r.fechaFactura : r.date;
      if (monthKey(base)) {
        const days = daysBetween(base, now);
        if (days > limits.facturadoDias) {
          result.facturadosSinCobrar.count += 1;
          result.facturadosSinCobrar.oldestDays = Math.max(result.facturadosSinCobrar.oldestDays, days);
        }
      }
    }
  });
  return result;
};

/** Remitos con fecha faltante o inválida: no entran en los gráficos por mes. */
export const countInvalidDates = (records: TechnicalAuditRecord[]): number =>
  records.filter(r => !monthKey(r.date)).length;

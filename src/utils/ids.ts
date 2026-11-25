/**
 * Unique document id: full timestamp plus 8 random characters. Never shorten it to a few
 * digits: a repeated id saves a new document on top of an existing one.
 */
export function uniqueId(prefix: string): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${Date.now().toString(36)}-${random}`.toUpperCase();
}

// Hours, crew, costs and price of a remito only make sense together: if one changes, all of them are saved.
const COST_GROUP = [
  'hoursWorked', 'travelHours', 'viajes', 'distanceKm', 'horaEntrada', 'horaSalida', 'jornadas',
  'isGuardia', 'guardiaType', 'guardiaMode', 'guardiaAmount', 'guardiaSubtype',
  'leadTech', 'helpers', 'teamMembers', 'capatazCommissionPct', 'capatazProfit',
  'logisticsCost', 'fuelCost', 'seguroCost', 'amortizacionCost', 'techPay', 'helperPay', 'laborDirectCost',
  'materialsCost', 'materialsDetails', 'fieldMaterials', 'operatingCost',
  'honorarios', 'marginPercentage', 'suggestedPrice', 'billedPrice'
];

// Fields of a remito that differ between two versions, plus its id.
export function changedFields<T extends { id: string }>(before: T | undefined, after: T): T {
  if (!before) return after;
  const patch: Record<string, unknown> = { id: after.id };
  const prev = before as unknown as Record<string, unknown>;
  const next = after as unknown as Record<string, unknown>;
  Object.entries(next).forEach(([key, value]) => {
    if (JSON.stringify(value) !== JSON.stringify(prev[key])) patch[key] = value;
  });
  if (COST_GROUP.some(key => key in patch)) {
    COST_GROUP.forEach(key => {
      if (next[key] !== undefined) patch[key] = next[key];
    });
  }
  return patch as unknown as T;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Today's date as YYYY-MM-DD in the user's local time zone.
 * `new Date().toISOString()` is UTC, which in Argentina (UTC-3) jumps to tomorrow after 21:00.
 */
export function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Parses YYYY-MM-DD as a local calendar date (midnight local time).
 * `new Date('2026-11-02')` is read as UTC midnight, i.e. the previous evening in Argentina.
 */
export function parseLocalDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(value);
}

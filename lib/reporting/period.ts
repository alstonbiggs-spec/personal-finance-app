export type PeriodKey = 'this-month' | 'last-month' | 'ytd' | 'last-year';

const PERIOD_KEYS: PeriodKey[] = ['this-month', 'last-month', 'ytd', 'last-year'];

export function parsePeriodKey(value: string | undefined | null): PeriodKey {
  return (PERIOD_KEYS as string[]).includes(value ?? '') ? (value as PeriodKey) : 'this-month';
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function resolvePeriod(value: string | undefined | null, now = new Date()): { key: PeriodKey; start: string; end: string; label: string } {
  const key = parsePeriodKey(value);
  const year = now.getFullYear();
  const month = now.getMonth();

  if (key === 'last-month') {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return { key, start: toISODate(start), end: toISODate(end), label: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
  }
  if (key === 'ytd') {
    const start = new Date(year, 0, 1);
    return { key, start: toISODate(start), end: toISODate(now), label: `Year to date ${year}` };
  }
  if (key === 'last-year') {
    const start = new Date(year - 1, 0, 1);
    const end = new Date(year - 1, 11, 31);
    return { key, start: toISODate(start), end: toISODate(end), label: `${year - 1}` };
  }
  const start = new Date(year, month, 1);
  return { key, start: toISODate(start), end: toISODate(now), label: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
}

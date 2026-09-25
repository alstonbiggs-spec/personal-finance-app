export type PeriodKey = 'this-month' | 'last-month' | 'last-2-months' | 'last-3-months' | 'last-6-months' | 'ytd' | 'last-year' | 'custom';
export type PeriodParams = { period?: string | null; from?: string | null; to?: string | null };
export type ResolvedPeriod = { key: PeriodKey; start: string; end: string; label: string; months: number; from: string; to: string };

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'last-2-months', label: 'This + Last Month' },
  { value: 'last-3-months', label: 'Last 3 Months' },
  { value: 'last-6-months', label: 'Last 6 Months' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'last-year', label: 'Last Year' },
  { value: 'custom', label: 'Custom range…' },
];

// Rolling windows that include the current (partial) month, e.g. "last 3 months" in
// September = July 1 through today.
const ROLLING_MONTHS: Partial<Record<PeriodKey, number>> = { 'last-2-months': 2, 'last-3-months': 3, 'last-6-months': 6 };

export function parsePeriodKey(value: string | undefined | null): PeriodKey {
  return PERIOD_OPTIONS.some((option) => option.value === value) ? (value as PeriodKey) : 'this-month';
}

function toISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// "YYYY-MM" month key, the format used by <input type="month"> and the ?from=/?to= params.
export function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonthKey(value: string | undefined | null): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Number(match[1]), month - 1, 1);
}

const monthLabel = (date: Date) => date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const shortMonthLabel = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
const monthsBetween = (first: Date, last: Date) => (last.getFullYear() - first.getFullYear()) * 12 + (last.getMonth() - first.getMonth()) + 1;

// `months` is how many calendar months the period touches (a partial current month counts
// as a whole one) — monthly category budgets are multiplied by it so plan-vs-actual compares
// like with like.
export function resolvePeriod(params: PeriodParams, now = new Date()): ResolvedPeriod {
  const key = parsePeriodKey(params.period);
  const year = now.getFullYear();
  const month = now.getMonth();
  const thisMonth = new Date(year, month, 1);
  const lastDayOf = (first: Date) => new Date(first.getFullYear(), first.getMonth() + 1, 0);
  // Never report past today, so a range ending in the current month stops at today.
  const clampEnd = (date: Date) => (date > now ? now : date);
  const build = (first: Date, last: Date, label: string): ResolvedPeriod => ({
    key,
    start: toISODate(first),
    end: toISODate(clampEnd(lastDayOf(last))),
    label,
    months: monthsBetween(first, last),
    from: toMonthKey(first),
    to: toMonthKey(last),
  });

  if (key === 'last-month') {
    const first = new Date(year, month - 1, 1);
    return build(first, first, monthLabel(first));
  }
  const rolling = ROLLING_MONTHS[key];
  if (rolling) {
    const first = new Date(year, month - (rolling - 1), 1);
    return build(first, thisMonth, `${shortMonthLabel(first)} – ${shortMonthLabel(thisMonth)}`);
  }
  if (key === 'ytd') return build(new Date(year, 0, 1), thisMonth, `Year to date ${year}`);
  if (key === 'last-year') return build(new Date(year - 1, 0, 1), new Date(year - 1, 11, 1), `${year - 1}`);
  if (key === 'custom') {
    let first = parseMonthKey(params.from) ?? new Date(year, month - 1, 1);
    let last = parseMonthKey(params.to) ?? thisMonth;
    if (first > last) [first, last] = [last, first];
    if (last > thisMonth) last = thisMonth;
    if (first > thisMonth) first = thisMonth;
    const label = monthsBetween(first, last) === 1 ? monthLabel(first) : `${shortMonthLabel(first)} – ${shortMonthLabel(last)}`;
    return build(first, last, label);
  }
  return build(thisMonth, thisMonth, monthLabel(thisMonth));
}

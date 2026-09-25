'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PERIOD_OPTIONS, resolvePeriod } from '@/lib/reporting/period';

// First year with data in the app; the year list grows on its own as time passes.
const FIRST_YEAR = 2026;
const MONTH_NAMES = Array.from({ length: 12 }, (_, index) => new Date(2000, index, 1).toLocaleDateString(undefined, { month: 'short' }));

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const period = resolvePeriod({ period: searchParams.get('period'), from: searchParams.get('from'), to: searchParams.get('to') });

  const navigate = (params: URLSearchParams) => {
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const setPeriod = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('from');
    params.delete('to');
    if (value === 'this-month') params.delete('period');
    else params.set('period', value);
    // Seed a custom range from whatever window is showing now, so switching to "Custom"
    // doesn't jump somewhere unexpected.
    if (value === 'custom') {
      params.set('from', period.from);
      params.set('to', period.to);
    }
    navigate(params);
  };

  const setRange = (field: 'from' | 'to', value: string) => {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', 'custom');
    params.set('from', field === 'from' ? value : period.from);
    params.set('to', field === 'to' ? value : period.to);
    navigate(params);
  };

  const now = new Date();
  // Also reach back to the selected range's year (e.g. 2025 after switching from "Last Year").
  const firstYear = Math.min(FIRST_YEAR, Number(period.from.slice(0, 4)));
  const years = Array.from({ length: Math.max(1, now.getFullYear() - firstYear + 1) }, (_, index) => firstYear + index);
  // Month + year dropdowns rather than <input type="month">, which several desktop browsers
  // render as a plain text box.
  const monthPicker = (field: 'from' | 'to') => {
    const [year, month] = period[field].split('-').map(Number);
    const change = (nextYear: number, nextMonth: number) => {
      // Picking the current year can leave a future month selected; pull it back to this month.
      const cappedMonth = nextYear === now.getFullYear() ? Math.min(nextMonth, now.getMonth() + 1) : nextMonth;
      setRange(field, `${nextYear}-${String(cappedMonth).padStart(2, '0')}`);
    };
    const selectClass = 'border hairline bg-transparent px-2 py-1.5';
    return <span className="flex items-center gap-1.5">
      <select aria-label={`${field === 'from' ? 'From' : 'To'} month`} value={month} onChange={(e) => change(year, Number(e.target.value))} className={selectClass}>
        {MONTH_NAMES.map((name, index) => <option key={name} value={index + 1} disabled={year === now.getFullYear() && index > now.getMonth()}>{name}</option>)}
      </select>
      <select aria-label={`${field === 'from' ? 'From' : 'To'} year`} value={year} onChange={(e) => change(Number(e.target.value), month)} className={selectClass}>
        {years.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </span>;
  };

  return <div className="flex flex-wrap items-center gap-3 border-y hairline py-4">
    <select aria-label="Reporting period" value={period.key} onChange={(e) => setPeriod(e.target.value)} className="border hairline bg-transparent px-3 py-2 text-sm">
      {PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    {period.key === 'custom' && <div className="flex flex-wrap items-center gap-2 text-sm">
      {monthPicker('from')}
      <span className="text-ink/40">to</span>
      {monthPicker('to')}
    </div>}
    {period.months > 1 && <span className="text-xs text-ink/45">{period.months} months · budgets × {period.months}</span>}
  </div>;
}

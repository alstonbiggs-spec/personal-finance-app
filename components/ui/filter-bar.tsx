'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PERIOD_OPTIONS, resolvePeriod, toMonthKey } from '@/lib/reporting/period';

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

  const maxMonth = toMonthKey(new Date());

  return <div className="flex flex-wrap items-center gap-3 border-y hairline py-4">
    <select aria-label="Reporting period" value={period.key} onChange={(e) => setPeriod(e.target.value)} className="border hairline bg-transparent px-3 py-2 text-sm">
      {PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    {period.key === 'custom' && <div className="flex items-center gap-2 text-sm">
      <input aria-label="From month" type="month" value={period.from} max={maxMonth} onChange={(e) => setRange('from', e.target.value)} className="border hairline bg-transparent px-2 py-1.5" />
      <span className="text-ink/40">to</span>
      <input aria-label="To month" type="month" value={period.to} max={maxMonth} onChange={(e) => setRange('to', e.target.value)} className="border hairline bg-transparent px-2 py-1.5" />
    </div>}
    {period.months > 1 && <span className="text-xs text-ink/45">{period.months} months · budgets × {period.months}</span>}
  </div>;
}

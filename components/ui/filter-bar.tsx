'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { parsePeriodKey } from '@/lib/reporting/period';

const PERIOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'last-year', label: 'Last Year' },
];

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const period = parsePeriodKey(searchParams.get('period'));

  const setPeriod = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'this-month') params.delete('period');
    else params.set('period', value);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return <div className="flex flex-wrap gap-3 border-y hairline py-4">
    <select value={period} onChange={(e) => setPeriod(e.target.value)} className="border hairline bg-transparent px-3 py-2 text-sm">
      {PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <select className="border hairline bg-transparent px-3 py-2 text-sm"><option>Both</option><option>Alston</option><option>Wife</option></select>
    <select className="border hairline bg-transparent px-3 py-2 text-sm"><option>All types</option><option>Needs</option><option>Wants</option><option>Savings</option></select>
  </div>;
}

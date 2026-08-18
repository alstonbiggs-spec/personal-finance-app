'use client';
import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { createClient } from '@/lib/supabase/client';

type Row = { amount: number; date: string; categories: { parent_category: string } | { parent_category: string }[] | null };
type Preset = { key: string; label: string; date: Date };

// Same forest/gold tones used for Needs/Wants everywhere else in the app (see
// spend-charts.tsx / spend-sankey.tsx) so Line A always reads as the "primary" series.
const LINE_A_COLOR = '#173d35';
const LINE_B_COLOR = '#ad8a50';

const money = (value: number) => `$${Math.round(value).toLocaleString()}`;
const axisMoney = (value: number) => value >= 1000 ? `$${(value / 1000).toFixed(1).replace(/\.0$/, '')}k` : `$${value}`;
const monthKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`;
const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const toISODate = (date: Date) => date.toISOString().slice(0, 10);
const monthLabel = (date: Date) => date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

function buildPresets(today: Date): Preset[] {
  const year = today.getFullYear();
  const month = today.getMonth();
  const at = (offsetMonths: number) => new Date(year, month - offsetMonths, 1);
  const lastYear = new Date(year - 1, month, 1);
  return [
    { key: monthKey(year, month), label: `${monthLabel(at(0))} (this month)`, date: at(0) },
    { key: monthKey(at(1).getFullYear(), at(1).getMonth()), label: monthLabel(at(1)), date: at(1) },
    { key: monthKey(at(2).getFullYear(), at(2).getMonth()), label: monthLabel(at(2)), date: at(2) },
    { key: monthKey(at(3).getFullYear(), at(3).getMonth()), label: monthLabel(at(3)), date: at(3) },
    { key: monthKey(lastYear.getFullYear(), lastYear.getMonth()), label: `${monthLabel(lastYear)} (last year)`, date: lastYear },
  ];
}

export function SpendPacing() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  // Frozen once per mount so preset boundaries stay stable across re-renders.
  const [today] = useState(() => new Date());
  const presets = useMemo(() => buildPresets(today), [today]);
  const [lineAKey, setLineAKey] = useState(presets[0].key);
  const [lineBKey, setLineBKey] = useState(presets[1].key);

  useEffect(() => {
    const earliest = presets[presets.length - 1].date;
    supabase.from('transactions').select('amount,date,categories(parent_category)').eq('is_ignored', false).gte('date', toISODate(earliest)).lte('date', toISODate(today))
      .then(({ data }) => { setRows((data ?? []) as Row[]); setLoading(false); });
    // presets is derived from `today`, which is frozen for the lifetime of this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cumulativeByMonth = useMemo(() => {
    const dailyTotals = new Map<string, number[]>();
    for (const row of rows) {
      const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
      const parent = category?.parent_category;
      const amount = Number(row.amount);
      // Plaid convention: positive amount = spend. Only Needs + Wants count toward pace.
      if (amount <= 0 || (parent !== 'needs' && parent !== 'wants')) continue;
      const [year, month, day] = row.date.split('-').map(Number);
      const key = monthKey(year, month - 1);
      if (!dailyTotals.has(key)) dailyTotals.set(key, Array(32).fill(0));
      dailyTotals.get(key)![day] += amount;
    }
    const currentKey = monthKey(today.getFullYear(), today.getMonth());
    const result = new Map<string, (number | null)[]>();
    for (const preset of presets) {
      const daily = dailyTotals.get(preset.key) ?? Array(32).fill(0);
      const [year, month] = preset.key.split('-').map(Number);
      // A month in progress only has data through today; a completed month plots in full.
      const lastValidDay = preset.key === currentKey ? Math.min(daysInMonth(year, month - 1), today.getDate()) : daysInMonth(year, month - 1);
      const series: (number | null)[] = [];
      let running = 0;
      for (let day = 1; day <= 31; day++) {
        if (day > lastValidDay) { series.push(null); continue; }
        running += daily[day] ?? 0;
        series.push(running);
      }
      result.set(preset.key, series);
    }
    return result;
  }, [rows, presets, today]);

  const lineA = presets.find(preset => preset.key === lineAKey) ?? presets[0];
  const lineB = presets.find(preset => preset.key === lineBKey) ?? presets[1];
  const seriesA = cumulativeByMonth.get(lineAKey) ?? [];
  const seriesB = cumulativeByMonth.get(lineBKey) ?? [];
  const chartData = Array.from({ length: 31 }, (_, index) => { const day = index + 1; return { day, a: seriesA[day - 1] ?? null, b: seriesB[day - 1] ?? null }; });
  const lastOf = (series: (number | null)[]) => [...series].reverse().find(value => value !== null && value !== undefined) ?? 0;
  const totalA = lastOf(seriesA);
  const totalB = lastOf(seriesB);
  const currentKey = monthKey(today.getFullYear(), today.getMonth());
  const todayMarker = lineAKey === currentKey || lineBKey === currentKey ? today.getDate() : null;

  if (loading) return <div className="mt-12"><p className="label">Spending pace</p><p className="mt-3 text-sm text-ink/50">Loading…</p></div>;

  return <div className="mt-12">
    <div className="mb-6"><p className="label">Spending pace</p><h2 className="serif mt-1 text-2xl">Needs + Wants, cumulative</h2></div>
    <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs">
      <label className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: LINE_A_COLOR }} /><select aria-label="Line A month" value={lineAKey} onChange={event => setLineAKey(event.target.value)} className="border hairline bg-transparent px-2 py-1.5">{presets.map(preset => <option key={preset.key} value={preset.key}>{preset.label}</option>)}</select><span className="serif text-base">{money(totalA)}</span></label>
      <span className="text-ink/30">vs</span>
      <label className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: LINE_B_COLOR }} /><select aria-label="Line B month" value={lineBKey} onChange={event => setLineBKey(event.target.value)} className="border hairline bg-transparent px-2 py-1.5">{presets.map(preset => <option key={preset.key} value={preset.key}>{preset.label}</option>)}</select><span className="serif text-base">{money(totalB)}</span></label>
    </div>
    <div className="h-64">
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#18231f" strokeOpacity={0.06} vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#66736b' }} ticks={[1, 5, 10, 15, 20, 25, 30]} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#66736b' }} tickFormatter={axisMoney} width={44} />
          {todayMarker && <ReferenceLine x={todayMarker} stroke="#18231f" strokeOpacity={0.3} strokeDasharray="3 3" label={{ value: 'Today', position: 'insideTopRight', fontSize: 10, fill: '#66736b' }} />}
          <Tooltip labelFormatter={day => `Day ${day}`} formatter={(value, name) => [value === null ? '—' : money(Number(value)), name === 'a' ? lineA.label : lineB.label]} />
          <Line type="monotone" dataKey="a" stroke={LINE_A_COLOR} strokeWidth={2} dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="b" stroke={LINE_B_COLOR} strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>;
}

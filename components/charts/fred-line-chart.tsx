'use client';
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { FredPoint } from '@/lib/fred';

const ink = '#18231f';
const HORIZONS = [5, 10, 15, 20] as const;
type Horizon = typeof HORIZONS[number];
// A phone chart is ~340px wide, so thousands of daily points add nothing visible and
// make touch scrubbing sluggish. Stats below still use every point.
const MAX_RENDERED_POINTS = 1200;

// '$T' / '$B' are values already scaled to trillions / billions of dollars.
export type ChartUnit = '%' | '$' | '$T' | '$B' | 'index';

// Big values drop their decimals so "$4,012" still fits a quarter of a phone screen.
function formatValue(value: number, unit: ChartUnit) {
  if (unit === '%') return `${value.toFixed(2)}%`;
  if (unit === '$T') return `$${value.toFixed(2)}T`;
  if (unit === '$B') return `$${Math.round(value).toLocaleString()}B`;
  const number = Math.abs(value) >= 1000 ? Math.round(value).toLocaleString() : value.toFixed(2);
  return unit === '$' ? `$${number}` : number;
}

function formatTick(value: number, unit: ChartUnit) {
  if (unit === '%') return `${Math.round(value * 10) / 10}%`;
  if (unit === '$T') return `$${Math.round(value)}T`;
  if (unit === '$B') return Math.abs(value) >= 1000 ? `$${Math.round(value / 100) / 10}T` : `$${Math.round(value)}B`;
  const number = Math.abs(value) >= 1000 ? `${Math.round(value / 100) / 10}k` : Math.abs(value) < 10 ? `${Math.round(value * 10) / 10}` : `${Math.round(value)}`;
  return unit === '$' ? `$${number}` : number;
}

const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

function cutoffFor(years: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date.toISOString().slice(0, 10);
}

// One tick at the first observation of every Nth year, so there are always about five
// labels however long the range is; any more don't fit across a phone screen.
function yearTicks(data: FredPoint[], years: number) {
  const step = years <= 5 ? 1 : years <= 10 ? 2 : 4;
  const ticks: string[] = [];
  let lastYear = '';
  for (const point of data) {
    const year = point.date.slice(0, 4);
    if (year !== lastYear) { lastYear = year; if (Number(year) % step === 0) ticks.push(point.date); }
  }
  return ticks;
}

function thin(data: FredPoint[]) {
  if (data.length <= MAX_RENDERED_POINTS) return data;
  const every = Math.ceil(data.length / MAX_RENDERED_POINTS);
  // Always keep the last point so the line ends on the latest value.
  return data.filter((_, index) => index % every === 0 || index === data.length - 1);
}

export function FredLineChart({ title, note, data, color = '#173d35', unit, defaultYears = 10 }: { title: string; note: string; data: FredPoint[]; color?: string; unit: ChartUnit; defaultYears?: Horizon }) {
  const [years, setYears] = useState<Horizon>(defaultYears);
  const format = (value: number) => formatValue(value, unit);

  const { visible, rendered, latest, average, low, high } = useMemo(() => {
    const cutoff = cutoffFor(years);
    const visible = data.filter(point => point.date >= cutoff);
    const values = visible.map(point => point.value);
    return {
      visible,
      rendered: thin(visible),
      latest: visible.at(-1),
      average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
      low: Math.min(...values),
      high: Math.max(...values),
    };
  }, [data, years]);

  return <div>
    <div className="mb-4 flex items-start justify-between gap-4">
      <div><h2 className="serif text-2xl">{title}</h2><p className="mt-1 text-xs text-ink/45">{note}</p></div>
      {/* text-base on phones: iOS zooms the page when focusing a control under 16px. */}
      <select aria-label={`${title} time range`} value={years} onChange={event => setYears(Number(event.target.value) as Horizon)} className="shrink-0 border hairline bg-transparent px-2 py-1.5 text-base sm:text-sm">
        {HORIZONS.map(option => <option key={option} value={option}>{option} years</option>)}
      </select>
    </div>
    {!latest ? <div className="flex h-64 items-center justify-center text-xs text-ink/40">No data available.</div> : <>
      {/* Headline numbers so the chart is readable at a glance without tapping. */}
      <div className="mb-4 grid grid-cols-4 gap-2 border-y hairline py-3">
        <div><p className="label">Latest</p><p className="serif mt-1 text-lg sm:text-2xl" style={{ color }}>{format(latest.value)}</p></div>
        <div><p className="label">Average</p><p className="serif mt-1 text-lg sm:text-2xl">{format(average)}</p></div>
        <div><p className="label">Low</p><p className="serif mt-1 text-lg sm:text-2xl">{format(low)}</p></div>
        <div><p className="label">High</p><p className="serif mt-1 text-lg sm:text-2xl">{format(high)}</p></div>
      </div>
      <div className="-mx-2 h-72 sm:mx-0 sm:h-80">
        <ResponsiveContainer>
          <LineChart data={rendered} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={ink} strokeOpacity={0.08} vertical={false} />
            <XAxis dataKey="date" ticks={yearTicks(visible, years)} tickFormatter={(date: string) => date.slice(0, 4)} tick={{ fontSize: 12, fill: ink, fillOpacity: 0.55 }} axisLine={false} tickLine={false} tickMargin={8} />
            <YAxis tickFormatter={(v: number) => formatTick(v, unit)} tickCount={5} width={42} tick={{ fontSize: 12, fill: ink, fillOpacity: 0.55 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
            <ReferenceLine y={average} stroke={ink} strokeOpacity={0.45} strokeDasharray="4 4" label={{ value: `Avg ${format(average)}`, position: 'insideTopLeft', fontSize: 11, fill: ink, fillOpacity: 0.6 }} />
            <Tooltip
              cursor={{ stroke: ink, strokeOpacity: 0.25 }}
              content={({ active, payload }) => {
                const point = active ? payload?.[0]?.payload as FredPoint | undefined : undefined;
                if (!point) return null;
                return <div className="border hairline bg-cream px-3 py-2 shadow-sm"><p className="text-[11px] text-ink/50">{formatDate(point.date)}</p><p className="serif text-lg">{format(point.value)}</p></div>;
              }}
            />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>}
  </div>;
}

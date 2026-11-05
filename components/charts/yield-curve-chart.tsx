'use client';
import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export type YieldPoint = { maturity: string; label: string; value: number };

const ink = '#18231f';

export function YieldCurveChart({ data }: { data: YieldPoint[] }) {
  if (data.length === 0) return <div className="flex h-64 items-center justify-center text-xs text-ink/40">No data available.</div>;
  return <div className="-mx-2 h-72 sm:mx-0 sm:h-80">
    <ResponsiveContainer>
      {/* Maturities are evenly spaced (not to time scale), the usual way to read a curve. */}
      <LineChart data={data} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={ink} strokeOpacity={0.08} vertical={false} />
        <XAxis dataKey="maturity" interval={0} tick={{ fontSize: 12, fill: ink, fillOpacity: 0.55 }} axisLine={false} tickLine={false} tickMargin={8} />
        <YAxis tickFormatter={(v: number) => `${Math.round(v * 10) / 10}%`} tickCount={5} width={42} tick={{ fontSize: 12, fill: ink, fillOpacity: 0.55 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
        <Tooltip
          cursor={{ stroke: ink, strokeOpacity: 0.25 }}
          content={({ active, payload }) => {
            const point = active ? payload?.[0]?.payload as YieldPoint | undefined : undefined;
            if (!point) return null;
            return <div className="border hairline bg-cream px-3 py-2 shadow-sm"><p className="text-[11px] text-ink/50">{point.label}</p><p className="serif text-lg">{point.value.toFixed(2)}%</p></div>;
          }}
        />
        <Line type="monotone" dataKey="value" stroke="#173d35" strokeWidth={2} dot={{ r: 3, fill: '#173d35' }} activeDot={{ r: 5 }} isAnimationActive={false}>
          {/* Values printed on the curve so it reads without tapping; % is dropped to fit 9 labels across a phone. */}
          <LabelList dataKey="value" position="top" offset={10} formatter={(v) => Number(v).toFixed(2)} style={{ fontSize: 10, fill: ink, fillOpacity: 0.7 }} />
        </Line>
      </LineChart>
    </ResponsiveContainer>
  </div>;
}

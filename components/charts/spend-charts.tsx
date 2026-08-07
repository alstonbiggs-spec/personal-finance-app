'use client';
import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
const colors = ['#173d35','#ad8a50','#889e93','#b5bcb3'];
// Needs/wants/savings keep the same tones used everywhere else in the app (see
// money-flow.tsx) so the same bucket always reads as the same color.
const bucketColors: Record<string, string> = { Needs: '#173d35', Wants: '#ad8a50', Savings: '#889e93' };
type ChartPoint = { name: string; value: number };
const colorFor = (name: string, index: number) => bucketColors[name] ?? colors[index % colors.length];
const percentOf = (value: number, points: ChartPoint[]) => { const total = points.reduce((sum, point) => sum + point.value, 0); return total > 0 ? Math.round((value / total) * 100) : 0; };

export function SpendCharts({ top = [], detailByBucket = {}, total = 0 }: { top?: ChartPoint[]; detailByBucket?: Record<string, ChartPoint[]>; total?: number }) {
  const [active, setActive] = useState(top[0]?.name ?? '');
  const detail = detailByBucket[active] ?? [];
  return <div className="space-y-10">
    <div>
      <div className="mb-3 flex justify-between"><span className="label">Total spend</span><span className="serif text-2xl">${total.toLocaleString()}</span></div>
      <div className="h-56"><ResponsiveContainer><PieChart><Pie data={top} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3} style={{ cursor: 'pointer' }} onClick={(entry) => { if (entry.name) setActive(String(entry.name)); }}>{top.map((x,i)=><Cell key={x.name} fill={colorFor(x.name,i)} stroke={active===x.name ? '#18231f' : 'transparent'} strokeWidth={active===x.name ? 2 : 0} />)}</Pie><Tooltip formatter={(v, n) => [`$${Number(v).toLocaleString()} (${percentOf(Number(v), top)}%)`, n]} /></PieChart></ResponsiveContainer></div>
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">{top.map((x,i)=><button key={x.name} onClick={() => setActive(x.name)} className={`flex items-center gap-2 text-sm transition-opacity ${active===x.name ? '' : 'opacity-50 hover:opacity-80'}`}><i className="inline-block h-2.5 w-2.5 rounded-full" style={{background:colorFor(x.name,i)}} /><span className="font-semibold">{x.name}</span><span className="text-ink/50">{percentOf(x.value, top)}%</span></button>)}</div>
    </div>
    <div>
      <span className="label">{active} breakdown</span>
      <div className="h-56">{detail.length === 0 ? <div className="flex h-full items-center justify-center text-xs text-ink/40">No {active.toLowerCase()} spend this period.</div> : <ResponsiveContainer><PieChart><Pie data={detail} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>{detail.map((x,i)=><Cell key={x.name} fill={colorFor(x.name,i)} />)}</Pie><Tooltip formatter={(v, n) => [`$${Number(v).toLocaleString()} (${percentOf(Number(v), detail)}%)`, n]} /></PieChart></ResponsiveContainer>}</div>
      <div className="grid grid-cols-2 gap-2 text-xs">{detail.map((x,i)=><span key={x.name} className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 shrink-0 rounded-full" style={{background:colorFor(x.name,i)}} />{x.name} <span className="text-ink/40">{percentOf(x.value, detail)}%</span></span>)}</div>
    </div>
  </div>;
}

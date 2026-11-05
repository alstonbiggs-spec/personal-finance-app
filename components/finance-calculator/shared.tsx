'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { MortgageResult } from '@/lib/calculators/mortgage';
import { NumberInput, Slider } from './number-field';

export const money = (value: number, decimals = 0) => `$${value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

export const palette = { forest: '#173d35', gold: '#ad8a50', sage: '#6f8f84', sand: '#c9b48a', stone: '#8e9692' };

export type Part = { label: string; value: number; color: string };

export function mortgageParts(result: MortgageResult): Part[] {
  return [
    { label: 'Principal & interest', value: result.principalAndInterest, color: palette.forest },
    { label: 'Property tax', value: result.propertyTax, color: palette.gold },
    { label: 'Home insurance', value: result.homeInsurance, color: palette.sage },
    { label: 'PMI', value: result.pmi, color: palette.sand },
    { label: 'HOA', value: result.hoa, color: palette.stone },
  ].filter(part => part.value > 0);
}

// True while the element is on screen. Used to pin a copy of the headline number
// once it scrolls away (sliders sit lower on a phone).
function useOnScreen<T extends Element>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, visible] as const;
}

type HeroProps = { label: string; display: string; suffix?: string; parts: Part[]; partsCaption?: string; children?: ReactNode };

// The big headline result, a stacked bar of what it's made of, and a pinned copy of the
// number at the bottom of the screen whenever the headline is scrolled out of view.
export function ResultHero({ label, display, suffix, parts, partsCaption, children }: HeroProps) {
  const [ref, visible] = useOnScreen<HTMLElement>();
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return <>
    <section ref={ref} className="border-y hairline py-7 text-center sm:py-14">
      <p className="label">{label}</p>
      {/* Scales with the screen so a seven-figure number still fits on one line at 320px. */}
      <p className="serif mt-3 whitespace-nowrap text-[clamp(2.5rem,13vw,4.5rem)] leading-none text-forest sm:mt-4">{display}{suffix && <span className="ml-1.5 text-lg text-ink/40 sm:ml-2 sm:text-2xl">{suffix}</span>}</p>
      {children}
      {parts.length > 0 && total > 0 && <div className="mx-auto mt-6 max-w-2xl sm:mt-8">
        {partsCaption && <p className="label mb-2 text-left sm:text-center">{partsCaption}</p>}
        <div className="flex h-2.5 overflow-hidden rounded-full bg-mist">{parts.map(part => <div key={part.label} style={{ width: `${(part.value / total) * 100}%`, background: part.color }} />)}</div>
        {/* Phones: an aligned list (label left, amount right). Wider: a centered legend row. */}
        <div className="mt-4 grid gap-y-2 text-left text-sm sm:mt-5 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-6 sm:gap-y-3">{parts.map(part => <div key={part.label} className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: part.color }} /><span className="text-ink/55">{part.label}</span><span className="ml-auto tabular-nums sm:ml-0">{money(part.value)}</span></div>)}</div>
      </div>}
    </section>
    <div className={`fixed inset-x-0 bottom-0 z-20 border-t hairline bg-cream/95 px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(24,35,31,.06)] backdrop-blur transition ${visible ? 'pointer-events-none translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
      <div className="mx-auto flex max-w-7xl items-baseline justify-between gap-4 lg:px-4"><span className="label">{label}</span><span className="serif whitespace-nowrap text-2xl text-forest">{display}{suffix && <span className="ml-1 text-sm text-ink/40">{suffix}</span>}</span></div>
    </div>
  </>;
}

export function InputGroup({ title, children }: { title?: string; children: ReactNode }) {
  return <section className="border-b hairline py-8 last:border-b-0 sm:py-10">
    {title && <p className="serif mb-6 text-xl sm:text-2xl">{title}</p>}
    <div className="grid gap-x-12 gap-y-7 sm:gap-y-9 md:grid-cols-2">{children}</div>
  </section>;
}

export function Stats({ title, items, children }: { title: string; items: { label: string; value: string; note?: string }[]; children?: ReactNode }) {
  return <section className="border-t hairline pt-8">
    <p className="label mb-5">{title}</p>
    <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:gap-y-7 lg:grid-cols-5">{items.map(item => <div key={item.label}><dt className="label">{item.label}</dt><dd className="serif mt-2 text-xl sm:text-2xl">{item.value}</dd>{item.note && <p className="mt-1 text-[11px] text-ink/40">{item.note}</p>}</div>)}</dl>
    {children}
  </section>;
}

export function Chips({ options, value, onChange, format }: { options: number[]; value: number; onChange: (value: number) => void; format: (value: number) => string }) {
  return <div className="mt-2 grid gap-2 sm:flex" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>{options.map(option => <button key={option} type="button" onClick={() => onChange(option)} className={`rounded-sm border px-2 py-2.5 text-xs tracking-wider transition sm:px-3 sm:py-1 ${value === option ? 'border-forest bg-forest text-white' : 'hairline text-ink/60 hover:bg-white'}`}>{format(option)}</button>)}</div>;
}

export function Toggle<T extends string>({ label, hint, options, value, onChange }: { label: string; hint?: string; options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <div>
    <div className="flex items-baseline justify-between gap-3"><span className="label">{label}</span>{hint && <span className="text-[11px] text-ink/40">{hint}</span>}</div>
    <div className={`mt-3 grid rounded-sm border hairline p-1 ${options.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>{options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={`rounded-sm py-2.5 text-xs uppercase tracking-[.12em] transition ${value === option.value ? 'bg-forest text-white' : 'text-ink/55 hover:text-ink'}`}>{option.label}</button>)}</div>
  </div>;
}

// A value entered either as dollars or as a percent of a base (home price). The percent
// is the stored value, so moving the home price keeps the same 20% down / 1.1% tax rate.
export function LinkedField({ label, hint, base, pct, onPct, maxPct, step, dollarSuffix }: { label: string; hint?: string; base: number; pct: number; onPct: (pct: number) => void; maxPct: number; step: number; dollarSuffix?: string }) {
  return <div>
    <div className="flex items-baseline justify-between gap-3"><span className="label">{label}</span>{hint && <span className="text-[11px] text-ink/40">{hint}</span>}</div>
    <div className="flex gap-4">
      <NumberInput ariaLabel={`${label} in dollars`} prefix="$" suffix={dollarSuffix} value={(base * pct) / 100} onChange={dollars => onPct(base > 0 ? (dollars / base) * 100 : 0)} />
      <div className="w-24 shrink-0"><NumberInput ariaLabel={`${label} percent`} suffix="%" decimals={3} value={pct} onChange={onPct} /></div>
    </div>
    <Slider ariaLabel={`${label} slider`} value={pct} onChange={onPct} min={0} max={maxPct} step={step} />
  </div>;
}

export function payoffLabel(months: number) {
  if (months <= 0) return '—';
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

// A typed input plus a slider for the same value. The text box keeps its own draft so
// the user can type freely ("", "6.", "1,2") without the value snapping back mid-edit;
// it reformats on blur. Typed values may go past the slider's range.

export function parseNumber(raw: string) {
  const n = Number(raw.replace(/[$,%\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function formatNumber(value: number, decimals: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

type TextProps = { value: number; onChange: (value: number) => void; prefix?: string; suffix?: string; decimals?: number; ariaLabel: string };

export function NumberInput({ value, onChange, prefix, suffix, decimals = 0, ariaLabel }: TextProps) {
  const [draft, setDraft] = useState(formatNumber(value, decimals));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(formatNumber(value, decimals)); }, [value, decimals]);
  return <div className="flex min-w-0 flex-1 items-baseline gap-1 border-b hairline py-2 focus-within:border-forest">
    {prefix && <span className="text-sm text-ink/45">{prefix}</span>}
    <input
      aria-label={ariaLabel}
      inputMode="decimal"
      enterKeyHint="done"
      autoComplete="off"
      value={draft}
      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      onFocus={event => { focused.current = true; event.target.select(); }}
      onBlur={() => { focused.current = false; setDraft(formatNumber(value, decimals)); }}
      onChange={event => { setDraft(event.target.value); onChange(parseNumber(event.target.value)); }}
      className="w-full min-w-0 bg-transparent text-lg outline-none"
    />
    {suffix && <span className="shrink-0 text-sm text-ink/45">{suffix}</span>}
  </div>;
}

type SliderProps = { value: number; onChange: (value: number) => void; min: number; max: number; step: number; ariaLabel: string };

export function Slider({ value, onChange, min, max, step, ariaLabel }: SliderProps) {
  const clamped = Math.min(max, Math.max(min, value));
  const fill = max > min ? ((clamped - min) / (max - min)) * 100 : 0;
  return <input
    type="range"
    aria-label={ariaLabel}
    min={min}
    max={max}
    step={step}
    value={clamped}
    onChange={event => onChange(Number(event.target.value))}
    style={{ '--fill': `${fill}%` } as CSSProperties}
    className="range mt-2"
  />;
}

type FieldProps = { label: string; hint?: string; min: number; max: number; step: number } & Omit<TextProps, 'ariaLabel'>;

export function NumberField({ label, hint, min, max, step, ...input }: FieldProps) {
  return <div>
    <div className="flex items-baseline justify-between gap-3"><span className="label">{label}</span>{hint && <span className="text-[11px] text-ink/40">{hint}</span>}</div>
    <NumberInput ariaLabel={label} {...input} />
    <Slider ariaLabel={`${label} slider`} value={input.value} onChange={input.onChange} min={min} max={max} step={step} />
  </div>;
}

'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MortgageInputs } from '@/lib/calculators/mortgage';
import { restoreInputs } from '@/lib/calculators/saved-inputs';
import { STATE_CODES } from '@/lib/calculators/tax-data';
import { createClient } from '@/lib/supabase/client';
import { AffordabilityCalculator, affordabilityDefaults } from './affordability-calculator';
import { CarCalculator, carDefaults } from './car-calculator';
import { MortgageCalculator, mortgageDefaults } from './mortgage-calculator';
import { DOLLARS, RETURN_MODELS, RetirementCalculator, retirementDefaults, type Dollars } from './retirement-calculator';
import { TakeHomeCalculator, takeHomeDefaults } from './take-home-calculator';

const calculators = [
  { id: 'mortgage', label: 'Mortgage Calculator', blurb: 'Your full monthly housing payment: principal, interest, taxes, insurance, PMI and HOA.' },
  { id: 'affordability', label: 'Home Affordability Calculator', blurb: 'The most house your income and debts support under typical lender limits.' },
  { id: 'car', label: 'Car Payment Calculator', blurb: 'Monthly payment and true cost of an auto loan, including tax, fees and trade-in.' },
  { id: 'retirement', label: 'Retirement Calculator', blurb: 'How your savings grow until you retire, what they pay out each year after, and how long they last.' },
  { id: 'take-home', label: 'Tax Bracket & Take-Home Pay', blurb: 'Your paycheck after federal and state income tax, Social Security, Medicare and pre-tax deductions, and where your salary falls in the federal brackets.' },
] as const;
type CalculatorId = typeof calculators[number]['id'];
const CALCULATOR_IDS = calculators.map(calculator => calculator.id);

// Everything saved to public.calculator_inputs for the signed-in user.
const viewDefaults = {
  selected: 'mortgage' as CalculatorId,
  mortgage: mortgageDefaults,
  affordability: affordabilityDefaults,
  car: carDefaults,
  retirement: retirementDefaults,
  retirementDollars: 'today' as Dollars,
  takeHome: takeHomeDefaults,
};
type SavedView = typeof viewDefaults;

function restoreView(saved: unknown): SavedView {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
  const top = restoreInputs({ selected: viewDefaults.selected, retirementDollars: viewDefaults.retirementDollars }, s, { selected: CALCULATOR_IDS, retirementDollars: DOLLARS });
  return {
    ...top,
    mortgage: restoreInputs(mortgageDefaults, s.mortgage),
    affordability: restoreInputs(affordabilityDefaults, s.affordability),
    car: restoreInputs(carDefaults, s.car),
    retirement: restoreInputs(retirementDefaults, s.retirement, { returnModel: RETURN_MODELS }),
    takeHome: restoreInputs(takeHomeDefaults, s.takeHome, { filingStatus: ['single', 'married'], state: STATE_CODES, frequency: ['monthly', 'semimonthly', 'biweekly', 'weekly'] }),
  };
}

const SAVE_DELAY_MS = 1000;
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// Each calculator's inputs live here so switching calculators doesn't reset them. They're
// loaded on the server (page.tsx) and saved back about a second after the last edit.
// `userId` is null in demo mode (no Supabase configured), and then nothing is saved.
export function FinanceCalculatorView({ userId, saved }: { userId: string | null; saved: unknown }) {
  const [initial] = useState(() => restoreView(saved));
  const [selected, setSelected] = useState<CalculatorId>(initial.selected);
  const [mortgage, setMortgage] = useState(initial.mortgage);
  const [affordability, setAffordability] = useState(initial.affordability);
  const [car, setCar] = useState(initial.car);
  const [takeHome, setTakeHome] = useState(initial.takeHome);
  const [retirement, setRetirement] = useState(initial.retirement);
  const [retirementDollars, setRetirementDollars] = useState(initial.retirementDollars);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const current = calculators.find(calculator => calculator.id === selected)!;

  const view: SavedView = useMemo(
    () => ({ selected, mortgage, affordability, car, retirement, retirementDollars, takeHome }),
    [selected, mortgage, affordability, car, retirement, retirementDollars, takeHome],
  );
  const json = useMemo(() => JSON.stringify(view), [view]);
  // What's in the database, as far as we know; starts as what we loaded, so opening the
  // page doesn't write anything.
  const lastSaved = useRef(JSON.stringify(initial));
  const pending = useRef<string | null>(null);

  const save = useRef(async (body: string) => {
    if (!userId || body === lastSaved.current) return;
    setStatus('saving');
    const { error } = await createClient()
      .from('calculator_inputs')
      .upsert({ user_id: userId, inputs: JSON.parse(body), updated_at: new Date().toISOString() });
    if (error) { console.error('Saving calculator inputs failed:', error); setStatus('error'); return; }
    lastSaved.current = body;
    setStatus('saved');
  }).current;

  useEffect(() => {
    if (!userId || json === lastSaved.current) return;
    pending.current = json;
    const timer = setTimeout(() => { pending.current = null; void save(json); }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [json, userId, save]);

  // Don't lose an edit made just before leaving: save immediately when the tab is hidden
  // (switching apps, closing the tab) or the page is navigated away from.
  useEffect(() => {
    const flush = () => { if (pending.current) { const body = pending.current; pending.current = null; void save(body); } };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { document.removeEventListener('visibilitychange', onVisibility); flush(); };
  }, [save]);

  const reset = () => {
    if (selected === 'mortgage') setMortgage(mortgageDefaults);
    if (selected === 'affordability') setAffordability(affordabilityDefaults);
    if (selected === 'car') setCar(carDefaults);
    if (selected === 'retirement') { setRetirement(retirementDefaults); setRetirementDollars(viewDefaults.retirementDollars); }
    if (selected === 'take-home') setTakeHome(takeHomeDefaults);
  };

  const openInMortgage = (inputs: MortgageInputs) => {
    setMortgage(inputs);
    setSelected('mortgage');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const statusText = { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Couldn’t save your changes' }[status];

  return <main className="mx-auto max-w-7xl px-6 py-8 pb-24 sm:py-10 lg:px-10">
    <div className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="label mb-3">Household office · Tools</p>
        <h1 className="serif text-4xl sm:text-5xl">Finance Calculator</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-ink/60">{current.blurb}</p>
      </div>
      <div className="sm:w-72">
        <label className="block">
          <span className="label">Calculator</span>
          <select value={selected} onChange={event => setSelected(event.target.value as CalculatorId)} className="mt-2 w-full border-b hairline bg-transparent py-2 text-base outline-none focus:border-forest">
            {calculators.map(calculator => <option key={calculator.id} value={calculator.id}>{calculator.label}</option>)}
          </select>
        </label>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs">
          <span aria-live="polite" className={status === 'error' ? 'text-gold' : 'text-ink/40'}>{statusText}</span>
          <button type="button" onClick={reset} className="text-ink/50 underline-offset-4 hover:text-ink hover:underline">Reset to defaults</button>
        </div>
      </div>
    </div>
    {selected === 'mortgage' && <MortgageCalculator inputs={mortgage} onChange={setMortgage} />}
    {selected === 'affordability' && <AffordabilityCalculator inputs={affordability} onChange={setAffordability} onOpenInMortgage={openInMortgage} />}
    {selected === 'car' && <CarCalculator inputs={car} onChange={setCar} />}
    {selected === 'retirement' && <RetirementCalculator inputs={retirement} onChange={setRetirement} dollars={retirementDollars} onDollarsChange={setRetirementDollars} />}
    {selected === 'take-home' && <TakeHomeCalculator inputs={takeHome} onChange={setTakeHome} />}
  </main>;
}

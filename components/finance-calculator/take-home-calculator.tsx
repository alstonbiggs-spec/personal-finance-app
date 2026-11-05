'use client';
import { useMemo } from 'react';
import { calculateTakeHome, type PayFrequency, type TakeHomeInputs } from '@/lib/calculators/take-home';
import { FEDERAL, STATES, STATE_CODES, type FilingStatus, type StateCode, type StateTax } from '@/lib/calculators/tax-data';
import { NumberField } from './number-field';
import { InputGroup, ResultHero, Stats, Toggle, money, palette } from './shared';

export const takeHomeDefaults: TakeHomeInputs = {
  filingStatus: 'married',
  state: 'TX',
  salary: 100000,
  spouseSalary: 0,
  frequency: 'biweekly',
  retirementPct: 5,
  pretaxMonthly: 300,
  children: 0,
  localRate: 0,
};

const frequencies: { value: PayFrequency; label: string; period: string }[] = [
  { value: 'monthly', label: 'Monthly', period: 'month' },
  { value: 'semimonthly', label: 'Semi-monthly', period: 'paycheck (twice a month)' },
  { value: 'biweekly', label: 'Bi-weekly', period: 'paycheck (every 2 weeks)' },
  { value: 'weekly', label: 'Weekly', period: 'paycheck (weekly)' },
];

const colors = { ...palette, clay: '#8a6a52', fern: '#a9b8a2', slate: '#56656b', wheat: '#e2d6bd' };
const pct = (value: number, digits = 1) => `${value.toLocaleString(undefined, { maximumFractionDigits: digits })}%`;

function rangeLabel(from: number, to: number) {
  if (from === 0) return `Up to ${money(to)}`;
  if (to === Infinity) return `Over ${money(from)}`;
  return `${money(from)} – ${money(to)}`;
}

export function TakeHomeCalculator({ inputs, onChange }: { inputs: TakeHomeInputs; onChange: (inputs: TakeHomeInputs) => void }) {
  const set = <K extends keyof TakeHomeInputs>(key: K) => (value: TakeHomeInputs[K]) => onChange({ ...inputs, [key]: value });
  const result = useMemo(() => calculateTakeHome(inputs), [inputs]);
  const state: StateTax = STATES[inputs.state];
  const married = inputs.filingStatus === 'married';
  const frequency = frequencies.find(f => f.value === inputs.frequency) ?? frequencies[2];
  const per = (annual: number) => annual / result.periods;
  const isMonthly = inputs.frequency === 'monthly';
  const standardDeduction = FEDERAL.standardDeduction[inputs.filingStatus];
  const deductionUsed = Math.min(standardDeduction, Math.max(0, result.gross - result.retirement - result.pretax));

  const parts = [
    { label: 'Take-home', value: per(result.takeHome), color: colors.forest },
    { label: 'Federal income tax', value: per(result.federal), color: colors.gold },
    { label: `${state.name} income tax`, value: per(result.state), color: colors.sage },
    { label: 'Social Security', value: per(result.socialSecurity), color: colors.sand },
    { label: 'Medicare', value: per(result.medicare), color: colors.stone },
    { label: state.payroll?.label ?? 'State payroll tax', value: per(result.statePayroll), color: colors.slate },
    { label: 'Local income tax', value: per(result.local), color: colors.clay },
    { label: '401(k)', value: per(result.retirement), color: colors.fern },
    { label: 'Pre-tax benefits', value: per(result.pretax), color: colors.wheat },
  ].filter(part => part.value > 0);

  const retirementPerEarner = (married ? [inputs.salary, inputs.spouseSalary] : [inputs.salary]).some(s => (s * inputs.retirementPct) / 100 > FEDERAL.retirementLimit);

  return <>
    <ResultHero label={`Take-home per ${isMonthly ? 'month' : 'paycheck'}`} display={money(per(result.takeHome))} suffix={isMonthly ? '/mo' : '/check'} parts={parts} partsCaption={`Gross ${money(per(result.gross))} per ${frequency.period}`}>
      <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-ink/55">
        {result.gross > 0
          ? <>{money(result.takeHome)} a year{!isMonthly && <> · {money(result.takeHome / 12)} a month</>}. {pct(result.effectiveRate)} of gross pay goes to taxes.</>
          : 'Enter a salary to see your paycheck.'}
      </p>
    </ResultHero>

    <InputGroup title="Your pay">
      <Toggle label="Filing status" hint={married ? 'Married filing jointly' : undefined} value={inputs.filingStatus} onChange={value => set('filingStatus')(value as FilingStatus)} options={[{ value: 'single', label: 'Single' }, { value: 'married', label: 'Married' }]} />
      <label className="block">
        <div className="flex items-baseline justify-between gap-3"><span className="label">State</span><span className="text-[11px] text-ink/40">{state.brackets ? 'Where you live and work' : 'No state income tax'}</span></div>
        <select value={inputs.state} onChange={event => set('state')(event.target.value as StateCode)} className="mt-2 w-full border-b hairline bg-transparent py-2 text-lg outline-none focus:border-forest">
          {STATE_CODES.map(code => <option key={code} value={code}>{STATES[code].name}</option>)}
        </select>
      </label>
      <NumberField label={married ? 'Your salary' : 'Annual salary'} hint="Per year, before tax" prefix="$" suffix="/yr" value={inputs.salary} onChange={set('salary')} min={0} max={500000} step={1000} />
      {married && <NumberField label="Spouse’s salary" hint="Leave at 0 for one income" prefix="$" suffix="/yr" value={inputs.spouseSalary} onChange={set('spouseSalary')} min={0} max={500000} step={1000} />}
      <div className="md:col-span-2">
        <Toggle label="Pay schedule" hint={`${result.periods} paychecks a year`} value={inputs.frequency} onChange={value => set('frequency')(value as PayFrequency)} options={frequencies} />
      </div>
    </InputGroup>

    <InputGroup title="Deductions and credits">
      <NumberField label="401(k) contribution" hint={retirementPerEarner ? `Capped at ${money(FEDERAL.retirementLimit)}/yr` : married ? 'Pre-tax, % of each salary' : 'Pre-tax, % of salary'} suffix="%" decimals={1} value={inputs.retirementPct} onChange={set('retirementPct')} min={0} max={30} step={0.5} />
      <NumberField label="Pre-tax benefits" hint="Health, dental, HSA, FSA" prefix="$" suffix="/mo" value={inputs.pretaxMonthly} onChange={set('pretaxMonthly')} min={0} max={3000} step={25} />
      <NumberField label="Children under 17" hint={`${money(FEDERAL.childCredit)} credit each`} value={inputs.children} onChange={value => set('children')(Math.round(value))} min={0} max={8} step={1} />
      <NumberField label="Local income tax" hint="City or county, if any" suffix="%" decimals={3} value={inputs.localRate} onChange={set('localRate')} min={0} max={5} step={0.05} />
    </InputGroup>

    <section className="border-t hairline py-8 sm:py-10">
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="serif text-xl sm:text-2xl">Federal tax brackets</p>
        <p className="text-xs text-ink/45">{FEDERAL.year} · {married ? 'Married filing jointly' : 'Single'}</p>
      </div>

      {/* How salary becomes taxable income. */}
      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 border-b hairline pb-6 sm:flex sm:flex-wrap sm:items-end sm:gap-x-5">
        {[
          { label: married ? 'Household salary' : 'Salary', value: money(result.gross) },
          ...(result.retirement > 0 ? [{ label: '401(k)', value: `− ${money(result.retirement)}` }] : []),
          ...(result.pretax > 0 ? [{ label: 'Pre-tax benefits', value: `− ${money(result.pretax)}` }] : []),
          { label: 'Standard deduction', value: `− ${money(standardDeduction)}` },
          { label: 'Taxable income', value: `= ${money(result.federalTaxable)}`, strong: true },
        ].map(item => <div key={item.label}>
          <dt className="label">{item.label}</dt>
          <dd className={`serif mt-1 text-lg tabular-nums sm:text-xl ${item.strong ? 'text-forest' : ''}`}>{item.value}</dd>
        </div>)}
      </dl>

      <div className="divide-y divide-ink/10">
        <div className={`grid grid-cols-[3.5rem_1fr_auto] items-center gap-x-4 py-3 ${deductionUsed > 0 ? '' : 'text-ink/35'}`}>
          <span className="serif text-2xl">0%</span>
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 text-xs"><span>Standard deduction · first {money(standardDeduction)}</span><span className="text-ink/45">{money(deductionUsed)} untaxed</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full" style={{ width: `${standardDeduction > 0 ? (deductionUsed / standardDeduction) * 100 : 0}%`, background: colors.fern }} /></div>
          </div>
          <span className="w-20 text-right text-sm tabular-nums sm:w-28">{money(0)}</span>
        </div>
        {result.federalSlices.map(slice => {
          const current = slice.rate === result.federalBracket && result.federalTaxable > 0;
          const fill = slice.to === Infinity ? (slice.amount > 0 ? 100 : 0) : (slice.amount / (slice.to - slice.from)) * 100;
          return <div key={slice.rate} className={`grid grid-cols-[3.5rem_1fr_auto] items-center gap-x-4 py-3 ${slice.amount > 0 ? '' : 'text-ink/35'}`}>
            <span className={`serif text-2xl ${current ? 'text-forest' : ''}`}>{slice.rate}%</span>
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-3 text-xs"><span>{rangeLabel(slice.from, slice.to)}</span>{current && <span className="label text-gold">Your bracket</span>}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full" style={{ width: `${fill}%`, background: current ? colors.forest : colors.sage }} /></div>
            </div>
            <span className="w-20 text-right text-sm tabular-nums sm:w-28">{slice.amount > 0 ? money(slice.tax) : '—'}</span>
          </div>;
        })}
      </div>
      <p className="mt-5 text-xs leading-5 text-ink/45">
        The standard deduction is the first slice of income, taxed at 0%. Each rate after it applies only to the income inside its band, so moving into a higher bracket never lowers your take-home.
        {result.childCredit > 0 && <> The child tax credit then takes {money(result.childCredit)} off the {money(result.federal + result.childCredit)} total.</>}
      </p>
    </section>

    <Stats title="For the year" items={[
      { label: 'Gross pay', value: money(result.gross), note: `${money(result.gross / 12)}/mo` },
      { label: 'Take-home', value: money(result.takeHome), note: `${money(result.takeHome / 12)}/mo` },
      { label: 'Total taxes', value: money(result.totalTax), note: `Effective rate ${pct(result.effectiveRate)}` },
      { label: 'Federal bracket', value: pct(result.federalBracket, 0), note: `${state.name} ${money(result.state)}/yr` },
      { label: 'Marginal rate', value: pct(result.marginalRate), note: 'Tax on your next dollar' },
    ]}>
      {state.note && <p className="mt-7 text-xs text-ink/50">{state.note}</p>}
      <p className="mt-3 text-xs text-ink/40">
        Estimates only. Federal figures are {FEDERAL.year} rates; state figures are simplified from the latest published rates and skip most phase-outs.
        Assumes wages are your only income and the standard deduction. Employer withholding can differ from what you actually owe, which shows up as a refund or a bill at tax time.
        {state.payroll ? '' : ' State disability, paid-leave and long-term-care payroll taxes are not included.'}
      </p>
    </Stats>
  </>;
}

'use client';
import { useMemo } from 'react';
import { calculateMortgage, type MortgageInputs } from '@/lib/calculators/mortgage';
import { NumberField } from './number-field';
import { Chips, InputGroup, LinkedField, ResultHero, Stats, money, mortgageParts, payoffLabel } from './shared';

export const mortgageDefaults: MortgageInputs = {
  homePrice: 400000,
  downPaymentPct: 20,
  interestRate: 6.5,
  termYears: 30,
  propertyTaxRate: 1.1,
  homeInsuranceAnnual: 1800,
  pmiRate: 0.5,
  hoaMonthly: 0,
};

export function MortgageCalculator({ inputs, onChange }: { inputs: MortgageInputs; onChange: (inputs: MortgageInputs) => void }) {
  const set = <K extends keyof MortgageInputs>(key: K) => (value: MortgageInputs[K]) => onChange({ ...inputs, [key]: value });
  const result = useMemo(() => calculateMortgage(inputs), [inputs]);
  const downBelow20 = inputs.homePrice > 0 && result.loanAmount / inputs.homePrice > 0.8;
  const pmiYears = Math.ceil(result.pmiMonths / 12);

  return <>
    <ResultHero label="Estimated monthly payment" display={money(result.monthlyTotal)} suffix="/mo" parts={mortgageParts(result)} />

    <InputGroup>
      <NumberField label="Home price" prefix="$" value={inputs.homePrice} onChange={set('homePrice')} min={0} max={2000000} step={5000} />
      <LinkedField label="Down payment" hint={inputs.homePrice > 0 ? `Loan ${money(result.loanAmount)}` : undefined} base={inputs.homePrice} pct={inputs.downPaymentPct} onPct={set('downPaymentPct')} maxPct={100} step={0.5} />
      <NumberField label="Interest rate" suffix="%" decimals={3} value={inputs.interestRate} onChange={set('interestRate')} min={0} max={15} step={0.125} />
      <div>
        <NumberField label="Loan term" suffix="years" value={inputs.termYears} onChange={set('termYears')} min={1} max={40} step={1} />
        <Chips options={[10, 15, 20, 30]} value={inputs.termYears} onChange={set('termYears')} format={years => `${years} yr`} />
      </div>
      <LinkedField label="Property tax" hint="Per year" dollarSuffix="/yr" base={inputs.homePrice} pct={inputs.propertyTaxRate} onPct={set('propertyTaxRate')} maxPct={4} step={0.05} />
      <NumberField label="Home insurance" hint="Per year" prefix="$" suffix="/yr" value={inputs.homeInsuranceAnnual} onChange={set('homeInsuranceAnnual')} min={0} max={10000} step={50} />
      <NumberField label="PMI rate" hint={downBelow20 ? 'Applies: under 20% down' : 'Not charged at 20%+ down'} suffix="% /yr" decimals={3} value={inputs.pmiRate} onChange={set('pmiRate')} min={0} max={2} step={0.05} />
      <NumberField label="HOA dues" hint="Per month" prefix="$" suffix="/mo" value={inputs.hoaMonthly} onChange={set('hoaMonthly')} min={0} max={1500} step={10} />
    </InputGroup>

    <Stats title="Over the life of the loan" items={[
      { label: 'Loan amount', value: money(result.loanAmount) },
      { label: 'Down payment', value: money(result.downPayment) },
      { label: 'Total interest', value: money(result.totalInterest) },
      { label: 'Total cost', value: money(result.lifetimeCost), note: 'Down payment + all payments' },
      { label: 'Paid off', value: result.loanAmount > 0 ? payoffLabel(result.months) : '—' },
    ]}>
      {result.pmi > 0 && <p className="mt-7 text-xs text-ink/50">PMI of {money(result.pmi)}/mo drops off after about {pmiYears} year{pmiYears === 1 ? '' : 's'}, once the balance reaches 78% of the home price. After that the payment is {money(result.monthlyTotal - result.pmi)}/mo.</p>}
      <p className="mt-3 text-xs text-ink/40">Estimates only. Taxes, insurance and HOA dues are assumed flat over the term.</p>
    </Stats>
  </>;
}

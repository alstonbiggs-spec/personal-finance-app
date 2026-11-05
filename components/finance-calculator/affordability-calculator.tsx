'use client';
import { useMemo } from 'react';
import { calculateAffordability, mortgageInputsForPrice, type AffordabilityInputs } from '@/lib/calculators/affordability';
import type { MortgageInputs } from '@/lib/calculators/mortgage';
import { NumberField } from './number-field';
import { Chips, InputGroup, ResultHero, Stats, money, mortgageParts } from './shared';

export const affordabilityDefaults: AffordabilityInputs = {
  annualIncome: 150000,
  monthlyDebts: 500,
  downPayment: 80000,
  interestRate: 6.5,
  termYears: 30,
  propertyTaxRate: 1.1,
  homeInsuranceAnnual: 1800,
  pmiRate: 0.5,
  hoaMonthly: 0,
  frontEndRatio: 28,
  backEndRatio: 36,
};

const pct = (value: number) => `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;

export function AffordabilityCalculator({ inputs, onChange, onOpenInMortgage }: { inputs: AffordabilityInputs; onChange: (inputs: AffordabilityInputs) => void; onOpenInMortgage: (inputs: MortgageInputs) => void }) {
  const set = <K extends keyof AffordabilityInputs>(key: K) => (value: AffordabilityInputs[K]) => onChange({ ...inputs, [key]: value });
  const result = useMemo(() => calculateAffordability(inputs), [inputs]);
  const { mortgage } = result;
  const hasPrice = result.price > 0 && !result.unbounded;

  const reason = result.unbounded
    ? 'With these inputs the payment doesn’t grow with the price, so there’s no ceiling. Add a loan term and rate.'
    : result.monthlyIncome === 0
      ? 'Enter your household income to see what you can afford.'
      : result.budget === 0
        ? 'Your monthly debts already use up the total debt limit.'
        : !hasPrice
          ? 'Insurance and HOA dues alone are over your housing budget.'
          : `Limited by your ${result.limitedBy === 'housing' ? 'housing ratio' : 'total debt ratio'}: up to ${money(result.budget)}/mo for housing.`;

  return <>
    <ResultHero label="Home price you can afford" display={result.unbounded ? 'No limit' : money(result.price)} parts={hasPrice ? mortgageParts(mortgage) : []} partsCaption={hasPrice ? `Monthly payment ${money(mortgage.monthlyTotal)}` : undefined}>
      <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-ink/55">{reason}</p>
      {hasPrice && <button type="button" onClick={() => onOpenInMortgage(mortgageInputsForPrice(inputs, result.price))} className="mt-5 text-xs uppercase tracking-[.16em] text-gold">Open in Mortgage Calculator →</button>}
    </ResultHero>

    <InputGroup title="Your finances">
      <NumberField label="Household income" hint="Per year, before tax" prefix="$" suffix="/yr" value={inputs.annualIncome} onChange={set('annualIncome')} min={0} max={500000} step={1000} />
      <NumberField label="Monthly debts" hint="Car, student loans, card minimums" prefix="$" suffix="/mo" value={inputs.monthlyDebts} onChange={set('monthlyDebts')} min={0} max={10000} step={50} />
      <NumberField label="Down payment" hint="Cash available" prefix="$" value={inputs.downPayment} onChange={set('downPayment')} min={0} max={500000} step={1000} />
    </InputGroup>

    <InputGroup title="The loan">
      <NumberField label="Interest rate" suffix="%" decimals={3} value={inputs.interestRate} onChange={set('interestRate')} min={0} max={15} step={0.125} />
      <div>
        <NumberField label="Loan term" suffix="years" value={inputs.termYears} onChange={set('termYears')} min={1} max={40} step={1} />
        <Chips options={[10, 15, 20, 30]} value={inputs.termYears} onChange={set('termYears')} format={years => `${years} yr`} />
      </div>
      <NumberField label="Property tax" hint={hasPrice ? `${money((result.price * inputs.propertyTaxRate) / 100)}/yr at this price` : 'Per year, % of price'} suffix="%" decimals={3} value={inputs.propertyTaxRate} onChange={set('propertyTaxRate')} min={0} max={4} step={0.05} />
      <NumberField label="Home insurance" hint="Per year" prefix="$" suffix="/yr" value={inputs.homeInsuranceAnnual} onChange={set('homeInsuranceAnnual')} min={0} max={10000} step={50} />
      <NumberField label="PMI rate" hint="Charged under 20% down" suffix="% /yr" decimals={3} value={inputs.pmiRate} onChange={set('pmiRate')} min={0} max={2} step={0.05} />
      <NumberField label="HOA dues" hint="Per month" prefix="$" suffix="/mo" value={inputs.hoaMonthly} onChange={set('hoaMonthly')} min={0} max={1500} step={10} />
    </InputGroup>

    <InputGroup title="Lender limits">
      <NumberField label="Housing ratio" hint="Housing ÷ gross income · often 28%" suffix="%" decimals={1} value={inputs.frontEndRatio} onChange={set('frontEndRatio')} min={0} max={50} step={1} />
      <NumberField label="Total debt ratio" hint="Housing + debts ÷ income · often 36–43%" suffix="%" decimals={1} value={inputs.backEndRatio} onChange={set('backEndRatio')} min={0} max={60} step={1} />
    </InputGroup>

    <Stats title="At this price" items={[
      { label: 'Loan amount', value: money(mortgage.loanAmount) },
      { label: 'Down payment', value: money(mortgage.downPayment), note: hasPrice ? `${pct((mortgage.downPayment / result.price) * 100)} of price` : undefined },
      { label: 'Monthly payment', value: money(mortgage.monthlyTotal) },
      { label: 'Housing ratio', value: pct(result.frontRatio), note: `Limit ${pct(inputs.frontEndRatio)}` },
      { label: 'Total debt ratio', value: pct(result.backRatio), note: `Limit ${pct(inputs.backEndRatio)}` },
    ]}>
      <p className="mt-7 text-xs text-ink/40">Estimates only. Lenders also weigh credit score, reserves and loan type, and closing costs (often 2–5% of the price) come on top of the down payment.</p>
    </Stats>
  </>;
}

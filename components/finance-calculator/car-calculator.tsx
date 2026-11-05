'use client';
import { useMemo } from 'react';
import { calculateCarPayment, type CarInputs } from '@/lib/calculators/car';
import { NumberField } from './number-field';
import { Chips, InputGroup, ResultHero, Stats, Toggle, money, palette, payoffLabel } from './shared';

export const carDefaults: CarInputs = {
  vehiclePrice: 35000,
  downPayment: 5000,
  tradeInValue: 0,
  tradeInOwed: 0,
  salesTaxRate: 6,
  fees: 600,
  interestRate: 7,
  termMonths: 60,
  rollCostsIntoLoan: true,
};

const termLabel = (months: number) => (months % 12 === 0 ? `${months / 12} yr` : `${(months / 12).toFixed(1)} yr`);

export function CarCalculator({ inputs, onChange }: { inputs: CarInputs; onChange: (inputs: CarInputs) => void }) {
  const set = <K extends keyof CarInputs>(key: K) => (value: CarInputs[K]) => onChange({ ...inputs, [key]: value });
  const result = useMemo(() => calculateCarPayment(inputs), [inputs]);
  const negativeEquity = result.tradeEquity < 0 ? -result.tradeEquity : 0;

  return <>
    <ResultHero label="Estimated monthly payment" display={money(result.monthlyPayment)} suffix="/mo" partsCaption="Of all payments" parts={[
      { label: 'Principal', value: result.months > 0 ? result.loanAmount : 0, color: palette.forest },
      { label: 'Interest', value: result.totalInterest, color: palette.gold },
    ].filter(part => part.value > 0)} />

    <InputGroup title="The car">
      <NumberField label="Vehicle price" prefix="$" value={inputs.vehiclePrice} onChange={set('vehiclePrice')} min={0} max={150000} step={500} />
      <NumberField label="Down payment" hint="Cash toward the car" prefix="$" value={inputs.downPayment} onChange={set('downPayment')} min={0} max={50000} step={500} />
      <NumberField label="Trade-in value" prefix="$" value={inputs.tradeInValue} onChange={set('tradeInValue')} min={0} max={80000} step={500} />
      <NumberField label="Owed on trade-in" hint={negativeEquity > 0 ? `${money(negativeEquity)} rolled into loan` : 'Remaining loan balance'} prefix="$" value={inputs.tradeInOwed} onChange={set('tradeInOwed')} min={0} max={80000} step={500} />
    </InputGroup>

    <InputGroup title="Taxes, fees and the loan">
      <NumberField label="Sales tax" hint={`${money(result.salesTax)} on price after trade-in`} suffix="%" decimals={3} value={inputs.salesTaxRate} onChange={set('salesTaxRate')} min={0} max={12} step={0.05} />
      <NumberField label="Title, registration & fees" prefix="$" value={inputs.fees} onChange={set('fees')} min={0} max={5000} step={50} />
      <Toggle label="Tax & fees" hint={inputs.rollCostsIntoLoan ? 'Added to the loan' : 'Paid at signing'} value={inputs.rollCostsIntoLoan ? 'roll' : 'upfront'} onChange={value => set('rollCostsIntoLoan')(value === 'roll')} options={[{ value: 'roll', label: 'Finance them' }, { value: 'upfront', label: 'Pay upfront' }]} />
      <NumberField label="Interest rate (APR)" suffix="%" decimals={3} value={inputs.interestRate} onChange={set('interestRate')} min={0} max={25} step={0.05} />
      <div>
        <NumberField label="Loan term" hint={inputs.termMonths > 0 ? termLabel(inputs.termMonths) : undefined} suffix="months" value={inputs.termMonths} onChange={set('termMonths')} min={12} max={96} step={6} />
        <Chips options={[36, 48, 60, 72, 84]} value={inputs.termMonths} onChange={set('termMonths')} format={months => `${months}`} />
      </div>
    </InputGroup>

    <Stats title="Over the life of the loan" items={[
      { label: 'Amount financed', value: money(result.loanAmount) },
      { label: 'Cash at signing', value: money(result.cashAtSigning), note: inputs.rollCostsIntoLoan ? 'Down payment' : 'Down payment + tax & fees' },
      { label: 'Total interest', value: money(result.totalInterest) },
      { label: 'Total cost', value: money(result.totalCost), note: 'Price + tax + fees + interest' },
      { label: 'Paid off', value: result.loanAmount > 0 ? payoffLabel(result.months) : '—' },
    ]}>
      {negativeEquity > 0 && <p className="mt-7 text-xs text-ink/50">The amount financed includes {money(negativeEquity)} still owed on your trade-in beyond what it’s worth.</p>}
      <p className="mt-3 text-xs text-ink/40">Estimates only. Most states tax the price after the trade-in credit; check yours.</p>
    </Stats>
  </>;
}

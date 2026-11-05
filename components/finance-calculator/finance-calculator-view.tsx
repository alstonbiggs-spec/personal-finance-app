'use client';
import { useState } from 'react';
import type { MortgageInputs } from '@/lib/calculators/mortgage';
import { AffordabilityCalculator, affordabilityDefaults } from './affordability-calculator';
import { CarCalculator, carDefaults } from './car-calculator';
import { MortgageCalculator, mortgageDefaults } from './mortgage-calculator';
import { RetirementCalculator, retirementDefaults } from './retirement-calculator';
import { TakeHomeCalculator, takeHomeDefaults } from './take-home-calculator';

const calculators = [
  { id: 'mortgage', label: 'Mortgage Calculator', blurb: 'Your full monthly housing payment: principal, interest, taxes, insurance, PMI and HOA.' },
  { id: 'affordability', label: 'Home Affordability Calculator', blurb: 'The most house your income and debts support under typical lender limits.' },
  { id: 'car', label: 'Car Payment Calculator', blurb: 'Monthly payment and true cost of an auto loan, including tax, fees and trade-in.' },
  { id: 'retirement', label: 'Retirement Calculator', blurb: 'How your savings grow until you retire, what they pay out each year after, and how long they last.' },
  { id: 'take-home', label: 'Tax Bracket & Take-Home Pay', blurb: 'Your paycheck after federal and state income tax, Social Security, Medicare and pre-tax deductions, and where your salary falls in the federal brackets.' },
] as const;
type CalculatorId = typeof calculators[number]['id'];

// Each calculator's inputs live here so switching calculators doesn't reset them.
export function FinanceCalculatorView() {
  const [selected, setSelected] = useState<CalculatorId>('mortgage');
  const [mortgage, setMortgage] = useState(mortgageDefaults);
  const [affordability, setAffordability] = useState(affordabilityDefaults);
  const [car, setCar] = useState(carDefaults);
  const [takeHome, setTakeHome] = useState(takeHomeDefaults);
  const [retirement, setRetirement] = useState(retirementDefaults);
  const current = calculators.find(calculator => calculator.id === selected)!;

  const openInMortgage = (inputs: MortgageInputs) => {
    setMortgage(inputs);
    setSelected('mortgage');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return <main className="mx-auto max-w-7xl px-6 py-8 pb-24 sm:py-10 lg:px-10">
    <div className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="label mb-3">Household office · Tools</p>
        <h1 className="serif text-4xl sm:text-5xl">Finance Calculator</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-ink/60">{current.blurb}</p>
      </div>
      <label className="block sm:w-72">
        <span className="label">Calculator</span>
        <select value={selected} onChange={event => setSelected(event.target.value as CalculatorId)} className="mt-2 w-full border-b hairline bg-transparent py-2 text-base outline-none focus:border-forest">
          {calculators.map(calculator => <option key={calculator.id} value={calculator.id}>{calculator.label}</option>)}
        </select>
      </label>
    </div>
    {selected === 'mortgage' && <MortgageCalculator inputs={mortgage} onChange={setMortgage} />}
    {selected === 'affordability' && <AffordabilityCalculator inputs={affordability} onChange={setAffordability} onOpenInMortgage={openInMortgage} />}
    {selected === 'car' && <CarCalculator inputs={car} onChange={setCar} />}
    {selected === 'retirement' && <RetirementCalculator inputs={retirement} onChange={setRetirement} />}
    {selected === 'take-home' && <TakeHomeCalculator inputs={takeHome} onChange={setTakeHome} />}
  </main>;
}

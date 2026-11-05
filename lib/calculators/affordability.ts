import { calculateMortgage, type MortgageInputs, type MortgageResult } from './mortgage';

// "How much house can we afford": the highest price whose full monthly payment fits
// under both lender debt-to-income limits. The housing payment is computed with the
// same calculateMortgage as the Mortgage Calculator, so the two always agree.

export type AffordabilityInputs = {
  annualIncome: number;       // gross household income
  monthlyDebts: number;       // car, student loans, card minimums (not rent)
  downPayment: number;        // dollars available, not a percent (the price is unknown)
  interestRate: number;
  termYears: number;
  propertyTaxRate: number;    // annual % of price
  homeInsuranceAnnual: number;
  pmiRate: number;
  hoaMonthly: number;
  frontEndRatio: number;      // max % of gross income for housing (lenders often use 28)
  backEndRatio: number;       // max % of gross income for housing + all debts (often 36)
};

export type AffordabilityResult = {
  price: number;
  unbounded: boolean;         // the payment doesn't grow with price (e.g. a 0-year term), so there's no ceiling
  monthlyIncome: number;
  budget: number;             // the max monthly housing payment allowed
  limitedBy: 'housing' | 'debt';
  mortgage: MortgageResult;
  frontRatio: number;         // actual % of income at the result price
  backRatio: number;
};

const clean = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);
const PRICE_CAP = 100_000_000;

export function mortgageInputsForPrice(input: AffordabilityInputs, price: number): MortgageInputs {
  return {
    homePrice: price,
    downPaymentPct: price > 0 ? Math.min(100, (clean(input.downPayment) / price) * 100) : 0,
    interestRate: input.interestRate,
    termYears: input.termYears,
    propertyTaxRate: input.propertyTaxRate,
    homeInsuranceAnnual: input.homeInsuranceAnnual,
    pmiRate: input.pmiRate,
    hoaMonthly: input.hoaMonthly,
  };
}

export function calculateAffordability(input: AffordabilityInputs): AffordabilityResult {
  const monthlyIncome = clean(input.annualIncome) / 12;
  const housingLimit = (monthlyIncome * clean(input.frontEndRatio)) / 100;
  const debtLimit = (monthlyIncome * clean(input.backEndRatio)) / 100 - clean(input.monthlyDebts);
  const budget = Math.max(0, Math.min(housingLimit, debtLimit));
  const limitedBy = housingLimit <= debtLimit ? 'housing' : 'debt';
  const monthlyAt = (price: number) => calculateMortgage(mortgageInputsForPrice(input, price)).monthlyTotal;

  // The payment never falls as the price rises (the loan, tax and PMI share all grow),
  // so binary-search for the highest price that still fits the budget.
  let price = 0;
  let unbounded = false;
  if (budget > 0 && monthlyAt(0) <= budget) {
    let high = 100_000;
    while (high < PRICE_CAP && monthlyAt(high) <= budget) high *= 2;
    if (high >= PRICE_CAP && monthlyAt(PRICE_CAP) <= budget) unbounded = true;
    else {
      let low = 0;
      for (let i = 0; i < 60; i += 1) {
        const mid = (low + high) / 2;
        if (monthlyAt(mid) <= budget) low = mid; else high = mid;
      }
      price = Math.floor(low / 100) * 100;
    }
  }

  const mortgage = calculateMortgage(mortgageInputsForPrice(input, unbounded ? 0 : price));
  const frontRatio = monthlyIncome > 0 ? (mortgage.monthlyTotal / monthlyIncome) * 100 : 0;
  const backRatio = monthlyIncome > 0 ? ((mortgage.monthlyTotal + clean(input.monthlyDebts)) / monthlyIncome) * 100 : 0;
  return { price, unbounded, monthlyIncome, budget, limitedBy, mortgage, frontRatio, backRatio };
}

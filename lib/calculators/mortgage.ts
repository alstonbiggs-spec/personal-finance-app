// Mortgage math for the Finance Calculator. Every input may be 0, so nothing here may
// divide by the price, the rate or the term without guarding it first.

export type MortgageInputs = {
  homePrice: number;
  downPaymentPct: number;     // % of home price
  interestRate: number;       // annual %, e.g. 6.5
  termYears: number;
  propertyTaxRate: number;    // annual % of home price
  homeInsuranceAnnual: number;
  pmiRate: number;            // annual % of the loan amount, charged only while LTV > 80%
  hoaMonthly: number;
};

export type MortgageResult = {
  downPayment: number;
  loanAmount: number;
  months: number;
  principalAndInterest: number;
  propertyTax: number;
  homeInsurance: number;
  pmi: number;
  hoa: number;
  monthlyTotal: number;
  totalInterest: number;
  pmiMonths: number;          // how many payments include PMI before it drops off
  lifetimeCost: number;       // down payment + every monthly payment over the term
};

const clean = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

export function monthlyPrincipalAndInterest(principal: number, annualRatePct: number, months: number) {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

export function calculateMortgage(input: MortgageInputs): MortgageResult {
  const price = clean(input.homePrice);
  const downPayment = Math.min(price, (price * clean(input.downPaymentPct)) / 100);
  const loanAmount = price - downPayment;
  const months = Math.round(clean(input.termYears) * 12);
  const monthlyRate = clean(input.interestRate) / 100 / 12;

  const principalAndInterest = monthlyPrincipalAndInterest(loanAmount, clean(input.interestRate), months);
  const propertyTax = (price * clean(input.propertyTaxRate)) / 100 / 12;
  const homeInsurance = clean(input.homeInsuranceAnnual) / 12;
  const hoa = clean(input.hoaMonthly);

  // PMI applies while the loan is above 80% of the price. Lenders must drop it
  // automatically once the scheduled balance reaches 78%, so count payments until then.
  const pmiMonthly = months > 0 && price > 0 && loanAmount / price > 0.8 ? (loanAmount * clean(input.pmiRate)) / 100 / 12 : 0;
  let pmiMonths = 0;
  if (pmiMonthly > 0) {
    let balance = loanAmount;
    while (pmiMonths < months && balance > price * 0.78) {
      balance -= principalAndInterest - balance * monthlyRate;
      pmiMonths += 1;
    }
  }

  const totalInterest = months > 0 ? Math.max(0, principalAndInterest * months - loanAmount) : 0;
  const monthlyTotal = principalAndInterest + propertyTax + homeInsurance + pmiMonthly + hoa;
  const lifetimeCost = downPayment + (principalAndInterest + propertyTax + homeInsurance + hoa) * months + pmiMonthly * pmiMonths;

  return { downPayment, loanAmount, months, principalAndInterest, propertyTax, homeInsurance, pmi: pmiMonthly, hoa, monthlyTotal, totalInterest, pmiMonths, lifetimeCost };
}

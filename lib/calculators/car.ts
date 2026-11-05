import { monthlyPrincipalAndInterest } from './mortgage';

// Auto loan math. Like the mortgage calculator, any input may be 0.

export type CarInputs = {
  vehiclePrice: number;
  downPayment: number;
  tradeInValue: number;
  tradeInOwed: number;        // still owed on the trade-in; anything above its value is rolled into the new loan
  salesTaxRate: number;       // %
  fees: number;               // title, registration, dealer doc fees
  interestRate: number;       // APR %
  termMonths: number;
  rollCostsIntoLoan: boolean; // finance the tax and fees instead of paying them at signing
};

export type CarResult = {
  salesTax: number;
  tradeEquity: number;        // negative = negative equity carried into the loan
  loanAmount: number;
  cashAtSigning: number;
  months: number;
  monthlyPayment: number;
  totalInterest: number;
  totalCost: number;          // price + tax + fees + interest
};

const clean = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

export function calculateCarPayment(input: CarInputs): CarResult {
  const price = clean(input.vehiclePrice);
  const tradeIn = clean(input.tradeInValue);
  const tradeEquity = tradeIn - clean(input.tradeInOwed);
  // Most states tax the price after the trade-in credit.
  const salesTax = (Math.max(0, price - tradeIn) * clean(input.salesTaxRate)) / 100;
  const fees = clean(input.fees);
  const financedCosts = input.rollCostsIntoLoan ? salesTax + fees : 0;

  const loanAmount = Math.max(0, price + financedCosts - clean(input.downPayment) - tradeEquity);
  const cashAtSigning = clean(input.downPayment) + (input.rollCostsIntoLoan ? 0 : salesTax + fees);
  const months = Math.round(clean(input.termMonths));
  const monthlyPayment = monthlyPrincipalAndInterest(loanAmount, clean(input.interestRate), months);
  const totalInterest = months > 0 ? Math.max(0, monthlyPayment * months - loanAmount) : 0;
  const totalCost = price + salesTax + fees + totalInterest;

  return { salesTax, tradeEquity, loanAmount, cashAtSigning, months, monthlyPayment, totalInterest, totalCost };
}

import { FEDERAL, STATES, type Bracket, type FilingStatus, type StateCode, type StateTax } from './tax-data';

// Salary → take-home pay. Every input may be 0. Traditional 401(k) deferrals lower
// income tax but not Social Security or Medicare; Section 125 benefits (health, dental,
// HSA/FSA through payroll) lower both.

export type PayFrequency = 'monthly' | 'semimonthly' | 'biweekly' | 'weekly';
export const PAY_PERIODS: Record<PayFrequency, number> = { monthly: 12, semimonthly: 24, biweekly: 26, weekly: 52 };

export type TakeHomeInputs = {
  filingStatus: FilingStatus;   // 'married' = married filing jointly
  state: StateCode;
  salary: number;
  spouseSalary: number;         // only counted when married
  frequency: PayFrequency;
  retirementPct: number;        // traditional 401(k)/403(b), % of each salary
  pretaxMonthly: number;        // household pre-tax benefits per month
  children: number;             // under 17, for the child tax credit
  localRate: number;            // city/county income tax, % of wages
};

export type BracketSlice = { rate: number; from: number; to: number; amount: number; tax: number };

export type TakeHomeResult = {
  periods: number;
  gross: number;
  retirement: number;
  pretax: number;
  federalTaxable: number;
  federalSlices: BracketSlice[];
  federalBracket: number;       // marginal federal rate, %
  childCredit: number;
  federal: number;
  stateTaxable: number;
  state: number;
  statePayroll: number;
  local: number;
  socialSecurity: number;
  medicare: number;
  totalTax: number;
  takeHome: number;
  effectiveRate: number;        // total tax ÷ gross, %
  marginalRate: number;         // share of the next $100 of salary that goes to tax, %
};

const clean = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

export function bracketSlices(income: number, brackets: Bracket[]): BracketSlice[] {
  let from = 0;
  return brackets.map(([to, rate]) => {
    const amount = Math.max(0, Math.min(income, to) - from);
    const slice = { rate, from, to, amount, tax: (amount * rate) / 100 };
    from = to;
    return slice;
  });
}

const sumTax = (slices: BracketSlice[]) => slices.reduce((sum, slice) => sum + slice.tax, 0);

function phasedOut(amount: number, income: number, phaseout?: { start: number; ratePerDollar: number }) {
  if (!phaseout) return amount;
  return Math.max(0, amount - Math.max(0, income - phaseout.start) * phaseout.ratePerDollar);
}

function stateIncomeTax(state: StateTax, status: FilingStatus, wages: number, federalTax: number) {
  if (!state.brackets) return { taxable: 0, tax: 0 };
  const deduction = state.deduction === 'federal' ? FEDERAL.standardDeduction[status] : state.deduction?.[status] ?? 0;
  const exemption = state.exemption?.[status] ?? 0;
  let federalDeduction = 0;
  if (state.federalTaxDeduction) {
    const { cap, phaseout } = state.federalTaxDeduction;
    let share = 1;
    if (phaseout) {
      const [from, to] = phaseout[status];
      share = Math.min(1, Math.max(0, (to - wages) / (to - from)));
    }
    federalDeduction = Math.min(cap, federalTax) * share;
  }
  const taxable = Math.max(0, wages
    - phasedOut(deduction, wages, state.deductionPhaseout?.[status])
    - phasedOut(exemption, wages, state.exemptionPhaseout?.[status])
    - federalDeduction);
  const tax = Math.max(0, sumTax(bracketSlices(taxable, state.brackets[status])) - (state.credit?.[status] ?? 0));
  return { taxable, tax };
}

function compute(input: TakeHomeInputs) {
  const status = input.filingStatus;
  const state: StateTax = STATES[input.state] ?? STATES.TX;
  const salaries = status === 'married' ? [clean(input.salary), clean(input.spouseSalary)] : [clean(input.salary)];
  const gross = salaries.reduce((sum, salary) => sum + salary, 0);

  // Benefits come out of the first paycheck that can cover them.
  let pretaxLeft = clean(input.pretaxMonthly) * 12;
  const earners = salaries.map(salary => {
    const pretax = Math.min(salary, pretaxLeft);
    pretaxLeft -= pretax;
    const retirement = Math.min(FEDERAL.retirementLimit, (salary * Math.min(100, clean(input.retirementPct))) / 100, salary - pretax);
    return { salary, pretax, retirement, ficaWages: salary - pretax };
  });
  const pretax = earners.reduce((sum, e) => sum + e.pretax, 0);
  const retirement = earners.reduce((sum, e) => sum + e.retirement, 0);
  const ficaWages = gross - pretax;
  const incomeWages = ficaWages - retirement;

  const federalTaxable = Math.max(0, incomeWages - FEDERAL.standardDeduction[status]);
  const federalSlices = bracketSlices(federalTaxable, FEDERAL.brackets[status]);
  const federalBeforeCredits = sumTax(federalSlices);
  // $50 less credit for each $1,000 (or part of it) of income over the threshold.
  const creditReduction = Math.ceil(Math.max(0, incomeWages - FEDERAL.childCreditPhaseout[status]) / 1000) * 50;
  const childCredit = Math.min(federalBeforeCredits, Math.max(0, Math.round(clean(input.children)) * FEDERAL.childCredit - creditReduction));
  const federal = federalBeforeCredits - childCredit;

  const socialSecurity = earners.reduce((sum, e) => sum + (Math.min(e.ficaWages, FEDERAL.socialSecurityWageBase) * FEDERAL.socialSecurityRate) / 100, 0);
  const medicare = (ficaWages * FEDERAL.medicareRate) / 100
    + (Math.max(0, ficaWages - FEDERAL.additionalMedicareThreshold[status]) * FEDERAL.additionalMedicareRate) / 100;

  const stateWages = state.taxesRetirement ? ficaWages : incomeWages;
  const { taxable: stateTaxable, tax: stateTax } = stateIncomeTax(state, status, stateWages, federal);
  const statePayroll = state.payroll ? (ficaWages * state.payroll.ratePct) / 100 : 0;
  const local = (stateWages * clean(input.localRate)) / 100;

  const totalTax = federal + stateTax + statePayroll + local + socialSecurity + medicare;
  const takeHome = gross - pretax - retirement - totalTax;
  const marginal = [...federalSlices].reverse().find(slice => slice.amount > 0) ?? federalSlices[0];

  return {
    gross, retirement, pretax, federalTaxable, federalSlices, federalBracket: marginal.rate, childCredit, federal,
    stateTaxable, state: stateTax, statePayroll, local, socialSecurity, medicare, totalTax, takeHome,
  };
}

export function calculateTakeHome(input: TakeHomeInputs): TakeHomeResult {
  const result = compute(input);
  const next = compute({ ...input, salary: clean(input.salary) + 100 });
  return {
    ...result,
    periods: PAY_PERIODS[input.frequency] ?? 26,
    effectiveRate: result.gross > 0 ? (result.totalTax / result.gross) * 100 : 0,
    marginalRate: Math.max(0, next.totalTax - result.totalTax),
  };
}

import { MARKET_HISTORY } from './market-history';

// Retirement projection, simulated month by month and reported once per year of age.
//
// Saving years: the balance earns that year's return, and each month adds your savings
// plus the employer match. Both grow each year with your salary.
// Retirement years: the withdrawal is entered in today's dollars and grown by inflation
// to every year it's taken, so your spending power stays level.
//
// Three return models share that one simulation:
// - steady: the same return every year (one path).
// - random: Monte Carlo. 1,000 paths of lognormal yearly returns with the given average
//   and standard deviation. A fixed seed keeps the paths stable while you edit inputs.
// - historical: one path per year of US history (1928 on) as the first year of
//   retirement, using that era's actual stock, bond and inflation numbers. Years that
//   would fall before 1928 or after the last year of data wrap around to the other end.
// An optional crash replaces one year's return with a fixed loss in every path.
// Every input may be 0.

export type ReturnModel = 'steady' | 'random' | 'historical';

export type RetirementInputs = {
  currentAge: number;
  retirementAge: number;
  planToAge: number;            // how long the money needs to last
  currentSavings: number;
  annualSalary: number;
  salaryGrowth: number;         // % per year; savings and the match grow with it
  monthlySavings: number;
  employerMatchPct: number;     // % of salary the employer adds each year
  preReturn: number;            // average % per year while saving
  postReturn: number;           // average % per year in retirement
  withdrawalToday: number;      // yearly withdrawal in today's dollars
  inflation: number;            // % per year (steady and random models)
  otherIncomeMonthly: number;   // Social Security, pension (today's dollars)
  returnModel: ReturnModel;
  preVolatility: number;        // random: standard deviation of yearly returns while saving, %
  postVolatility: number;       // random: the same in retirement
  preStockPct: number;          // historical: % in stocks while saving (rest in 10-year Treasuries)
  postStockPct: number;         // historical: the same in retirement
  replayYear: number;           // historical: retirement year to draw as its own line, 0 = none
  crashEnabled: boolean;
  crashAge: number;             // the crash hits the year you turn this age
  crashPct: number;             // loss that year, e.g. 35 = −35%
};

export type RetirementYear = {
  age: number;
  year: number;
  balance: number;              // end of the year, future dollars
  realBalance: number;          // the same in today's dollars
  contributions: number;        // added this year (yours + match)
  withdrawals: number;          // taken out this year
  retired: boolean;
  marketYear?: number;          // historical paths: the year of market data used
};

type Path = { years: RetirementYear[]; depletedAge: number | null };

export type RetirementResult = {
  years: RetirementYear[];
  balanceAtRetirement: number;
  realBalanceAtRetirement: number;
  startingBalance: number;
  yourContributions: number;
  matchContributions: number;
  growthAtRetirement: number;   // investment gains up to retirement
  firstWithdrawal: number;      // year-one withdrawal, future dollars
  realFirstWithdrawal: number;  // the same in today's dollars (constant spending power)
  initialWithdrawalRate: number; // year-one withdrawal ÷ balance at retirement, %
  replacementRatio: number;     // (withdrawal + other income) ÷ today's salary, %
  depletedAge: number | null;   // age the money runs out, or null if it lasts to planToAge
  endingBalance: number;
  realEndingBalance: number;
  yearsSaving: number;
};

const clean = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);
const monthlyRate = (annualPct: number) => Math.pow(1 + Math.max(-99, annualPct) / 100, 1 / 12) - 1;

type Plan = { input: RetirementInputs; currentAge: number; retirementAge: number; planToAge: number; thisYear: number };

function plan(input: RetirementInputs): Plan {
  const currentAge = Math.round(clean(input.currentAge));
  const retirementAge = Math.max(currentAge, Math.round(clean(input.retirementAge)));
  const planToAge = Math.min(120, Math.max(retirementAge, Math.round(clean(input.planToAge))));
  return { input, currentAge, retirementAge, planToAge, thisYear: new Date().getFullYear() };
}

// One run of the plan. `market(i, retired)` gives year i's return and inflation in %.
function simulatePath(p: Plan, market: (i: number, retired: boolean) => { ret: number; inflation: number; marketYear?: number }): Path {
  const { input, currentAge, retirementAge, planToAge, thisYear } = p;
  const salaryGrowth = clean(input.salaryGrowth) / 100;
  const crash = input.crashEnabled ? Math.round(clean(input.crashAge)) : -1;
  let balance = clean(input.currentSavings);
  let priceIndex = 1;           // today's prices = 1
  let depletedAge: number | null = null;
  const years: RetirementYear[] = [{ age: currentAge, year: thisYear, balance, realBalance: balance, contributions: 0, withdrawals: 0, retired: currentAge >= retirementAge }];

  for (let age = currentAge; age < planToAge; age += 1) {
    const i = age - currentAge;
    const retired = age >= retirementAge;
    const m = market(i, retired);
    const rate = monthlyRate(age === crash ? -Math.min(99, clean(input.crashPct)) : m.ret);
    let added = 0;
    let taken = 0;

    if (!retired) {
      const growth = Math.pow(1 + salaryGrowth, i);
      const perMonth = clean(input.monthlySavings) * growth + (clean(input.annualSalary) * growth * clean(input.employerMatchPct)) / 100 / 12;
      for (let month = 0; month < 12; month += 1) balance = balance * (1 + rate) + perMonth;
      added = perMonth * 12;
    } else {
      const perMonth = (clean(input.withdrawalToday) * priceIndex) / 12;
      for (let month = 0; month < 12; month += 1) {
        const out = Math.min(balance, perMonth);
        balance = (balance - out) * (1 + rate);
        taken += out;
      }
      if (balance < 1 && perMonth > 0 && depletedAge === null) { balance = 0; depletedAge = age + 1; }
    }

    priceIndex *= 1 + m.inflation / 100;
    years.push({ age: age + 1, year: thisYear + i + 1, balance, realBalance: balance / priceIndex, contributions: added, withdrawals: taken, retired: age + 1 > retirementAge, marketYear: m.marketYear });
  }
  return { years, depletedAge };
}

const steadyMarket = (input: RetirementInputs) => (_: number, retired: boolean) => ({ ret: clean(retired ? input.postReturn : input.preReturn), inflation: clean(input.inflation) });

export function calculateRetirement(input: RetirementInputs): RetirementResult {
  const p = plan(input);
  const { years, depletedAge } = simulatePath(p, steadyMarket(input));
  const yearsSaving = p.retirementAge - p.currentAge;
  const atRetirement = years[yearsSaving];
  const startingBalance = clean(input.currentSavings);
  const yourContributions = years.slice(1, yearsSaving + 1).reduce((sum, y) => sum + y.contributions, 0);
  // Contributions split between you and the match in proportion to their monthly amounts.
  const yoursMonthly = clean(input.monthlySavings);
  const matchMonthly = (clean(input.annualSalary) * clean(input.employerMatchPct)) / 100 / 12;
  const yourShare = yoursMonthly + matchMonthly > 0 ? yoursMonthly / (yoursMonthly + matchMonthly) : 1;
  const realFirstWithdrawal = clean(input.withdrawalToday);
  const firstWithdrawal = realFirstWithdrawal * Math.pow(1 + clean(input.inflation) / 100, yearsSaving);
  const salary = clean(input.annualSalary);
  const last = years[years.length - 1];

  return {
    years,
    balanceAtRetirement: atRetirement.balance,
    realBalanceAtRetirement: atRetirement.realBalance,
    startingBalance,
    yourContributions: yourContributions * yourShare,
    matchContributions: yourContributions * (1 - yourShare),
    growthAtRetirement: Math.max(0, atRetirement.balance - startingBalance - yourContributions),
    firstWithdrawal,
    realFirstWithdrawal,
    initialWithdrawalRate: atRetirement.balance > 0 ? (firstWithdrawal / atRetirement.balance) * 100 : 0,
    replacementRatio: salary > 0 ? ((realFirstWithdrawal + clean(input.otherIncomeMonthly) * 12) / salary) * 100 : 0,
    depletedAge,
    endingBalance: last.balance,
    realEndingBalance: last.realBalance,
    yearsSaving,
  };
}

// ---------- Random and historical: many paths summarized as percentile bands ----------

export const SIMULATION_RUNS = 1000;
export type Percentiles = [p10: number, p25: number, p50: number, p75: number, p90: number];
export type BandPoint = { age: number; year: number; nominal: Percentiles; real: Percentiles };
export type Outcome = { balance: number; realBalance: number; depletedAge: number | null; retirementYear?: number };

export type VariabilityResult = {
  runs: number;
  bands: BandPoint[];
  successRate: number;          // % of paths that never run out before planToAge
  atRetirement: { nominal: Percentiles; real: Percentiles };
  atEnd: { nominal: Percentiles; real: Percentiles };
  badCase: Outcome;             // the 10th-percentile path (by when it runs out, then by what's left)
  worst?: Outcome;              // historical: the worst starting year
  replay?: RetirementYear[];    // historical: the chosen retirement year as its own line
};

// Small, fast, seedable PRNG (mulberry32) and a standard normal from it.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normals(seed: number, count: number) {
  const next = rng(seed);
  return Array.from({ length: count }, () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next()));
}

// A lognormal yearly return with the given arithmetic mean and standard deviation (both %).
function lognormalReturn(meanPct: number, sdPct: number, z: number) {
  const m = 1 + meanPct / 100;
  const s = sdPct / 100;
  if (s === 0) return meanPct;
  const sigma2 = Math.log(1 + (s * s) / (m * m));
  return (Math.exp(Math.log(m) - sigma2 / 2 + Math.sqrt(sigma2) * z) - 1) * 100;
}

function percentiles(values: number[]): Percentiles {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
  return [at(0.1), at(0.25), at(0.5), at(0.75), at(0.9)];
}

// Ranks paths from worst to best: running out earlier is worse, then less money left.
const severity = (path: Path) => [path.depletedAge ?? Infinity, path.years[path.years.length - 1].realBalance] as const;
const compareSeverity = (a: Path, b: Path) => { const [da, ra] = severity(a); const [db, rb] = severity(b); return da - db || ra - rb; };

function outcome(path: Path, retirementYear?: number): Outcome {
  const last = path.years[path.years.length - 1];
  return { balance: last.balance, realBalance: last.realBalance, depletedAge: path.depletedAge, retirementYear };
}

export function calculateVariability(input: RetirementInputs, seed: number): VariabilityResult {
  const p = plan(input);
  const horizon = p.planToAge - p.currentAge;
  const yearsSaving = p.retirementAge - p.currentAge;
  let paths: Path[];
  let retirementYears: number[] = [];

  if (input.returnModel === 'historical') {
    const n = MARKET_HISTORY.length;
    const stocks = (retired: boolean) => Math.min(100, clean(retired ? input.postStockPct : input.preStockPct)) / 100;
    retirementYears = MARKET_HISTORY.map(([year]) => year);
    paths = MARKET_HISTORY.map((_, k) => simulatePath(p, (i, retired) => {
      const [marketYear, stockReturn, bondReturn, inflation] = MARKET_HISTORY[(((k - yearsSaving + i) % n) + n) % n];
      const s = stocks(retired);
      return { ret: s * stockReturn + (1 - s) * bondReturn, inflation, marketYear };
    }));
  } else {
    paths = Array.from({ length: SIMULATION_RUNS }, (_, k) => {
      const z = normals(seed * 100_003 + k * 7_919, horizon);
      return simulatePath(p, (i, retired) => ({
        ret: retired ? lognormalReturn(clean(input.postReturn), clean(input.postVolatility), z[i]) : lognormalReturn(clean(input.preReturn), clean(input.preVolatility), z[i]),
        inflation: clean(input.inflation),
      }));
    });
  }

  const bands: BandPoint[] = paths[0].years.map((year, index) => ({
    age: year.age,
    year: year.year,
    nominal: percentiles(paths.map(path => path.years[index].balance)),
    real: percentiles(paths.map(path => path.years[index].realBalance)),
  }));
  const ranked = paths.map((path, index) => ({ path, index })).sort((a, b) => compareSeverity(a.path, b.path));
  const bad = ranked[Math.round(0.1 * (ranked.length - 1))];
  const worst = ranked[0];
  const replayIndex = retirementYears.indexOf(input.replayYear);

  return {
    runs: paths.length,
    bands,
    successRate: (paths.filter(path => path.depletedAge === null).length / paths.length) * 100,
    atRetirement: { nominal: bands[yearsSaving].nominal, real: bands[yearsSaving].real },
    atEnd: { nominal: bands[bands.length - 1].nominal, real: bands[bands.length - 1].real },
    badCase: outcome(bad.path, retirementYears[bad.index]),
    worst: input.returnModel === 'historical' ? outcome(worst.path, retirementYears[worst.index]) : undefined,
    replay: replayIndex >= 0 ? paths[replayIndex].years : undefined,
  };
}

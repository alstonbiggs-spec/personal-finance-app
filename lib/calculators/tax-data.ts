// Tax tables for the Take-Home Pay calculator.
//
// Federal figures are for the 2026 tax year (IRS Rev. Proc. 2025-32, SSA 2026 wage base).
// State figures are the latest published rates, simplified: each state is reduced to
// brackets plus a standard deduction, personal exemption and/or credit. Phase-outs,
// recapture rules and local (city/county) taxes are mostly left out, so state results are
// estimates. Update this file once a year.

export type FilingStatus = 'single' | 'married';
export type Bracket = [upTo: number, ratePct: number]; // the last bracket's upTo is Infinity
export type ByStatus<T> = Record<FilingStatus, T>;

const INF = Infinity;

export const FEDERAL = {
  year: 2026,
  brackets: {
    single: [[12_400, 10], [50_400, 12], [105_700, 22], [201_775, 24], [256_225, 32], [640_600, 35], [INF, 37]],
    married: [[24_800, 10], [100_800, 12], [211_400, 22], [403_550, 24], [512_450, 32], [768_700, 35], [INF, 37]],
  } as ByStatus<Bracket[]>,
  standardDeduction: { single: 16_100, married: 32_200 } as ByStatus<number>,
  childCredit: 2_200,                                                // per child under 17
  childCreditPhaseout: { single: 200_000, married: 400_000 } as ByStatus<number>, // $50 off per $1,000 over
  socialSecurityRate: 6.2,
  socialSecurityWageBase: 184_500,                                   // per earner
  medicareRate: 1.45,
  additionalMedicareRate: 0.9,
  additionalMedicareThreshold: { single: 200_000, married: 250_000 } as ByStatus<number>,
  retirementLimit: 24_500,                                           // 401(k)/403(b) employee deferral, per earner
};

type Phaseout = ByStatus<{ start: number; ratePerDollar: number }>;

export type StateTax = {
  name: string;
  brackets: ByStatus<Bracket[]> | null;          // null = no tax on wages
  deduction?: ByStatus<number> | 'federal';      // 'federal' = uses the federal standard deduction
  deductionPhaseout?: Phaseout;
  exemption?: ByStatus<number>;                  // personal exemptions (married = both spouses)
  exemptionPhaseout?: Phaseout;
  credit?: ByStatus<number>;                     // personal credit subtracted from the tax
  taxesRetirement?: boolean;                     // 401(k) deferrals aren't deductible for state tax
  federalTaxDeduction?: { cap: number; phaseout?: ByStatus<[from: number, to: number]> }; // federal income tax is deductible
  payroll?: { label: string; ratePct: number };  // employee payroll tax such as CA SDI, uncapped
  note?: string;
};

const same = (brackets: Bracket[]): ByStatus<Bracket[]> => ({ single: brackets, married: brackets });
const doubled = (brackets: Bracket[]): ByStatus<Bracket[]> => ({ single: brackets, married: brackets.map(([upTo, rate]) => [upTo * 2, rate] as Bracket) });
const flat = (rate: number) => same([[INF, rate]]);
const pair = (single: number, married: number): ByStatus<number> => ({ single, married });
const none = (name: string, note?: string): StateTax => ({ name, brackets: null, note });

export const STATES = {
  AL: { name: 'Alabama', brackets: { single: [[500, 2], [3_000, 4], [INF, 5]], married: [[1_000, 2], [6_000, 4], [INF, 5]] }, deduction: pair(2_500, 5_000), exemption: pair(1_500, 3_000), federalTaxDeduction: { cap: INF }, note: 'Some cities add an occupational tax.' },
  AK: none('Alaska'),
  AZ: { name: 'Arizona', brackets: flat(2.5), deduction: 'federal' },
  AR: { name: 'Arkansas', brackets: same([[5_499, 0], [10_899, 2], [15_599, 3], [25_699, 3.4], [INF, 3.9]]), deduction: pair(2_410, 4_820), credit: pair(29, 58) },
  CA: {
    name: 'California',
    brackets: {
      single: [[11_079, 1], [26_264, 2], [41_452, 4], [57_542, 6], [72_724, 8], [371_479, 9.3], [445_771, 10.3], [742_953, 11.3], [1_000_000, 12.3], [INF, 13.3]],
      // Doubled, except the 1% mental health surcharge starts at $1M for every filer.
      married: [[22_158, 1], [52_528, 2], [82_904, 4], [115_084, 6], [145_448, 8], [742_958, 9.3], [891_542, 10.3], [1_000_000, 11.3], [1_485_906, 12.3], [INF, 13.3]],
    },
    deduction: pair(5_706, 11_412),
    credit: pair(153, 306),
    payroll: { label: 'CA SDI', ratePct: 1.3 },
  },
  CO: { name: 'Colorado', brackets: flat(4.4), deduction: 'federal' },
  CT: {
    name: 'Connecticut',
    brackets: doubled([[10_000, 2], [50_000, 4.5], [100_000, 5.5], [200_000, 6], [250_000, 6.5], [500_000, 6.9], [INF, 6.99]]),
    exemption: pair(15_000, 24_000),
    exemptionPhaseout: { single: { start: 30_000, ratePerDollar: 1 }, married: { start: 48_000, ratePerDollar: 1 } },
  },
  DE: { name: 'Delaware', brackets: same([[2_000, 0], [5_000, 2.2], [10_000, 3.9], [20_000, 4.8], [25_000, 5.2], [60_000, 5.55], [INF, 6.6]]), deduction: pair(3_250, 6_500), credit: pair(110, 220), note: 'Wilmington adds a 1.25% city wage tax.' },
  DC: { name: 'District of Columbia', brackets: same([[10_000, 4], [40_000, 6], [60_000, 6.5], [250_000, 8.5], [500_000, 9.25], [1_000_000, 9.75], [INF, 10.75]]), deduction: 'federal' },
  FL: none('Florida'),
  GA: { name: 'Georgia', brackets: flat(5.09), deduction: pair(12_000, 24_000) },
  HI: { name: 'Hawaii', brackets: doubled([[9_600, 1.4], [14_400, 3.2], [19_200, 5.5], [24_000, 6.4], [36_000, 6.8], [48_000, 7.2], [125_000, 7.6], [175_000, 7.9], [225_000, 8.25], [275_000, 9], [325_000, 10], [INF, 11]]), deduction: pair(4_400, 8_800), exemption: pair(1_144, 2_288) },
  ID: { name: 'Idaho', brackets: doubled([[4_811, 0], [INF, 5.3]]), deduction: 'federal' },
  IL: { name: 'Illinois', brackets: flat(4.95), exemption: pair(2_850, 5_700) },
  IN: { name: 'Indiana', brackets: flat(2.95), exemption: pair(1_000, 2_000), note: 'Every county adds its own income tax, roughly 1–3%.' },
  IA: { name: 'Iowa', brackets: flat(3.8), deduction: 'federal' },
  KS: { name: 'Kansas', brackets: doubled([[23_000, 5.2], [INF, 5.58]]), deduction: pair(3_605, 8_240), exemption: pair(9_160, 18_320) },
  KY: { name: 'Kentucky', brackets: flat(3.5), deduction: pair(3_360, 6_720), note: 'Many cities and counties add an occupational tax.' },
  LA: { name: 'Louisiana', brackets: flat(3), deduction: pair(12_500, 25_000) },
  ME: { name: 'Maine', brackets: { single: [[26_800, 5.8], [63_450, 6.75], [INF, 7.15]], married: [[53_600, 5.8], [126_900, 6.75], [INF, 7.15]] }, deduction: 'federal', exemption: pair(5_150, 10_300) },
  MD: {
    name: 'Maryland',
    brackets: {
      single: [[1_000, 2], [2_000, 3], [3_000, 4], [100_000, 4.75], [125_000, 5], [150_000, 5.25], [250_000, 5.5], [500_000, 5.75], [1_000_000, 6.25], [INF, 6.5]],
      married: [[1_000, 2], [2_000, 3], [3_000, 4], [150_000, 4.75], [175_000, 5], [225_000, 5.25], [300_000, 5.5], [600_000, 5.75], [1_200_000, 6.25], [INF, 6.5]],
    },
    deduction: pair(3_350, 6_700),
    exemption: pair(3_200, 6_400),
    note: 'Every county adds 2.25–3.3%. Enter yours as local income tax.',
  },
  MA: { name: 'Massachusetts', brackets: same([[1_083_150, 5], [INF, 9]]), exemption: pair(4_400, 8_800) },
  MI: { name: 'Michigan', brackets: flat(4.25), exemption: pair(5_800, 11_600), note: 'Detroit and some other cities add a city income tax.' },
  MN: { name: 'Minnesota', brackets: { single: [[32_570, 5.35], [106_990, 6.8], [198_630, 7.85], [INF, 9.85]], married: [[47_620, 5.35], [189_180, 6.8], [330_410, 7.85], [INF, 9.85]] }, deduction: pair(14_950, 29_900) },
  MS: { name: 'Mississippi', brackets: same([[10_000, 0], [INF, 4]]), deduction: pair(2_300, 4_600), exemption: pair(6_000, 12_000) },
  MO: { name: 'Missouri', brackets: same([[1_313, 0], [2_626, 2], [3_939, 2.5], [5_252, 3], [6_565, 3.5], [7_878, 4], [9_191, 4.5], [INF, 4.7]]), deduction: 'federal', note: 'Kansas City and St. Louis add a 1% earnings tax.' },
  MT: { name: 'Montana', brackets: doubled([[47_500, 4.7], [INF, 5.65]]), deduction: 'federal' },
  NE: { name: 'Nebraska', brackets: doubled([[4_130, 2.46], [24_760, 3.51], [INF, 4.55]]), deduction: pair(8_600, 17_200), credit: pair(171, 342) },
  NV: none('Nevada'),
  NH: none('New Hampshire'),
  NJ: {
    name: 'New Jersey',
    brackets: {
      single: [[20_000, 1.4], [35_000, 1.75], [40_000, 3.5], [75_000, 5.525], [500_000, 6.37], [1_000_000, 8.97], [INF, 10.75]],
      married: [[20_000, 1.4], [50_000, 1.75], [70_000, 2.45], [80_000, 3.5], [150_000, 5.525], [500_000, 6.37], [1_000_000, 8.97], [INF, 10.75]],
    },
    exemption: pair(1_000, 2_000),
  },
  NM: { name: 'New Mexico', brackets: { single: [[5_500, 1.5], [16_500, 3.2], [33_500, 4.3], [66_500, 4.7], [210_000, 4.9], [INF, 5.9]], married: [[8_000, 1.5], [25_000, 3.2], [50_000, 4.3], [100_000, 4.7], [315_000, 4.9], [INF, 5.9]] }, deduction: 'federal' },
  NY: {
    name: 'New York',
    brackets: {
      single: [[8_500, 3.9], [11_700, 4.4], [13_900, 5.15], [80_650, 5.4], [215_400, 5.9], [1_077_550, 6.85], [5_000_000, 9.65], [25_000_000, 10.3], [INF, 10.9]],
      married: [[17_150, 3.9], [23_600, 4.4], [27_900, 5.15], [161_550, 5.4], [323_200, 5.9], [2_155_350, 6.85], [5_000_000, 9.65], [25_000_000, 10.3], [INF, 10.9]],
    },
    deduction: pair(8_000, 16_050),
    note: 'New York City adds about 3.1–3.9% and Yonkers adds a surcharge. Enter it as local income tax.',
  },
  NC: { name: 'North Carolina', brackets: flat(3.99), deduction: pair(12_750, 25_500) },
  ND: { name: 'North Dakota', brackets: { single: [[48_475, 0], [244_825, 1.95], [INF, 2.5]], married: [[80_975, 0], [298_075, 1.95], [INF, 2.5]] }, deduction: 'federal' },
  OH: { name: 'Ohio', brackets: same([[26_050, 0], [INF, 2.75]]), note: 'Most Ohio cities add a 1–2.5% income tax.' },
  OK: { name: 'Oklahoma', brackets: doubled([[3_750, 0], [4_900, 2.5], [7_200, 3.5], [INF, 4.5]]), deduction: pair(6_350, 12_700), exemption: pair(1_000, 2_000) },
  OR: {
    name: 'Oregon',
    brackets: doubled([[4_400, 4.75], [11_050, 6.75], [125_000, 8.75], [INF, 9.9]]),
    deduction: pair(2_835, 5_670),
    credit: pair(256, 512),
    federalTaxDeduction: { cap: 8_500, phaseout: { single: [125_000, 145_000], married: [250_000, 290_000] } },
    note: 'Portland-area taxes (Metro, Multnomah County) aren’t included.',
  },
  PA: { name: 'Pennsylvania', brackets: flat(3.07), taxesRetirement: true, note: 'Most towns add a local earned income tax, often 1% (Philadelphia about 3.7%).' },
  RI: { name: 'Rhode Island', brackets: same([[79_900, 3.75], [181_650, 4.75], [INF, 5.99]]), deduction: pair(10_900, 21_800), exemption: pair(5_100, 10_200) },
  SC: { name: 'South Carolina', brackets: same([[3_560, 0], [17_830, 3], [INF, 6]]), deduction: 'federal' },
  SD: none('South Dakota'),
  TN: none('Tennessee'),
  TX: none('Texas'),
  UT: { name: 'Utah', brackets: flat(4.5), note: 'Utah’s taxpayer credit, which phases out with income, isn’t included.' },
  VT: { name: 'Vermont', brackets: { single: [[47_900, 3.35], [116_000, 6.6], [242_000, 7.6], [INF, 8.75]], married: [[79_950, 3.35], [193_300, 6.6], [294_600, 7.6], [INF, 8.75]] }, deduction: pair(7_400, 14_850), exemption: pair(5_300, 10_600) },
  VA: { name: 'Virginia', brackets: same([[3_000, 2], [5_000, 3], [17_000, 5], [INF, 5.75]]), deduction: pair(8_750, 17_500), exemption: pair(930, 1_860) },
  WA: none('Washington', 'WA Cares and Paid Family Leave payroll deductions aren’t included.'),
  WV: { name: 'West Virginia', brackets: same([[10_000, 2.22], [25_000, 2.96], [40_000, 3.33], [60_000, 4.44], [INF, 4.82]]), exemption: pair(2_000, 4_000) },
  WI: {
    name: 'Wisconsin',
    brackets: { single: [[14_680, 3.5], [29_370, 4.4], [323_290, 5.3], [INF, 7.65]], married: [[19_580, 3.5], [39_150, 4.4], [431_060, 5.3], [INF, 7.65]] },
    deduction: pair(13_560, 25_110),
    deductionPhaseout: { single: { start: 19_070, ratePerDollar: 0.12 }, married: { start: 26_800, ratePerDollar: 0.19778 } },
    exemption: pair(700, 1_400),
  },
  WY: none('Wyoming'),
} satisfies Record<string, StateTax>;

export type StateCode = keyof typeof STATES;
export const STATE_CODES = (Object.keys(STATES) as StateCode[]).sort((a, b) => STATES[a].name.localeCompare(STATES[b].name));

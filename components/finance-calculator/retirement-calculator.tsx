'use client';
import { useDeferredValue, useMemo, useState } from 'react';
import { Area, ComposedChart, CartesianGrid, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FIRST_MARKET_YEAR, LAST_MARKET_YEAR, MARKET_HISTORY } from '@/lib/calculators/market-history';
import { calculateRetirement, calculateVariability, type Percentiles, type RetirementInputs, type ReturnModel } from '@/lib/calculators/retirement';
import { NumberField } from './number-field';
import { Chips, InputGroup, ResultHero, Stats, Toggle, money, palette } from './shared';

export const retirementDefaults: RetirementInputs = {
  currentAge: 35,
  retirementAge: 65,
  planToAge: 95,
  currentSavings: 100000,
  annualSalary: 100000,
  salaryGrowth: 3,
  monthlySavings: 1000,
  employerMatchPct: 4,
  preReturn: 7,
  postReturn: 5,
  withdrawalToday: 50000,
  inflation: 3,
  otherIncomeMonthly: 2000,
  returnModel: 'steady',
  preVolatility: 15,
  postVolatility: 10,
  preStockPct: 80,
  postStockPct: 50,
  replayYear: 0,
  crashEnabled: false,
  crashAge: 65,
  crashPct: 35,
};

const ink = '#18231f';
type Dollars = 'today' | 'future';

const models: { value: ReturnModel; label: string; hint: string }[] = [
  { value: 'steady', label: 'Steady', hint: 'The same return every year' },
  { value: 'random', label: 'Random', hint: '1,000 simulated markets' },
  { value: 'historical', label: 'Historical', hint: `Every start year since ${FIRST_MARKET_YEAR}` },
];

// Notable years to retire into, listed first in the replay picker.
const famousYears = [1929, 1937, 1966, 1973, 2000, 2008];

function compact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `$${Math.round(value / 1e3)}k`;
  return `$${Math.round(value)}`;
}

type Row = {
  age: number; year: number; steady: number; contributions: number; withdrawals: number; deflate: number;
  band80?: [number, number]; band50?: [number, number]; median?: number; replay?: number; marketYear?: number;
};

function LegendKey({ kind, color, label }: { kind: 'line' | 'dash' | 'band'; color: string; label: string }) {
  return <span className="flex items-center gap-2 text-xs text-ink/60">
    {kind === 'band'
      ? <span className="h-2.5 w-4 rounded-sm" style={{ background: color }} />
      : <span className="w-4 border-t-2" style={{ borderColor: color, borderStyle: kind === 'dash' ? 'dashed' : 'solid' }} />}
    {label}
  </span>;
}

export function RetirementCalculator({ inputs, onChange }: { inputs: RetirementInputs; onChange: (inputs: RetirementInputs) => void }) {
  const set = <K extends keyof RetirementInputs>(key: K) => (value: RetirementInputs[K]) => onChange({ ...inputs, [key]: value });
  const [dollars, setDollars] = useState<Dollars>('today');
  const [seed, setSeed] = useState(1);
  const today = dollars === 'today';
  const model = inputs.returnModel ?? 'steady';
  const variable = model !== 'steady';
  const historical = model === 'historical';

  const result = useMemo(() => calculateRetirement(inputs), [inputs]);
  // The simulation runs 1,000 paths; deferring it keeps sliders smooth while it catches up.
  const deferred = useDeferredValue(inputs);
  const sim = useMemo(() => (deferred.returnModel && deferred.returnModel !== 'steady' ? calculateVariability(deferred, seed) : null), [deferred, seed]);
  const stale = deferred !== inputs;

  const retireAge = Math.max(inputs.currentAge, inputs.retirementAge);
  const lastAge = result.years[result.years.length - 1].age;
  const pick = (p: { nominal: Percentiles; real: Percentiles }) => (today ? p.real : p.nominal);

  const rows: Row[] = result.years.map((year, i) => {
    const band = sim?.bands[i];
    const pc = band ? pick(band) : undefined;
    const replay = sim?.replay?.[i];
    return {
      age: year.age, year: year.year, steady: today ? year.realBalance : year.balance,
      contributions: year.contributions, withdrawals: year.withdrawals, deflate: year.balance > 0 ? year.realBalance / year.balance : 1 / Math.pow(1 + inputs.inflation / 100, i),
      band80: pc ? [pc[0], pc[4]] : undefined, band50: pc ? [pc[1], pc[3]] : undefined, median: pc?.[2],
      replay: replay ? (today ? replay.realBalance : replay.balance) : undefined, marketYear: replay?.marketYear,
    };
  });

  // ---- Headline ----
  const headline = today ? result.realBalanceAtRetirement : result.balanceAtRetirement;
  const scale = result.balanceAtRetirement > 0 ? headline / result.balanceAtRetirement : 0;
  const parts = [
    { label: 'Saved today', value: result.startingBalance * scale, color: palette.stone },
    { label: 'Your savings', value: result.yourContributions * scale, color: palette.sage },
    { label: 'Employer match', value: result.matchContributions * scale, color: palette.sand },
    { label: 'Investment growth', value: result.growthAtRetirement * scale, color: palette.forest },
  ].filter(part => part.value > 0);

  const otherIncome = inputs.otherIncomeMonthly * 12;
  const yearlyIncome = result.realFirstWithdrawal + otherIncome;
  const dollarWord = today ? 'today’s dollars' : 'future dollars';
  const crashNote = inputs.crashEnabled ? ` Includes a −${inputs.crashPct}% crash at age ${inputs.crashAge}.` : '';
  const endValue = (o: { balance: number; realBalance: number }) => money(today ? o.realBalance : o.balance);

  const steadyHero = <ResultHero label={`Savings at retirement · age ${retireAge}`} display={money(headline)} parts={parts} partsCaption={today ? 'What it’s made of (today’s dollars)' : 'What it’s made of'}>
    <p className="mx-auto mt-3 text-xs uppercase tracking-[.16em] text-ink/40">{today ? `In today’s dollars · ${money(result.balanceAtRetirement)} in ${result.years[result.yearsSaving]?.year ?? ''} dollars` : `Future dollars · ${money(result.realBalanceAtRetirement)} in today’s dollars`}</p>
    <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-ink/55">
      Withdrawing {money(result.realFirstWithdrawal)} a year in today’s dollars ({money(result.realFirstWithdrawal / 12)}/mo) means {money(result.firstWithdrawal)} in your first year of retirement
      {result.balanceAtRetirement > 0 && <>, {result.initialWithdrawalRate.toFixed(1)}% of your savings</>}
      {otherIncome > 0 && <>. With other income that’s {money(yearlyIncome / 12)}/mo in today’s dollars</>}
      {inputs.annualSalary > 0 && <>, about {Math.round(result.replacementRatio)}% of your salary today</>}.{' '}
      {result.depletedAge === null
        ? <>It lasts past age {inputs.planToAge}, with {money(result.realEndingBalance)} left in today’s dollars.</>
        : <>At this withdrawal the money runs out at age <span className="text-ink">{result.depletedAge}</span>.</>}
      {crashNote}
    </p>
  </ResultHero>;

  const variableHero = sim && <ResultHero label={`Chance your money lasts to age ${inputs.planToAge}`} display={`${Math.round(sim.successRate)}%`} parts={[]}>
    <p className={`mx-auto mt-4 max-w-xl text-sm leading-6 text-ink/55 transition-opacity ${stale ? 'opacity-50' : ''}`}>
      {historical
        ? <>Across all {sim.runs} starting years from {FIRST_MARKET_YEAR} to {LAST_MARKET_YEAR}, withdrawing {money(inputs.withdrawalToday)} a year in today’s dollars lasted in {Math.round((sim.successRate / 100) * sim.runs)} of them. </>
        : <>Across {sim.runs.toLocaleString()} simulated markets, withdrawing {money(inputs.withdrawalToday)} a year in today’s dollars lasted in {Math.round(sim.successRate)}% of them. </>}
      Median savings at retirement: {money(pick(sim.atRetirement)[2])} in {dollarWord}, with 8 in 10 outcomes between {compact(pick(sim.atRetirement)[0])} and {compact(pick(sim.atRetirement)[4])}.{' '}
      {historical && sim.worst
        ? <>Worst start: retiring in {sim.worst.retirementYear} {sim.worst.depletedAge !== null ? <>runs out at age <span className="text-ink">{sim.worst.depletedAge}</span></> : <>still leaves {endValue(sim.worst)}</>}.</>
        : <>In the worst 10% of markets {sim.badCase.depletedAge !== null ? <>the money runs out by age <span className="text-ink">{sim.badCase.depletedAge}</span></> : <>you still have {endValue(sim.badCase)} at {inputs.planToAge}</>}.</>}
      {crashNote}
    </p>
  </ResultHero>;

  const replayLabel = inputs.replayYear ? `Retiring in ${inputs.replayYear}` : '';

  return <>
    {variable && variableHero ? variableHero : steadyHero}

    <section className="border-b hairline py-8 sm:py-10">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="serif text-xl sm:text-2xl">Your savings over time</p>
          <p className="mt-1 text-xs text-ink/45">
            {variable
              ? `The band shows the range of outcomes across ${historical ? 'historical starting years' : 'simulated markets'}; the line is the median.`
              : `Grows while you save, then funds your withdrawals from age ${retireAge}${result.depletedAge !== null ? ` until it runs out at ${result.depletedAge}` : ''}.`}
          </p>
        </div>
        <div className="sm:w-72"><Toggle label="Show in" value={dollars} onChange={setDollars} options={[{ value: 'today', label: 'Today’s $' }, { value: 'future', label: 'Future $' }]} /></div>
      </div>

      {variable && <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2">
        <LegendKey kind="line" color={palette.forest} label="Median" />
        <LegendKey kind="band" color="rgba(23,61,53,.28)" label="Middle 50%" />
        <LegendKey kind="band" color="rgba(23,61,53,.12)" label="80% of outcomes" />
        {!historical && <LegendKey kind="dash" color={palette.gold} label={`Steady ${inputs.preReturn}% / ${inputs.postReturn}%`} />}
        {historical && inputs.replayYear > 0 && <LegendKey kind="line" color={palette.gold} label={replayLabel} />}
      </div>}

      <div className={`-mx-2 h-72 transition-opacity sm:mx-0 sm:h-96 ${variable && stale ? 'opacity-60' : ''}`}>
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 24, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="retirement-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.forest} stopOpacity={0.22} />
                <stop offset="100%" stopColor={palette.forest} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={ink} strokeOpacity={0.08} vertical={false} />
            {retireAge < lastAge && <ReferenceArea x1={retireAge} x2={lastAge} fill={palette.gold} fillOpacity={0.06} strokeOpacity={0} />}
            <XAxis dataKey="age" type="number" domain={['dataMin', 'dataMax']} tickCount={8} allowDecimals={false} tick={{ fontSize: 12, fill: ink, fillOpacity: 0.55 }} axisLine={false} tickLine={false} tickMargin={8} />
            <YAxis tickFormatter={compact} tickCount={5} width={52} tick={{ fontSize: 12, fill: ink, fillOpacity: 0.55 }} axisLine={false} tickLine={false} />
            {retireAge > inputs.currentAge && retireAge < lastAge && <ReferenceLine x={retireAge} stroke={palette.gold} strokeDasharray="4 4" label={{ value: `Retire at ${retireAge}`, position: 'top', fontSize: 11, fill: ink, fillOpacity: 0.65 }} />}
            {inputs.crashEnabled && inputs.crashAge >= inputs.currentAge && inputs.crashAge < lastAge && <ReferenceLine x={inputs.crashAge + 0.5} stroke="#9b4a3c" strokeOpacity={0.7} strokeDasharray="2 3" label={{ value: `−${inputs.crashPct}% crash`, position: 'insideTopRight', fontSize: 11, fill: '#9b4a3c' }} />}
            {!variable && result.depletedAge !== null && <ReferenceLine x={result.depletedAge} stroke={ink} strokeOpacity={0.4} strokeDasharray="2 3" label={{ value: `Runs out at ${result.depletedAge}`, position: 'insideTopRight', fontSize: 11, fill: ink, fillOpacity: 0.65 }} />}
            <Tooltip
              cursor={{ stroke: ink, strokeOpacity: 0.25 }}
              content={({ active, payload }) => {
                const row = active ? payload?.[0]?.payload as Row | undefined : undefined;
                if (!row) return null;
                if (variable && row.band80 && row.band50 && row.median !== undefined) {
                  return <div className="border hairline bg-cream px-3 py-2 shadow-sm">
                    <p className="text-[11px] text-ink/50">Age {row.age} · {row.year}</p>
                    <p className="serif text-lg">{money(row.median)} <span className="text-[11px] text-ink/50">median</span></p>
                    <p className="text-[11px] text-ink/60">Middle 50%: {compact(row.band50[0])} – {compact(row.band50[1])}</p>
                    <p className="text-[11px] text-ink/60">80% of outcomes: {compact(row.band80[0])} – {compact(row.band80[1])}</p>
                    {!historical && <p className="text-[11px] text-ink/60">Steady return: {compact(row.steady)}</p>}
                    {row.replay !== undefined && <p className="text-[11px] text-ink/60">{replayLabel}: {compact(row.replay)}{row.marketYear ? ` (${row.marketYear} market)` : ''}</p>}
                  </div>;
                }
                const flow = row.withdrawals > 0 ? { label: 'Withdrawn that year', amount: row.withdrawals } : row.contributions > 0 ? { label: 'Added that year', amount: row.contributions } : null;
                return <div className="border hairline bg-cream px-3 py-2 shadow-sm">
                  <p className="text-[11px] text-ink/50">Age {row.age} · {row.year}</p>
                  <p className="serif text-lg">{money(row.steady)}</p>
                  {flow && <p className="text-[11px] text-ink/50">{flow.label}: {money(today ? flow.amount * row.deflate : flow.amount)}</p>}
                </div>;
              }}
            />
            {variable ? <>
              <Area type="monotone" dataKey="band80" stroke="none" fill={palette.forest} fillOpacity={0.12} isAnimationActive={false} activeDot={false} />
              <Area type="monotone" dataKey="band50" stroke="none" fill={palette.forest} fillOpacity={0.18} isAnimationActive={false} activeDot={false} />
              <Line type="monotone" dataKey="median" stroke={palette.forest} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              {!historical && <Line type="monotone" dataKey="steady" stroke={palette.gold} strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={false} isAnimationActive={false} />}
              {historical && inputs.replayYear > 0 && <Line type="monotone" dataKey="replay" stroke={palette.gold} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />}
            </> : <Area type="monotone" dataKey="steady" stroke={palette.forest} strokeWidth={2} fill="url(#retirement-fill)" activeDot={{ r: 4 }} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs text-ink/40">Shaded area: retirement. {today ? 'Today’s dollars remove inflation, so the chart shows real spending power.' : 'Future dollars are the actual account balance, before adjusting for inflation.'}</p>
    </section>

    <InputGroup title="Market model">
      <div className="md:col-span-2">
        <Toggle label="Returns" hint={models.find(m => m.value === model)?.hint} value={model} onChange={set('returnModel')} options={models} />
      </div>
      {model === 'random' && <>
        <div>
          <NumberField label="Volatility before retirement" hint="Std. deviation of yearly returns" suffix="%" decimals={1} value={inputs.preVolatility} onChange={set('preVolatility')} min={0} max={30} step={0.5} />
          <Chips options={[6, 10, 15, 18]} value={inputs.preVolatility} onChange={set('preVolatility')} format={v => `${v}%`} />
        </div>
        <div>
          <NumberField label="Volatility in retirement" hint="Stocks ≈ 15–20% · 60/40 ≈ 10–12%" suffix="%" decimals={1} value={inputs.postVolatility} onChange={set('postVolatility')} min={0} max={30} step={0.5} />
          <Chips options={[6, 10, 15, 18]} value={inputs.postVolatility} onChange={set('postVolatility')} format={v => `${v}%`} />
        </div>
        <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-ink/45">Returns average what you entered, but swings lower the typical (median) result: an 8% average with 15% volatility compounds closer to 7%.</p>
          <button type="button" onClick={() => setSeed(s => s + 1)} className="button-quiet shrink-0">New random markets</button>
        </div>
      </>}
      {historical && <>
        <NumberField label="Stocks before retirement" hint={`${100 - inputs.preStockPct}% in 10-yr Treasuries`} suffix="% stocks" value={inputs.preStockPct} onChange={value => set('preStockPct')(Math.min(100, value))} min={0} max={100} step={5} />
        <NumberField label="Stocks in retirement" hint={`${100 - inputs.postStockPct}% in 10-yr Treasuries`} suffix="% stocks" value={inputs.postStockPct} onChange={value => set('postStockPct')(Math.min(100, value))} min={0} max={100} step={5} />
        <label className="block md:col-span-2">
          <div className="flex items-baseline justify-between gap-3"><span className="label">Replay a retirement year</span><span className="text-[11px] text-ink/40">Draws that history as its own line</span></div>
          <select value={inputs.replayYear} onChange={event => set('replayYear')(Number(event.target.value))} className="mt-2 w-full border-b hairline bg-transparent py-2 text-lg outline-none focus:border-forest">
            <option value={0}>None</option>
            <optgroup label="Hard years to retire into">{famousYears.map(year => <option key={year} value={year}>{year}</option>)}</optgroup>
            <optgroup label="Every year">{MARKET_HISTORY.map(([year]) => <option key={year} value={year}>{year}</option>)}</optgroup>
          </select>
        </label>
        <p className="text-xs leading-5 text-ink/45 md:col-span-2">Uses each year’s actual S&amp;P 500 and 10-year Treasury returns and inflation, so the return and inflation inputs are set aside. Each path treats one year from {FIRST_MARKET_YEAR}–{LAST_MARKET_YEAR} as your first year of retirement; years outside the data wrap around to the other end. Rebalanced yearly.</p>
      </>}
      <div className="md:col-span-2">
        <Toggle label="Market crash" hint={inputs.crashEnabled ? 'Replaces that year’s return in every scenario' : 'Test a single bad year'} value={inputs.crashEnabled ? 'on' : 'off'} onChange={value => set('crashEnabled')(value === 'on')} options={[{ value: 'off', label: 'No crash' }, { value: 'on', label: 'Add a crash' }]} />
      </div>
      {inputs.crashEnabled && <>
        <NumberField label="Crash at age" hint={inputs.crashAge < retireAge ? `${retireAge - inputs.crashAge} years before retiring` : inputs.crashAge === retireAge ? 'Your first year of retirement' : `${inputs.crashAge - retireAge} years into retirement`} suffix="yrs" value={inputs.crashAge} onChange={value => set('crashAge')(Math.round(value))} min={inputs.currentAge} max={Math.max(inputs.currentAge, lastAge - 1)} step={1} />
        <div>
          <NumberField label="Crash size" hint="Loss that year" prefix="−" suffix="%" value={inputs.crashPct} onChange={value => set('crashPct')(Math.min(99, value))} min={5} max={60} step={1} />
          <Chips options={[20, 35, 45, 55]} value={inputs.crashPct} onChange={set('crashPct')} format={v => `−${v}%`} />
        </div>
        <p className="text-xs leading-5 text-ink/45 md:col-span-2">For scale: stocks fell 37% in 2008, 22% in 2002, 26% in 1974 and 44% in 1931. A 60/40 portfolio typically falls about half as much.</p>
      </>}
    </InputGroup>

    <InputGroup title="Where you are now">
      <NumberField label="Current age" suffix="yrs" value={inputs.currentAge} onChange={value => set('currentAge')(Math.round(value))} min={18} max={80} step={1} />
      <NumberField label="Saved so far" hint="All retirement accounts" prefix="$" value={inputs.currentSavings} onChange={set('currentSavings')} min={0} max={3000000} step={5000} />
      <NumberField label="Annual salary" hint="Before tax" prefix="$" suffix="/yr" value={inputs.annualSalary} onChange={set('annualSalary')} min={0} max={500000} step={1000} />
      <NumberField label="Salary growth" hint="Raises; your savings grow with it" suffix="% /yr" decimals={2} value={inputs.salaryGrowth} onChange={set('salaryGrowth')} min={0} max={10} step={0.25} />
    </InputGroup>

    <InputGroup title="Saving until retirement">
      <NumberField label="Retirement age" hint={result.yearsSaving > 0 ? `${result.yearsSaving} years from now` : undefined} suffix="yrs" value={inputs.retirementAge} onChange={value => set('retirementAge')(Math.round(value))} min={40} max={80} step={1} />
      <NumberField label="Monthly savings" hint={inputs.annualSalary > 0 ? `${((inputs.monthlySavings * 12 * 100) / inputs.annualSalary).toFixed(1)}% of salary` : 'Your contributions'} prefix="$" suffix="/mo" value={inputs.monthlySavings} onChange={set('monthlySavings')} min={0} max={10000} step={50} />
      <NumberField label="Employer match" hint={`${money((inputs.annualSalary * inputs.employerMatchPct) / 100)}/yr`} suffix="% of salary" decimals={1} value={inputs.employerMatchPct} onChange={set('employerMatchPct')} min={0} max={10} step={0.5} />
      {!historical && <NumberField label={model === 'random' ? 'Average return before retirement' : 'Return before retirement'} hint="Stock-heavy portfolios: often 6–8%" suffix="% /yr" decimals={2} value={inputs.preReturn} onChange={set('preReturn')} min={0} max={12} step={0.25} />}
    </InputGroup>

    <InputGroup title="In retirement">
      <NumberField label="Yearly withdrawal" hint={historical ? 'Today’s $ · grows with each era’s actual inflation' : `Today’s $ · ${money(result.firstWithdrawal)} at age ${retireAge}`} prefix="$" suffix="/yr" value={inputs.withdrawalToday} onChange={set('withdrawalToday')} min={0} max={300000} step={1000} />
      {!historical && <NumberField label={model === 'random' ? 'Average return in retirement' : 'Return in retirement'} hint="More conservative mix: often 4–6%" suffix="% /yr" decimals={2} value={inputs.postReturn} onChange={set('postReturn')} min={0} max={12} step={0.25} />}
      {!historical && <NumberField label="Inflation" hint="Long-run US average ≈ 3%" suffix="% /yr" decimals={2} value={inputs.inflation} onChange={set('inflation')} min={0} max={8} step={0.25} />}
      <NumberField label="Plan until age" hint="How long the money must last" suffix="yrs" value={inputs.planToAge} onChange={value => set('planToAge')(Math.round(value))} min={70} max={110} step={1} />
      <NumberField label="Other retirement income" hint="Social Security, pension · today’s $" prefix="$" suffix="/mo" value={inputs.otherIncomeMonthly} onChange={set('otherIncomeMonthly')} min={0} max={10000} step={100} />
    </InputGroup>

    {variable && sim
      ? <Stats title={`Across ${sim.runs.toLocaleString()} ${historical ? 'historical starting years' : 'simulated markets'} · ${dollarWord}`} items={[
        { label: 'Chance it lasts', value: `${Math.round(sim.successRate)}%`, note: `To age ${inputs.planToAge}` },
        { label: 'Median at retirement', value: money(pick(sim.atRetirement)[2]), note: `Age ${retireAge}` },
        { label: 'Range at retirement', value: `${compact(pick(sim.atRetirement)[0])}–${compact(pick(sim.atRetirement)[4])}`, note: '80% of outcomes' },
        { label: `Median at ${inputs.planToAge}`, value: money(pick(sim.atEnd)[2]), note: 'What’s left at the end' },
        { label: 'Bad markets', value: sim.badCase.depletedAge !== null ? `Out at ${sim.badCase.depletedAge}` : endValue(sim.badCase), note: sim.badCase.depletedAge !== null ? 'Worst 10% run out by this age' : `Worst 10% still have this at ${inputs.planToAge}` },
      ]}>
        <p className="mt-7 text-xs text-ink/40">Estimates only. {historical ? 'Past markets don’t predict future ones, and US history from 1928 was unusually strong by world standards.' : 'Random returns are independent year to year, so they miss real-world streaks like the 1970s; try Historical for those.'} Balances are before tax: withdrawals from a traditional 401(k) or IRA are taxed as income.</p>
      </Stats>
      : <Stats title="The plan" items={[
        { label: 'At retirement', value: money(result.balanceAtRetirement), note: 'Future dollars' },
        { label: 'In today’s dollars', value: money(result.realBalanceAtRetirement), note: `${inputs.inflation}% inflation` },
        { label: 'Year-one withdrawal', value: money(result.firstWithdrawal), note: `${result.initialWithdrawalRate.toFixed(1)}% of savings · rises with inflation` },
        { label: 'Money lasts', value: result.depletedAge === null ? `Past ${inputs.planToAge}` : `Age ${result.depletedAge}`, note: result.depletedAge === null ? `${money(result.endingBalance)} left` : `${result.depletedAge - retireAge} years of withdrawals` },
        { label: 'You contribute', value: money(result.yourContributions), note: `+ ${money(result.matchContributions)} match` },
      ]}>
        <p className="mt-7 text-xs text-ink/40">Estimates only. Assumes the same return every year; switch the market model to Random or Historical to see how real swings, and a bad stretch early in retirement, change the picture. Balances are before tax: withdrawals from a traditional 401(k) or IRA are taxed as income.</p>
      </Stats>}
  </>;
}

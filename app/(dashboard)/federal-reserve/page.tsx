import { FredLineChart, type ChartUnit } from '@/components/charts/fred-line-chart';
import { YieldCurveChart, type YieldPoint } from '@/components/charts/yield-curve-chart';
import { fetchFredSeries, yearsAgo, type FredPoint } from '@/lib/fred';
import { fetchPinkSheet } from '@/lib/world-bank';

// Render on every request so the numbers are current when the page opens. A static/ISR
// page is served stale first and only regenerated in the background (see lib/fred.ts).
// World Bank metals data is still cached for a day in lib/world-bank.ts; it's monthly.
export const dynamic = 'force-dynamic';

// Series ids: DGS10 = 10-year Treasury constant maturity (daily), CPIAUCSL with pc1 =
// year-over-year CPI inflation (monthly), DCOILWTICO = WTI crude spot price (daily),
// UNRATE = civilian unemployment rate (monthly). NASDAQQGLDI / NASDAQQSLVO = Nasdaq gold and
// silver price indexes (daily; FRED dropped dollar gold/silver prices in 2022), PCOPPUSDM =
// IMF global copper price (monthly, $/metric ton). GDP = nominal GDP ($ billions, annual rate),
// GFDEBTN = total public debt ($ millions), A091RC1Q027SBEA = federal interest payments
// ($ billions, annual rate); all three quarterly.
// We load the longest range the dropdown offers (20 years) once; each chart filters
// it down client-side so switching ranges is instant.
const MAX_YEARS = 20;

const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

async function load(seriesId: string, units?: 'lin' | 'pc1'): Promise<FredPoint[] | null> {
  try { return await fetchFredSeries(seriesId, { start: yearsAgo(MAX_YEARS), units }); }
  catch (error) { console.error(error); return null; }
}

const POUNDS_PER_METRIC_TON = 2204.62;
const scale = (points: FredPoint[] | null, divisor: number) => points?.map(point => ({ ...point, value: point.value / divisor })) ?? null;
const perPound = (points: FredPoint[] | null) => scale(points, POUNDS_PER_METRIC_TON);

// Dollar prices from the World Bank, since FRED no longer has them for gold and silver.
async function loadMetals() {
  try {
    const sheet = await fetchPinkSheet(['Gold', 'Silver', 'Copper']);
    const start = yearsAgo(MAX_YEARS);
    const recent = (points: FredPoint[]) => points.filter(point => point.date >= start);
    return { gold: recent(sheet.Gold), silver: recent(sheet.Silver), copper: perPound(recent(sheet.Copper)) };
  } catch (error) { console.error(error); return { gold: null, silver: null, copper: null }; }
}

// Treasury constant-maturity series, shortest to longest, for the yield curve.
const MATURITIES = [
  { id: 'DGS6MO', maturity: '6M', label: '6-month' },
  { id: 'DGS1', maturity: '1Y', label: '1-year' },
  { id: 'DGS2', maturity: '2Y', label: '2-year' },
  { id: 'DGS3', maturity: '3Y', label: '3-year' },
  { id: 'DGS5', maturity: '5Y', label: '5-year' },
  { id: 'DGS7', maturity: '7Y', label: '7-year' },
  { id: 'DGS10', maturity: '10Y', label: '10-year' },
  { id: 'DGS20', maturity: '20Y', label: '20-year' },
  { id: 'DGS30', maturity: '30Y', label: '30-year' },
];

// Use the latest date every maturity has published, so the curve is one day's snapshot
// rather than a mix of days. Only the last few weeks are fetched to find it.
async function loadYieldCurve(): Promise<{ date: string; points: YieldPoint[] } | null> {
  const start = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  try {
    const series = await Promise.all(MATURITIES.map(m => fetchFredSeries(m.id, { start })));
    const byDate = series.map(points => new Map(points.map(point => [point.date, point.value])));
    const date = series[0].map(point => point.date).reverse().find(d => byDate.every(values => values.has(d)));
    if (!date) return null;
    return { date, points: MATURITIES.map((m, i) => ({ maturity: m.maturity, label: m.label, value: byDate[i].get(date)! })) };
  } catch (error) { console.error(error); return null; }
}

function Section({ title, note, data, color, unit }: { title: string; note: string; data: FredPoint[] | null; color?: string; unit: ChartUnit }) {
  return <section className="border-t hairline py-8">
    {data ? <FredLineChart title={title} note={note} data={data} color={color} unit={unit} /> : <>
      <div className="mb-4"><h2 className="serif text-2xl">{title}</h2><p className="mt-1 text-xs text-ink/45">{note}</p></div>
      <div className="flex h-64 items-center justify-center text-xs text-ink/40">Couldn&apos;t load this data right now.</div>
    </>}
  </section>;
}

export default async function FederalReservePage() {
  const [treasury, inflation, oil, curve, unemployment, gdp, debt, interest, metals, goldIndex, silverIndex, fredCopper] = await Promise.all([
    load('DGS10'), load('CPIAUCSL', 'pc1'), load('DCOILWTICO'), loadYieldCurve(), load('UNRATE'),
    load('GDP'), load('GFDEBTN'), load('A091RC1Q027SBEA'),
    loadMetals(), load('NASDAQQGLDI'), load('NASDAQQSLVO'), load('PCOPPUSDM'),
  ]);
  const latest = treasury?.at(-1);
  const previous = treasury?.at(-2);
  const change = latest && previous ? latest.value - previous.value : null;

  return <main className="mx-auto max-w-4xl px-6 py-8 sm:py-10 lg:px-10">
    <div className="mb-8 sm:mb-10"><p className="label mb-3">Household office · Federal Reserve</p><h1 className="serif text-4xl sm:text-5xl">Federal Reserve Info</h1></div>
    {!process.env.FRED_API_KEY && <div className="mb-8 border hairline px-4 py-3 text-sm text-ink/60">FRED_API_KEY isn&apos;t set. Add it to your environment variables to load this page.</div>}
    <section className="pb-8">
      <p className="label">10-year Treasury yield</p>
      <p className="serif mt-2 text-5xl text-forest">{latest ? `${latest.value.toFixed(2)}%` : '—'}</p>
      {latest && <p className="mt-2 text-xs text-ink/50">
        As of {formatDate(latest.date)}
        {change !== null && <> · <span className={change > 0 ? 'text-gold' : ''}>{change >= 0 ? '+' : ''}{change.toFixed(2)} pts</span> from prior day</>}
      </p>}
    </section>
    <Section title="10-year Treasury" note="Daily, percent. Source: FRED DGS10." data={treasury} unit="%" />
    <Section title="Inflation" note="CPI, all urban consumers, percent change from a year ago. Monthly. Source: FRED CPIAUCSL." data={inflation} color="#ad8a50" unit="%" />
    <Section title="Oil prices" note="WTI crude, dollars per barrel. Daily. Source: FRED DCOILWTICO." data={oil} color="#18231f" unit="$" />
    <section className="border-t hairline py-8">
      <div className="mb-4"><h2 className="serif text-2xl">Treasury yield curve</h2><p className="mt-1 text-xs text-ink/45">{curve ? `Yield by maturity as of ${formatDate(curve.date)}.` : 'Yield by maturity, latest day.'} Source: FRED DGS6MO–DGS30.</p></div>
      {curve ? <YieldCurveChart data={curve.points} /> : <div className="flex h-64 items-center justify-center text-xs text-ink/40">Couldn&apos;t load this series from FRED.</div>}
    </section>
    <Section title="Unemployment rate" note="Civilian unemployment rate, seasonally adjusted. Monthly. Source: FRED UNRATE." data={unemployment} color="#889e93" unit="%" />
    <Section title="GDP" note="Nominal gross domestic product, trillions of dollars, seasonally adjusted annual rate. Quarterly. Source: FRED GDP." data={scale(gdp, 1000)} color="#173d35" unit="$T" />
    <Section title="U.S. debt" note="Total public debt outstanding, trillions of dollars, end of quarter. Source: FRED GFDEBTN." data={scale(debt, 1_000_000)} color="#18231f" unit="$T" />
    <Section title="U.S. interest payments" note="Federal government interest payments, billions of dollars per year (seasonally adjusted annual rate). Quarterly. Source: FRED A091RC1Q027SBEA." data={interest} color="#ad8a50" unit="$B" />
    <Section title="Gold" note="Dollars per troy ounce, monthly average. Source: World Bank Pink Sheet." data={metals.gold} color="#ad8a50" unit="$" />
    <Section title="Gold index" note="Nasdaq gold price index, daily. Tracks the gold price but is an index level, not $/oz. Source: FRED NASDAQQGLDI." data={goldIndex} color="#ad8a50" unit="index" />
    <Section title="Silver" note="Dollars per troy ounce, monthly average. Source: World Bank Pink Sheet." data={metals.silver} color="#6b7a80" unit="$" />
    <Section title="Silver index" note="Nasdaq silver price index, daily, starting 2013. An index level, not $/oz. Source: FRED NASDAQQSLVO." data={silverIndex} color="#6b7a80" unit="index" />
    <Section title="Copper" note="Dollars per pound (converted from $/metric ton), monthly average. Source: World Bank Pink Sheet." data={metals.copper} color="#a5643d" unit="$" />
    <Section title="Copper (IMF)" note="Global copper price, dollars per pound (converted from $/metric ton), monthly average. Source: FRED PCOPPUSDM." data={perPound(fredCopper)} color="#a5643d" unit="$" />
  </main>;
}

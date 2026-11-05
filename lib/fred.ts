// Federal Reserve Economic Data (FRED) client. Server-only: FRED_API_KEY must never
// reach the browser, so this is only imported from server components.
export type FredPoint = { date: string; value: number };

type FredUnits = 'lin' | 'pc1'; // lin = raw level, pc1 = percent change from a year ago

const FRED_URL = 'https://api.stlouisfed.org/fred/series/observations';
// FRED publishes once a day at most, so a few hours of caching keeps us well under
// its rate limit without the numbers ever being meaningfully stale.
const REVALIDATE_SECONDS = 60 * 60 * 6;

export function yearsAgo(years: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date.toISOString().slice(0, 10);
}

export async function fetchFredSeries(seriesId: string, { start, units = 'lin' }: { start: string; units?: FredUnits }): Promise<FredPoint[]> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) throw new Error('FRED_API_KEY is not configured.');
  const params = new URLSearchParams({ series_id: seriesId, api_key: apiKey, file_type: 'json', observation_start: start, units });
  const response = await fetch(`${FRED_URL}?${params}`, { next: { revalidate: REVALIDATE_SECONDS } });
  if (!response.ok) throw new Error(`FRED ${seriesId} request failed (${response.status}).`);
  const json = (await response.json()) as { observations?: { date: string; value: string }[] };
  // Market holidays come back as "." rather than being omitted.
  return (json.observations ?? []).filter(o => o.value !== '.').map(o => ({ date: o.date, value: Number(o.value) }));
}

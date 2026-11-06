// Federal Reserve Economic Data (FRED) client. Server-only: FRED_API_KEY must never
// reach the browser, so this is only imported from server components.
export type FredPoint = { date: string; value: number };

type FredUnits = 'lin' | 'pc1'; // lin = raw level, pc1 = percent change from a year ago

const FRED_URL = 'https://api.stlouisfed.org/fred/series/observations';
// Fetched fresh on every request. Next's time-based cache (`next: { revalidate }`) is
// stale-while-revalidate: the first request after it expires still gets the old data and
// only refreshes in the background. With two users who visit now and then, that meant
// every visit showed whatever was fetched on the previous visit, sometimes days old. A
// page view makes about 20 small calls, well under FRED's 120-requests-a-minute limit.

export function yearsAgo(years: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date.toISOString().slice(0, 10);
}

export async function fetchFredSeries(seriesId: string, { start, units = 'lin' }: { start: string; units?: FredUnits }): Promise<FredPoint[]> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) throw new Error('FRED_API_KEY is not configured.');
  const params = new URLSearchParams({ series_id: seriesId, api_key: apiKey, file_type: 'json', observation_start: start, units });
  const response = await fetch(`${FRED_URL}?${params}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`FRED ${seriesId} request failed (${response.status}).`);
  const json = (await response.json()) as { observations?: { date: string; value: string }[] };
  // Market holidays come back as "." rather than being omitted.
  return (json.observations ?? []).filter(o => o.value !== '.').map(o => ({ date: o.date, value: Number(o.value) }));
}

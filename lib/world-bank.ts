// World Bank Commodity Price Data ("Pink Sheet"): monthly average prices in nominal US
// dollars since 1960. FRED stopped carrying gold and silver dollar prices in 2022, so
// this is the free source for those. Server-only; no API key needed.
import { strFromU8, unzipSync } from 'fflate';
import type { FredPoint } from '@/lib/fred';

// The spreadsheet's URL changes every year, so we scrape the current link from this
// stable page and fall back to the last known one if that fails.
const LANDING_PAGE = 'https://www.worldbank.org/en/research/commodity-markets';
const FALLBACK_URL = 'https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx';
const SHEET_NAME = 'Monthly Prices';
// Published once a month (early in the month), so a day of caching is plenty.
const REVALIDATE_SECONDS = 60 * 60 * 24;

export type PinkSheetSeries = Record<string, FredPoint[]>;

async function spreadsheetUrl() {
  try {
    const html = await (await fetch(LANDING_PAGE, { next: { revalidate: REVALIDATE_SECONDS } })).text();
    return html.match(/https?:\/\/[^"']*CMO-Historical-Data-Monthly\.xlsx/)?.[0] ?? FALLBACK_URL;
  } catch { return FALLBACK_URL; }
}

const decode = (text: string) => text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

// Reads the columns whose header (row 5 of the sheet) exactly matches one of `names`.
// Headers are matched by name rather than column letter so a new commodity inserted by
// the World Bank doesn't shift us onto the wrong series. Dates look like "2026M10".
export async function fetchPinkSheet(names: string[]): Promise<PinkSheetSeries> {
  const response = await fetch(await spreadsheetUrl(), { next: { revalidate: REVALIDATE_SECONDS } });
  if (!response.ok) throw new Error(`World Bank Pink Sheet request failed (${response.status}).`);
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()), {
    filter: file => file.name === 'xl/workbook.xml' || file.name === 'xl/_rels/workbook.xml.rels' || file.name === 'xl/sharedStrings.xml' || file.name.startsWith('xl/worksheets/sheet'),
  });

  const relId = strFromU8(files['xl/workbook.xml']).match(new RegExp(`<sheet [^>]*name="${SHEET_NAME}"[^>]*r:id="([^"]+)"`))?.[1];
  const target = relId && strFromU8(files['xl/_rels/workbook.xml.rels']).match(new RegExp(`Id="${relId}"[^>]*Target="([^"]+)"`))?.[1];
  const sheet = target && files[`xl/${target.replace(/^\/?xl\//, '')}`];
  if (!sheet) throw new Error(`World Bank Pink Sheet is missing the "${SHEET_NAME}" sheet.`);
  const shared = Array.from(strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)).map(m => decode(m[1]));

  const columns = new Map<string, string>(); // column letter → series name
  const result: PinkSheetSeries = Object.fromEntries(names.map(name => [name, []]));
  for (const row of Array.from(strFromU8(sheet).matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g))) {
    const cells = new Map<string, string>();
    for (const cell of Array.from(row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g))) {
      const raw = cell[3]?.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      if (raw !== undefined) cells.set(cell[1], cell[2].includes('t="s"') ? shared[Number(raw)] : decode(raw));
    }
    const label = cells.get('A');
    if (columns.size === 0) {
      for (const [column, value] of Array.from(cells)) if (names.includes(value)) columns.set(column, value);
      continue;
    }
    const month = label?.match(/^(\d{4})M(\d{2})$/);
    if (!month) continue;
    for (const [column, name] of Array.from(columns)) {
      // Missing months are blank or "…", and Number('') would quietly be 0.
      const text = cells.get(column);
      const value = Number(text);
      if (text && Number.isFinite(value)) result[name].push({ date: `${month[1]}-${month[2]}-01`, value });
    }
  }
  const missing = names.filter(name => !Array.from(columns.values()).includes(name));
  if (missing.length) throw new Error(`World Bank Pink Sheet has no column named ${missing.join(', ')}.`);
  return result;
}

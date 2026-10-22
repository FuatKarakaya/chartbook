import type { Candle } from '../../shared/types.ts';

const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

/** A FRED series since `from` (UTC seconds), from its public CSV (no key needed). */
export async function fetchFred(id: string, from: number): Promise<Candle[]> {
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${day(from)}`);
  if (!res.ok) throw new Error(`FRED HTTP ${res.status}`);
  const csv = await res.text();
  // During site maintenance FRED answers "OK" with a web page instead of the data.
  if (!csv.startsWith('observation_date')) throw new Error('FRED sent a web page, not data (site maintenance?)');
  return parseFred(csv);
}

/**
 * "observation_date,DFF\n1954-07-01,1.13\n..." as candles with open = high = low = close at UTC midnight
 * (a monthly series like M2 is dated the 1st). FRED writes "." for a day with no value; those are skipped.
 */
export function parseFred(csv: string): Candle[] {
  return csv.trim().split('\n').slice(1).flatMap((row) => {
    const [date, value] = row.split(',');
    const v = Number(value);
    return value === '.' ? [] : [{ time: Date.parse(date) / 1000, open: v, high: v, low: v, close: v }];
  });
}

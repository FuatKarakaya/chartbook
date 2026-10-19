import type { Candle } from '../../shared/types.ts';
import { fetchDukascopy } from './dukascopy.ts';
import { fetchYahoo } from './yahoo.ts';

const DAY = 86400;
/** COMEX silver's most traded delivery months (0-based) and their ticker letters. */
const ACTIVE: [number, string][] = [[2, 'H'], [4, 'K'], [6, 'N'], [8, 'U'], [11, 'Z']];

/** Yahoo ticker of the most traded silver contract on date `d`, e.g. SIZ26.CMX; traders move on around the 25th of the month before delivery. */
export function activeContract(d: Date) {
  const m = d.getUTCMonth() + (d.getUTCDate() >= 25 ? 1 : 0);
  const next = ACTIVE.find(([month]) => month > m);
  const year = (d.getUTCFullYear() + (next ? 0 : 1)) % 100;
  return `SI${(next ?? ACTIVE[0])[1]}${String(year).padStart(2, '0')}.CMX`;
}

/**
 * Spot candles, then the futures candles after them scaled to spot by the gap between the two on the last bar both
 * have (futures trade a little above spot). A daily spot bar whose day isn't over yet is dropped first.
 */
export function stitch(spot: Candle[], futures: Candle[], interval: '1h' | '1D', now: number): Candle[] {
  const done = interval === '1D' ? spot.filter((c) => c.time + DAY <= now) : spot;
  const last = done.at(-1);
  const same = last && futures.find((c) => c.time === last.time);
  if (!same) return done; // e.g. a holiday: today waits for the next day both sources have
  const k = last.close / same.close;
  const later = futures.filter((c) => c.time > last.time);
  return [...done, ...later.map((c) => ({ time: c.time, open: c.open * k, high: c.high * k, low: c.low * k, close: c.close * k }))];
}

/**
 * Silver spot. Dukascopy has clean spot prices but publishes a day only once it is over; the day in progress comes
 * from Yahoo's most traded contract. (Yahoo's SI=F follows thinly traded months, so most of its days look flat.)
 */
export async function fetchSilver(interval: '1h' | '1D', from: number): Promise<Candle[]> {
  const spot = await fetchDukascopy('XAGUSD', interval, from);
  const futures = await fetchYahoo(activeContract(new Date()), interval, spot.at(-1)!.time - 3 * DAY);
  return stitch(spot, futures, interval, Date.now() / 1000);
}

// lzma-purejs: Dukascopy's .bi5 files are LZMA-compressed and Node has no built-in LZMA (pure JS, so nothing to compile on Windows).
import lzma from 'lzma-purejs';
import { aggregate } from '../../shared/time.ts';
import type { Candle } from '../../shared/types.ts';

const BASE = 'https://datafeed.dukascopy.com/datafeed';
const DAY = 86400;
const HOUR = 3600;
/** First year with data (silver spot starts in 2001). */
const FIRST_YEAR = 2001;
/** Same hourly depth as Yahoo assets: two years. */
const HOURLY_LIMIT = 730 * DAY;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pad = (n: number) => String(n).padStart(2, '0');
const utc = (y: number, m = 0, d = 1) => Date.UTC(y, m, d) / 1000;
const hourOf = (t: number) => Math.floor(t / HOUR) * HOUR;
/** Spot metals trade from Sunday 22:00 UTC; that evening counts towards Monday, like the futures day. */
export const dayOf = (t: number) => {
  const d = Math.floor(t / DAY) * DAY;
  return new Date(d * 1000).getUTCDay() === 0 ? d + DAY : d;
};

/**
 * Candles from one .bi5 file: 24-byte records of seconds since `start`, open, close, low, high (integer
 * thousandths) and volume. Minutes, hours and days without trades (weekends, holidays) have volume 0 and are dropped.
 */
export function parse(data: Uint8Array, start: number): Candle[] {
  if (!data.length) return []; // Dukascopy sends an empty file for a period without trades
  const b = Buffer.from(lzma.decompressFile(data));
  const out: Candle[] = [];
  for (let i = 0; i < b.length; i += 24) {
    if (b.readFloatBE(i + 20) === 0) continue;
    const [open, close, low, high] = [4, 8, 12, 16].map((o) => b.readInt32BE(i + o) / 1000);
    out.push({ time: start + b.readInt32BE(i), open, high: Math.max(high, open, close), low: Math.min(low, open, close), close });
  }
  return out;
}

/** One file, [] if it doesn't exist. Dukascopy often answers "busy" (429/503): wait and retry, one file a second. */
async function file(symbol: string, path: string, start: number): Promise<Candle[]> {
  for (let wait = 2000; ; wait *= 2) {
    await sleep(1000);
    const res = await fetch(`${BASE}/${symbol}/${path}.bi5`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      .catch((err: Error) => ({ ok: false, status: err.message }) as const);
    if (res.status === 404) return [];
    if (res.ok) return parse(new Uint8Array(await res.arrayBuffer()), start);
    if (wait > 32000) throw new Error(`dukascopy ${symbol} ${path}: ${res.status}`);
    await sleep(wait);
  }
}

/** Hour candles from `from` to the end of yesterday: a file per finished month, then this month's minute files rolled up into hours. */
async function hours(symbol: string, from: number): Promise<Candle[]> {
  const now = new Date();
  const thisMonth = utc(now.getUTCFullYear(), now.getUTCMonth());
  const out: Candle[] = [];
  for (let d = new Date(from * 1000), y = d.getUTCFullYear(), m = d.getUTCMonth(); utc(y, m) < thisMonth; [y, m] = m === 11 ? [y + 1, 0] : [y, m + 1]) {
    out.push(...await file(symbol, `${y}/${pad(m)}/BID_candles_hour_1`, utc(y, m))); // months count from 00
  }
  // A day's file appears only once the day is over, so today is never asked for.
  for (let t = Math.floor(Math.max(from, thisMonth) / DAY) * DAY; t + DAY <= now.getTime() / 1000; t += DAY) {
    const d = new Date(t * 1000);
    const minutes = await file(symbol, `${d.getUTCFullYear()}/${pad(d.getUTCMonth())}/${pad(d.getUTCDate())}/BID_candles_min_1`, t);
    out.push(...aggregate(minutes, hourOf));
  }
  return out;
}

/**
 * Spot prices (e.g. XAGUSD) from Dukascopy's free data feed since `from` (UTC seconds). Daily: a file per finished
 * year, then this year's hours rolled up into days.
 */
export async function fetchDukascopy(symbol: string, interval: '1h' | '1D', from: number): Promise<Candle[]> {
  const now = Date.now() / 1000;
  if (interval === '1h') return hours(symbol, Math.max(from, now - HOURLY_LIMIT));
  const thisYear = new Date().getUTCFullYear();
  const out: Candle[] = [];
  for (let y = Math.max(FIRST_YEAR, new Date(from * 1000).getUTCFullYear()); y < thisYear; y++) {
    out.push(...await file(symbol, `${y}/BID_candles_day_1`, utc(y)));
  }
  out.push(...await hours(symbol, Math.max(from, utc(thisYear))));
  return aggregate(out, dayOf);
}

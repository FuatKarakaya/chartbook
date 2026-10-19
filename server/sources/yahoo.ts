import YahooFinance from 'yahoo-finance2';
import type { Candle } from '../../shared/types.ts';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const DAY = 86400;
const HOUR = 3600;
/** Yahoo only serves hourly bars for the last 730 days; ask for a bit less to stay inside the limit. */
const HOURLY_LIMIT = 729 * DAY;

/**
 * Candles from Yahoo since `from` (UTC seconds). Times are floored to the UTC day / hour so every asset
 * shares one grid: Yahoo stamps S&P daily bars 14:30 UTC, gold 04:00 UTC, and the live bar "now".
 */
export async function fetchYahoo(symbol: string, interval: '1h' | '1D', from: number): Promise<Candle[]> {
  const step = interval === '1h' ? HOUR : DAY;
  const now = Math.floor(Date.now() / 1000);
  const start = interval === '1h' ? Math.max(from, now - HOURLY_LIMIT) : from;
  const res = await yf.chart(symbol, { period1: new Date(start * 1000), interval: interval === '1h' ? '1h' : '1d' });
  return toCandles(res.quotes, step);
}

interface Quote { date: Date; open: number | null; high: number | null; low: number | null; close: number | null }

/**
 * Drops empty bars and floors times to `step` seconds. High/low are widened to cover open/close: old futures bars
 * often close at a settlement price outside them. Two kinds of stray bar are folded away:
 * - one that starts less than `step` after the bar before it is merged into that bar. S&P hourly bars run
 *   13:30, 14:30 .. 19:30 UTC, then Yahoo adds the 20:00 closing print as its own few-minute bar; the live bar too.
 * - a bar with no range at the last close (an after-hours repeat of the close, e.g. S&P at 21:00) is dropped.
 */
export function toCandles(quotes: Quote[], step: number): Candle[] {
  const out: Candle[] = [];
  let start = -Infinity; // real start of the last bar, before flooring
  for (const q of quotes) {
    if (q.open == null || q.high == null || q.low == null || q.close == null) continue;
    const t = q.date.getTime() / 1000;
    const { open, close } = q;
    const high = Math.max(q.high, open, close);
    const low = Math.min(q.low, open, close);
    const last = out.at(-1);
    if (last && high === low && close === last.close) continue;
    if (last && t < start + step) {
      last.high = Math.max(last.high, high);
      last.low = Math.min(last.low, low);
      last.close = close;
      continue;
    }
    start = t;
    out.push({ time: Math.floor(t / step) * step, open, high, low, close });
  }
  return out;
}

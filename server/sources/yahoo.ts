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
 * Drops empty bars and floors times to `step` seconds; when two bars land on one slot the later wins.
 * High/low are widened to cover open/close: old futures bars often close at a settlement price outside them.
 */
export function toCandles(quotes: Quote[], step: number): Candle[] {
  const out: Candle[] = [];
  for (const q of quotes) {
    if (q.open == null || q.high == null || q.low == null || q.close == null) continue;
    const time = Math.floor(q.date.getTime() / 1000 / step) * step;
    const { open, close } = q;
    const candle = { time, open, high: Math.max(q.high, open, close), low: Math.min(q.low, open, close), close };
    if (out.at(-1)?.time === time) out[out.length - 1] = candle;
    else out.push(candle);
  }
  return out;
}

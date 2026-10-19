import type { Candle } from './types.ts';

const DAY = 86400;
const WEEK = 7 * DAY;
/** 1970-01-05, the first Monday after the epoch: weeks are counted from here. */
const FIRST_MONDAY = 4 * DAY;

/** Start (UTC seconds) of the 4h block, Monday-based week or calendar month that `t` falls in. */
export const bucket = {
  '4h': (t: number) => Math.floor(t / (4 * 3600)) * 4 * 3600,
  '1W': (t: number) => Math.floor((t - FIRST_MONDAY) / WEEK) * WEEK + FIRST_MONDAY,
  '1M': (t: number) => {
    const d = new Date(t * 1000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
  },
};

/** Merges time-ordered candles into bigger bars: first open, highest high, lowest low, last close. */
export function aggregate(candles: Candle[], start: (t: number) => number): Candle[] {
  const out: Candle[] = [];
  for (const k of candles) {
    const time = start(k.time);
    const bar = out.at(-1);
    if (bar?.time !== time) out.push({ ...k, time });
    else {
      bar.high = Math.max(bar.high, k.high);
      bar.low = Math.min(bar.low, k.low);
      bar.close = k.close;
    }
  }
  return out;
}

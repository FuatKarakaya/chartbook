import { bucket } from '../../shared/time.ts';
import type { Candle, Point } from '../../shared/types.ts';

const SMA_WEEKS = 20;
const EMA_WEEKS = 21;
const K = 2 / (EMA_WEEKS + 1);

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * The bull market support band: 20-week SMA and 21-week EMA of weekly closes (weeks start Monday), as each day
 * saw them: the weeks before, plus that day's close standing in for its week's. So it never looks ahead, moves
 * every day on the daily chart, and is the plain weekly average at each week's last day (the weekly chart).
 * The EMA starts from the average of its first 21 weeks.
 */
export function band(days: Candle[]) {
  const sma: Point[] = [];
  const ema: Point[] = [];
  const weeks: number[] = []; // closes of the weeks already over
  let e = NaN; // EMA of the weeks already over
  days.forEach((d, i) => {
    if (i > 0 && bucket['1W'](d.time) !== bucket['1W'](days[i - 1].time)) {
      const close = days[i - 1].close;
      weeks.push(close);
      e = weeks.length === EMA_WEEKS ? sum(weeks) / EMA_WEEKS : e + K * (close - e);
    }
    if (weeks.length >= SMA_WEEKS - 1) sma.push({ time: d.time, value: (sum(weeks.slice(1 - SMA_WEEKS)) + d.close) / SMA_WEEKS });
    if (weeks.length === EMA_WEEKS - 1) ema.push({ time: d.time, value: (sum(weeks) + d.close) / EMA_WEEKS });
    if (weeks.length >= EMA_WEEKS) ema.push({ time: d.time, value: e + K * (d.close - e) });
  });
  return { sma, ema };
}

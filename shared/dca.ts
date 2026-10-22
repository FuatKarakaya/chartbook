import { bucket } from './time.ts';
import type { Candle } from './types.ts';

const DAY = 86400;
const WEEK = 7 * DAY;
/** 0 = Monday … 6 = Sunday. */
export const weekdayOf = (t: number) => (new Date(t * 1000).getUTCDay() + 6) % 7;

/** What buying $1 every week on one weekday came to. */
export interface WeekdayBuys {
  /** 0 = Monday … 6 = Sunday. */
  weekday: number;
  buys: number;
  /** How much of the asset the buys got, all told. */
  units: number;
  /**
   * How much more of the asset a buy got than the same money spread evenly over the trading week around it (the buy
   * day in the middle), on average: 0.01 = 1% more. Against the days around it, a rising market favours no day, and
   * where the range starts doesn't matter. Buys too near the end of the data for a whole week around them are left out.
   */
  more: number;
}

/**
 * Dollar-cost averaging: $1 bought at the day's close (or open) every week, once for each weekday the market trades,
 * from `from` to `to` (UTC seconds). A buy that falls on a day without a candle (a holiday) happens at the next one.
 */
export function weekdayBuys(days: Candle[], from: number, to: number, at: 'open' | 'close' = 'close'): WeekdayBuys[] {
  const traded = [...new Set(days.filter((d) => d.time >= from && d.time <= to).map((d) => weekdayOf(d.time)))]
    .sort((a, b) => a - b);
  const half = traded.length === 7 ? 3 : 2; // candles either side: a week of trading days
  return traded.map((weekday) => {
    let buys = 0;
    let units = 0;
    let more = 0;
    let compared = 0;
    let t = bucket['1W'](from) + weekday * DAY;
    if (t < from) t += WEEK;
    for (let k = 0; t <= to; t += WEEK) {
      while (k < days.length && days[k].time < t) k++;
      if (k === days.length) break;
      const price = days[k][at];
      buys++;
      units += 1 / price;
      if (k < half || k + half >= days.length) continue;
      const around = days.slice(k - half, k + half + 1).reduce((s, d) => s + 1 / d[at], 0) / (2 * half + 1);
      more += 1 / price / around - 1;
      compared++;
    }
    return { weekday, buys, units, more: more / compared };
  });
}

import type { Candle } from './types.ts';

/** One market cycle, by UTC day (YYYY-MM-DD). It ends where the next one bottoms; the current one runs to today. */
export interface Cycle {
  bottom: string;
  peak: string;
  /** A later peak to use instead, when the top came twice (2021: spring and November). */
  secondPeak?: string;
}

/**
 * Bottoms (lowest daily close) and peaks (highest), picked by hand from the stored daily closes, not detected.
 * A new bottom is added only once the owner says it is confirmed; its year then needs a colour in web/pages/cycles.ts.
 */
export const CYCLES = {
  btc: [
    { bottom: '2010-07-17', peak: '2011-06-08' }, // the first price there is
    { bottom: '2011-11-18', peak: '2013-12-04' },
    { bottom: '2015-01-14', peak: '2017-12-16' },
    { bottom: '2018-12-15', peak: '2021-04-13', secondPeak: '2021-11-08' },
    { bottom: '2022-11-21', peak: '2025-10-06' },
  ],
  // ETH history here starts 2017-08-17, after its 2015 bottom, so its first full cycle is 2018's.
  eth: [
    { bottom: '2018-12-14', peak: '2021-05-11', secondPeak: '2021-11-08' },
    { bottom: '2022-06-18', peak: '2025-08-22' },
  ],
} satisfies Record<string, Cycle[]>;
export type CycleAsset = keyof typeof CYCLES;

/** How much of each cycle to show: up to its peak, 3 months past it, or up to the next bottom (the current one: today). */
export type Length = 'peak' | '3m' | 'bottom';
export interface Options {
  length: Length;
  secondPeak: boolean;
  /** Treat the first two cycles as one, from the first bottom to the second peak (BTC: 2010 to the 2013 peak). */
  combine: boolean;
}
/** One cycle's line: `day` = days since its bottom, `roi` = close / bottom close (so day 0 is 1). */
export interface CycleLine {
  /** Names and colours the cycle: "2015 cycle". */
  year: number;
  /** The bottom's day, UTC seconds. */
  bottom: number;
  points: { day: number; roi: number }[];
}

const DAY = 86400;
const utc = (day: string) => Date.parse(`${day}T00:00:00Z`) / 1000;
const monthsAfter = (t: number, n: number) => {
  const d = new Date(t * 1000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()) / 1000;
};

/** Each cycle's ROI line from daily candles, cut where `o.length` says. */
export function cycleLines(days: Candle[], cycles: Cycle[], o: Options): CycleLine[] {
  const list = o.combine ? [{ ...cycles[1], bottom: cycles[0].bottom }, ...cycles.slice(2)] : cycles;
  return list.map((c, i) => {
    const bottom = utc(c.bottom);
    const peak = utc((o.secondPeak && c.secondPeak) || c.peak);
    const next = list[i + 1] ? utc(list[i + 1].bottom) : Infinity;
    const end = { peak, '3m': monthsAfter(peak, 3), bottom: next }[o.length];
    const from = days.findIndex((d) => d.time >= bottom);
    const points = [];
    for (let k = from; k < days.length && days[k].time <= end; k++) {
      points.push({ day: (days[k].time - bottom) / DAY, roi: days[k].close / days[from].close });
    }
    return { year: Number(c.bottom.slice(0, 4)), bottom, points };
  });
}

/** The latest close over the close at the latest bottom. */
export function currentRoi(days: Candle[], cycles: Cycle[]) {
  const bottom = utc(cycles.at(-1)!.bottom);
  return days.at(-1)!.close / days.find((d) => d.time >= bottom)!.close;
}

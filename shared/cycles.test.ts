import { describe, expect, it } from 'vitest';
import { currentRoi, CYCLES, cycleLines, type Cycle, type Options } from './cycles.ts';

const DAY = 86400;
const START = Date.UTC(2020, 0, 1) / 1000;
/** Daily candles from 2020-01-01 whose close is 1, 2, 3...: a day's ROI from bottom day b is (day + 1) / (b + 1). */
const days = Array.from({ length: 400 }, (_, i) => ({ time: START + i * DAY, open: i + 1, high: i + 1, low: i + 1, close: i + 1 }));
const dayOf = (iso: string) => (Date.parse(iso) / 1000 - START) / DAY;
const cycles: Cycle[] = [
  { bottom: '2020-01-01', peak: '2020-02-01' },
  { bottom: '2020-03-01', peak: '2020-04-01', secondPeak: '2020-05-01' },
  { bottom: '2020-06-01', peak: '2020-07-01' },
];
const opts: Options = { length: 'bottom', secondPeak: false, combine: false };
/** Each line's [bottom year-month-day, last day number, last ROI]. */
const ends = (o: Partial<Options>) => cycleLines(days, cycles, { ...opts, ...o }).map((l) => {
  const last = l.points.at(-1)!;
  return [new Date(l.bottom * 1000).toISOString().slice(0, 10), last.day, last.roi];
});

describe('ROI', () => {
  it('is close / bottom close, counted in days from the bottom', () => {
    const [, second] = cycleLines(days, cycles, opts);
    const b = dayOf('2020-03-01');
    expect(second.points.slice(0, 3)).toEqual([
      { day: 0, roi: 1 }, { day: 1, roi: (b + 2) / (b + 1) }, { day: 2, roi: (b + 3) / (b + 1) },
    ]);
    expect(second.year).toBe(2020);
  });

  it('of the current cycle is the last close over the latest bottom close', () => {
    expect(currentRoi(days, cycles)).toBe(400 / (dayOf('2020-06-01') + 1));
  });
});

describe('data length', () => {
  it('to next bottom ends on the next bottom; the current cycle runs to the last candle', () => {
    expect(ends({ length: 'bottom' })).toEqual([
      ['2020-01-01', dayOf('2020-03-01'), dayOf('2020-03-01') + 1],
      ['2020-03-01', dayOf('2020-06-01') - dayOf('2020-03-01'), (dayOf('2020-06-01') + 1) / (dayOf('2020-03-01') + 1)],
      ['2020-06-01', 399 - dayOf('2020-06-01'), 400 / (dayOf('2020-06-01') + 1)],
    ]);
  });

  it('to peak ends on the peak, the first or the second one', () => {
    expect(ends({ length: 'peak' }).map((e) => e[1])).toEqual([31, 31, 30]);
    expect(ends({ length: 'peak', secondPeak: true }).map((e) => e[1])).toEqual([31, 61, 30]); // only where there is one
  });

  it('3 months out ends 3 calendar months after the peak', () => {
    const lastDays = ends({ length: '3m' }).map((e) => e[1]);
    expect(lastDays).toEqual([
      dayOf('2020-05-01'), dayOf('2020-07-01') - dayOf('2020-03-01'), dayOf('2020-10-01') - dayOf('2020-06-01'),
    ]);
  });

  it('combining makes one cycle from the first bottom to the second peak', () => {
    const b = dayOf('2020-06-01');
    expect(ends({ combine: true, length: 'peak' })).toEqual([
      ['2020-01-01', dayOf('2020-04-01'), dayOf('2020-04-01') + 1], ['2020-06-01', 30, (b + 31) / (b + 1)],
    ]);
    expect(ends({ combine: true, length: 'bottom' })[0][1]).toBe(b);
  });
});

it('cycle dates run bottom < peak < second peak < next bottom', () => {
  for (const list of Object.values(CYCLES)) {
    const dates = list.flatMap((c: Cycle) => [c.bottom, c.peak, ...(c.secondPeak ? [c.secondPeak] : [])]);
    expect(dates).toEqual([...dates].sort());
  }
});

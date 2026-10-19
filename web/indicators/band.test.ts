import { expect, it } from 'vitest';
import { band } from './band.ts';

const DAY = 86400;
const MONDAY = 4 * DAY; // 1970-01-05
const day = (t: number, close: number) => ({ time: t, open: close, high: close, low: close, close });

it('is the 20-week SMA and 21-week EMA of weekly closes', () => {
  // One bar a week, closing at 1, 2, 3 .. 25.
  const weeks = Array.from({ length: 25 }, (_, i) => day(MONDAY + i * 7 * DAY, i + 1));
  const { sma, ema } = band(weeks);
  expect(sma.map((p) => p.value)).toEqual([10.5, 11.5, 12.5, 13.5, 14.5, 15.5]); // weeks 20-25
  expect(sma[0].time).toBe(weeks[19].time);
  // Starts at the average of weeks 1-21 (11), then each week moves 2/22 of the way to the new close.
  expect(ema[0]).toEqual({ time: weeks[20].time, value: 11 });
  expect(ema[1].value).toBeCloseTo(11 + (22 - 11) / 11);
});

it('takes each day as it was: earlier weeks plus that day as its week close', () => {
  // 19 weeks closing at 1, then a week of days closing 21, 41 (Mon, Tue), then next Monday at 1.
  const weeks = Array.from({ length: 19 }, (_, i) => day(MONDAY + i * 7 * DAY, 1));
  const week20 = MONDAY + 19 * 7 * DAY;
  const { sma } = band([...weeks, day(week20, 21), day(week20 + DAY, 41), day(week20 + 7 * DAY, 1)]);
  expect(sma).toEqual([
    { time: week20, value: 2 }, // (19 + 21) / 20
    { time: week20 + DAY, value: 3 }, // (19 + 41) / 20: Tuesday's close is the week's so far
    { time: week20 + 7 * DAY, value: 3 }, // (18 + 41 + 1) / 20: week 20 closed at 41
  ]);
});

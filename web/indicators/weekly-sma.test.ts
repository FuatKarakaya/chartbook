import { expect, it } from 'vitest';
import { onBars, sma } from './weekly-sma.ts';

const W = 7 * 86400;
const week = (i: number, close: number) => ({ time: i * W, open: close, high: close, low: close, close });

it('averages the last N weekly closes', () => {
  const weeks = [1, 2, 3, 4, 10].map((c, i) => week(i, c));
  expect(sma(weeks, 3)).toEqual([
    { time: 2 * W, value: 2 }, { time: 3 * W, value: 3 }, { time: 4 * W, value: 17 / 3 },
  ]);
  expect(sma(weeks, 6)).toEqual([]);
});

it('steps the weekly value across smaller bars', () => {
  const line = [{ time: W, value: 5 }, { time: 2 * W, value: 6 }];
  const days = [0, 7, 8, 14, 15].map((d) => week(d / 7, 1)); // daily bars at day 0, 7, 8, 14, 15
  expect(onBars(line, days)).toEqual([
    { time: 7 * 86400, value: 5 }, { time: 8 * 86400, value: 5 },
    { time: 14 * 86400, value: 6 }, { time: 15 * 86400, value: 6 },
  ]);
});

it('gives a monthly bar the last week that started inside it', () => {
  const line = [0, 1, 2, 3, 4, 5].map((i) => ({ time: i * W, value: i }));
  const months = [week(0, 1), { ...week(0, 1), time: 4 * W + 86400 }];
  expect(onBars(line, months)).toEqual([{ time: 0, value: 4 }, { time: 4 * W + 86400, value: 5 }]);
});

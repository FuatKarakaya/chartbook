import { describe, expect, it } from 'vitest';
import { onBars, sma } from './sma.ts';

const W = 7 * 86400;
const week = (i: number, close: number) => ({ time: i * W, open: close, high: close, low: close, close });

it('averages the last N closes', () => {
  const weeks = [1, 2, 3, 4, 10].map((c, i) => week(i, c));
  expect(sma(weeks, 3)).toEqual([
    { time: 2 * W, value: 2 }, { time: 3 * W, value: 3 }, { time: 4 * W, value: 17 / 3 },
  ]);
  expect(sma(weeks, 6)).toEqual([]);
});

it('steps the value across smaller bars', () => {
  const line = [{ time: W, value: 5 }, { time: 2 * W, value: 6 }];
  const days = [0, 7, 8, 14, 15].map((d) => week(d / 7, 1)); // daily bars at day 0, 7, 8, 14, 15
  expect(onBars(line, days)).toEqual([
    { time: 7 * 86400, value: 5 }, { time: 8 * 86400, value: 5 },
    { time: 14 * 86400, value: 6 }, { time: 15 * 86400, value: 6 },
  ]);
});

it('gives a bigger bar the value of the last point that started inside it', () => {
  const line = [0, 1, 2, 3, 4, 5].map((i) => ({ time: i * W, value: i }));
  const months = [week(0, 1), { ...week(0, 1), time: 4 * W + 86400 }];
  expect(onBars(line, months)).toEqual([{ time: 0, value: 4 }, { time: 4 * W + 86400, value: 5 }]);
});

describe('on 1h/4h with glide', () => {
  const H = 6 * 3600; // 4 bars a day
  const day = (d: number, close: number) => ({ time: d * 86400, open: close, high: close, low: close, close });
  const days = [day(0, 10), day(1, 20), day(2, 30)];
  const line = sma(days, 2); // day 1: 15, day 2: 25
  const bar = (d: number, k: number, close: number) => ({ ...day(d, close), time: d * 86400 + k * H });

  it('moves from the day before\'s value to the day\'s over its bars, each bar\'s close standing in for the day\'s', () => {
    const bars = [22, 24, 28, 30].map((c, k) => bar(2, k, c));
    // A 2-day window sliding 6 hours a bar: a quarter of day 2 (22), day 1 (20), three quarters of day 0 (10).
    expect(onBars(line, bars, { days, perClose: 1 / 2 }).map((p) => p.value)).toEqual([16.5, 18.5, 21.75, 25]);
  });

  it('counts the day still going on as long as the day before', () => {
    const bars = [...[12, 14, 16, 20].map((c, k) => bar(1, k, c)), ...[22, 24].map((c, k) => bar(2, k, c))];
    expect(onBars(line, bars, { days, perClose: 1 / 2 }).slice(4).map((p) => p.value)).toEqual([16.5, 18.5]);
  });

  it('holds the first day\'s value, with no day before it to move from', () => {
    const upToDay1 = days.slice(0, 2);
    const bars = [12, 20].map((c, k) => bar(1, k, c));
    expect(onBars(sma(upToDay1, 2), bars, { days: upToDay1, perClose: 1 / 2 }).map((p) => p.value)).toEqual([15, 15]);
  });
});

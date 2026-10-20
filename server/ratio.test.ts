import { expect, it } from 'vitest';
import { ratio } from './ratio.ts';

const bar = (time: number, open: number, high: number, low: number, close: number) => ({ time, open, high, low, close });

it('divides each price by the other asset bar at the same time', () => {
  expect(ratio([bar(1, 10, 12, 8, 11)], [bar(1, 2, 2, 2, 2)])).toEqual([bar(1, 5, 6, 4, 5.5)]);
});

it('widens high and low to cover open and close', () => {
  // high/high and low/low are both 1, but the ratio opened at 2 and closed at 1.
  expect(ratio([bar(1, 20, 30, 20, 30)], [bar(1, 10, 30, 20, 30)])).toEqual([bar(1, 2, 2, 1, 1)]);
});

it('holds the other asset at its last close where it has no bar, and starts with its history', () => {
  const btc = [bar(0, 4, 4, 4, 4), bar(1, 10, 12, 8, 11), bar(2, 11, 14, 11, 12), bar(3, 12, 12, 9, 9)];
  const spx = [bar(1, 1, 3, 1, 2)]; // only trades on day 1
  expect(ratio(btc, spx)).toEqual([bar(1, 10, 10, 4, 5.5), bar(2, 5.5, 7, 5.5, 6), bar(3, 6, 6, 4.5, 4.5)]);
});

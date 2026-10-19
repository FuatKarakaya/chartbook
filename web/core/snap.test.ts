import { expect, it } from 'vitest';
import { snapToCandle } from './snap.ts';

const bars = [
  { time: 0, open: 10, high: 14, low: 8, close: 12 },
  { time: 86400, open: 12, high: 20, low: 11, close: 18 },
];
const toY = (price: number) => 100 - price; // higher price = higher up

it('picks the nearest of open, high, low and close of the bar under the mouse', () => {
  expect(snapToCandle(bars, 0.2, 100 - 13.5, toY)).toEqual({ time: 0, price: 14 });
  expect(snapToCandle(bars, 0.2, 100 - 7, toY)).toEqual({ time: 0, price: 8 });
  expect(snapToCandle(bars, 0.6, 100 - 17, toY)).toEqual({ time: 86400, price: 18 });
});

it('keeps to the bars when the mouse is in the empty space either side', () => {
  expect(snapToCandle(bars, 9, 100 - 30, toY)).toEqual({ time: 86400, price: 20 });
  expect(snapToCandle(bars, -3, 100, toY)).toEqual({ time: 0, price: 8 });
});

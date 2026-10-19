import { expect, it } from 'vitest';
import { aggregate, bucket } from './time.ts';

const utc = (s: string) => Date.parse(`${s}Z`) / 1000;
const bar = (time: number, open: number, high: number, low: number, close: number) => ({ time, open, high, low, close });

it('4h blocks start at 00:00 UTC', () => {
  expect(bucket['4h'](utc('2024-03-05T00:00:00'))).toBe(utc('2024-03-05T00:00:00'));
  expect(bucket['4h'](utc('2024-03-05T03:59:59'))).toBe(utc('2024-03-05T00:00:00'));
  expect(bucket['4h'](utc('2024-03-05T22:00:00'))).toBe(utc('2024-03-05T20:00:00'));
});

it('weeks start on Monday', () => {
  // 2024-03-04 was a Monday.
  expect(bucket['1W'](utc('2024-03-04T00:00:00'))).toBe(utc('2024-03-04T00:00:00'));
  expect(bucket['1W'](utc('2024-03-10T23:00:00'))).toBe(utc('2024-03-04T00:00:00'));
  expect(bucket['1W'](utc('2024-03-11T00:00:00'))).toBe(utc('2024-03-11T00:00:00'));
  // Before 1970 too (S&P history starts 1927).
  expect(bucket['1W'](utc('1929-10-29T00:00:00'))).toBe(utc('1929-10-28T00:00:00'));
});

it('months start on the 1st', () => {
  expect(bucket['1M'](utc('2024-02-29T00:00:00'))).toBe(utc('2024-02-01T00:00:00'));
  expect(bucket['1M'](utc('1929-10-29T00:00:00'))).toBe(utc('1929-10-01T00:00:00'));
});

it('aggregates open, high, low, close', () => {
  const h = 3600;
  const hours = [bar(0, 10, 12, 9, 11), bar(h, 11, 15, 10, 14), bar(3 * h, 14, 14, 8, 9), bar(4 * h, 9, 10, 9, 10)];
  expect(aggregate(hours, bucket['4h'])).toEqual([bar(0, 10, 15, 8, 9), bar(4 * h, 9, 10, 9, 10)]);
  expect(hours[0]).toEqual(bar(0, 10, 12, 9, 11)); // input left untouched
});

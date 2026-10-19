import { expect, it } from 'vitest';
import { activeContract, stitch } from './silver.ts';

it('picks the most traded contract, moving on near the end of the month before delivery', () => {
  const at = (iso: string) => activeContract(new Date(iso));
  expect(at('2026-10-19')).toBe('SIZ26.CMX');
  expect(at('2026-11-24')).toBe('SIZ26.CMX');
  expect(at('2026-11-25')).toBe('SIH27.CMX');
  expect(at('2026-12-31')).toBe('SIH27.CMX');
  expect(at('2027-02-10')).toBe('SIH27.CMX');
  expect(at('2027-02-25')).toBe('SIK27.CMX');
});

const D = 86400;
const bar = (day: number, close: number) => ({ time: day * D, open: close, high: close, low: close, close });

it('adds today from futures, scaled to spot on the last day both have', () => {
  const spot = [bar(1, 50), bar(2, 40), bar(3, 41)]; // day 3 is today and not over yet
  const futures = [bar(2, 40.4), bar(3, 41.41)];
  const out = stitch(spot, futures, '1D', 3.5 * D);
  expect(out.slice(0, 2)).toEqual([bar(1, 50), bar(2, 40)]);
  expect(out[2].time).toBe(3 * D);
  expect(out[2].close).toBeCloseTo(41);
});

it('keeps spot only when futures have no bar to compare with', () => {
  expect(stitch([bar(1, 50)], [bar(2, 51)], '1h', 9 * D)).toEqual([bar(1, 50)]);
});

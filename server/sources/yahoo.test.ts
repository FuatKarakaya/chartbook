import { expect, it } from 'vitest';
import { toCandles } from './yahoo.ts';

const q = (iso: string, close: number | null) => ({ date: new Date(iso), open: close, high: close, low: close, close });

it('floors daily bars to UTC midnight, drops empty bars, keeps the later of two bars in one slot', () => {
  const out = toCandles([
    q('1927-12-30T14:30:00Z', 17.66),
    q('1928-01-03T14:30:00Z', null),
    q('2026-10-16T04:00:00Z', 4100),
    q('2026-10-16T22:05:54Z', 4181),
  ], 86400);
  expect(out.map((c) => [new Date(c.time * 1000).toISOString(), c.close])).toEqual([
    ['1927-12-30T00:00:00.000Z', 17.66],
    ['2026-10-16T00:00:00.000Z', 4181],
  ]);
});

it('floors hourly bars to the hour', () => {
  expect(toCandles([q('2026-10-16T13:30:00Z', 1)], 3600)[0].time).toBe(Date.parse('2026-10-16T13:00:00Z') / 1000);
});

it('widens high/low to cover a settlement close outside the range', () => {
  const [c] = toCandles([{ date: new Date(0), open: 1650, high: 1650, low: 1650, close: 1616 }], 86400);
  expect(c).toEqual({ time: 0, open: 1650, high: 1650, low: 1616, close: 1616 });
});

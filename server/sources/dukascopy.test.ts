import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { aggregate } from '../../shared/time.ts';
import { dayOf, parse } from './dukascopy.ts';

const Y2025 = Date.UTC(2025, 0, 1) / 1000;
const days = parse(readFileSync(new URL('./fixtures/XAGUSD-2025-day.bi5', import.meta.url)), Y2025);
const iso = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

it('decodes a year of silver days, without the no-trade weekend days', () => {
  expect(days[1]).toEqual({ time: Y2025 + 86400, open: 28.975, high: 29.59, low: 28.95, close: 29.523 });
  expect(days.find((d) => iso(d.time) === '2025-01-04')).toBeUndefined(); // Saturday
  expect(days.at(-1)).toMatchObject({ open: 75.2, close: 71.537 });
  expect(days.length).toBeGreaterThan(300);
});

it('counts the Sunday evening session towards Monday', () => {
  const merged = aggregate(days, dayOf);
  expect(merged.some((d) => new Date(d.time * 1000).getUTCDay() === 0)).toBe(false);
  const sunday = days.find((d) => iso(d.time) === '2025-12-28')!;
  const monday = merged.find((d) => iso(d.time) === '2025-12-29')!;
  expect(monday.open).toBe(sunday.open);
  expect(monday.high).toBeGreaterThanOrEqual(sunday.high);
});

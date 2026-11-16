import { expect, it } from 'vitest';
import type { Candle } from '../../shared/types.ts';
import type { Fractal } from '../../shared/fractal.ts';
import type { View } from './tool.ts';
import { fractalProjection } from './fractal.ts';
import { timeline } from './timeline.ts';

const D = 86400;
const bars = (days: number[]): Candle[] => days.map((d, i) => ({ time: d * D, open: 10 + i, high: 12 + i, low: 9 + i, close: 11 + i }));
const daily = bars([0, 1, 2, 3, 4, 7, 8, 9, 10, 11, 14, 15, 16]);
const f: Fractal = { id: 'f', type: 'fractal', sourceAsset: 'silver', sourceInterval: '1D',
  srcStart: 0, srcEnd: 7 * D, anchorTime: 7 * D, anchorPrice: 40, timeScale: 1, moveScale: 1, flip: false,
  style: { color: '#fff', opacity: 0.6 } };
const view = (target = daily, source = daily): View => ({ width: 1000, height: 500, asset: 'gold', interval: '1D',
  bars: target, x: (t) => t, y: (p) => p, candles: (a) => a === 'silver' ? source : target });

it('keeps one candle per trading slot when dragged across a weekend and into the future', () => {
  const axis = timeline(daily.map(c => c.time));
  for (const anchorTime of [3 * D, 7 * D, 15 * D, 22 * D]) {
    const copy = fractalProjection({ ...f, anchorTime }, view()).copy;
    copy.forEach((c, i) => expect(axis.toLogical(c.time) - axis.toLogical(anchorTime)).toBeCloseTo(i));
    expect(copy[0].close).toBe(40);
  }
});

it('scales in trading slots, including fractional scales and missing weeks', () => {
  const weeks = bars([0, 7, 14, 28, 35, 42]);
  const axis = timeline(weeks.map(c => c.time));
  const copy = fractalProjection({ ...f, sourceInterval: '1W', srcEnd: 35 * D, timeScale: 1.5 }, view(weeks, weeks)).copy;
  copy.forEach((c, i) => expect(axis.toLogical(c.time) - axis.toLogical(f.anchorTime)).toBeCloseTo(i * 1.5));
});

it('keeps a saved daily fractal identical when viewing the weekly chart', () => {
  const v = view();
  expect(fractalProjection(f, { ...v, interval: '1W', bars: bars([0, 7, 14]) }).copy)
    .toEqual(fractalProjection(f, v).copy);
});

it('waits for data and falls back to daily for source history older than hourly coverage', () => {
  expect(fractalProjection(f, { ...view(), candles: () => undefined }).copy).toEqual([]);
  const hourly = { ...f, sourceInterval: '1h' as const };
  const v = { ...view(), candles: (_a: string, interval: string) => interval === '1h' ? bars([100, 101]) : daily };
  expect(fractalProjection(hourly, v).copy).toEqual(fractalProjection(f, view()).copy);
});

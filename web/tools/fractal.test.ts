import { expect, it } from 'vitest';
import { fractal } from './fractal.ts';
import { fractalProjection } from '../core/fractal.ts';
import { timeline } from '../core/timeline.ts';
import type { View } from '../core/tool.ts';
import type { Fractal } from '../../shared/fractal.ts';

const D = 86400;
const bars = [0, 1, 2, 3, 4, 7, 8, 9, 10, 11, 14, 15].map((d, i) => ({ time: d * D, open: 10 + i, high: 12 + i, low: 9 + i, close: 11 + i }));
const view: View = { bars, asset: 'silver', interval: '1D', width: 1000, height: 500, x: t => t, y: p => p, candles: () => bars };
const legacy = (): Fractal => ({ id: 'old', type: 'fractal', sourceAsset: 'silver', srcStart: 0, srcEnd: 7 * D,
  anchorTime: 7 * D, anchorPrice: 40, timeScale: 1, moveScale: 1, flip: false, style: { color: '#fff', opacity: 0.6 } });

it('edits old saved drawings in bar slots and freezes their source timeframe', () => {
  const f = legacy();
  const handles = fractal.handles!(f, view);
  const axis = timeline(bars.map(c => c.time));
  handles[1].time = axis.toTime(axis.toLogical(f.anchorTime) + 10);
  fractal.place!(f, handles, 1, view);
  expect(f.sourceInterval).toBe('1D');
  expect(f.timeScale).toBe(2);
  const copy = fractalProjection(f, view).copy;
  expect(fractalProjection(f, { ...view, interval: '1W' }).copy).toEqual(copy);
  // The move handle may cross the anchor and flip the price path.
  const scaled = fractal.handles!(f, view);
  scaled[2].price = 20;
  fractal.place!(f, scaled, 2, view);
  expect(f.flip).toBe(true);
  expect(fractalProjection(f, view).copy.at(-1)!.close).toBeCloseTo(20, 1);
});
it('keeps source timeframe and OHLC when copied to another asset with different trading days', () => {
  const f = { ...legacy(), sourceInterval: '1D' as const, sourceAsset: 'btc' as const };
  const target = bars.filter((_, i) => i % 3 !== 0);
  const v = { ...view, bars: target, candles: (a: string) => a === 'btc' ? bars : target };
  const copy = fractalProjection(f, v).copy;
  const axis = timeline(target.map(c => c.time));
  copy.forEach((c, i) => expect(axis.toLogical(c.time) - axis.toLogical(f.anchorTime)).toBeCloseTo(i));
  expect(copy[0].close).toBe(40);
});

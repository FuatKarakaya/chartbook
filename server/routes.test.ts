import { expect, it } from 'vitest';
import { api } from './routes.ts';
import type { Candle } from '../shared/types.ts';

it('serves BTC 1D sample candles, ascending and well-formed', async () => {
  const res = await api.request('/candles?asset=btc&interval=1D');
  expect(res.status).toBe(200);
  const candles: Candle[] = await res.json();
  expect(candles.length).toBeGreaterThan(700);
  candles.forEach((c, i) => {
    if (i > 0) expect(c.time).toBeGreaterThan(candles[i - 1].time);
    expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
    expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
  });
});

it('404s for data not in the sample', async () => {
  expect((await api.request('/candles?asset=gold&interval=1D')).status).toBe(404);
});

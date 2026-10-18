import { expect, it } from 'vitest';
import { openDb } from './db.ts';
import { api } from './routes.ts';
import type { Candle } from '../shared/types.ts';

const bar = (time: number, close: number): Candle => ({ time, open: close, high: close, low: close, close });

it('serves stored candles in time order', async () => {
  const db = openDb(':memory:');
  db.save('gold', '1h', [bar(7200, 2), bar(3600, 1)]);
  const res = await api(db).request('/candles?asset=gold&interval=1h');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual([bar(3600, 1), bar(7200, 2)]);
});

it('404s for unknown assets and not-yet-built intervals', async () => {
  const app = api(openDb(':memory:'));
  expect((await app.request('/candles?asset=doge&interval=1D')).status).toBe(404);
  expect((await app.request('/candles?asset=btc&interval=4h')).status).toBe(404);
});

it('save replaces the tail so a moved live bar does not linger', () => {
  const db = openDb(':memory:');
  db.save('btc', '1D', [bar(0, 1), bar(86400, 2), bar(100000, 3)]);
  db.save('btc', '1D', [bar(86400, 2.5), bar(172800, 4)]);
  expect(db.candles('btc', '1D')).toEqual([bar(0, 1), bar(86400, 2.5), bar(172800, 4)]);
  expect(db.lastTime('btc', '1D')).toBe(172800);
  expect(db.lastTime('spx', '1D')).toBeNull();
});

it('remembers which data version the history was downloaded with', () => {
  const db = openDb(':memory:');
  expect(db.dataVersion()).toBe(0);
  db.setDataVersion(1);
  expect(db.dataVersion()).toBe(1);
});

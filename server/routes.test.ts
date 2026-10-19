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

it('404s for unknown assets and intervals', async () => {
  const app = api(openDb(':memory:'));
  expect((await app.request('/candles?asset=doge&interval=1D')).status).toBe(404);
  expect((await app.request('/candles?asset=btc&interval=5m')).status).toBe(404);
});

it('builds 4h from stored 1h and weeks from stored days', async () => {
  const db = openDb(':memory:');
  db.save('btc', '1h', [bar(0, 1), bar(3600, 3), bar(14400, 2)]);
  db.save('btc', '1D', [bar(4 * 86400, 5), bar(5 * 86400, 6)]); // Mon 1970-01-05, Tue
  const app = api(db);
  expect(await (await app.request('/candles?asset=btc&interval=4h')).json()).toEqual([
    { time: 0, open: 1, high: 3, low: 1, close: 3 }, bar(14400, 2),
  ]);
  expect(await (await app.request('/candles?asset=btc&interval=1W')).json()).toEqual([
    { time: 4 * 86400, open: 5, high: 6, low: 5, close: 6 },
  ]);
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

it('saves drawings per asset, replacing the whole list', async () => {
  const app = api(openDb(':memory:'));
  const line = { id: 'a', type: 'trend', points: [{ time: 0, price: 1 }, { time: 86400, price: 2 }] };
  const hline = { id: 'b', type: 'horizontal', points: [{ time: 0, price: 3 }] };
  const put = (asset: string, body: unknown) =>
    app.request(`/drawings?asset=${asset}`, { method: 'PUT', body: JSON.stringify(body) });
  expect((await put('btc', [line, hline])).status).toBe(204);
  const gold = { ...hline, id: 'c' };
  await put('gold', [gold]);
  expect(await (await app.request('/drawings?asset=btc')).json()).toEqual([line, hline]);
  await put('btc', [hline]);
  expect(await (await app.request('/drawings?asset=btc')).json()).toEqual([hline]);
  expect(await (await app.request('/drawings?asset=gold')).json()).toEqual([gold]);
  expect((await put('doge', [])).status).toBe(404);
});

it('a full re-download replaces older stored candles too', () => {
  const db = openDb(':memory:');
  db.save('silver', '1D', [bar(0, 1), bar(86400, 2)]);
  db.save('silver', '1D', [bar(172800, 3)], -2e9);
  expect(db.candles('silver', '1D')).toEqual([bar(172800, 3)]);
});

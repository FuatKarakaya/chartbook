import { Hono } from 'hono';
import sample from './sample/btc-1d.json' with { type: 'json' };
import type { Candle } from '../shared/types.ts';

// M0: serves one sample file (2y of BTC daily). M1 replaces this with SQLite.
export const api = new Hono().get('/candles', (c) => {
  const { asset, interval } = c.req.query();
  if (asset !== 'btc' || interval !== '1D') return c.json({ error: 'sample has btc 1D only' }, 404);
  return c.json(sample as Candle[]);
});

import { Hono } from 'hono';
import type { Asset } from '../shared/types.ts';
import type { Db } from './db.ts';
import { ASSETS, failing, STORED, type Stored } from './updater.ts';

export function api(db: Db) {
  return new Hono()
    .get('/candles', (c) => {
      const { asset, interval } = c.req.query();
      // 4h/1W/1M are built from 1h/1D in M2.
      if (!ASSETS.includes(asset as Asset) || !STORED.includes(interval as Stored)) {
        return c.json({ error: `unknown asset/interval: ${asset} ${interval}` }, 404);
      }
      return c.json(db.candles(asset as Asset, interval as Stored));
    })
    .get('/status', (c) => c.json({ failing: [...failing] }));
}

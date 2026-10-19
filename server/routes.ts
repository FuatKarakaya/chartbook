import { Hono } from 'hono';
import { aggregate, bucket } from '../shared/time.ts';
import type { Asset, Interval } from '../shared/types.ts';
import type { Db } from './db.ts';
import { ASSETS, failing } from './updater.ts';

/** Which stored series each timeframe is built from (4h from 1h, 1W/1M from 1D). */
const BASE: Record<Interval, '1h' | '1D'> = { '1h': '1h', '4h': '1h', '1D': '1D', '1W': '1D', '1M': '1D' };

export function api(db: Db) {
  return new Hono()
    .get('/candles', (c) => {
      const { asset, interval } = c.req.query() as { asset: Asset; interval: Interval };
      if (!ASSETS.includes(asset) || !(interval in BASE)) {
        return c.json({ error: `unknown asset/interval: ${asset} ${interval}` }, 404);
      }
      const stored = db.candles(asset, BASE[interval]);
      return c.json(interval === BASE[interval] ? stored : aggregate(stored, bucket[interval as keyof typeof bucket]));
    })
    .get('/status', (c) => c.json({ failing: [...failing] }));
}

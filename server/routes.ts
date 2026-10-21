import { Hono } from 'hono';
import { aggregate, bucket } from '../shared/time.ts';
import { ASSETS, type Asset, type Interval, type Ticker } from '../shared/types.ts';
import type { Db } from './db.ts';
import { ratio } from './ratio.ts';
import { failing } from './updater.ts';

/** Which stored series each timeframe is built from (4h from 1h, 1W/1M from 1D). */
const BASE: Record<Interval, '1h' | '1D'> = { '1h': '1h', '4h': '1h', '1D': '1D', '1W': '1D', '1M': '1D' };

/** The assets in a ticker ('btc', or 'btc/gold' for a ratio chart), or null if it isn't one. */
function assetsOf(ticker = '') {
  const parts = ticker.split('/') as Asset[];
  return parts.length <= 2 && parts[0] !== parts[1] && parts.every((a) => ASSETS.includes(a)) ? parts : null;
}

export function api(db: Db) {
  return new Hono()
    .get('/candles', (c) => {
      const { asset, interval } = c.req.query() as { asset?: string; interval: Interval };
      const [a, b] = assetsOf(asset) ?? [];
      if (!a || !(interval in BASE)) return c.json({ error: `unknown asset/interval: ${asset} ${interval}` }, 404);
      // A ratio is divided bar by bar on the stored series, then built up like any other (a weekly high is the highest daily one).
      const base = BASE[interval];
      const stored = b ? ratio(db.candles(a, base), db.candles(b, base)) : db.candles(a, base);
      return c.json(interval === base ? stored : aggregate(stored, bucket[interval as keyof typeof bucket]));
    })
    // Drawings are saved per ticker: a ratio chart has its own.
    .get('/drawings', (c) => {
      const ticker = c.req.query('asset');
      if (!assetsOf(ticker)) return c.json({ error: `unknown asset: ${ticker}` }, 404);
      return c.json(db.drawings(ticker as Ticker));
    })
    .put('/drawings', async (c) => {
      const ticker = c.req.query('asset');
      if (!assetsOf(ticker)) return c.json({ error: `unknown asset: ${ticker}` }, 404);
      db.saveDrawings(ticker as Ticker, await c.req.json());
      return c.body(null, 204);
    })
    .get('/status', (c) => c.json({ failing: [...failing] }));
}

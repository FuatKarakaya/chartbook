import type { Asset, Candle } from '../shared/types.ts';
import type { Db } from './db.ts';
import { fetchBitstamp } from './sources/bitstamp.ts';
import { fetchYahoo } from './sources/yahoo.ts';

export type Stored = '1h' | '1D';
export const ASSETS: Asset[] = ['btc', 'gold', 'silver', 'spx'];
export const STORED: Stored[] = ['1h', '1D'];

const DAY = 86400;
const YAHOO: Record<Exclude<Asset, 'btc'>, string> = { gold: 'GC=F', silver: 'SI=F', spx: '^GSPC' };
const BITSTAMP_START = Date.UTC(2011, 7, 18) / 1000;
/** How far back each 5-minute refresh re-fetches, so late corrections overwrite stored bars. */
const REFRESH: Record<Stored, number> = { '1h': 2 * DAY, '1D': 10 * DAY };

/** Candles for one series since `from` (UTC seconds), from the right source per PLAN.md's data table. */
export async function fetchSeries(asset: Asset, interval: Stored, from: number): Promise<Candle[]> {
  if (asset !== 'btc') return fetchYahoo(YAHOO[asset], interval, from);
  if (interval === '1h') return fetchBitstamp('1h', Math.max(from, BITSTAMP_START));
  // BTC daily: Yahoo from Sept 2014, Bitstamp fills the years before.
  const yahoo = await fetchYahoo('BTC-USD', '1D', from);
  const gapEnd = yahoo[0]?.time ?? Infinity;
  if (from >= gapEnd) return yahoo;
  return [...(await fetchBitstamp('1D', Math.max(from, BITSTAMP_START), gapEnd)), ...yahoo];
}

/** Series whose last fetch failed, e.g. "gold 1h". The page shows "data delayed" while this is non-empty. */
export const failing = new Set<string>();

/** Brings one series up to date: full history if empty, else from the last saved candle (or refresh window). */
async function update(db: Db, asset: Asset, interval: Stored, full = false) {
  const name = `${asset} ${interval}`;
  const last = full ? null : db.lastTime(asset, interval);
  const from = last == null ? -2e9 : Math.min(last, Date.now() / 1000 - REFRESH[interval]);
  try {
    const candles = await fetchSeries(asset, interval, from);
    db.save(asset, interval, candles);
    failing.delete(name);
    if (last == null) console.log(`${name}: saved ${candles.length} candles`);
  } catch (err) {
    failing.add(name);
    console.error(`${name}: update failed, serving stored data (${(err as Error).message})`);
  }
}

/** Updates every series once, one at a time to stay polite to the sources. */
export async function updateAll(db: Db, full = false) {
  for (const asset of ASSETS) for (const interval of STORED) await update(db, asset, interval, full);
}

const FIVE_MIN = 5 * 60 * 1000;

/** Catch up now, then refresh every 5 minutes. */
export function startUpdater(db: Db) {
  const loop = () => updateAll(db).finally(() => setTimeout(loop, FIVE_MIN));
  loop();
}

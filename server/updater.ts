import type { Asset, Candle } from '../shared/types.ts';
import type { Db } from './db.ts';
import early from './sources/btc-2010-2011.json' with { type: 'json' };
import { fetchBitstamp } from './sources/bitstamp.ts';
import { fetchYahoo } from './sources/yahoo.ts';

export type Stored = '1h' | '1D';
export const ASSETS: Asset[] = ['btc', 'gold', 'silver', 'spx'];
const STORED: Stored[] = ['1h', '1D'];

const DAY = 86400;
const YAHOO: Record<Exclude<Asset, 'btc'>, string> = { gold: 'GC=F', silver: 'SI=F', spx: '^GSPC' };
const BITSTAMP_START = Date.UTC(2011, 7, 18) / 1000;
/** Bitstamp's 2011 daily bars are too thin (many days without a trade); the saved file covers BTC before this. */
const BITSTAMP_DAILY_START = Date.UTC(2012, 0, 1) / 1000;
/** Bump when a source change means stored history must be re-downloaded once (1: BTC daily back to 2010). */
const DATA_VERSION = 1;
/** How far back each 5-minute refresh re-fetches, so late corrections overwrite stored bars. */
const REFRESH: Record<Stored, number> = { '1h': 2 * DAY, '1D': 10 * DAY };

/** Candles for one series since `from` (UTC seconds), from the right source per PLAN.md's data table. */
export async function fetchSeries(asset: Asset, interval: Stored, from: number): Promise<Candle[]> {
  if (asset !== 'btc') return fetchYahoo(YAHOO[asset], interval, from);
  if (interval === '1h') return fetchBitstamp('1h', Math.max(from, BITSTAMP_START));
  // BTC daily: Yahoo from Sept 2014, Bitstamp for 2012-2014, the saved 2010-2011 file before that.
  const yahoo = await fetchYahoo('BTC-USD', '1D', from);
  const gapEnd = yahoo[0]?.time ?? Infinity;
  if (from >= gapEnd) return yahoo;
  const bitstamp = await fetchBitstamp('1D', Math.max(from, BITSTAMP_DAILY_START), gapEnd);
  return [...(early as Candle[]).filter((c) => c.time >= from), ...bitstamp, ...yahoo];
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

/** Updates every series once, one at a time to stay polite to the sources. Full re-download if DATA_VERSION rose. */
export async function updateAll(db: Db, full = db.dataVersion() < DATA_VERSION) {
  for (const asset of ASSETS) for (const interval of STORED) await update(db, asset, interval, full);
  if (full && failing.size === 0) db.setDataVersion(DATA_VERSION);
}

const FIVE_MIN = 5 * 60 * 1000;

/** Catch up now, then refresh every 5 minutes. */
export function startUpdater(db: Db) {
  const loop = () => updateAll(db).finally(() => setTimeout(loop, FIVE_MIN));
  loop();
}

import { ASSET_NAMES, DAILY_ONLY, type Asset, type Candle } from '../shared/types.ts';
import type { Db } from './db.ts';
import early from './sources/btc-2010-2011.json' with { type: 'json' };
import { fetchBitstamp } from './sources/bitstamp.ts';
import { fetchFred } from './sources/fred.ts';
import { fetchSilver } from './sources/silver.ts';
import { fetchYahoo } from './sources/yahoo.ts';

export type Stored = '1h' | '1D';
export const ASSETS = Object.keys(ASSET_NAMES) as Asset[];
const stored = (asset: Asset): Stored[] => (DAILY_ONLY.includes(asset) ? ['1D'] : ['1h', '1D']);

const DAY = 86400;
const YAHOO = { gold: 'GC=F', spx: '^GSPC', ixic: '^IXIC', dxy: 'DX-Y.NYB', tnx: '^TNX' };
const FRED = { fed: 'DFF', m2: 'M2SL' };
/** Where Bitstamp's history is used from. BTC daily only from 2012: its 2011 days are too thin, the saved file covers them. */
const BITSTAMP: Record<'btc' | 'eth', Record<Stored, number>> = {
  btc: { '1h': Date.UTC(2011, 7, 18) / 1000, '1D': Date.UTC(2012, 0, 1) / 1000 },
  eth: { '1h': Date.UTC(2017, 7, 17) / 1000, '1D': Date.UTC(2017, 7, 17) / 1000 },
};
/** Bump when a source change means stored history must be re-downloaded once (1: BTC daily back to 2010, 2: S&P hourly closing print + silver from Dukascopy). */
const DATA_VERSION = 2;
/** How far back each refresh re-fetches, so late corrections overwrite stored bars. FRED revises past months (M2), so a year. */
const REFRESH = { '1h': 2 * DAY, '1D': 10 * DAY, fred: 365 * DAY };

/** Candles for one series since `from` (UTC seconds), from the right source per PLAN.md's data table. */
export async function fetchSeries(asset: Asset, interval: Stored, from: number): Promise<Candle[]> {
  if (asset === 'silver') return fetchSilver(interval, from);
  if (asset === 'fed' || asset === 'm2') return fetchFred(FRED[asset], from);
  // The yield is one value per bar like FRED's series (LINE_ONLY): its close.
  if (asset === 'tnx') return (await fetchYahoo(YAHOO.tnx, interval, from)).map((c) => ({ ...c, open: c.close, high: c.close, low: c.close }));
  if (asset !== 'btc' && asset !== 'eth') return fetchYahoo(YAHOO[asset], interval, from);
  const pair = `${asset}usd`;
  const start = BITSTAMP[asset][interval];
  if (interval === '1h') return fetchBitstamp(pair, '1h', Math.max(from, start));
  // Daily: Yahoo (BTC from Sept 2014, ETH from Nov 2017), Bitstamp before that, and for BTC the saved 2010-2011 file.
  const yahoo = await fetchYahoo(`${asset.toUpperCase()}-USD`, '1D', from);
  const gapEnd = yahoo[0]?.time ?? Infinity;
  if (from >= gapEnd) return yahoo;
  const bitstamp = await fetchBitstamp(pair, '1D', Math.max(from, start), gapEnd);
  const saved = asset === 'btc' ? (early as Candle[]).filter((c) => c.time >= from) : [];
  return [...saved, ...bitstamp, ...yahoo];
}

/** Series whose last fetch failed, e.g. "gold 1h". The page shows "data delayed" while this is non-empty. */
export const failing = new Set<string>();

/**
 * Brings one series up to date: full history if empty or `full` (replacing what is stored), else from the last
 * saved candle (or refresh window). Returns whether it worked.
 */
async function update(db: Db, asset: Asset, interval: Stored, full: boolean) {
  const name = `${asset} ${interval}`;
  const last = full ? null : db.lastTime(asset, interval);
  const from = last == null ? -2e9 : Math.min(last, Date.now() / 1000 - REFRESH[asset in FRED ? 'fred' : interval]);
  try {
    const candles = await fetchSeries(asset, interval, from);
    db.save(asset, interval, candles, full ? from : undefined);
    failing.delete(name);
    if (last == null) console.log(`${name}: saved ${candles.length} candles`);
    return true;
  } catch (err) {
    failing.add(name);
    console.error(`${name}: update failed, serving stored data (${(err as Error).message})`);
    return false;
  }
}

/** Series still to re-download in full after DATA_VERSION rose; the new version is saved once all are done. */
let redownload: Set<string> | null = null;
/** When a FRED series is next asked for news: it publishes once a day at most, so hourly, not every 5 minutes. */
const due = new Map<string, number>();
const HOUR = 3600 * 1000;

/** Updates every series once, one at a time to stay polite to the sources. `full` re-downloads everything. */
export async function updateAll(db: Db, full = false) {
  if (full || db.dataVersion() < DATA_VERSION) redownload ??= new Set(ASSETS.flatMap((a) => stored(a).map((i) => `${a} ${i}`)));
  for (const asset of ASSETS) {
    for (const interval of stored(asset)) {
      const name = `${asset} ${interval}`;
      const again = !!redownload?.has(name);
      if (!again && Date.now() < (due.get(name) ?? 0)) continue;
      if (!(await update(db, asset, interval, again))) continue;
      redownload?.delete(name);
      if (asset in FRED) due.set(name, Date.now() + HOUR);
    }
  }
  if (redownload?.size === 0) {
    db.setDataVersion(DATA_VERSION);
    redownload = null;
  }
}

const FIVE_MIN = 5 * 60 * 1000;

/** Catch up now, then refresh every 5 minutes. */
export function startUpdater(db: Db) {
  const loop = () => updateAll(db).finally(() => setTimeout(loop, FIVE_MIN));
  loop();
}

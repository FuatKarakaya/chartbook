import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { Asset, Candle, Interval } from '../shared/types.ts';

export type Db = ReturnType<typeof openDb>;

export function openDb(path = 'data/chartbook.db') {
  if (path !== ':memory:') mkdirSync('data', { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS candles (
      asset TEXT, interval TEXT, time INTEGER, o REAL, h REAL, l REAL, c REAL,
      PRIMARY KEY (asset, interval, time)
    ) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS drawings (id TEXT PRIMARY KEY, asset TEXT, json TEXT);
  `);
  const insert = db.prepare('INSERT OR REPLACE INTO candles VALUES (?, ?, ?, ?, ?, ?, ?)');
  const deleteFrom = db.prepare('DELETE FROM candles WHERE asset = ? AND interval = ? AND time >= ?');
  const select = db.prepare(
    'SELECT time, o AS open, h AS high, l AS low, c AS close FROM candles WHERE asset = ? AND interval = ? ORDER BY time',
  );
  const last = db.prepare('SELECT MAX(time) AS t FROM candles WHERE asset = ? AND interval = ?');

  return {
    /**
     * Saves candles, first dropping stored ones from the first new candle onwards, so a still-forming bar
     * whose timestamp moved (Yahoo does this) doesn't linger as a duplicate.
     */
    save(asset: Asset, interval: Interval, candles: Candle[]) {
      if (!candles.length) return;
      db.exec('BEGIN');
      deleteFrom.run(asset, interval, candles[0].time);
      for (const k of candles) insert.run(asset, interval, k.time, k.open, k.high, k.low, k.close);
      db.exec('COMMIT');
    },
    candles: (asset: Asset, interval: Interval) => select.all(asset, interval) as unknown as Candle[],
    lastTime: (asset: Asset, interval: Interval) => (last.get(asset, interval) as { t: number | null }).t,
    /** Which DATA_VERSION (updater.ts) the stored history was downloaded with; SQLite's spare user_version slot. */
    dataVersion: () => (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
    setDataVersion: (v: number) => db.exec(`PRAGMA user_version = ${v}`),
  };
}

import { readFileSync } from 'node:fs';
import { openDb } from '../server/db.ts';
import { parseSilverHistory, validateSilverCoverage } from '../server/sources/silver-history.ts';
import { bucket } from '../shared/time.ts';
import { backupDatabase } from './backup-db.ts';

// Stooq exports weeks with their ending date; the parser normalizes to Monday.
const url = 'https://stooq.com/q/d/l/?s=xagusd&i=w&d1=19700101&d2=20011231';
const path = process.argv[2];
try {
  const csv = path ? readFileSync(path, 'utf8') : await (async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Stooq HTTP ${response.status}`);
    return response.text();
  })();
  const history = parseSilverHistory(csv);
  const db = openDb();
  const daily = db.candles('silver', '1D');
  if (!daily.length) throw new Error('Run chartbook once to load modern silver data before importing history.');
  const seam = bucket['1W'](daily[0].time);
  const older = history.filter(c => c.time >= bucket['1W'](0) && c.time < seam);
  validateSilverCoverage(older, seam);
  backupDatabase();
  db.save('silver', '1W', older, -2e9);
  console.log(`Imported ${older.length} weekly OHLC candles: ${new Date(older[0].time * 1000).toISOString().slice(0, 10)} to ${new Date(older.at(-1)!.time * 1000).toISOString().slice(0, 10)}. Refresh Silver / 1W.`);
} catch (error) {
  console.error(`Silver history was not imported: ${(error as Error).message}`);
  console.error('If Stooq limits downloads, export XAGUSD / Weekly at https://stooq.com/q/d/?s=xagusd&i=w and run npm run silver-history -- "path-to-file.csv". Existing candles are kept.');
  process.exitCode = 1;
}

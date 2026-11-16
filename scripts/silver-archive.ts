import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { parseSilverContract, silverArchiveWeeks } from '../server/sources/silver-archive.ts';
import { validateSilverCoverage } from '../server/sources/silver-history.ts';
import { bucket } from '../shared/time.ts';

const folder = process.argv[2];
if (!folder) throw new Error('Usage: npx tsx scripts/silver-archive.ts path-to-extracted-si-archive');
const db = new DatabaseSync('data/chartbook.db', { readOnly: true });
const first = db.prepare("SELECT min(time) AS time FROM candles WHERE asset='silver' AND interval='1D'").get()?.time;
db.close();
if (typeof first !== 'number') throw new Error('Modern silver daily history is required.');
const seam = bucket['1W'](first);
const files = readdirSync(folder).filter(name => /^SI\d{2}[FGHJKMNQUVXZ]\.txt$/i.test(name)).sort();
const inputs = files.map(name => ({ name, text: readFileSync(`${folder}/${name}`, 'utf8') }));
const { candles, audit } = silverArchiveWeeks(inputs.map(f => parseSilverContract(f.name, f.text)), bucket['1W'](0), seam);
validateSilverCoverage(candles, seam);
const output = 'data/imports/silver-futures-weekly.csv';
writeFileSync(output, 'Date,Open,High,Low,Close\n' + candles.map(c =>
  [new Date(c.time * 1000).toISOString().slice(0, 10), c.open, c.high, c.low, c.close].join(',')).join('\n') + '\n');
writeFileSync('data/imports/silver-futures-audit.json', JSON.stringify({
  source: 'https://www.turtletrader.com/cddata/si.zip', retrieved: new Date().toISOString(),
  description: 'COMEX silver futures, one complete contract per week selected by greatest weekly volume, including delivery month; unadjusted USD/troy oz. Modern spot history wins at seam. Not suitable as a roll-adjusted return series.',
  units: 'YYMMDD files: cents/oz divided by 100; MM/DD/YYYY files with quoted header: 0.0001 USD/oz divided by 10000.',
  inputs: inputs.map(f => ({ name: f.name, sha256: createHash('sha256').update(f.text).digest('hex') })),
  csvSha256: createHash('sha256').update(readFileSync(output)).digest('hex'), seam, audit,
}, null, 2));
console.log(JSON.stringify({ output, weeks: candles.length, first: candles[0], last: candles.at(-1),
  max: Math.max(...candles.map(c => c.high)), minDays: Math.min(...audit.map(a => a.days)) }, null, 2));

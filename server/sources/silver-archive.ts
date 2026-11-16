import type { Candle } from '../../shared/types.ts';
import { aggregate, bucket } from '../../shared/time.ts';

interface Trade extends Candle { volume: number }
interface Contract { name: string; bars: Trade[]; expiry: number }
const MONTHS = 'FGHJKMNQUVXZ';

/** TurtleTrader's SI archive has cents/oz in YYMMDD files and 0.0001 USD/oz in the quoted-header files.
 * These are individual COMEX futures contracts, not spot quotes or a back-adjusted continuous series.
 */
export function parseSilverContract(name: string, text: string): Contract {
  const match = /^SI(\d{2})([FGHJKMNQUVXZ])\.txt$/i.exec(name);
  if (!match) throw new Error(`Unknown silver contract: ${name}`);
  const year = +match[1] < 30 ? 2000 + +match[1] : 1900 + +match[1];
  const expiry = Date.UTC(year, MONTHS.indexOf(match[2].toUpperCase()) + 1, 1) / 1000;
  const rows = text.trim().split(/\r?\n/);
  const header = rows[0] === '"Date","Open","High","Low","Close","Volume","OpenInt"';
  if (header) rows.shift();
  const divisor = header ? 10000 : 100;
  const seen = new Set<number>();
  const bars = rows.map(row => {
    const [date, ...cells] = row.split(',');
    if (!(header ? /^\d{2}\/\d{2}\/\d{4}$/ : /^\d{6}$/).test(date)) throw new Error(`Bad date in ${name}: ${date}`);
    const iso = header ? `${date.slice(6)}-${date.slice(0, 2)}-${date.slice(3, 5)}`
      : `${+date.slice(0, 2) < 30 ? '20' : '19'}${date.slice(0, 2)}-${date.slice(2, 4)}-${date.slice(4, 6)}`;
    const time = Date.parse(`${iso}T00:00:00Z`) / 1000;
    const [open, high, low, close] = cells.slice(0, 4).map(v => Number(v) / divisor);
    const volume = Number(cells[4]);
    if (cells.length !== 6 || cells.some(v => !v.trim() || !Number.isFinite(Number(v)))
      || !Number.isFinite(time) || new Date(time * 1000).toISOString().slice(0, 10) !== iso || seen.has(time)
      || low <= 0 || high < Math.max(open, close) || low > Math.min(open, close) || volume < 0) {
      throw new Error(`Invalid silver contract OHLC in ${name}: ${row}`);
    }
    seen.add(time);
    return { time, open, high, low, close, volume };
  }).sort((a, b) => a.time - b.time);
  return { name, bars, expiry };
}

/** One actively traded contract for each whole week: greatest total volume, through its delivery month.
 * Every weekly O/H/L/C comes from that single contract, with all archive trading dates present.
 * Prices stay unadjusted; contract rolls can introduce small gaps. Selection uses that week's volume.
 */
export function silverArchiveWeeks(contracts: Contract[], from: number, seam: number) {
  const weeks = new Map<number, { days: Set<number>; candidates: { contract: string; bars: Trade[]; volume: number }[] }>();
  for (const contract of contracts) {
    const grouped = new Map<number, Trade[]>();
    for (const bar of contract.bars) {
      const week = bucket['1W'](bar.time);
      if (week < from || week >= seam) continue;
      const entry = weeks.get(week) ?? { days: new Set<number>(), candidates: [] };
      entry.days.add(bar.time);
      weeks.set(week, entry);
      // Archive rows must belong to a contract that has not expired.
      if (bar.time >= contract.expiry) continue;
      if (!grouped.has(week)) grouped.set(week, []);
      grouped.get(week)!.push(bar);
    }
    for (const [week, bars] of grouped) weeks.get(week)!.candidates.push({
      contract: contract.name, bars, volume: bars.reduce((sum, b) => sum + b.volume, 0),
    });
  }
  const audit: { time: number; contract: string; volume: number; days: number }[] = [];
  const candles: Candle[] = [];
  for (const [time, week] of [...weeks].sort(([a], [b]) => a - b)) {
    const chosen = week.candidates.filter(c => c.bars.length === week.days.size && c.volume > 0)
      .sort((a, b) => b.volume - a.volume || a.contract.localeCompare(b.contract))[0];
    if (!chosen) throw new Error(`No complete active contract for ${new Date(time * 1000).toISOString().slice(0, 10)}`);
    const { open, high, low, close } = aggregate(chosen.bars, bucket['1W'])[0];
    candles.push({ time, open, high, low, close });
    audit.push({ time, contract: chosen.contract, volume: chosen.volume, days: chosen.bars.length });
  }
  return { candles, audit };
}

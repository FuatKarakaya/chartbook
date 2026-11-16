import { aggregate, bucket } from '../../shared/time.ts';
import type { Candle } from '../../shared/types.ts';

/** Stooq weekly CSV (week-ending dates). Keep real OHLC; never invent daily bars from weekly data. */
export function parseSilverHistory(csv: string): Candle[] {
  const [header, ...rows] = csv.trim().replace(/^\uFEFF/, '').split(/\r?\n/);
  const separator = header.includes(';') ? ';' : ',';
  const columns = header.split(separator).map(s => s.trim().toLowerCase());
  const keys = ['date', 'open', 'high', 'low', 'close'];
  const indices = keys.map(key => columns.indexOf(key));
  if (indices.some(i => i < 0)) throw new Error('Expected a weekly CSV with Date,Open,High,Low,Close columns. The provider may have returned an access-limit page.');
  const seen = new Set<number>();
  const candles = rows.filter(row => row.trim()).map(row => {
    const cells = row.split(separator);
    const [date, ...values] = indices.map(i => cells[i]?.trim() ?? '');
    const time = Date.parse(`${date}T00:00:00Z`) / 1000;
    const [open, high, low, close] = values.map(Number);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(time)
      || new Date(time * 1000).toISOString().slice(0, 10) !== date
      || values.some(s => !s || !Number.isFinite(Number(s)) || Number(s) <= 0)
      || high < Math.max(open, close) || low > Math.min(open, close) || low > high) {
      throw new Error(`Invalid silver OHLC row: ${row}`);
    }
    const week = bucket['1W'](time);
    if (seen.has(week)) throw new Error('More than one row in a week. Export Weekly data, not Daily data.');
    seen.add(week);
    return { time: week, open, high, low, close };
  }).sort((a, b) => a.time - b.time);
  if (!candles.length) throw new Error('The silver history CSV is empty.');
  return candles;
}

/** Only complete older weeks precede modern spot data; never duplicate or replace its boundary week. */
export function silverWeeks(history: Candle[], daily: Candle[]): Candle[] {
  const modern = aggregate(daily, bucket['1W']);
  const seam = modern[0]?.time ?? Infinity;
  return [...history.filter(c => c.time < seam), ...modern];
}

/** Reject a download silently truncated to recent years or with a large hole. */
export function validateSilverCoverage(history: Candle[], seam: number) {
  const start = Date.UTC(1970, 0, 1) / 1000;
  if (history[0]?.time > start + 7 * 86400 || (history.at(-1)?.time ?? -Infinity) < seam - 7 * 86400) {
    throw new Error('Silver history must cover January 1970 through the start of the existing daily data.');
  }
  for (let i = 1; i < history.length; i++) {
    if (history[i].time - history[i - 1].time > 14 * 86400) throw new Error('Silver history has a gap of more than two weeks. Import was cancelled.');
  }
}

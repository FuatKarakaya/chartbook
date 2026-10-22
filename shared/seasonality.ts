import { bucket } from './time.ts';
import type { Candle } from './types.ts';

/** One table cell: a month's or a year's change (0.05 = +5%; for a rate, in percentage points: 0.25 = +0.25). */
export interface Cell {
  change: number;
  /** Shown faded and left out of the stats: the month or year isn't over yet, or the data starts partway through it. */
  partial: boolean;
}
export interface YearRow {
  year: number;
  /** Jan..Dec; null where there is no month, or none before it to compare with (the very first one). */
  months: (Cell | null)[];
  /** The year's months added up: its last close against the close before its first month. */
  full: Cell;
}

/**
 * Monthly changes from monthly candles, newest year first: this month's close / last month's close - 1, or for a
 * `rate` (a yield, in %) the difference, so 5.25% -> 5.5% is +0.25 percentage points rather than +4.8%.
 */
export function monthlyReturns(months: Candle[], now: number, rate = false): YearRow[] {
  const running = bucket['1M'](now);
  const years = new Map<number, (Cell | null)[]>();
  for (let i = 1; i < months.length; i++) {
    const d = new Date(months[i].time * 1000);
    if (!years.has(d.getUTCFullYear())) years.set(d.getUTCFullYear(), Array(12).fill(null));
    years.get(d.getUTCFullYear())![d.getUTCMonth()] = {
      change: rate ? months[i].close - months[i - 1].close : months[i].close / months[i - 1].close - 1,
      partial: months[i].time === running,
    };
  }
  return [...years].reverse().map(([year, cells]) => {
    const shown = cells.filter((c) => c !== null);
    return {
      year, months: cells, full: {
        change: rate ? shown.reduce((s, c) => s + c.change, 0) : shown.reduce((p, c) => p * (1 + c.change), 1) - 1,
        partial: shown.length < 12 || shown.some((c) => c.partial),
      },
    };
  });
}

/**
 * Where a year sits in the 4-year cycle: its remainder after dividing by 4. US presidential elections and BTC halvings
 * both fall in years divisible by 4 (2012, 2016, 2020, 2024, 2028), so 0 = election and halving years,
 * 1 = post-election (halving +1), 2 = midterm (+2), 3 = pre-election (+3).
 */
export type Phase = 0 | 1 | 2 | 3;
export interface Filter {
  from: number;
  to: number;
  /** null: every year. */
  phase: Phase | null;
}

export const pickYears = (rows: YearRow[], f: Filter) =>
  rows.filter((r) => r.year >= f.from && r.year <= f.to && (f.phase === null || r.year % 4 === f.phase));

/** One column's rows under the table. */
export interface Stats {
  average: number;
  median: number;
  /** Share of the years that went up (0..1). */
  up: number;
  years: number;
}

/** The rows under the table, per column (Jan..Dec, then full year), from the finished cells; null where there are none. */
export function stats(rows: YearRow[]): (Stats | null)[] {
  return Array.from({ length: 13 }, (_, m) => {
    const changes = rows.map((r) => (m < 12 ? r.months[m] : r.full)).filter((c) => c && !c.partial)
      .map((c) => c!.change).sort((a, b) => a - b);
    const n = changes.length;
    if (!n) return null;
    return {
      average: changes.reduce((s, c) => s + c, 0) / n,
      median: n % 2 ? changes[(n - 1) / 2] : (changes[n / 2 - 1] + changes[n / 2]) / 2,
      up: changes.filter((c) => c > 0).length / n,
      years: n,
    };
  });
}

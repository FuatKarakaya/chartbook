import { describe, expect, it } from 'vitest';
import { monthlyReturns, pickYears, stats, type YearRow } from './seasonality.ts';
import { aggregate, bucket } from './time.ts';

const DAY = 86400;
/** Month-end closes from July 2019 to March 2021 (the last one still running). */
const CLOSES = [100, 110, 99, 99, 120, 150, 120, 132, 66, 99, 99, 110, 121, 100, 90, 108, 135, 135, 162, 81, 90];
const START = Date.UTC(2019, 6, 17) / 1000; // data starts mid-July
const NOW = Date.UTC(2021, 2, 10, 12) / 1000;
/** Daily candles whose close is their month's close, built up into months the way the server does. */
function months() {
  const days = [];
  for (let t = START; t <= NOW; t += DAY) {
    const d = new Date(t * 1000);
    const close = CLOSES[(d.getUTCFullYear() - 2019) * 12 + d.getUTCMonth() - 6];
    days.push({ time: t, open: close, high: close, low: close, close });
  }
  return aggregate(days, bucket['1M']);
}
const changes = (r: YearRow) => r.months.map((c) => c && Math.round(c.change * 1000) / 10); // in %, 1 decimal

describe('monthly returns', () => {
  const [y2021, y2020, y2019, ...rest] = monthlyReturns(months(), NOW);

  it('are each month close over the one before, newest year first', () => {
    expect(rest).toEqual([]);
    expect(changes(y2020)).toEqual([-20, 10, -50, 50, 0, 11.1, 10, -17.4, -10, 20, 25, 0]);
    expect(y2020.months.some((c) => c!.partial)).toBe(false);
  });

  it('full year = the last close over last December close', () => {
    expect(y2020.year).toBe(2020);
    expect(y2020.full.change).toBeCloseTo(135 / 150 - 1);
    expect(y2020.full.partial).toBe(false);
  });

  it('a first year starting partway: no change for its first month, the year counted from it and marked partial', () => {
    expect(changes(y2019)).toEqual([null, null, null, null, null, null, null, 10, -10, 0, 21.2, 25]);
    expect(y2019.full.change).toBeCloseTo(150 / 100 - 1);
    expect(y2019.full.partial).toBe(true);
  });

  it('the current month and year are marked partial', () => {
    expect(changes(y2021)).toEqual([20, -50, 11.1, null, null, null, null, null, null, null, null, null]);
    expect(y2021.months.slice(0, 3).map((c) => c!.partial)).toEqual([false, false, true]);
    expect(y2021.full.change).toBeCloseTo(90 / 135 - 1);
    expect(y2021.full.partial).toBe(true);
  });

  it('a month that is over is not partial, even when it is the last one', () => {
    const [last] = monthlyReturns(months(), Date.UTC(2021, 3, 1) / 1000);
    expect(last.months[2]!.partial).toBe(false);
  });
});

/** A row with these month changes (null: no month) and full-year change; `partial` marks the full year. */
const row = (year: number, months: (number | null)[], full: number, partial = false): YearRow => ({
  year, months: [...months, ...Array(12 - months.length).fill(null)].map((c) => c === null ? null : { change: c, partial: false }),
  full: { change: full, partial },
});

describe('filters', () => {
  const rows = Array.from({ length: 17 }, (_, i) => row(2026 - i, [], 0)); // 2026 down to 2010
  const years = (from: number, to: number, phase: 0 | 1 | 2 | 3 | null) => pickYears(rows, { from, to, phase }).map((r) => r.year);

  it('keep the years from/to, both included', () => {
    expect(years(2018, 2021, null)).toEqual([2021, 2020, 2019, 2018]);
  });

  it('pick one year of the 4-year cycle: election = halving years, then post-election, midterm, pre-election', () => {
    expect(years(2010, 2026, 0)).toEqual([2024, 2020, 2016, 2012]);
    expect(years(2010, 2026, 1)).toEqual([2025, 2021, 2017, 2013]);
    expect(years(2010, 2026, 2)).toEqual([2026, 2022, 2018, 2014, 2010]);
    expect(years(2010, 2026, 3)).toEqual([2023, 2019, 2015, 2011]);
    expect(years(2015, 2022, 2)).toEqual([2022, 2018]);
  });
});

describe('stats rows', () => {
  it('average, median and share of years up, per month and for the full year', () => {
    const [jan, feb, mar, , , , , , , , , , full] = stats([
      row(2023, [0.1, -0.2, null], 0.5),
      row(2022, [0.3, 0.1, 0.05], -0.1),
      row(2021, [-0.1, 0.4, 0.05], 0.2),
      row(2020, [0.2], 0.4),
    ]);
    expect(jan).toEqual({ average: expect.closeTo(0.125), median: expect.closeTo(0.15), up: 0.75, years: 4 });
    expect(feb).toEqual({ average: expect.closeTo(0.1), median: expect.closeTo(0.1), up: 2 / 3, years: 3 });
    expect(mar).toEqual({ average: expect.closeTo(0.05), median: 0.05, up: 1, years: 2 });
    expect(full).toEqual({ average: expect.closeTo(0.25), median: expect.closeTo(0.3), up: 0.75, years: 4 });
  });

  it('leave out partial cells (the running month and year), and show nothing where no year has the month', () => {
    const current = row(2024, [0.5], 0.5, true);
    current.months[0]!.partial = true;
    const s = stats([current, row(2023, [-0.1], -0.1)]);
    expect(s[0]).toEqual({ average: -0.1, median: -0.1, up: 0, years: 1 });
    expect(s[1]).toBeNull();
    expect(s[12]).toEqual({ average: -0.1, median: -0.1, up: 0, years: 1 });
  });

  it('count no change as not up', () => {
    expect(stats([row(2023, [0], 0), row(2022, [0.1], 0.1)])[0]!.up).toBe(0.5);
  });
});

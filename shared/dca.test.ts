import { describe, expect, it } from 'vitest';
import { weekdayBuys, weekdayOf } from './dca.ts';
import type { Candle } from './types.ts';

const DAY = 86400;
const MON = Date.UTC(2024, 0, 1) / 1000; // Monday 1 January 2024
/** `n` daily candles from that Monday, closing at `price(i)` (by default 1, 2, 3...). */
const days = (n = 21, price = (i: number) => i + 1): Candle[] => Array.from({ length: n }, (_, i) => {
  const c = price(i);
  return { time: MON + i * DAY, open: c, high: c, low: c, close: c };
});
const all = (list: Candle[]) => weekdayBuys(list, list[0].time, list.at(-1)!.time);

it('weekdays count from Monday', () => {
  expect([0, 1, 5, 6].map((i) => weekdayOf(MON + i * DAY))).toEqual([0, 1, 5, 6]);
  expect(weekdayOf(Date.UTC(1950, 0, 2) / 1000)).toBe(0); // a Monday before 1970 too
});

describe('buying every week on one weekday', () => {
  it('buys $1 at that day\'s close every week, for each of the 7 days a coin trades', () => {
    const result = all(days());
    expect(result.map((r) => r.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(result[0]).toMatchObject({ buys: 3, units: expect.closeTo(1 / 1 + 1 / 8 + 1 / 15) });
    expect(result[6]).toMatchObject({ buys: 3, units: expect.closeTo(1 / 7 + 1 / 14 + 1 / 21) });
  });

  it('compares each buy with the same money spread over the week around it, leaving out buys near the ends', () => {
    // 100 every day but Mondays, at 90: any 7 days in a row hold one Monday.
    const spread = (6 / 100 + 1 / 90) / 7; // what $1 a day bought over 7 days, per dollar
    const result = all(days(28, (i) => (i % 7 ? 100 : 90)));
    expect(result[0]).toMatchObject({ buys: 4, more: expect.closeTo(1 / 90 / spread - 1) });
    expect(result.slice(1).map((r) => r.more)).toEqual(Array(6).fill(expect.closeTo(1 / 100 / spread - 1)));
  });

  it('a steady rise favours no day', () => {
    const more = all(days(70, (i) => 1.01 ** i)).map((r) => r.more);
    for (const m of more) expect(m).toBeCloseTo(more[0], 10);
  });

  it('only has the days a market trades, and a holiday\'s buy happens the next day', () => {
    const holiday = MON + 7 * DAY; // Monday 8 January, closed
    const market = days().filter((d) => weekdayOf(d.time) < 5 && d.time !== holiday);
    const result = all(market);
    expect(result.map((r) => r.weekday)).toEqual([0, 1, 2, 3, 4]);
    expect(result[0]).toMatchObject({ buys: 3, units: expect.closeTo(1 / 1 + 1 / 9 + 1 / 15) }); // Tuesday 9th's close
  });

  it('can buy at the open instead', () => {
    const list = days().map((d) => ({ ...d, open: d.close * 2 }));
    const [mon] = weekdayBuys(list, list[0].time, list.at(-1)!.time, 'open');
    expect(mon.units).toBeCloseTo((1 / 1 + 1 / 8 + 1 / 15) / 2);
  });

  it('only buys inside the years picked', () => {
    const [mon, tue, wed] = weekdayBuys(days(), MON + 2 * DAY, MON + 13 * DAY); // Wednesday 3rd to Sunday 14th
    expect(mon).toMatchObject({ buys: 1, units: 1 / 8 });
    expect(tue).toMatchObject({ buys: 1, units: 1 / 9 });
    expect(wed).toMatchObject({ buys: 2, units: expect.closeTo(1 / 3 + 1 / 10) });
  });
});

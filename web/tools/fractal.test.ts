import { expect, it } from 'vitest';
import { biggestMove, type Fractal, project, stretch } from './fractal.ts';

const DAY = 86400;
const bar = (time: number, open: number, high: number, low: number, close: number) => ({ time, open, high, low, close });
// 100 -> 200 -> 40 over three days.
const src = [bar(0, 90, 110, 80, 100), bar(DAY, 100, 220, 100, 200), bar(2 * DAY, 200, 200, 40, 40)];
const fractal = (f: Partial<Fractal>): Fractal => ({
  id: 'f', type: 'fractal', sourceAsset: 'btc', srcStart: 0, srcEnd: 2 * DAY,
  anchorTime: 1000 * DAY, anchorPrice: 10, timeScale: 1, moveScale: 1, flip: false,
  style: { color: '#fff', opacity: 1 }, ...f,
});

it('copies the stretch from the anchor: first close on the anchor, same % moves, same spacing', () => {
  expect(project(fractal({}), src)).toEqual([
    bar(1000 * DAY, 9, 11, 8, 10), bar(1001 * DAY, 10, 22, 10, 20), bar(1002 * DAY, 20, 20, 4, 4),
  ]);
});

it('stretches time from the anchor', () => {
  const times = project(fractal({ timeScale: 1.5 }), src).map((c) => c.time);
  expect(times).toEqual([1000 * DAY, 1001.5 * DAY, 1003 * DAY]);
});

it('scales moves as powers, so x0.5 halves the height on a log scale', () => {
  const closes = project(fractal({ moveScale: 0.5 }), src).map((c) => c.close);
  expect(closes[1]).toBeCloseTo(10 * Math.SQRT2); // 2x became 1.41x
  expect(closes[2]).toBeCloseTo(10 * Math.sqrt(0.4));
});

it('flips: a doubling becomes a halving, and highs and lows swap', () => {
  const [, up, down] = project(fractal({ flip: true }), src);
  expect(up).toEqual(bar(DAY * 1001, 10, 10, 10 / 2.2, 5));
  expect(down.close).toBeCloseTo(25);
  expect(down.high).toBeCloseTo(25); // from the 40 low
  expect(down.low).toBeCloseTo(5); // from the 200 high
});

it('takes the candles from the one holding the start to the last at the end', () => {
  const weeks = [0, 7, 14, 21].map((d) => bar(d * DAY, 1, 1, 1, 1));
  // A Wednesday start on weekly bars takes that whole week.
  expect(stretch(weeks, 2 * DAY, 15 * DAY).map((c) => c.time / DAY)).toEqual([0, 7, 14]);
  expect(stretch(weeks, -5 * DAY, 30 * DAY)).toHaveLength(4);
  expect(stretch(weeks, -9 * DAY, -1 * DAY)).toEqual([]);
});

it('puts the move-size handle on the close furthest from the first in %', () => {
  expect(biggestMove(src)).toBe(2); // the fall to 40 is bigger than the doubling to 200, in %
  expect(biggestMove(src.slice(0, 2))).toBe(1);
});

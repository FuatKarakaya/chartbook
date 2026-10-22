import { describe, expect, it } from 'vitest';
import { after, findFits, fitsIn, likeness, swings } from './patterns.ts';

/** Daily log moves of a random walk (the same every run), about ±3% a day. */
function randomMoves(n: number) {
  let seed = 7;
  return Array.from({ length: n }, () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return (seed / 4294967296 - 0.5) * 0.06;
  });
}
const closesOf = (moves: number[]) => moves.reduce((c, m) => [...c, c[c.length - 1] * Math.exp(m)], [100]);
/** 600 bars; the pattern is the last 40 (bars 560-599), and `plant` puts something made of its moves at bar 100. */
function market(plant: (moves: number[]) => number[]) {
  const moves = randomMoves(599);
  const planted = plant(moves.slice(560));
  moves.splice(100, planted.length, ...planted);
  return closesOf(moves);
}
const search = { weight: 0.7, speeds: false };
/** Looks for the pattern (bars 560-599) in its own series only. */
const own = (closes: number[], o = search, count = 10) =>
  findFits(closes, 560, 599, [{ closes, scale: 1, skip: [560, 599] }], o, count);

describe('finding look-alikes', () => {
  it('finds an exact copy first, with full marks', () => {
    const [best] = own(market((m) => m));
    expect(best).toMatchObject({ series: 0, start: 100, end: 139, speed: 1 });
    expect([best.direction, best.size, best.score].map((x) => x.toFixed(6))).toEqual(['1.000000', '1.000000', '1.000000']);
  });

  it('a copy with moves twice as big has the same direction but half the size', () => {
    const fit = own(market((m) => m.map((x) => 2 * x))).find((f) => f.start === 100)!;
    expect(fit.direction).toBeCloseTo(1);
    expect(fit.size).toBeCloseTo(0.5);
    expect(fit.score).toBeCloseTo(0.7 + 0.3 * 0.5);
  });

  it('weights direction against size as asked', () => {
    const fit = own(market((m) => m.map((x) => 2 * x)), { weight: 1, speeds: false })[0];
    expect(fit).toMatchObject({ start: 100, score: expect.closeTo(1) });
  });

  it('an upside-down copy gets nothing for direction, and isn\'t found', () => {
    const moves = [0.1, -0.05, 0.2, 0.03];
    expect(likeness(moves, moves.map((x) => -x), 0.7)).toEqual({ direction: -1, size: 1, score: expect.closeTo(0.3) });
    expect(own(market((m) => m.map((x) => -x))).some((f) => f.start === 100)).toBe(false);
  });

  it('finds a copy played out at half the speed, when speeds are on', () => {
    const closes = market((m) => m.flatMap((x) => [x / 2, x / 2])); // every move spread over two bars
    const [best] = own(closes, { ...search, speeds: true });
    expect(best).toMatchObject({ start: 100, end: 178, speed: 2, score: expect.closeTo(1) });
    expect(own(closes).some((f) => f.speed !== 1)).toBe(false);
  });

  it('never returns stretches overlapping each other or the pattern', () => {
    const fits = own(market((m) => m), { weight: 0.7, speeds: true }, Infinity);
    expect(fits.length).toBeGreaterThan(10);
    const spans = [[560, 599], ...fits.map((f) => [f.start, f.end])];
    spans.forEach(([a, b], i) => spans.slice(i + 1).forEach(([c, d]) => expect(b < c || a > d).toBe(true)));
  });

  it('skips flat stretches, which have no direction (a rate that stayed put)', () => {
    const closes = [...Array(100).fill(5), ...closesOf(randomMoves(99))];
    const fits = findFits(closes, 160, 199, [{ closes, scale: 1, skip: [160, 199] }], search, Infinity);
    expect(fits.every((f) => Number.isFinite(f.score) && f.end >= 100)).toBe(true);
  });
});

describe('looking in other assets too', () => {
  const mine = market((m) => m);
  const pool = (other: number[], scale = 1) => [
    { closes: mine, scale: 1, skip: [560, 599] as [number, number] }, { closes: other, scale, skip: [560, 599] as [number, number] },
  ];

  it('finds a copy in another series, and tells which', () => {
    // The other series: a different random walk, with the pattern copied in at bar 300.
    const moves = randomMoves(599).reverse();
    moves.splice(300, 39, ...mine.slice(560).map((c, i, a) => Math.log(a[i + 1] / c)).slice(0, 39));
    const fits = findFits(mine, 560, 599, pool(closesOf(moves)), search);
    expect(fits.slice(0, 2).map((f) => [f.series, f.start, f.score.toFixed(6)]))
      .toEqual(expect.arrayContaining([[0, 100, '1.000000'], [1, 300, '1.000000']]));
  });

  it('may overlap in time with a fit in another series, but not the pattern\'s time', () => {
    const fits = findFits(mine, 560, 599, pool(mine), search, Infinity); // the same series twice
    expect(fits.filter((f) => f.start === 100).map((f) => f.series)).toEqual([0, 1]);
    expect(fits.every((f) => f.end < 560)).toBe(true);
  });

  it('counts "as long" in time: on a chart with bars twice as often, a copy over twice the bars is the same speed', () => {
    const candles = (closes: number[], every: number) => closes.map((close, i) => ({ time: i * every, open: close, high: close, low: close, close }));
    const daily = candles(mine, 86400);
    const twiceADay = candles(market((m) => m.flatMap((x) => [x / 2, x / 2])), 43200);
    const fits = fitsIn(daily, 560, 599, [{ chart: 'mine', bars: daily }, { chart: 'other', bars: twiceADay }], search);
    expect(fits.find((f) => f.chart === 'other' && f.start === 100)).toMatchObject({ end: 178, speed: 1, score: expect.closeTo(1) });
    // The pattern's time there (days 560-599 = bars 1120-1198) isn't searched.
    expect(fits.filter((f) => f.chart === 'other').every((f) => f.end < 1120 || f.start > 1198)).toBe(true);
  });
});

describe('swings', () => {
  it('are the legs up and down', () => {
    expect(swings([0.5, -0.3, 0.2]).map((x) => x.toFixed(2))).toEqual(['0.50', '-0.30', '0.20']);
  });

  it('keep wiggles smaller than a quarter of the range inside a leg', () => {
    expect(swings([0.4, -0.05, 0.4, -0.5]).map((x) => x.toFixed(2))).toEqual(['0.75', '-0.50']);
  });
});

describe('what came after a fit', () => {
  const bar = (close: number, high = close, low = close) => ({ time: 0, open: close, high, low, close });
  const bars = [bar(10), bar(20), bar(15, 30, 12), bar(25, 26, 9)];

  it('is the change over as long again, with the highest high and lowest low, from its last close', () => {
    expect(after(bars, 0, 1)).toEqual({ to: 2, change: -0.25, high: 0.5, low: -0.4, whole: true });
  });

  it('runs to the last bar while that time isn\'t over, and is null when nothing came yet', () => {
    expect(after(bars, 0, 2)).toMatchObject({ to: 3, change: 25 / 15 - 1, whole: false });
    expect(after(bars, 1, 3)).toBeNull();
  });
});


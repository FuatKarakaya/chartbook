import { describe, expect, it } from 'vitest';
import { findFits, likeness, swings } from './patterns.ts';

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
const PATTERN = [560, 599] as const;
const search = { weight: 0.7, speeds: false };

describe('finding look-alikes', () => {
  it('finds an exact copy first, with full marks', () => {
    const [best] = findFits(market((m) => m), ...PATTERN, search);
    expect(best).toMatchObject({ start: 100, end: 139, speed: 1 });
    expect([best.direction, best.size, best.score].map((x) => x.toFixed(6))).toEqual(['1.000000', '1.000000', '1.000000']);
  });

  it('a copy with moves twice as big has the same direction but half the size', () => {
    const fit = findFits(market((m) => m.map((x) => 2 * x)), ...PATTERN, search).find((f) => f.start === 100)!;
    expect(fit.direction).toBeCloseTo(1);
    expect(fit.size).toBeCloseTo(0.5);
    expect(fit.score).toBeCloseTo(0.7 + 0.3 * 0.5);
  });

  it('weights direction against size as asked', () => {
    const closes = market((m) => m.map((x) => 2 * x));
    const fit = findFits(closes, ...PATTERN, { weight: 1, speeds: false })[0];
    expect(fit).toMatchObject({ start: 100, score: expect.closeTo(1) });
  });

  it('an upside-down copy gets nothing for direction, and isn\'t found', () => {
    const moves = [0.1, -0.05, 0.2, 0.03];
    expect(likeness(moves, moves.map((x) => -x), 0.7)).toEqual({ direction: -1, size: 1, score: expect.closeTo(0.3) });
    expect(findFits(market((m) => m.map((x) => -x)), ...PATTERN, search).some((f) => f.start === 100)).toBe(false);
  });

  it('finds a copy played out at half the speed, when speeds are on', () => {
    const closes = market((m) => m.flatMap((x) => [x / 2, x / 2])); // every move spread over two bars
    const [best] = findFits(closes, ...PATTERN, { ...search, speeds: true });
    expect(best).toMatchObject({ start: 100, end: 178, speed: 2, score: expect.closeTo(1) });
    expect(findFits(closes, ...PATTERN, search).some((f) => f.speed !== 1)).toBe(false);
  });

  it('never returns stretches overlapping each other or the pattern', () => {
    const fits = findFits(market((m) => m), ...PATTERN, { weight: 0.7, speeds: true }, Infinity);
    expect(fits.length).toBeGreaterThan(10);
    const spans = [[560, 599], ...fits.map((f) => [f.start, f.end])];
    spans.forEach(([a, b], i) => spans.slice(i + 1).forEach(([c, d]) => expect(b < c || a > d).toBe(true)));
  });

  it('skips flat stretches, which have no direction (a rate that stayed put)', () => {
    const closes = [...Array(100).fill(5), ...closesOf(randomMoves(99))];
    expect(findFits(closes, 160, 199, search, Infinity).every((f) => Number.isFinite(f.score) && f.end >= 100)).toBe(true);
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

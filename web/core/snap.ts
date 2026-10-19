import type { Anchor, Candle } from '../../shared/types.ts';

/**
 * The open, high, low or close nearest to screen height `y`, of the bar at logical position `l` (rounded, and kept
 * on the bars, so a click in the empty space on the right takes the last bar). `toY` converts a price to a height.
 */
export function snapToCandle(bars: Candle[], l: number, y: number, toY: (price: number) => number): Anchor {
  const bar = bars[Math.min(bars.length - 1, Math.max(0, Math.round(l)))];
  const prices = [bar.open, bar.high, bar.low, bar.close];
  const dist = (price: number) => Math.abs(toY(price) - y);
  return { time: bar.time, price: prices.reduce((a, b) => (dist(b) < dist(a) ? b : a)) };
}

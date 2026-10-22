import type { Candle, Drawing, Ticker } from './types.ts';

/** A ghost copy of a stretch of candles (PLAN.md's stored shape). */
export interface Fractal extends Drawing {
  /** An asset, or a ratio of two. */
  sourceAsset: Ticker;
  /** The stretch copied (UTC seconds). */
  srcStart: number;
  srcEnd: number;
  /** Where the copy's first close sits. */
  anchorTime: number;
  anchorPrice: number;
  /** 2 = the copy takes twice as long as the original. */
  timeScale: number;
  /** 0.5 = half the original's moves (half the height on a log scale). */
  moveScale: number;
  /** Upside down: rises become falls. */
  flip: boolean;
  style: { color: string; opacity: number };
}

/** The candles copied: from the one holding `from` (so 1W/1M take the week or month it falls in) to the last at `to`. */
export function stretch(all: Candle[], from: number, to: number) {
  return all.slice(Math.max(0, all.findLastIndex((c) => c.time <= from)), all.findLastIndex((c) => c.time <= to) + 1);
}

/**
 * The ghost candles: `src` moved so its first close sits on the anchor, every move from that close scaled
 * (price_i = anchorPrice * (c_i / c_0) ^ (moveScale * (flip ? -1 : 1))) and time stretched
 * (t_i = anchorTime + timeScale * (t_i_src - t_0_src)). Flipped, highs and lows swap.
 */
export function project(f: Fractal, src: Candle[]): Candle[] {
  const k = f.moveScale * (f.flip ? -1 : 1);
  const at = (p: number) => f.anchorPrice * (p / src[0].close) ** k;
  return src.map((c) => {
    const [high, low] = [at(c.high), at(c.low)];
    return {
      time: f.anchorTime + f.timeScale * (c.time - src[0].time),
      open: at(c.open), high: Math.max(high, low), low: Math.min(high, low), close: at(c.close),
    };
  });
}

/** Index of the candle whose close is furthest (in %) from the first one's: the move-size handle sits on it. */
export function biggestMove(src: Candle[]) {
  const size = (c: Candle) => Math.abs(Math.log(c.close / src[0].close));
  return src.reduce((best, c, i) => (size(c) > size(src[best]) ? i : best), 0);
}

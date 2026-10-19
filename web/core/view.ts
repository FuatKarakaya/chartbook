import type { Logical } from 'lightweight-charts';
import type { Anchor, Asset, Candle, Interval } from '../../shared/types.ts';
import { fetchCandles } from './api.ts';
import type { createMainChart } from './chart.ts';
import { snapToCandle } from './snap.ts';
import { timeline } from './timeline.ts';
import type { Px, View } from './tool.ts';

/**
 * The chart as drawings see it: the bars on screen, pixels <-> time + price, and other assets' and timeframes'
 * candles (for fractals copied from them), each downloaded once; `onLoad` fires as one arrives.
 */
export function chartView({ chart, series }: ReturnType<typeof createMainChart>, onLoad: () => void) {
  const time = chart.timeScale();
  let bars: Candle[] = [];
  let asset: Asset;
  let interval: Interval;
  let line: ReturnType<typeof timeline>;
  const loaded = new Map<string, Candle[] | null>(); // null while downloading

  const candles = (a: Asset, i: Interval) => {
    if (a === asset && i === interval) return bars;
    const key = `${a} ${i}`;
    if (!loaded.has(key)) {
      loaded.set(key, null);
      fetchCandles(a, i).then((c) => (loaded.set(key, c), onLoad()));
    }
    return loaded.get(key) ?? undefined;
  };
  // logicalToCoordinate only takes whole bars, and a daily point on the weekly chart sits between two.
  const xAt = (l: number) => {
    const i = Math.floor(l);
    const x = time.logicalToCoordinate(i as Logical)!;
    return x + (l - i) * (time.logicalToCoordinate((i + 1) as Logical)! - x);
  };
  const y = (price: number) => series.priceToCoordinate(price) ?? NaN;
  const logicalAt = (x: number) => time.coordinateToLogical(x) ?? 0;

  return {
    /** The bars on screen, for placing drawings made on any timeframe. */
    setBars(candles: Candle[], a: Asset, i: Interval) {
      if (bars.length) loaded.set(`${asset} ${interval}`, bars); // a fractal copied onto the next asset may need them
      bars = candles;
      asset = a;
      interval = i;
      line = timeline(candles.map((b) => b.time));
    },
    /** What tools get; make a fresh one per frame, as size and scales change. */
    view: (): View => ({
      width: time.width(), height: chart.panes()[0].getHeight(), asset, interval, bars, candles,
      x: (t) => xAt(line.toLogical(t)), y,
    }),
    toLogical: (t: number) => line.toLogical(t),
    /** Scrolls to show these times, with half their span of history before them. */
    reveal(times: number[]) {
      if (!times.length) return; // its candles are still downloading
      const at = times.map((t) => line.toLogical(t));
      const [from, to] = [Math.min(...at), Math.max(...at)];
      time.setVisibleLogicalRange({ from: from - (to - from) / 2, to: to + (to - from) / 10 });
    },
    /**
     * A click as time + price: the nearest bar (or future bar slot) in time and wherever the mouse is in price;
     * with `snap`, the nearest open/high/low/close of the candle under the mouse.
     */
    anchorAt: (p: Px, snap = false): Anchor => snap
      ? snapToCandle(bars, logicalAt(p.x), p.y, y)
      : { time: line.toTime(Math.round(logicalAt(p.x))), price: series.coordinateToPrice(p.y)! },
    /** `a` dragged by the mouse going from `from` to `to`: by whole bars in time, by pixels in price (right on log scale). */
    shift: (a: Anchor, from: Px, to: Px): Anchor => ({
      time: line.toTime(line.toLogical(a.time) + Math.round(logicalAt(to.x) - logicalAt(from.x))),
      price: series.coordinateToPrice(y(a.price) + to.y - from.y)!,
    }),
  };
}

import type { Candle, Point } from '../../shared/types.ts';

/** Simple moving average of closes, one point per candle once `length` candles exist. */
export function sma(candles: Candle[], length: number): Point[] {
  const out: Point[] = [];
  let sum = 0;
  candles.forEach((c, i) => {
    sum += c.close - (i >= length ? candles[i - length].close : 0);
    if (i >= length - 1) out.push({ time: c.time, value: sum / length });
  });
  return out;
}

/**
 * Puts a daily line onto the chart's own bars, so it shows on every timeframe without adding time points:
 * each bar takes the value of the last day that started before the bar ended (the next bar's start).
 * So on 1h/4h it steps once a day, and a weekly or monthly bar shows the value at its last day.
 */
export function onBars(line: Point[], bars: Candle[]): Point[] {
  const out: Point[] = [];
  let w = -1;
  bars.forEach((bar, i) => {
    const end = bars[i + 1]?.time ?? Infinity;
    while (w + 1 < line.length && line[w + 1].time < end) w++;
    if (w >= 0) out.push({ time: bar.time, value: line[w].value });
  });
  return out;
}

import type { Candle } from '../../shared/types.ts';

export interface Point { time: number; value: number }

/** Simple moving average of weekly closes, one point per week once `length` weeks exist. */
export function sma(weeks: Candle[], length: number): Point[] {
  const out: Point[] = [];
  let sum = 0;
  weeks.forEach((w, i) => {
    sum += w.close - (i >= length ? weeks[i - length].close : 0);
    if (i >= length - 1) out.push({ time: w.time, value: sum / length });
  });
  return out;
}

/**
 * Puts a weekly line onto the chart's own bars, so it shows on every timeframe without adding time points:
 * each bar takes the value of the last week that started before the bar ended (the next bar's start).
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

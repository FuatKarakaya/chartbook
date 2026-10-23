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
 * each bar takes the value of the last day that started before the bar ended (the next bar's start), so a weekly or
 * monthly bar shows the value at its last day.
 * With `glide` (1h/4h, where a day spans many bars) the line doesn't step once a day: over a day's bars it moves from
 * the day before's value to the day's own, by how much of the day's bars are done, the bar's close standing in for the
 * day's (`perClose`: how much a day's close moves the line, 1/50 for a 50-day average). That is a window sliding
 * hour by hour, and it never looks ahead; the day's last bar shows the daily value. `days` are the daily candles the
 * line was made from (it starts at one of them and has a point for each after).
 */
export function onBars(line: Point[], bars: Candle[], glide?: { days: Candle[]; perClose: number }): Point[] {
  let w = -1;
  const day = bars.map((bar, i) => {
    const end = bars[i + 1]?.time ?? Infinity;
    while (w + 1 < line.length && line[w + 1].time < end) w++;
    return w;
  });
  const out: Point[] = [];
  let whole = 1; // bars in a whole day: the day still going on (the last) counts as long as the one before
  for (let i = 0, j = 0; i < bars.length; i = j) {
    const w = day[i];
    while (j < bars.length && day[j] === w) j++;
    const n = j === bars.length ? Math.max(j - i, whole) : j - i;
    whole = j - i;
    for (let k = i; k < j && w >= 0; k++) {
      if (!glide || w === 0) {
        out.push({ time: bars[k].time, value: line[w].value });
        continue;
      }
      const asSeen = line[w].value + glide.perClose * (bars[k].close - glide.days[w + glide.days.length - line.length].close);
      out.push({ time: bars[k].time, value: line[w - 1].value + ((k - i + 1) / n) * (asSeen - line[w - 1].value) });
    }
  }
  return out;
}

import type { Candle } from '../shared/types.ts';

/**
 * `a` priced in `b`, on a's bars: open and close divided by b's, high and low by b's high and low (then widened to
 * cover open and close, as the true in-bar extremes are unknown). Where b has no bar at that time (BTC at the
 * weekend, when S&P is shut) b stands still at its last close. Bars before b's first are left out.
 */
export function ratio(a: Candle[], b: Candle[]): Candle[] {
  const out: Candle[] = [];
  let j = -1; // b's last bar at or before a's
  for (const k of a) {
    while (j + 1 < b.length && b[j + 1].time <= k.time) j++;
    if (j < 0) continue;
    const c = b[j].close;
    const d = b[j].time === k.time ? b[j] : { open: c, high: c, low: c, close: c };
    const open = k.open / d.open;
    const close = k.close / d.close;
    const ends = [open, close, k.high / d.high, k.low / d.low];
    out.push({ time: k.time, open, high: Math.max(...ends), low: Math.min(...ends), close });
  }
  return out;
}

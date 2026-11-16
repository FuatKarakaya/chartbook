/** Bars used to guess the spacing of future bars (and of bars before the first one). */
const STEP_BARS = 50;

/**
 * Converts between times and the chart's logical bar positions (0 = first bar, may be fractional).
 * Times between two bars interpolate, so a drawing made on 1h still lands right on 1W.
 * Beyond the last bar (the empty space for projections) bars are assumed to keep their recent average spacing.
 */
export function timeline(times: number[], fallbackStep = 86400) {
  const n = times.length;
  const first = times[0] ?? 0;
  const last = times[n - 1] ?? first;
  const k = Math.min(STEP_BARS, n - 1);
  const step = k > 0 ? (last - times[n - 1 - k]) / k : fallbackStep;

  return {
    last: Math.max(0, n - 1),
    toLogical(t: number) {
      if (t >= last) return Math.max(0, n - 1) + (t - last) / step;
      if (t <= first) return (t - first) / step;
      let lo = 0;
      let hi = n - 1; // times[lo] <= t < times[hi]
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (times[mid] <= t) lo = mid;
        else hi = mid;
      }
      return lo + (t - times[lo]) / (times[hi] - times[lo]);
    },
    toTime(l: number) {
      if (l >= n - 1) return last + (l - Math.max(0, n - 1)) * step;
      if (l <= 0) return first + l * step;
      const i = Math.floor(l);
      return times[i] + (l - i) * (times[i + 1] - times[i]);
    },
  };
}

type Timeline = ReturnType<typeof timeline>;
type Range = { from: number; to: number };

/**
 * The stretch of time `range` shows on `before`'s bars, as a range of `after`'s bars (another timeframe), at least
 * `minBars` and at most `maxBars` wide. Empty space past the last bar keeps its share of the screen rather than its
 * length in time (40 empty days are 960 empty hours); the screen keeps showing the latest bar when cut to `maxBars`.
 */
export function carryRange(range: Range, before: Timeline, after: Timeline, minBars: number, maxBars: number): Range {
  // A viewport entirely past the last bar has no visible history to use as a ratio.
  // Recover at the latest candles instead of dividing by zero or reversing the range.
  const limit = Math.max(minBars, maxBars);
  if (range.from >= before.last || range.to <= 0 || !Number.isFinite(range.to - range.from) || range.to <= range.from) {
    const width = Math.min(limit, Math.max(minBars, range.to - range.from || minBars));
    return { from: after.last - width * 0.9, to: after.last + width * 0.1 };
  }
  const from = Math.max(0, after.toLogical(before.toTime(range.from)));
  const empty = range.to - before.last; // bars of empty space on screen, if any
  const to = empty > 0
    ? after.last + (empty * (after.last - from)) / (before.last - range.from)
    : after.toLogical(before.toTime(range.to));
  if (to <= 0) return { from: 0, to: minBars }; // the new timeframe starts later than the old view
  if (to - from < minBars) return { from: to - minBars, to };
  const cut = Math.min(1, limit / (to - from));
  const pivot = Math.min(to, after.last);
  return { from: pivot - (pivot - from) * cut, to: pivot + (to - pivot) * cut };
}

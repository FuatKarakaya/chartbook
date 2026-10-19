/** Bars used to guess the spacing of future bars (and of bars before the first one). */
const STEP_BARS = 50;

/**
 * Converts between times and the chart's logical bar positions (0 = first bar, may be fractional).
 * Times between two bars interpolate, so a drawing made on 1h still lands right on 1W.
 * Beyond the last bar (the empty space for projections) bars are assumed to keep their recent average spacing.
 */
export function timeline(times: number[]) {
  const n = times.length;
  const first = times[0];
  const last = times[n - 1];
  const k = Math.min(STEP_BARS, n - 1);
  const step = (last - times[n - 1 - k]) / k;

  return {
    toLogical(t: number) {
      if (t >= last) return n - 1 + (t - last) / step;
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
      if (l >= n - 1) return last + (l - (n - 1)) * step;
      if (l <= 0) return first + l * step;
      const i = Math.floor(l);
      return times[i] + (l - i) * (times[i + 1] - times[i]);
    },
  };
}

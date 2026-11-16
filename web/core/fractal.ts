import { project, stretch, type Fractal } from '../../shared/fractal.ts';
import { timeline } from './timeline.ts';
import type { View } from './tool.ts';

/** Project in trading-bar space, then convert back to dates for drawing/storage.
 * Closed weekends and uneven month lengths must not squash a translated pattern.
 * Keep the creation timeframe so switching timeframe cannot change its geometry.
 */
export function fractalProjection(f: Fractal, view: View) {
  let interval = f.sourceInterval ?? view.interval;
  let all = view.candles(f.sourceAsset, interval);
  if (all && (!all.length || all[0].time > f.srcStart) && (interval === '1h' || interval === '4h')) {
    interval = '1D';
    all = view.candles(f.sourceAsset, interval);
  }
  const target = view.candles(view.asset, interval);
  const src = all ? stretch(all, f.srcStart, f.srcEnd) : [];
  if (!src.length || !target?.length) return { src: [], copy: [], span: 0, logical: (t: number) => t };
  const axis = timeline(target.map((c) => c.time));
  const start = axis.toLogical(f.anchorTime);
  const copy = project(f, src, (i) => axis.toTime(start + i * f.timeScale));
  return { src, copy, span: src.length - 1, logical: axis.toLogical };
}

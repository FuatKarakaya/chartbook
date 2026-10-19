import { changeBox, COLOR, dot, type Tool } from '../core/tool.ts';

const HOUR = 3600;
const DAY = 24 * HOUR;

/** Time between two bars in the unit that reads best: hours, days, then weeks. */
export const span = (s: number) =>
  s < 2 * DAY ? `${Math.round(s / HOUR)} hours` : s < 60 * DAY ? `${Math.round(s / DAY)} days` : `${(s / DAY / 7).toFixed(1)} weeks`;

/**
 * Quick change between two candles: each end jumps to the nearest open/high/low/close. Not saved; the next click
 * or Esc clears it. Shift+click on the chart starts one too.
 */
export const ruler: Tool = {
  type: 'ruler',
  label: 'Ruler',
  clicks: 2,
  snap: true,
  temporary: true,
  draw(ctx, [a, b], [p, q]) {
    changeBox(ctx, a, b, p, q, span(Math.abs(q.time - p.time)));
    for (const end of [a, b]) dot(ctx, end, 3, COLOR);
  },
  hit: () => false,
};

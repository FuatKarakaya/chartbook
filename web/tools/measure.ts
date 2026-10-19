import { changeBox, type Tool } from '../core/tool.ts';

const WEEK = 7 * 86400;

/** A box from the first click to the second, labelled with the % change and the weeks between them. */
export const measure: Tool = {
  type: 'measure',
  label: 'Measure',
  clicks: 2,
  draw: (ctx, [a, b], { points: [p, q] }) => changeBox(ctx, a, b, p, q, `${(Math.abs(q.time - p.time) / WEEK).toFixed(1)} weeks`),
  hit: ([a, b], x, y) =>
    x >= Math.min(a.x, b.x) && x <= Math.max(a.x, b.x) && y >= Math.min(a.y, b.y) && y <= Math.max(a.y, b.y),
};

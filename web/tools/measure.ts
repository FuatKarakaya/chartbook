import { formatPrice } from '../core/chart.ts';
import { label, stroke, type Tool } from '../core/tool.ts';

const WEEK = 7 * 86400;

/** A box from the first click to the second, labelled with the % change and the weeks between them. */
export const measure: Tool = {
  type: 'measure',
  label: 'Measure',
  clicks: 2,
  draw(ctx, [a, b], [p, q]) {
    const up = q.price >= p.price;
    const color = up ? '#26a69a' : '#ef5350';
    ctx.fillStyle = up ? 'rgba(38,166,154,0.2)' : 'rgba(239,83,80,0.2)';
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    stroke(ctx, a, b, color);
    const change = q.price - p.price;
    const sign = up ? '+' : '-';
    const text = `${sign}${Math.abs((q.price / p.price - 1) * 100).toFixed(2)}% (${sign}${formatPrice(Math.abs(change))})`
      + ` · ${(Math.abs(q.time - p.time) / WEEK).toFixed(1)} weeks`;
    // Label sits past the end of the move: above the box going up, below it going down.
    label(ctx, text, (a.x + b.x) / 2, up ? Math.min(a.y, b.y) - 18 : Math.max(a.y, b.y) + 18, color);
  },
  hit: ([a, b], x, y) =>
    x >= Math.min(a.x, b.x) && x <= Math.max(a.x, b.x) && y >= Math.min(a.y, b.y) && y <= Math.max(a.y, b.y),
};

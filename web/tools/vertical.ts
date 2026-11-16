import { COLOR, GRAB, label, stroke, type Tool } from '../core/tool.ts';

/** A date marker spanning the chart, stored as an ordinary time/price anchor. */
export const vertical: Tool = {
  type: 'vertical',
  label: 'Vertical',
  key: 'V',
  clicks: 1,
  draw(ctx, [a], { points: [p] }, { width, height, interval }) {
    stroke(ctx, { x: a.x, y: 0 }, { x: a.x, y: height });
    if (a.x < 0 || a.x > width) return;
    const intraday = interval === '1h' || interval === '4h';
    const date = new Date(p.time * 1000).toISOString().slice(0, intraday ? 16 : 10).replace('T', ' ');
    label(ctx, date, Math.max(70, Math.min(width - 70, a.x)), height - 14, COLOR);
  },
  hit: ([a], x) => Math.abs(x - a.x) <= GRAB,
};

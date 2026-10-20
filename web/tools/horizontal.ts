import { formatPrice } from '../core/chart.ts';
import { COLOR, GRAB, label, stroke, type Tool } from '../core/tool.ts';

export const horizontal: Tool = {
  type: 'horizontal',
  label: 'Horizontal',
  key: 'H',
  clicks: 1,
  draw(ctx, [a], { points: [p] }, { width }) {
    stroke(ctx, { x: 0, y: a.y }, { x: width, y: a.y });
    label(ctx, formatPrice(p.price), width - 4, a.y, COLOR, 'right');
  },
  hit: ([a], _, y) => Math.abs(y - a.y) <= GRAB,
};

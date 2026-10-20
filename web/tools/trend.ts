import { nearSegment, stroke, type Tool } from '../core/tool.ts';

export const trend: Tool = {
  type: 'trend',
  label: 'Trend line',
  key: 'T',
  clicks: 2,
  draw: (ctx, [a, b]) => stroke(ctx, a, b),
  hit: ([a, b], x, y) => nearSegment(a, b, x, y),
};

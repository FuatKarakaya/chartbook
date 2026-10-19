import { nearSegment, stroke, type Px, type Size, type Tool } from '../core/tool.ts';

/** A point past the chart's edge, on the line from a through b. */
const far = (a: Px, b: Px, size: Size): Px => {
  const k = (size.width + size.height) / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
};

export const ray: Tool = {
  type: 'ray',
  label: 'Ray',
  clicks: 2,
  draw: (ctx, [a, b], _, size) => stroke(ctx, a, far(a, b, size)),
  hit: ([a, b], x, y, size) => nearSegment(a, far(a, b, size), x, y),
};

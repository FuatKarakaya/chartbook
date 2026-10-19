import type { Anchor } from '../../shared/types.ts';

export interface Px { x: number; y: number }
export interface Size { width: number; height: number }

export const COLOR = '#26c6da';

/**
 * A drawing tool, one file in web/tools/. A drawing is plain JSON (shared/types.ts Drawing), so saving it is just
 * JSON.stringify; the editor (core/drawings.ts) turns clicks into its points and every point into a drag handle.
 * `px` are the points in screen pixels, `points` the same points as time + price.
 */
export interface Tool {
  type: string;
  label: string;
  /** Clicks that create one; each click becomes one point. */
  clicks: number;
  draw(ctx: CanvasRenderingContext2D, px: Px[], points: Anchor[], size: Size): void;
  /** Whether (x, y) is on the drawing's body (the editor tests the handles). */
  hit(px: Px[], x: number, y: number, size: Size): boolean;
}

/** How close (CSS pixels) the mouse must be to grab a line. */
export const GRAB = 6;

export function stroke(ctx: CanvasRenderingContext2D, a: Px, b: Px, color = COLOR) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

export function nearSegment(a: Px, b: Px, x: number, y: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(a.x + t * dx - x, a.y + t * dy - y) <= GRAB;
}

/** A text box centred on (x, y), or ending at x when `align` is 'right'. */
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string, align = 'center') {
  ctx.font = '12px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 12;
  const left = align === 'right' ? x - w : x - w / 2;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(left, y - 10, w, 20, 3);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + 6, y);
}

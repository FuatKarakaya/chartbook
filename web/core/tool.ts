import type { Anchor } from '../../shared/types.ts';
import { formatPrice } from './chart.ts';

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
  /** Points jump to the nearest open, high, low or close of the candle under the mouse. */
  snap?: boolean;
  /** Not saved: shown until the next click or Esc (a ruler). */
  temporary?: boolean;
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

/** A circle at p: a drag handle (hollow) or a ruler end (filled). */
export function dot(ctx: CanvasRenderingContext2D, p: Px, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = COLOR;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
  ctx.fill();
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

/**
 * Measure-style box from a to b (p and q as time + price), green going up, red going down, labelled with the
 * % and price change followed by `extra`, past the end of the move: above the box going up, below it going down.
 */
export function changeBox(ctx: CanvasRenderingContext2D, a: Px, b: Px, p: Anchor, q: Anchor, extra: string) {
  const up = q.price >= p.price;
  const color = up ? '#26a69a' : '#ef5350';
  ctx.fillStyle = up ? 'rgba(38,166,154,0.2)' : 'rgba(239,83,80,0.2)';
  ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  stroke(ctx, a, b, color);
  const sign = up ? '+' : '-';
  const text = `${sign}${Math.abs((q.price / p.price - 1) * 100).toFixed(2)}% (${sign}${formatPrice(Math.abs(q.price - p.price))}) · ${extra}`;
  label(ctx, text, (a.x + b.x) / 2, up ? Math.min(a.y, b.y) - 18 : Math.max(a.y, b.y) + 18, color);
}

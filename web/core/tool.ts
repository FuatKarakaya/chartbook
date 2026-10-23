import type { Anchor, Asset, Candle, Drawing, Interval, PointDrawing, Ticker } from '../../shared/types.ts';
import { formatPrice } from './chart.ts';

export interface Px { x: number; y: number }
export interface Size { width: number; height: number }

export const COLOR = '#26c6da';
/** A pattern's fits: their strips and overlays. */
export const STRIP = '#ab47bc';

/** A stretch of time to shade: darker from `from` to `to`, lighter on to `after`, labelled at the bottom (a fit). */
export interface Strip { from: number; to: number; after: number; label: string }

/** What a tool sees of the chart: its size, time/price -> pixels (also in the empty space on the right), and candles. */
export interface View extends Size {
  x(time: number): number;
  y(price: number): number;
  /** The chart's asset, or ratio of two. */
  asset: Ticker;
  interval: Interval;
  /** The bars on screen. */
  bars: Candle[];
  /** Any chart's candles on any timeframe; undefined while they download (the chart redraws once they're in). */
  candles(asset: Ticker, interval: Interval): Candle[] | undefined;
}

/** Given to a tool's controls, to change the selected drawing. */
export interface Edit<D extends Drawing> {
  /** Call after changing it: redraws, and when `done` saves it as one undo step (a slider: once let go). */
  changed(done: boolean): void;
  /** Switches the chart to another asset and adds `make(its bars)` there, as a new drawing. */
  copyTo(asset: Asset, make: (bars: Candle[]) => D): void;
  /** Adds a new drawing of any tool to this chart, selected (a pattern's fit kept as a fractal). */
  add(d: Omit<Drawing, 'id'>): void;
  /** Scrolls the chart to show these times. */
  reveal(times: number[]): void;
  /** Switches the chart to another asset, scrolled to `strip` and shading it until Esc or the next switch. */
  goTo(asset: Ticker, strip: Strip): void;
}

/**
 * A drawing tool, one file in web/tools/. A drawing is plain JSON (shared/types.ts Drawing), so saving it is just
 * JSON.stringify. The editor (core/drawings.ts) collects the clicks, draws, hit-tests and drags the handles. By
 * default the clicks become the drawing's `points` and each point is a handle; a tool storing something else (the
 * fractal) says how with `create`, `handles` and `place`. `px` are the handles in screen pixels.
 */
export interface Tool<D extends Drawing = PointDrawing> {
  type: string;
  label: string;
  /** Keyboard shortcut that picks it. */
  key: string;
  /** Clicks that create one. */
  clicks: number;
  /** Points jump to the nearest open, high, low or close of the candle under the mouse. */
  snap?: boolean;
  /** Not saved: shown until the next click or Esc (a ruler). */
  temporary?: boolean;
  /** Makes one from its clicks, or null if they don't make one (the clicks start over). */
  create?(clicks: Anchor[], view: View): Omit<D, 'id' | 'type'> | null;
  /** Its drag handles as time + price. */
  handles?(d: D, view: View): Anchor[];
  /** Applies a drag: `moved` is the dragged handle, or -1 when the whole drawing moved (every handle shifted). */
  place?(d: D, handles: Anchor[], moved: number, view: View): void;
  /** `selected` is also true while it is being made. */
  draw(ctx: CanvasRenderingContext2D, px: Px[], d: D, view: View, selected: boolean): void;
  /** Whether (x, y) is on the drawing's body (the editor tests the handles). */
  hit(px: Px[], x: number, y: number, d: D, view: View): boolean;
  /** Candles it draws (a fractal's copy), which the price scale keeps in view like the chart's own. */
  candles?(d: D, view: View): Candle[];
  /** Settings shown above the chart while one is selected, before the Delete button. */
  controls?(d: D, edit: Edit<D>, view: View): (HTMLElement | string)[];
}

/** A drawing's handles as time + price: its points unless its tool says otherwise. */
export const handlesOf = (tool: Tool<Drawing>, d: Drawing, view: View) =>
  tool.handles?.(d, view) ?? (d as PointDrawing).points;

/**
 * Ghost candles (a fractal's copy, a pattern's overlay) in `color` at `opacity`. Returns the top, left and right of
 * what is on screen, for a label (left > right: none is).
 */
export function ghostCandles(ctx: CanvasRenderingContext2D, copy: Candle[], view: View, color: string, opacity: number) {
  const xs = copy.map((c) => view.x(c.time));
  const w = copy.length > 1 ? Math.max(1, (0.6 * (xs[xs.length - 1] - xs[0])) / (copy.length - 1)) : 5;
  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  copy.forEach((c, i) => {
    const x = xs[i];
    if (x < -w || x > view.width + w) return;
    const [open, high, low, close] = [c.open, c.high, c.low, c.close].map(view.y);
    ctx.fillRect(x - 0.5, high, 1, low - high);
    ctx.fillRect(x - w / 2, Math.min(open, close), w, Math.max(1, Math.abs(close - open)));
    top = Math.min(top, high);
    left = Math.min(left, x);
    right = Math.max(right, x);
  });
  ctx.globalAlpha = 1;
  return { top, left, right };
}

export function shadeStrip(ctx: CanvasRenderingContext2D, view: View, s: Strip) {
  const [x0, x1, x2] = [s.from, s.to, s.after].map(view.x);
  ctx.fillStyle = STRIP;
  ctx.globalAlpha = 0.14;
  ctx.fillRect(x0, 0, x1 - x0, view.height);
  ctx.globalAlpha = 0.06;
  ctx.fillRect(x1, 0, x2 - x1, view.height);
  ctx.globalAlpha = 1;
  if (x2 < 0 || x0 > view.width) return;
  ctx.font = '12px system-ui, sans-serif';
  label(ctx, s.label, Math.max(x0, 0) + ctx.measureText(s.label).width / 2 + 12, view.height - 30, STRIP);
}

/** A button for a drawing's settings bar. */
export function button(text: string, onclick: () => void, title: string) {
  return Object.assign(document.createElement('button'), { textContent: text, onclick, title });
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

/** A text box centred on (x, y), or ending at x when `align` is 'right'; `bg` is a #rrggbb colour. */
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string, align = 'center') {
  ctx.font = '12px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 12;
  const left = align === 'right' ? x - w : x - w / 2;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(left, y - 10, w, 20, 3);
  ctx.fill();
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  ctx.fillStyle = 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#000' : '#fff'; // dark text on a light colour
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

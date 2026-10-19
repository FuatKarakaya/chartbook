import type { IChartApi, IPanePrimitive, ISeriesApi, Logical, SeriesType } from 'lightweight-charts';
import type { Anchor, Candle, Drawing } from '../../shared/types.ts';
import { snapToCandle } from './snap.ts';
import { timeline } from './timeline.ts';
import { dot, GRAB, type Px, type Tool } from './tool.ts';

interface Drag { d: Drawing; handle: number; start: Anchor[]; from: Px; before: string; moved: boolean }

/**
 * Draws the asset's drawings on the chart and lets you make and edit them: pick a tool, click its points;
 * with no tool, click a drawing to select it, drag it or its handles, Delete removes it, Ctrl+Z undoes.
 * A temporary tool (the ruler, also on Shift+click) isn't saved: it stays until the next click or Esc.
 * `onChange` gets the full list after every change (for saving); `onToolDone` fires when a tool finished or was cancelled.
 */
export function drawingEditor(
  chart: IChartApi, series: ISeriesApi<SeriesType>, el: HTMLElement, tools: Tool[],
  onChange: (drawings: Drawing[]) => void, onToolDone: () => void,
) {
  const time = chart.timeScale();
  const byType = new Map(tools.map((t) => [t.type, t]));
  const quick = tools.find((t) => t.temporary);
  let bars: Candle[] = [];
  let line: ReturnType<typeof timeline>;
  let drawings: Drawing[] = [];
  let undo: string[] = [];
  let selected: Drawing | null = null;
  let tool: Tool | null = null;
  let pending: Anchor[] = []; // points clicked so far for the drawing being made
  let mouse: Anchor | null = null;
  let drag: Drag | null = null;
  let ruler: { tool: Tool; points: Anchor[] } | null = null; // a finished temporary measurement
  let redraw = () => {};

  // logicalToCoordinate only takes whole bars, and a daily point on the weekly chart sits between two.
  const xAt = (l: number) => {
    const i = Math.floor(l);
    const x = time.logicalToCoordinate(i as Logical)!;
    return x + (l - i) * (time.logicalToCoordinate((i + 1) as Logical)! - x);
  };
  const toPx = (a: Anchor): Px => ({
    x: xAt(line.toLogical(a.time)),
    y: series.priceToCoordinate(a.price) ?? NaN,
  });
  const logicalAt = (x: number) => time.coordinateToLogical(x) ?? 0;
  // Clicks snap to the nearest bar (or future bar slot) in time; price is wherever the mouse is, or the nearest
  // open/high/low/close for a snapping tool.
  const toAnchor = (p: Px): Anchor => tool?.snap
    ? snapToCandle(bars, logicalAt(p.x), p.y, (price) => series.priceToCoordinate(price) ?? NaN)
    : { time: line.toTime(Math.round(logicalAt(p.x))), price: series.coordinateToPrice(p.y)! };
  const size = () => ({ width: time.width(), height: chart.panes()[0].getHeight() });
  const commit = (before: string) => {
    undo.push(before);
    onChange(drawings);
    redraw();
  };

  /** The drawing under the mouse; `handle` is the grabbed point's index, or -1 for the body. */
  function hitAt(p: Px) {
    const near = (q: Px) => Math.hypot(q.x - p.x, q.y - p.y) <= GRAB + 2;
    const order = [...drawings].reverse(); // last drawn is on top
    for (const d of order) {
      const handle = d.points.map(toPx).findIndex(near);
      if (handle >= 0) return { d, handle };
    }
    const d = order.find((d) => byType.get(d.type)!.hit(d.points.map(toPx), p.x, p.y, size()));
    return d && { d, handle: -1 };
  }

  function render(ctx: CanvasRenderingContext2D) {
    const s = size();
    for (const d of drawings) byType.get(d.type)!.draw(ctx, d.points.map(toPx), d.points, s);
    if (ruler) ruler.tool.draw(ctx, ruler.points.map(toPx), ruler.points, s);
    if (tool && pending.length && mouse) {
      const points = [...pending, mouse];
      tool.draw(ctx, points.map(toPx), points, s);
    }
    for (const p of selected?.points.map(toPx) ?? []) dot(ctx, p, 5, '#131722');
  }

  const layer: IPanePrimitive = {
    attached: ({ requestUpdate }) => void (redraw = requestUpdate),
    paneViews: () => [{
      zOrder: () => 'top',
      renderer: () => ({ draw: (target) => target.useMediaCoordinateSpace(({ context }) => render(context)) }),
    }],
    // Only sets the mouse cursor; clicks and drags are handled below.
    hitTest(x, y) {
      if (tool) return { externalId: 'new', zOrder: 'top', cursorStyle: 'crosshair' };
      const h = hitAt({ x, y });
      return h ? { externalId: h.d.id, zOrder: 'top', cursorStyle: h.handle >= 0 ? 'pointer' : 'move' } : null;
    },
  };
  chart.panes()[0].attachPrimitive(layer);

  const pointAt = (e: PointerEvent): Px => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const finishTool = () => {
    tool = null;
    pending = [];
    onToolDone();
  };

  // Capture phase, so a click that makes or grabs a drawing never reaches the chart (which would pan instead).
  el.addEventListener('pointerdown', (e) => {
    const p = pointAt(e);
    const s = size();
    if (e.button !== 0 || p.x > s.width || p.y > s.height) return;
    ruler = null; // any click clears the last one
    if (!tool && e.shiftKey && quick) tool = quick;
    const grab = () => {
      e.preventDefault(); // also stops the chart's own mousedown
      e.stopPropagation();
    };
    if (tool) {
      grab();
      pending.push(toAnchor(p));
      if (pending.length === tool.clicks && tool.temporary) {
        ruler = { tool, points: pending };
        finishTool();
      } else if (pending.length === tool.clicks) {
        const before = JSON.stringify(drawings);
        selected = { id: crypto.randomUUID(), type: tool.type, points: pending };
        drawings.push(selected);
        finishTool();
        commit(before);
      }
      return redraw();
    }
    const h = hitAt(p);
    selected = h?.d ?? null;
    redraw();
    if (!h) return;
    grab();
    el.setPointerCapture(e.pointerId);
    drag = { ...h, start: h.d.points.map((a) => ({ ...a })), from: p, before: JSON.stringify(drawings), moved: false };
  }, true);

  el.addEventListener('pointermove', (e) => {
    const p = pointAt(e);
    if (tool) {
      mouse = toAnchor(p);
      return redraw();
    }
    if (!drag) return;
    drag.moved = true;
    const { d, handle, start, from } = drag;
    if (handle >= 0) d.points[handle] = toAnchor(p);
    else {
      // Whole drawing: shift by whole bars in time and by the mouse's pixels in price (so log scale looks right).
      const bars = Math.round(logicalAt(p.x) - logicalAt(from.x));
      d.points = start.map((a) => ({
        time: line.toTime(line.toLogical(a.time) + bars),
        price: series.coordinateToPrice(series.priceToCoordinate(a.price)! + p.y - from.y)!,
      }));
    }
    redraw();
  });

  el.addEventListener('pointerup', () => {
    if (drag?.moved) commit(drag.before);
    drag = null;
  });

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (tool) finishTool();
      selected = null;
      ruler = null;
      redraw();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
      const before = JSON.stringify(drawings);
      drawings = drawings.filter((d) => d !== selected);
      selected = null;
      commit(before);
    } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && undo.length) {
      e.preventDefault();
      drawings = JSON.parse(undo.pop()!);
      selected = null;
      onChange(drawings);
      redraw();
    }
  });

  return {
    /** Shows another asset's drawings; undo history starts fresh. */
    load(list: Drawing[]) {
      drawings = list;
      undo = [];
      selected = null;
      pending = [];
      ruler = null;
      redraw();
    },
    /** The bars on screen, for placing drawings made on any timeframe. */
    setBars(candles: Candle[]) {
      bars = candles;
      line = timeline(candles.map((b) => b.time));
      redraw();
    },
    count: () => drawings.length,
    /** Deletes every drawing on this asset (Ctrl+Z brings them back). */
    clear() {
      const before = JSON.stringify(drawings);
      drawings = [];
      selected = null;
      commit(before);
    },
    /** Picks a tool by type, or null for the plain pointer. */
    setTool(type: string | null) {
      tool = type ? byType.get(type)! : null;
      pending = [];
      selected = null;
      redraw();
    },
  };
}

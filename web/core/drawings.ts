import type { Anchor, Drawing, PointDrawing, Ticker } from '../../shared/types.ts';
import type { createMainChart } from './chart.ts';
import { drawingLayer } from './layer.ts';
import { handlesOf, type Edit, type Px, type Tool } from './tool.ts';
import { chartView } from './view.ts';

interface Drag { d: Drawing; handle: number; start: Anchor[]; from: Px; moved: boolean }
interface App {
  /** Gets the full list after every change, for saving. */
  save(drawings: Drawing[]): void;
  /** A tool finished or was cancelled. */
  toolDone(): void;
  /** Switches the chart to another asset (a fractal copied onto it). */
  showAsset(asset: Ticker): Promise<void>;
}

/**
 * Lets you make and edit the asset's drawings: pick a tool, click its points; with no tool, click a drawing to
 * select it, drag it or its handles, Delete removes it, Ctrl+Z undoes. A selected drawing gets a bar above the
 * chart with its tool's settings and a Delete button.
 * A temporary tool (the ruler, also on Shift+click) isn't saved: it stays until the next click or Esc.
 */
export function drawingEditor(main: ReturnType<typeof createMainChart>, el: HTMLElement, tools: Tool<Drawing>[], app: App) {
  const byType = new Map(tools.map((t) => [t.type, t]));
  const toolOf = (d: Drawing) => byType.get(d.type)!;
  const quick = tools.find((t) => t.temporary);
  let drawings: Drawing[] = [];
  let saved = '[]'; // the drawings as last saved; undo steps back through earlier ones
  let undo: string[] = [];
  let selected: Drawing | null = null;
  let tool: Tool<Drawing> | null = null;
  let pending: Anchor[] = []; // points clicked so far for the drawing being made
  let mouse: Anchor | null = null;
  let drag: Drag | null = null;
  let ruler: Drawing | null = null; // a finished temporary measurement

  const coords = chartView(main, () => layer.redraw());
  const view = coords.view;
  /** What the picked tool makes of these clicks, or null. */
  const make = (points: Anchor[]): Drawing | null => {
    const made = tool!.create ? tool!.create(points, view()) : { points };
    return made && { id: crypto.randomUUID(), type: tool!.type, ...made };
  };
  const layer = drawingLayer(main, coords, toolOf, () => ({
    drawings, selected, ruler, making: !!tool, dragging: !!drag,
    preview: tool && pending.length && mouse ? make([...pending, mouse]) : null,
  }));
  const commit = () => {
    undo.push(saved);
    saved = JSON.stringify(drawings);
    app.save(drawings);
    layer.redraw();
  };

  const bar = document.createElement('div');
  bar.className = 'drawing-bar';
  el.after(bar);
  const remove = () => {
    drawings = drawings.filter((d) => d !== selected);
    select(null);
    commit();
  };
  const edit: Edit<Drawing> = {
    changed: (done) => (done ? commit() : layer.redraw()),
    copyTo: (a, copy) => void app.showAsset(a).then(() => add({ ...copy(view().bars), id: crypto.randomUUID() }, true)),
    add: (d) => add({ ...d, id: crypto.randomUUID() }),
    reveal: (times) => coords.reveal(times),
  };
  function select(d: Drawing | null) {
    selected = d;
    bar.hidden = !d;
    if (!d) return;
    const del = Object.assign(document.createElement('button'), { textContent: 'Delete', onclick: remove });
    bar.replaceChildren(...toolOf(d).controls?.(d, edit, view()) ?? [], del);
  }
  select(null);

  /**
   * Adds a finished drawing, selected, and scrolls to it if any handle is off screen (a fractal starts at the last
   * candle) or `reveal` (a copy: just switched asset, so the chart's own scroll there hasn't happened yet).
   */
  function add(d: Drawing, reveal = false) {
    drawings.push(d);
    select(d);
    commit();
    const v = view();
    const times = handlesOf(toolOf(d), d, v).map((a) => a.time);
    if (reveal || times.some((t) => v.x(t) < 0 || v.x(t) > v.width)) coords.reveal(times);
  }

  const pointAt = (e: PointerEvent): Px => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const finishTool = () => {
    tool = null;
    pending = [];
    app.toolDone();
  };

  // Capture phase, so a click that makes or grabs a drawing never reaches the chart (which would pan instead).
  el.addEventListener('pointerdown', (e) => {
    const p = pointAt(e);
    const { width, height } = view();
    if (e.button !== 0 || p.x > width || p.y > height) return;
    ruler = null; // any click clears the last one
    if (!tool && e.shiftKey && quick) tool = quick;
    const grab = () => {
      e.preventDefault(); // also stops the chart's own mousedown
      e.stopPropagation();
    };
    if (tool) {
      grab();
      pending.push(coords.anchorAt(p, tool.snap));
      if (pending.length < tool.clicks) return layer.redraw();
      const d = make(pending);
      if (!d) pending = []; // e.g. a fractal of fewer than 2 candles: pick again
      else if (tool.temporary) {
        ruler = d;
        finishTool();
      } else {
        finishTool();
        add(d);
      }
      return layer.redraw();
    }
    const h = layer.hitAt(p);
    select(h?.d ?? null);
    layer.redraw();
    if (!h) return;
    grab();
    el.setPointerCapture(e.pointerId);
    drag = { ...h, start: handlesOf(toolOf(h.d), h.d, view()), from: p, moved: false };
  }, true);

  el.addEventListener('pointermove', (e) => {
    const p = pointAt(e);
    if (tool) {
      mouse = coords.anchorAt(p, tool.snap);
      return layer.redraw();
    }
    if (!drag) return;
    drag.moved = true;
    const { d, handle, start, from } = drag;
    // A handle goes where the mouse is; the whole drawing moves with it.
    const points = handle >= 0 ? start.map((a, i) => (i === handle ? coords.anchorAt(p) : a)) : start.map((a) => coords.shift(a, from, p));
    const t = toolOf(d);
    if (t.place) t.place(d, points, handle, view());
    else (d as PointDrawing).points = points;
    layer.redraw();
  });

  el.addEventListener('pointerup', () => {
    const moved = drag?.moved;
    drag = null;
    if (moved) commit();
  });

  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return; // typing in a box (Settings, a fractal's colour)
    if (e.key === 'Escape') {
      if (tool) finishTool();
      select(null);
      ruler = null;
      layer.redraw();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) remove();
    else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && undo.length) {
      e.preventDefault();
      saved = undo.pop()!;
      drawings = JSON.parse(saved);
      select(null);
      app.save(drawings);
      layer.redraw();
    }
  });

  return {
    /** Shows another chart's drawings; undo history starts fresh. */
    load(list: Drawing[]) {
      drawings = list;
      saved = JSON.stringify(list);
      undo = [];
      select(null);
      pending = [];
      ruler = null;
      layer.redraw();
    },
    /** The bars on screen, for placing drawings made on any timeframe; the selected one's bar is rebuilt for them. */
    setBars(...args: Parameters<typeof coords.setBars>) {
      coords.setBars(...args);
      select(selected);
      layer.redraw();
    },
    count: () => drawings.length,
    /** Deletes every drawing on this chart (Ctrl+Z brings them back). */
    clear() {
      drawings = [];
      select(null);
      commit();
    },
    /** Picks a tool by type, or null for the plain pointer. */
    setTool(type: string | null) {
      tool = type ? byType.get(type)! : null;
      pending = [];
      select(null);
      layer.redraw();
    },
  };
}

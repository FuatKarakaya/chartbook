import type { IPanePrimitive } from 'lightweight-charts';
import type { Drawing } from '../../shared/types.ts';
import type { createMainChart } from './chart.ts';
import { dot, GRAB, handlesOf, shadeStrip, type Px, type Strip, type Tool, type View } from './tool.ts';
import type { chartView } from './view.ts';

/** What is on screen: the saved drawings, the selected one, and unsaved ones (a ruler, one being made). */
export interface Scene {
  drawings: Drawing[];
  selected: Drawing | null;
  ruler: Drawing | null;
  preview: Drawing | null;
  /** A fit from another chart's pattern, shaded here. */
  strip: Strip | null;
  /** A tool is picked: the mouse shows a crosshair. */
  making: boolean;
  dragging: boolean;
}

/**
 * The canvas layer the drawings live on: draws the scene, finds the drawing under the mouse, and widens the price
 * scale to fit the candles drawings draw (a fractal's copy).
 */
export function drawingLayer(
  main: ReturnType<typeof createMainChart>, coords: ReturnType<typeof chartView>,
  toolOf: (d: Drawing) => Tool<Drawing>, scene: () => Scene,
) {
  let redraw = () => {};
  const px = (d: Drawing, v: View) => handlesOf(toolOf(d), d, v).map((a) => ({ x: v.x(a.time), y: v.y(a.price) }));

  function render(ctx: CanvasRenderingContext2D) {
    const { drawings, selected, ruler, preview, strip } = scene();
    const v = coords.view();
    if (strip) shadeStrip(ctx, v, strip);
    for (const d of drawings) toolOf(d).draw(ctx, px(d, v), d, v, d === selected);
    if (ruler) toolOf(ruler).draw(ctx, px(ruler, v), ruler, v, false);
    if (preview) toolOf(preview).draw(ctx, px(preview, v), preview, v, true);
    for (const p of selected ? px(selected, v) : []) dot(ctx, p, 5, '#0f1219');
  }

  /** The drawing under the mouse; `handle` is the grabbed handle's index, or -1 for the body. */
  function hitAt(p: Px) {
    const near = (q: Px) => Math.hypot(q.x - p.x, q.y - p.y) <= GRAB + 2;
    const v = coords.view();
    const order = [...scene().drawings].reverse(); // last drawn is on top
    for (const d of order) {
      const handle = px(d, v).findIndex(near);
      if (handle >= 0) return { d, handle };
    }
    const d = order.find((d) => toolOf(d).hit(px(d, v), p.x, p.y, d, v));
    return d && { d, handle: -1 };
  }

  const layer: IPanePrimitive = {
    attached: ({ requestUpdate }) => void (redraw = requestUpdate),
    paneViews: () => [{
      zOrder: () => 'top',
      renderer: () => ({ draw: (target) => target.useMediaCoordinateSpace(({ context }) => render(context)) }),
    }],
    // Only sets the mouse cursor; the editor handles clicks and drags.
    hitTest(x, y) {
      if (scene().making) return { externalId: 'new', zOrder: 'top', cursorStyle: 'crosshair' };
      const h = hitAt({ x, y });
      return h ? { externalId: h.d.id, zOrder: 'top', cursorStyle: h.handle >= 0 ? 'pointer' : 'move' } : null;
    },
  };
  main.chart.panes()[0].attachPrimitive(layer);

  // Holds still mid-drag, or the scale would chase the mouse.
  let fit: { minValue: number; maxValue: number } | null = null;
  main.fit((from, to) => {
    const { drawings, dragging } = scene();
    if (dragging) return fit;
    let [minValue, maxValue] = [Infinity, -Infinity];
    const v = coords.view();
    for (const d of drawings) {
      for (const c of toolOf(d).candles?.(d, v) ?? []) {
        const l = coords.toLogical(c.time);
        if (l < from || l > to) continue;
        minValue = Math.min(minValue, c.low);
        maxValue = Math.max(maxValue, c.high);
      }
    }
    return (fit = minValue <= maxValue ? { minValue, maxValue } : null);
  });

  return { redraw: () => redraw(), hitAt };
}

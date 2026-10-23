import { biggestMove, type Fractal, project, stretch } from '../../shared/fractal.ts';
import { ASSET_NAMES, ASSETS, tickerName } from '../../shared/types.ts';
import { button, ghostCandles, GRAB, label, type Px, type Tool, type View } from '../core/tool.ts';

/**
 * The source candles on the chart's timeframe, or daily where that timeframe's history doesn't reach back
 * far enough (hourly S&P only covers 2 years). Empty while they download.
 */
function source(f: Fractal, view: View) {
  let all = view.candles(f.sourceAsset, view.interval);
  if (all && (all[0]?.time ?? 0) > f.srcStart) all = view.candles(f.sourceAsset, '1D');
  return all ? stretch(all, f.srcStart, f.srcEnd) : [];
}

function ghost(f: Fractal, view: View) {
  const src = source(f, view);
  return src.length ? project(f, src) : [];
}

/** Scales are kept to 2 decimals, so the label shows exactly what is stored, and above 0. */
const round = (v: number) => Math.max(0.05, Math.round(v * 100) / 100);
const date = (t: number) => new Date(t * 1000).toISOString().slice(0, t % 86400 ? 16 : 10).replace('T', ' ');

function dashed(ctx: CanvasRenderingContext2D, a: Px, b: Px) {
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Like TradingView's Bars Pattern: click the start and end of a stretch, and a ghost copy of it appears from the last
 * candle on. Drag it to move it; the handle at its end stretches time, the one on its biggest move scales the moves.
 */
export const fractal: Tool<Fractal> = {
  type: 'fractal',
  label: 'Fractal',
  key: 'F',
  clicks: 2,
  create([a, b], view) {
    if (stretch(view.bars, Math.min(a.time, b.time), Math.max(a.time, b.time)).length < 2) return null;
    const last = view.bars[view.bars.length - 1];
    return {
      sourceAsset: view.asset, srcStart: Math.min(a.time, b.time), srcEnd: Math.max(a.time, b.time),
      anchorTime: last.time, anchorPrice: last.close, timeScale: 1, moveScale: 1, flip: false,
      style: { color: '#ab47bc', opacity: 0.6 },
    };
  },
  candles: ghost,
  // Anchor, time (at the copy's end, level with the anchor), move size (on the biggest move).
  handles(f, view) {
    const src = source(f, view);
    if (!src.length) return [];
    const copy = project(f, src);
    const big = copy[biggestMove(src)];
    return [
      { time: f.anchorTime, price: f.anchorPrice },
      { time: copy[copy.length - 1].time, price: f.anchorPrice },
      { time: big.time, price: big.close },
    ];
  },
  place(f, [anchor, end, size], moved, view) {
    if (moved <= 0) return void Object.assign(f, { anchorTime: anchor.time, anchorPrice: anchor.price });
    const src = source(f, view);
    if (moved === 1) f.timeScale = round((end.time - f.anchorTime) / (src[src.length - 1].time - src[0].time));
    else {
      // The power that puts the biggest move's close at the mouse; across the anchor from the original means flipped.
      const k = Math.log(size.price / f.anchorPrice) / Math.log(src[biggestMove(src)].close / src[0].close);
      f.moveScale = round(Math.abs(k));
      f.flip = k < 0;
    }
  },
  draw(ctx, [a, end, size], f, view, selected) {
    const copy = ghost(f, view);
    if (!copy.length) return;
    ctx.fillStyle = ctx.strokeStyle = f.style.color;
    if (selected && f.sourceAsset === view.asset) {
      // Where it was copied from.
      ctx.globalAlpha = 0.12;
      ctx.fillRect(view.x(f.srcStart), 0, view.x(f.srcEnd) - view.x(f.srcStart), view.height);
    }
    const { top, left, right } = ghostCandles(ctx, copy, view, f.style.color, f.style.opacity);
    if (selected) {
      ctx.lineWidth = 1;
      dashed(ctx, a, end);
      dashed(ctx, { x: size.x, y: a.y }, size);
    }
    if (left > right) return; // all off screen
    const scale = `time x${f.timeScale} · moves x${f.moveScale}${f.flip ? ' · flipped' : ''}`;
    label(ctx, scale, Math.min(Math.max((left + right) / 2, 110), view.width - 110), Math.max(12, top - 16), f.style.color);
  },
  hit(_, x, y, f, view) {
    return ghost(f, view).some((c) =>
      Math.abs(view.x(c.time) - x) <= GRAB && y >= view.y(c.high) - GRAB && y <= view.y(c.low) + GRAB);
  },
  controls(f, edit, view) {
    const flip = button('Flip', () => {
      f.flip = !f.flip;
      flip.classList.toggle('on', f.flip);
      edit.changed(true);
    }, 'Upside down: rises become falls');
    flip.classList.toggle('on', f.flip);
    const color = Object.assign(document.createElement('input'), { type: 'color', value: f.style.color, title: 'Colour' });
    color.oninput = () => {
      f.style.color = color.value;
      edit.changed(false);
    };
    const opacity = Object.assign(document.createElement('input'), {
      type: 'range', min: '0.1', max: '1', step: '0.05', value: String(f.style.opacity), title: 'Opacity',
    });
    opacity.oninput = () => {
      f.style.opacity = Number(opacity.value);
      edit.changed(false);
    };
    color.onchange = opacity.onchange = () => edit.changed(true);
    // A copy on another asset starts from that asset's last candle, like a new one.
    const copies = ASSETS.filter((a) => a !== view.asset).map((asset) =>
      button(ASSET_NAMES[asset], () => edit.copyTo(asset, (bars) => ({
        ...structuredClone(f), anchorTime: bars[bars.length - 1].time, anchorPrice: bars[bars.length - 1].close,
      })), `Copy this fractal onto ${ASSET_NAMES[asset]}, starting at its last candle`));
    return [`Fractal of ${tickerName(f.sourceAsset)} ${date(f.srcStart)} to ${date(f.srcEnd)}`, flip, color, opacity, 'Copy to', ...copies];
  },
};

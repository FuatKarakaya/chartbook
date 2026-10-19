import { ASSET_NAMES, tickerName, type Anchor, type Asset, type Candle, type Drawing, type Ticker } from '../../shared/types.ts';
import { GRAB, label, type Px, type Tool, type View } from '../core/tool.ts';

/** A ghost copy of a stretch of candles (PLAN.md's stored shape). */
export interface Fractal extends Drawing {
  /** An asset, or a ratio of two. */
  sourceAsset: Ticker;
  /** The stretch copied (UTC seconds). */
  srcStart: number;
  srcEnd: number;
  /** Where the copy's first close sits. */
  anchorTime: number;
  anchorPrice: number;
  /** 2 = the copy takes twice as long as the original. */
  timeScale: number;
  /** 0.5 = half the original's moves (half the height on a log scale). */
  moveScale: number;
  /** Upside down: rises become falls. */
  flip: boolean;
  style: { color: string; opacity: number };
}

/** The candles copied: from the one holding `from` (so 1W/1M take the week or month it falls in) to the last at `to`. */
export function stretch(all: Candle[], from: number, to: number) {
  return all.slice(Math.max(0, all.findLastIndex((c) => c.time <= from)), all.findLastIndex((c) => c.time <= to) + 1);
}

/**
 * The ghost candles: `src` moved so its first close sits on the anchor, every move from that close scaled
 * (price_i = anchorPrice * (c_i / c_0) ^ (moveScale * (flip ? -1 : 1))) and time stretched
 * (t_i = anchorTime + timeScale * (t_i_src - t_0_src)). Flipped, highs and lows swap.
 */
export function project(f: Fractal, src: Candle[]): Candle[] {
  const k = f.moveScale * (f.flip ? -1 : 1);
  const at = (p: number) => f.anchorPrice * (p / src[0].close) ** k;
  return src.map((c) => {
    const [high, low] = [at(c.high), at(c.low)];
    return {
      time: f.anchorTime + f.timeScale * (c.time - src[0].time),
      open: at(c.open), high: Math.max(high, low), low: Math.min(high, low), close: at(c.close),
    };
  });
}

/** Index of the candle whose close is furthest (in %) from the first one's: the move-size handle sits on it. */
export function biggestMove(src: Candle[]) {
  const size = (c: Candle) => Math.abs(Math.log(c.close / src[0].close));
  return src.reduce((best, c, i) => (size(c) > size(src[best]) ? i : best), 0);
}

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

function button(text: string, onclick: () => void, title = '') {
  return Object.assign(document.createElement('button'), { textContent: text, onclick, title });
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
    const xs = copy.map((c) => view.x(c.time));
    const w = copy.length > 1 ? Math.max(1, (0.6 * (xs[xs.length - 1] - xs[0])) / (copy.length - 1)) : 5;
    ctx.fillStyle = ctx.strokeStyle = f.style.color;
    if (selected && f.sourceAsset === view.asset) {
      // Where it was copied from.
      ctx.globalAlpha = 0.12;
      ctx.fillRect(view.x(f.srcStart), 0, view.x(f.srcEnd) - view.x(f.srcStart), view.height);
    }
    ctx.globalAlpha = f.style.opacity;
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
    const copies = (Object.keys(ASSET_NAMES) as Asset[]).filter((a) => a !== view.asset).map((asset) =>
      button(ASSET_NAMES[asset], () => edit.copyTo(asset, (bars) => ({
        ...structuredClone(f), anchorTime: bars[bars.length - 1].time, anchorPrice: bars[bars.length - 1].close,
      })), `Copy this fractal onto ${ASSET_NAMES[asset]}, starting at its last candle`));
    return [`Fractal of ${tickerName(f.sourceAsset)} ${date(f.srcStart)} to ${date(f.srcEnd)}`, flip, color, opacity, 'Copy to', ...copies];
  },
};

import { type Fractal, project, stretch } from '../../shared/fractal.ts';
import { findFits, type Fit, pieces, swings } from '../../shared/patterns.ts';
import type { Candle, Drawing } from '../../shared/types.ts';
import { buttonGroup } from '../core/buttons.ts';
import { COLOR, ghostCandles, label, nearSegment, stroke, type Tool, type View } from '../core/tool.ts';

/** A picked stretch and how to search for look-alikes of it; the look-alikes ("fits") are worked out, not stored. */
export interface Pattern extends Drawing {
  start: number;
  end: number;
  /** How much of the likeness is direction, 0.5..1; the rest is size. */
  weight: number;
  /** Also count look-alikes that played out at ½× to 2× the speed. */
  speeds: boolean;
  /** The fit shown: 0 = the best. */
  fit: number;
  /** Draws the fit and what came after it over the pattern, like a fractal (see asFractal). */
  overlay: boolean;
}

const FIT = '#ab47bc';
const MIN_BARS = 10;
const pct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(0)}%`;
const date = (t: number) => new Date(t * 1000).toISOString().slice(0, t % 86400 ? 16 : 10).replace('T', ' ');
const round = (v: number) => Math.max(0.05, Math.round(v * 100) / 100); // as the fractal keeps its scales

/** The pattern's first and last bar: the one holding its start, the last at its end. */
const span = (bars: Candle[], p: Pattern) =>
  [Math.max(0, bars.findLastIndex((c) => c.time <= p.start)), bars.findLastIndex((c) => c.time <= p.end)];
const logs = (bars: Candle[]) => bars.map((c) => Math.log(c.close));
/** "↗+34% ↘-12%": the stretch's legs up and down. */
const legs = (bars: Candle[], from: number, to: number) =>
  swings(pieces(logs(bars), from, to)).map((l) => `${l > 0 ? '↗' : '↘'}${pct(Math.exp(l) - 1)}`).join(' ');

/** Searches done, by what they depend on: the chart's bars and the pattern's stretch and settings. */
const searched = new Map<string, Fit[]>();
function fitsOf(p: Pattern, view: View) {
  const { bars } = view;
  const key = `${view.asset} ${view.interval} ${bars.length} ${bars.at(-1)?.time} ${p.start} ${p.end} ${p.weight} ${p.speeds}`;
  if (!searched.has(key)) {
    if (searched.size > 50) searched.clear();
    const [from, to] = span(bars, p);
    searched.set(key, to - from + 1 >= MIN_BARS ? findFits(bars.map((c) => c.close), from, to, p) : []);
  }
  return searched.get(key)!;
}

/** Where what came after a fit ends: as many bars on as the fit took, or the last bar. */
const afterEnd = (bars: Candle[], f: Fit) => Math.min(bars.length - 1, f.end + f.end - f.start);

/**
 * The fit and what came after it as a fractal over the pattern: stretched to its length and the size of its moves,
 * and lined up so the fit ends on the pattern's last close, so what came after starts from there.
 */
function asFractal(p: Pattern, f: Fit, view: View): Omit<Fractal, 'id'> {
  const { bars } = view;
  const [from, to] = span(bars, p);
  const size = (a: number, b: number) => Math.hypot(...pieces(logs(bars), a, b));
  const moveScale = round(size(from, to) / size(f.start, f.end));
  return {
    type: 'fractal', sourceAsset: view.asset, srcStart: bars[f.start].time, srcEnd: bars[afterEnd(bars, f)].time,
    anchorTime: bars[from].time, anchorPrice: bars[to].close * (bars[f.start].close / bars[f.end].close) ** moveScale,
    timeScale: round((bars[to].time - bars[from].time) / (bars[f.end].time - bars[f.start].time)),
    moveScale, flip: false, style: { color: FIT, opacity: 0.6 },
  };
}

function overlay(p: Pattern, view: View) {
  const f = p.overlay && fitsOf(p, view)[p.fit];
  if (!f) return [];
  const ghost = asFractal(p, f, view) as Fractal;
  return project(ghost, stretch(view.bars, ghost.srcStart, ghost.srcEnd));
}

/** "then +12% (high +40%, low -8%)": what came after a fit, from its last close. */
function then(bars: Candle[], f: Fit) {
  const next = bars.slice(f.end + 1, afterEnd(bars, f) + 1);
  if (!next.length) return 'nothing after it yet';
  const from = bars[f.end].close;
  const high = Math.max(...next.map((c) => c.high)) / from - 1;
  const low = Math.min(...next.map((c) => c.low)) / from - 1;
  return `then ${next.length < f.end - f.start ? 'so far ' : ''}${pct(next.at(-1)!.close / from - 1)} (high ${pct(high)}, low ${pct(low)})`;
}

function button(text: string, onclick: () => void, title: string) {
  return Object.assign(document.createElement('button'), { textContent: text, onclick, title });
}

/**
 * Click the start and end of a stretch: the past stretches whose ups and downs look most like it are found
 * (shared/patterns.ts). Step through them in the bar above the chart: each is shaded where it happened, with what came
 * after it, and can be laid over the pattern like a fractal, or kept as one.
 */
export const pattern: Tool<Pattern> = {
  type: 'pattern',
  label: 'Pattern',
  key: 'S',
  clicks: 2,
  create([a, b], view) {
    const p = { start: Math.min(a.time, b.time), end: Math.max(a.time, b.time), weight: 0.7, speeds: true, fit: 0, overlay: true };
    const [from, to] = span(view.bars, p as Pattern);
    return to - from + 1 >= MIN_BARS ? p : null;
  },
  candles: overlay,
  // The ends of a bracket over the stretch's candles.
  handles(p, view) {
    const bars = stretch(view.bars, p.start, p.end);
    if (!bars.length) return [];
    const top = Math.max(...bars.map((c) => c.high)) * 1.03;
    return [{ time: p.start, price: top }, { time: p.end, price: top }];
  },
  place(p, [a, b]) {
    [p.start, p.end, p.fit] = [Math.min(a.time, b.time), Math.max(a.time, b.time), 0];
  },
  draw(ctx, [a, b], p, view, selected) {
    if (!a) return;
    const { bars } = view;
    ctx.fillStyle = COLOR;
    ctx.globalAlpha = 0.07;
    ctx.fillRect(a.x, 0, b.x - a.x, view.height);
    ctx.globalAlpha = 1;
    stroke(ctx, a, b);
    for (const end of [a, b]) stroke(ctx, end, { x: end.x, y: end.y + 8 });
    const fits = fitsOf(p, view);
    const f = fits[p.fit];
    const [from, to] = span(bars, p);
    const text = to - from + 1 < MIN_BARS ? `Pattern: under ${MIN_BARS} candles on this timeframe`
      : `Pattern ${legs(bars, from, to)}${f ? ` · fit ${p.fit + 1}: ${(f.score * 100).toFixed(0)}% alike` : ''}`;
    label(ctx, text, (a.x + b.x) / 2, a.y - 14, selected ? COLOR : '#2a2e39');
    if (!f) return;
    // Where the fit happened, and lighter, what came after it.
    const [x0, x1, x2] = [f.start, f.end, afterEnd(bars, f)].map((i) => view.x(bars[i].time));
    ctx.fillStyle = FIT;
    ctx.globalAlpha = 0.14;
    ctx.fillRect(x0, 0, x1 - x0, view.height);
    ctx.globalAlpha = 0.06;
    ctx.fillRect(x1, 0, x2 - x1, view.height);
    ctx.globalAlpha = 1;
    if (x2 > 0 && x0 < view.width) {
      label(ctx, `Fit ${p.fit + 1} · ${(f.score * 100).toFixed(0)}% alike`, Math.max(x0, 0) + 70, view.height - 30, FIT);
    }
    if (p.overlay) ghostCandles(ctx, overlay(p, view), view, FIT, 0.5);
  },
  hit: (px, x, y) => nearSegment(px[0], px[1], x, y) || (x >= px[0].x && x <= px[1].x && y >= px[0].y - 26 && y <= px[0].y),
  controls(p, edit, view) {
    const { bars } = view;
    const [info, weightText] = [document.createElement('span'), document.createElement('span')];
    const picker = document.createElement('div');
    picker.className = 'labelled';
    const show = () => {
      const f = fitsOf(p, view)[p.fit];
      if (f) edit.reveal([bars[f.start].time, bars[afterEnd(bars, f)].time]);
    };
    const refresh = () => {
      const fits = fitsOf(p, view);
      const f = fits[p.fit];
      picker.replaceChildren('Fit');
      buttonGroup(picker, fits.map((_, i) => [String(i), String(i + 1)]), String(p.fit), (i) => {
        p.fit = Number(i);
        edit.changed(true);
        refresh();
        show();
      });
      const up = fits.filter((g) => afterEnd(bars, g) > g.end && bars[afterEnd(bars, g)].close > bars[g.end].close).length;
      info.textContent = !f ? `No look-alikes: pick at least ${MIN_BARS} candles` : `${(f.score * 100).toFixed(0)}% alike: `
        + `${date(bars[f.start].time)} to ${date(bars[f.end].time)}, ${f.speed.toFixed(1)}× as long, ${legs(bars, f.start, f.end)}, `
        + `${then(bars, f)} · ${up} of ${fits.length} fits went up after`;
      weightText.textContent = `Direction ${(p.weight * 100).toFixed(0)}% · size ${(100 - p.weight * 100).toFixed(0)}%`;
    };
    const toggle = (text: string, key: 'overlay' | 'speeds', title: string) => {
      const b = button(text, () => {
        p[key] = !p[key];
        b.classList.toggle('on', p[key]);
        if (key === 'speeds') p.fit = 0;
        edit.changed(true);
        refresh();
      }, title);
      b.classList.toggle('on', p[key]);
      return b;
    };
    const weight = Object.assign(document.createElement('input'), {
      type: 'range', min: '0.5', max: '1', step: '0.05', value: String(p.weight),
      title: 'How much the ups and downs count against the size of the moves',
    });
    weight.oninput = () => {
      [p.weight, p.fit] = [Number(weight.value), 0];
      edit.changed(false);
      refresh();
    };
    weight.onchange = () => edit.changed(true);
    refresh();
    return [
      picker, info,
      button('Go to fit', show, 'Scroll to where this fit happened'),
      button('Back to mine', () => edit.reveal([p.start, p.end + (p.end - p.start)]), 'Scroll back to your stretch'),
      toggle('Overlay', 'overlay', 'Lay the fit and what came after it over your stretch, like a fractal'),
      button('Keep as fractal', () => {
        const f = fitsOf(p, view)[p.fit];
        if (!f) return;
        p.overlay = false;
        edit.add(asFractal(p, f, view));
      }, 'Make the overlay a fractal you can move, stretch and keep'),
      weight, weightText,
      toggle('½×–2× speed', 'speeds', 'Also count look-alikes that took from half to twice as long'),
    ];
  },
};

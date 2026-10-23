import { type Fractal, project, stretch } from '../../shared/fractal.ts';
import { after, fitsIn, type Found as FoundIn, pieces, swings } from '../../shared/patterns.ts';
import { type Candle, type Drawing, type Ticker, tickerName } from '../../shared/types.ts';
import { buttonGroup } from '../core/buttons.ts';
import { button, COLOR, ghostCandles, label, nearSegment, shadeStrip, STRIP, stroke, type Tool, type View } from '../core/tool.ts';

/** A picked stretch and how to search for look-alikes of it; the look-alikes ("fits") are worked out, not stored. */
export interface Pattern extends Drawing {
  start: number;
  end: number;
  /** Charts whose history is searched, on this timeframe: this one, and/or BTC, Gold, Silver. */
  pool: Ticker[];
  /** How much of the likeness is direction, 0.5..1; the rest is size. */
  weight: number;
  /** Also count look-alikes that played out at ½× to 2× the speed. */
  speeds: boolean;
  /** The fit shown: 0 = the best. */
  fit: number;
  /** Draws the fit and what came after it over the pattern, like a fractal (see asFractal). */
  overlay: boolean;
}
type Found = FoundIn<Ticker>;

const MIN_BARS = 10;
const pct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(0)}%`;
const date = (t: number) => new Date(t * 1000).toISOString().slice(0, t % 86400 ? 16 : 10).replace('T', ' ');
const round = (v: number) => Math.max(0.05, Math.round(v * 100) / 100); // as the fractal keeps its scales

/** The pattern's time as bars: the one holding its start to the last at its end. */
const span = (bars: Candle[], p: Pattern): [number, number] =>
  [Math.max(0, bars.findLastIndex((c) => c.time <= p.start)), bars.findLastIndex((c) => c.time <= p.end)];
const logs = (bars: Candle[]) => bars.map((c) => Math.log(c.close));
/** "↗+34% ↘-12%": the stretch's legs up and down. */
const legs = (bars: Candle[], from: number, to: number) =>
  swings(pieces(logs(bars), from, to)).map((l) => `${l > 0 ? '↗' : '↘'}${pct(Math.exp(l) - 1)}`).join(' ');

/** Searches done, by what they depend on: the candles searched and the pattern's stretch and settings. */
const searched = new Map<string, Found[]>();
function fitsOf(p: Pattern, view: View): Found[] {
  const { bars } = view;
  // Another chart's candles download on first use; it is searched once they're in.
  const charts = p.pool.flatMap((chart) => {
    const b = view.candles(chart, view.interval);
    return b?.length ? [{ chart, bars: b }] : [];
  });
  const key = [view.asset, view.interval, bars.length, p.start, p.end, p.weight, p.speeds,
    ...charts.map((c) => `${c.chart} ${c.bars.length} ${c.bars.at(-1)!.time}`)].join(' ');
  if (!searched.has(key)) {
    if (searched.size > 50) searched.clear();
    const [from, to] = span(bars, p);
    searched.set(key, to - from + 1 >= MIN_BARS ? fitsIn(bars, from, to, charts, p) : []);
  }
  return searched.get(key)!;
}

/** Where what came after a fit ends: as many bars on as the fit took, or the last bar. */
const afterEnd = (f: Found) => after(f.bars, f.start, f.end)?.to ?? f.end;

/**
 * The fit and what came after it as a fractal over the pattern: stretched to its length and the size of its moves,
 * and lined up so the fit ends on the pattern's last close, so what came after starts from there.
 */
function asFractal(p: Pattern, f: Found, view: View): Omit<Fractal, 'id'> {
  const { bars } = view;
  const [from, to] = span(bars, p);
  const size = (b: Candle[], i: number, j: number) => Math.hypot(...pieces(logs(b), i, j));
  const moveScale = round(size(bars, from, to) / size(f.bars, f.start, f.end));
  return {
    type: 'fractal', sourceAsset: f.chart, srcStart: f.bars[f.start].time, srcEnd: f.bars[afterEnd(f)].time,
    anchorTime: bars[from].time, anchorPrice: bars[to].close * (f.bars[f.start].close / f.bars[f.end].close) ** moveScale,
    timeScale: round((bars[to].time - bars[from].time) / (f.bars[f.end].time - f.bars[f.start].time)),
    moveScale, flip: false, style: { color: STRIP, opacity: 0.6 },
  };
}

function overlay(p: Pattern, view: View) {
  const f = p.overlay && fitsOf(p, view)[p.fit];
  if (!f) return [];
  const ghost = asFractal(p, f, view) as Fractal;
  return project(ghost, stretch(f.bars, ghost.srcStart, ghost.srcEnd));
}

/** "then +12% (high +40%, low -8%)": what came after a fit. */
function then(f: Found) {
  const a = after(f.bars, f.start, f.end);
  return a ? `then ${a.whole ? '' : 'so far '}${pct(a.change)} (high ${pct(a.high)}, low ${pct(a.low)})` : 'nothing after it yet';
}

/** The fit's strip: where it happened, and what came after it. */
const stripOf = (f: Found, i: number, own: Ticker) => ({
  from: f.bars[f.start].time, to: f.bars[f.end].time, after: f.bars[afterEnd(f)].time,
  label: `Fit ${i + 1}${f.chart === own ? '' : ` of your ${tickerName(own)} pattern`} · ${(f.score * 100).toFixed(0)}% alike`,
});

/**
 * Click the start and end of a stretch: the past stretches whose ups and downs look most like it are found
 * (shared/patterns.ts), in this chart's history and/or BTC's, Gold's and Silver's. Step through them in the bar above
 * the chart: each is shaded where it happened, with what came after it, and can be laid over the pattern like a
 * fractal, or kept as one.
 */
export const pattern: Tool<Pattern> = {
  type: 'pattern',
  label: 'Pattern',
  key: 'S',
  clicks: 2,
  create([a, b], view) {
    const p = {
      start: Math.min(a.time, b.time), end: Math.max(a.time, b.time), pool: [view.asset], weight: 0.7, speeds: true, fit: 0, overlay: true,
    };
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
    ctx.fillStyle = COLOR;
    ctx.globalAlpha = 0.07;
    ctx.fillRect(a.x, 0, b.x - a.x, view.height);
    ctx.globalAlpha = 1;
    stroke(ctx, a, b);
    for (const end of [a, b]) stroke(ctx, end, { x: end.x, y: end.y + 8 });
    const f = fitsOf(p, view)[p.fit];
    const [from, to] = span(view.bars, p);
    const text = to - from + 1 < MIN_BARS ? `Pattern: under ${MIN_BARS} candles on this timeframe` : `Pattern ${legs(view.bars, from, to)}`
      + (f ? ` · fit ${p.fit + 1}${f.chart === view.asset ? '' : ` (${tickerName(f.chart)})`}: ${(f.score * 100).toFixed(0)}% alike` : '');
    label(ctx, text, (a.x + b.x) / 2, a.y - 14, selected ? COLOR : '#2a2e39');
    if (f?.chart === view.asset) shadeStrip(ctx, view, stripOf(f, p.fit, view.asset));
    if (f && p.overlay) ghostCandles(ctx, overlay(p, view), view, STRIP, 0.5);
  },
  hit: (px, x, y) => nearSegment(px[0], px[1], x, y) || (x >= px[0].x && x <= px[1].x && y >= px[0].y - 26 && y <= px[0].y),
  controls(p, edit, view) {
    const [info, weightText] = [document.createElement('span'), document.createElement('span')];
    const [picker, poolBox] = [document.createElement('div'), document.createElement('div')];
    picker.className = poolBox.className = 'labelled';
    const back = () => edit.reveal([p.start, p.end + (p.end - p.start)]);
    // Another chart's fit: its chart, scrolled there and shaded (the pattern stays on this one).
    const show = () => {
      const f = fitsOf(p, view)[p.fit];
      if (f?.chart === view.asset) edit.reveal([f.bars[f.start].time, f.bars[afterEnd(f)].time]);
      else if (f) edit.goTo(f.chart, stripOf(f, p.fit, view.asset));
    };
    const refresh = () => {
      const fits = fitsOf(p, view);
      const f = fits[p.fit];
      picker.replaceChildren('Fit');
      buttonGroup(picker, fits.map((_, i) => [String(i), String(i + 1)]), String(p.fit), (i) => {
        p.fit = Number(i);
        edit.changed(true);
        refresh();
        // This chart's fit: scrolls to it; another's: back to the pattern, where its overlay is.
        if (fits[p.fit].chart === view.asset) show();
        else back();
      });
      const up = fits.filter((g) => (after(g.bars, g.start, g.end)?.change ?? 0) > 0).length;
      const loading = p.pool.filter((a) => !view.candles(a, view.interval)?.length).map(tickerName);
      info.textContent = (!f ? `No look-alikes: pick at least ${MIN_BARS} candles` : `${f.chart === view.asset ? '' : `${tickerName(f.chart)} `}`
        + `${(f.score * 100).toFixed(0)}% alike: ${date(f.bars[f.start].time)} to ${date(f.bars[f.end].time)}, ${f.speed.toFixed(1)}× as long, `
        + `${legs(f.bars, f.start, f.end)}, ${then(f)} · ${up} of ${fits.length} fits went up after`)
        + (loading.length ? ` · loading ${loading.join(', ')}…` : '');
      weightText.textContent = `Direction ${(p.weight * 100).toFixed(0)}% · size ${(100 - p.weight * 100).toFixed(0)}%`;
    };
    /** A button lit while `on()`; `flip` changes the pattern. */
    const onOff = (text: string, title: string, on: () => boolean, flip: () => void) => {
      const b = button(text, () => {
        flip();
        b.classList.toggle('on', on());
        edit.changed(true);
        refresh();
      }, title);
      b.classList.toggle('on', on());
      return b;
    };
    // Which charts' history to search; the last one on stays on.
    poolBox.append('Search in', Object.assign(document.createElement('div'), { className: 'group' }));
    for (const asset of [...new Set<Ticker>([view.asset, 'btc', 'gold', 'silver'])]) {
      const on = () => p.pool.includes(asset);
      poolBox.lastElementChild!.append(onOff(tickerName(asset), `Look for fits in ${tickerName(asset)}'s history (same timeframe)`, on, () => {
        if (!on() || p.pool.length > 1) [p.pool, p.fit] = [on() ? p.pool.filter((a) => a !== asset) : [...p.pool, asset], 0];
      }));
    }
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
      button('Go to fit', show, 'Scroll to where this fit happened (another asset\'s: switches to its chart)'),
      button('Back to mine', back, 'Scroll back to your stretch'),
      onOff('Overlay', 'Lay the fit and what came after it over your stretch, like a fractal', () => p.overlay, () => (p.overlay = !p.overlay)),
      button('Keep as fractal', () => {
        const f = fitsOf(p, view)[p.fit];
        if (!f) return;
        p.overlay = false;
        edit.add(asFractal(p, f, view));
      }, 'Make the overlay a fractal you can move, stretch and keep'),
      poolBox, weight, weightText,
      onOff('½×–2× speed', 'Also count look-alikes that took from half to twice as long', () => p.speeds, () => {
        [p.speeds, p.fit] = [!p.speeds, 0];
      }),
    ];
  },
};

import { CandlestickSeries, createChart, LineSeries, PriceScaleMode } from 'lightweight-charts';
import type { CandlestickData, IPanePrimitive, ISeriesApi, ISeriesPrimitive, LineData, Logical, UTCTimestamp } from 'lightweight-charts';
import type { Candle, Point } from '../../shared/types.ts';
import { futureDates } from './future.ts';
import { carryRange, timeline } from './timeline.ts';

const UP = '#26a69a';
const DOWN = '#ef5350';
const MARK = '#9598a1';
/** Empty bars kept right of the last candle, so drawings can project into the future. */
const RIGHT_SPACE = 40;
/** Bars shown when a chart opens; older history is a scroll or zoom away. */
const START_BARS = 400;
/** Fewest bars shown when a short stretch moves to a longer timeframe (2 days of 1h on 1W). */
const MIN_BARS = 20;

const num = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 });
export const formatPrice = (p: number) => num.format(p);

export type Style = 'candles' | 'line';
/** A line over the bars (a moving average), one point per bar from some bar on (see onBars). */
export interface Line { name: string; color: string; points: Point[]; /** Shades the gap to the line before it (a band). */ band?: boolean }
/** A vertical line at a time (a BTC halving), labelled at the bottom; dotted when it is an estimate. */
export interface Mark { time: number; label: string; estimate?: boolean }

export function createMainChart(el: HTMLElement) {
  const chart = createChart(el, {
    autoSize: true,
    // attributionLogo is required by the Lightweight Charts Apache-2.0 licence notice.
    layout: {
      background: { color: '#0f1219' }, textColor: '#8b91a0', fontFamily: "Inter, 'Segoe UI', system-ui, sans-serif", attributionLogo: true,
    },
    localization: { priceFormatter: formatPrice },
    grid: { vertLines: { color: '#171b24' }, horzLines: { color: '#171b24' } },
    rightPriceScale: { mode: PriceScaleMode.Logarithmic, borderColor: '#262c39' },
    timeScale: { borderColor: '#262c39', rightOffset: RIGHT_SPACE },
  });
  const time = chart.timeScale();
  const candles = chart.addSeries(CandlestickSeries, {
    upColor: UP, downColor: DOWN, borderVisible: false, wickUpColor: UP, wickDownColor: DOWN,
  });
  const close = chart.addSeries(LineSeries, { color: '#d1d4dc', lineWidth: 2, visible: false });
  const series: ISeriesApi<'Line'>[] = []; // one per overlay line, made as needed
  let bars: Candle[] = [];
  let lines: Line[] = [];
  let marks: Mark[] = [];
  let line: ReturnType<typeof timeline>;
  let intraday = false;

  // logicalToCoordinate only takes whole bars, and a daily point on the weekly chart sits between two.
  const xAt = (l: number) => {
    const i = Math.floor(l);
    const x = time.logicalToCoordinate(i as Logical)!;
    return x + (l - i) * (time.logicalToCoordinate((i + 1) as Logical)! - x);
  };
  const x = (t: number) => xAt(line.toLogical(t));
  const y = (price: number) => candles.priceToCoordinate(price) ?? NaN;
  // On both series, as one is hidden at a time (candles or line); each shows the dates while it is shown.
  const dates = { last: () => bars.length - 1, toTime: (l: number) => line.toTime(l), x, intraday: () => intraday };
  for (const s of [candles, close]) futureDates(chart, s, dates);

  /** Fills each band between its two lines, over the bars on screen. */
  function shade(ctx: CanvasRenderingContext2D) {
    const range = time.getVisibleLogicalRange();
    const n = bars.length;
    lines.forEach((l, i) => {
      if (!l.band || !range) return;
      const [a, b] = [l.points, lines[i - 1].points];
      const from = Math.max(0, Math.floor(range.from), n - a.length, n - b.length);
      const to = Math.min(n - 1, Math.ceil(range.to));
      ctx.beginPath();
      for (let k = from; k <= to; k++) ctx.lineTo(xAt(k), y(a[k - n + a.length].value));
      for (let k = to; k >= from; k--) ctx.lineTo(xAt(k), y(b[k - n + b.length].value));
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = l.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function drawMarks(ctx: CanvasRenderingContext2D, height: number) {
    ctx.strokeStyle = ctx.fillStyle = MARK;
    ctx.font = '11px system-ui, sans-serif';
    ctx.lineWidth = 1;
    for (const m of marks) {
      const at = Math.round(x(m.time)) + 0.5;
      ctx.setLineDash(m.estimate ? [2, 4] : [6, 4]);
      ctx.beginPath();
      ctx.moveTo(at, 0);
      ctx.lineTo(at, height);
      ctx.stroke();
      ctx.fillText(m.label, at + 4, height - 6);
    }
    ctx.setLineDash([]);
  }

  // Behind the candles: band shading and the marks.
  let redraw = () => {};
  const under: IPanePrimitive = {
    attached: ({ requestUpdate }) => void (redraw = requestUpdate),
    paneViews: () => [{
      zOrder: () => 'bottom',
      renderer: () => ({
        draw: (target) => target.useMediaCoordinateSpace(({ context, mediaSize }) => {
          shade(context);
          drawMarks(context, mediaSize.height);
        }),
      }),
    }],
  };
  chart.panes()[0].attachPrimitive(under);

  return {
    chart,
    /** The candle series; its price scale places drawings (it converts prices even while hidden in line mode). */
    series: candles,
    /**
     * Replaces the bars and their close line. Jumps to the latest bars, unless `keepView`: then it shows the same
     * stretch of time as before (a refresh, or another timeframe of the same chart).
     */
    setData(candleList: Candle[], hourly: boolean, keepView = false) {
      const view = keepView ? time.getVisibleLogicalRange() : null;
      const before = line;
      bars = candleList;
      intraday = hourly;
      line = timeline(bars.map((b) => b.time));
      chart.applyOptions({ timeScale: { timeVisible: hourly } });
      // Price steps fine enough for the lowest price (silver in BTC is 0.0007), or the price scale shows no marks.
      const precision = Math.max(2, 3 - Math.floor(Math.log10(bars.reduce((m, b) => Math.min(m, b.low), Infinity))));
      for (const s of [candles, close]) s.applyOptions({ priceFormat: { type: 'price', precision, minMove: 10 ** -precision } });
      candles.setData(bars as CandlestickData<UTCTimestamp>[]);
      close.setData(bars.map((b) => ({ time: b.time as UTCTimestamp, value: b.close })));
      const maxBars = time.width() / chart.options().timeScale.minBarSpacing;
      time.setVisibleLogicalRange(view ? carryRange(view, before, line, MIN_BARS, maxBars)
        : { from: Math.max(0, bars.length - START_BARS), to: bars.length - 1 + RIGHT_SPACE });
    },
    /** Replaces the lines over the bars (call after setData); each one's latest value shows on the price scale. */
    setLines(list: Line[]) {
      lines = list;
      while (series.length < lines.length) {
        series.push(chart.addSeries(LineSeries, { lineWidth: 2, priceLineVisible: false, crosshairMarkerVisible: false }));
      }
      series.forEach((s, i) => {
        s.setData((lines[i]?.points ?? []) as LineData<UTCTimestamp>[]);
        if (lines[i]) s.applyOptions({ color: lines[i].color });
      });
    },
    setMarks(list: Mark[]) {
      marks = list;
      redraw();
    },
    setLog: (log: boolean) =>
      chart.applyOptions({ rightPriceScale: { mode: log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal } }),
    setStyle(style: Style) {
      candles.applyOptions({ visible: style === 'candles' });
      close.applyOptions({ visible: style === 'line' });
    },
    /** A time's logical bar position and back (may be fractional: between bars, or in the empty space on the right). */
    toLogical: (t: number) => line.toLogical(t),
    toTime: (l: number) => line.toTime(l),
    /** Where a time is on screen, also between bars and in the empty space on the right. */
    x,
    /** Widens the price scale to also fit `range(first, last visible logical bar)`, on candles and line alike. */
    fit(range: (from: number, to: number) => { minValue: number; maxValue: number } | null) {
      const primitive: ISeriesPrimitive = {
        autoscaleInfo(from, to) {
          const priceRange = range(from, to);
          return priceRange && { priceRange };
        },
      };
      candles.attachPrimitive(primitive);
      close.attachPrimitive(primitive);
    },
    /** Calls back with the bar time under the crosshair, or null when the mouse leaves the bars. */
    onHover(cb: (time: number | null) => void) {
      chart.subscribeCrosshairMove((p) => cb(p.time === undefined ? null : (p.time as number)));
    },
    /** The chart as a picture, drawings included, with `title` and the lines' names written top left. */
    picture(title: string) {
      const canvas = chart.takeScreenshot(true);
      const ctx = canvas.getContext('2d')!;
      const scale = canvas.width / el.clientWidth;
      ctx.scale(scale, scale);
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillStyle = '#d1d4dc';
      ctx.fillText(title, 12, 22);
      let left = 24 + ctx.measureText(title).width;
      ctx.font = '13px system-ui, sans-serif';
      for (const l of lines) {
        ctx.fillStyle = l.color;
        ctx.fillText(l.name, left, 22);
        left += ctx.measureText(l.name).width + 10;
      }
      return canvas;
    },
  };
}

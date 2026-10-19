import { CandlestickSeries, createChart, LineSeries, PriceScaleMode } from 'lightweight-charts';
import type { CandlestickData, LineData, UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '../../shared/types.ts';

const UP = '#26a69a';
const DOWN = '#ef5350';
/** Empty bars kept right of the last candle, so drawings can project into the future. */
const RIGHT_SPACE = 40;
/** Bars shown when a chart opens; older history is a scroll or zoom away. */
const START_BARS = 400;

const num = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 });
export const formatPrice = (p: number) => num.format(p);

export type Style = 'candles' | 'line';
export interface Line { points: { time: number; value: number }[]; color: string }

export function createMainChart(el: HTMLElement) {
  const chart = createChart(el, {
    autoSize: true,
    // attributionLogo is required by the Lightweight Charts Apache-2.0 licence notice.
    layout: { background: { color: '#131722' }, textColor: '#d1d4dc', attributionLogo: true },
    localization: { priceFormatter: formatPrice },
    grid: { vertLines: { color: '#1e222d' }, horzLines: { color: '#1e222d' } },
    rightPriceScale: { mode: PriceScaleMode.Logarithmic, borderColor: '#2a2e39' },
    timeScale: { borderColor: '#2a2e39', rightOffset: RIGHT_SPACE },
  });
  const candles = chart.addSeries(CandlestickSeries, {
    upColor: UP, downColor: DOWN, borderVisible: false, wickUpColor: UP, wickDownColor: DOWN,
  });
  const close = chart.addSeries(LineSeries, { color: '#d1d4dc', lineWidth: 2, visible: false });
  const overlays = [0, 1].map(() =>
    chart.addSeries(LineSeries, { lineWidth: 2, priceLineVisible: false, crosshairMarkerVisible: false }));

  return {
    chart,
    /** The candle series; its price scale places drawings (it converts prices even while hidden in line mode). */
    series: candles,
    /**
     * Replaces everything shown: bars, their close line, and the overlay lines (e.g. the 50D/200D MAs).
     * Jumps to the latest bars, unless `keepView` (a refresh of the same chart) keeps the current zoom and scroll.
     */
    setData(bars: Candle[], lines: Line[], intraday: boolean, keepView = false) {
      const view = chart.timeScale().getVisibleLogicalRange();
      chart.applyOptions({ timeScale: { timeVisible: intraday } });
      candles.setData(bars as CandlestickData<UTCTimestamp>[]);
      close.setData(bars.map((b) => ({ time: b.time as UTCTimestamp, value: b.close })));
      overlays.forEach((s, i) => {
        s.setData(lines[i].points as LineData<UTCTimestamp>[]);
        s.applyOptions({ color: lines[i].color });
      });
      chart.timeScale().setVisibleLogicalRange(keepView && view ? view
        : { from: Math.max(0, bars.length - START_BARS), to: bars.length - 1 + RIGHT_SPACE });
    },
    setLog: (log: boolean) =>
      chart.applyOptions({ rightPriceScale: { mode: log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal } }),
    setStyle(style: Style) {
      candles.applyOptions({ visible: style === 'candles' });
      close.applyOptions({ visible: style === 'line' });
    },
    setOverlayVisible: (i: number, visible: boolean) => overlays[i].applyOptions({ visible }),
    /** Calls back with the bar time under the crosshair, or null when the mouse leaves the bars. */
    onHover(cb: (time: number | null) => void) {
      chart.subscribeCrosshairMove((p) => cb(p.time === undefined ? null : (p.time as number)));
    },
  };
}

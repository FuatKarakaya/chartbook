import { CandlestickSeries, createChart, PriceScaleMode } from 'lightweight-charts';
import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '../../shared/types.ts';

const UP = '#26a69a';
const DOWN = '#ef5350';

export function createMainChart(el: HTMLElement) {
  const chart = createChart(el, {
    autoSize: true,
    // attributionLogo is required by the Lightweight Charts Apache-2.0 licence notice.
    layout: { background: { color: '#131722' }, textColor: '#d1d4dc', attributionLogo: true },
    grid: { vertLines: { color: '#1e222d' }, horzLines: { color: '#1e222d' } },
    rightPriceScale: { mode: PriceScaleMode.Logarithmic, borderColor: '#2a2e39' },
    timeScale: { borderColor: '#2a2e39' },
  });
  const series = chart.addSeries(CandlestickSeries, {
    upColor: UP, downColor: DOWN, borderVisible: false, wickUpColor: UP, wickDownColor: DOWN,
  });

  return {
    chart,
    setCandles(candles: Candle[]) {
      series.setData(candles as CandlestickData<UTCTimestamp>[]);
      chart.timeScale().fitContent();
    },
  };
}

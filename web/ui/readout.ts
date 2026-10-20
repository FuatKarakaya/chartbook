import type { Candle } from '../../shared/types.ts';
import { formatPrice, type Line } from '../core/chart.ts';

/** Top-left legend: date, OHLC (just the close for a `line` asset), % change from the previous close, and the overlay lines' values. */
export function readout(el: HTMLElement) {
  return (bars: Candle[], index: number, lines: (Line & { name: string })[], intraday: boolean, line: boolean) => {
    const bar = bars[index];
    if (!bar) return void (el.textContent = '');
    const date = new Date(bar.time * 1000).toISOString();
    const prev = bars[index - 1]?.close ?? bar.open;
    const change = (bar.close / prev - 1) * 100;
    const values = lines.map((l) => {
      // Overlay points line up with the last bars (see onBars), so the index is offset, not searched.
      const v = l.points[index - bars.length + l.points.length]?.value;
      return v === undefined ? '' : `<span style="color:${l.color}">${l.name} ${formatPrice(v)}</span>`;
    });
    el.innerHTML = [
      `<span>${intraday ? date.slice(0, 16).replace('T', ' ') : date.slice(0, 10)}</span>`,
      ...(line ? ['close'] as const : ['open', 'high', 'low', 'close'] as const)
        .map((k) => `<span>${k[0].toUpperCase()} <b>${formatPrice(bar[k])}</b></span>`),
      `<b class="${change >= 0 ? 'up' : 'down'}">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</b>`,
      ...values,
    ].join(' ');
  };
}

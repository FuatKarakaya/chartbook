// Cycles page: one line per market cycle, x = days since that cycle's bottom, y = ROI (close / bottom close).
import { createOptionsChart, LineSeries, PriceScaleMode, type ISeriesApi } from 'lightweight-charts';
import { currentRoi, CYCLES, cycleLines, type CycleAsset, type CycleLine, type Length } from '../../shared/cycles.ts';
import { ASSET_NAMES, type Candle } from '../../shared/types.ts';
import { fetchCandles } from '../core/api.ts';
import { buttonGroup } from '../core/buttons.ts';

/** One colour per cycle, by its bottom year, so a cycle keeps it on BTC and ETH and with every option. */
const COLORS: Record<number, string> = { 2010: '#3987e5', 2011: '#d95926', 2015: '#199e70', 2018: '#c98500', 2022: '#d55181' };
const DAY = 86400;
const formatRoi = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 }).format;
const date = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
const month = (day: string) => new Date(day).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });

// The view lives in the address bar, so a reload or bookmark keeps it.
const params = new URLSearchParams(location.search);
const state = {
  asset: (params.get('asset') ?? 'btc') as CycleAsset,
  length: (params.get('length') ?? 'bottom') as Length,
  peak: (params.get('peak') ?? 'first') as 'first' | 'second',
  combine: (params.get('combine') ?? 'no') as 'no' | 'yes',
  scale: (params.get('scale') ?? 'log') as 'log' | 'linear',
  /** Bottom years of the cycles switched off in the legend. */
  hidden: new Set(params.get('hide')?.split(',')),
};
const save = () => history.replaceState(null, '', `?${new URLSearchParams({
  asset: state.asset, length: state.length, peak: state.peak, combine: state.combine, scale: state.scale,
  ...(state.hidden.size && { hide: [...state.hidden].join(',') }),
})}`);

const chart = createOptionsChart(document.getElementById('chart')!, {
  autoSize: true,
  // attributionLogo is required by the Lightweight Charts Apache-2.0 licence notice.
  layout: { background: { color: '#131722' }, textColor: '#d1d4dc', attributionLogo: true },
  localization: { priceFormatter: formatRoi, precision: 0, timeFormatter: (day: number) => `Day ${day}` },
  grid: { vertLines: { color: '#1e222d' }, horzLines: { color: '#1e222d' } },
  rightPriceScale: { borderColor: '#2a2e39' },
  timeScale: { borderColor: '#2a2e39' },
});
const setScale = () => chart.applyOptions({
  rightPriceScale: { mode: state.scale === 'log' ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal },
});

// Top left: today's ROI, then a legend row per cycle with its ROI and date on the day under the mouse.
const readout = document.getElementById('readout')!;
const title = readout.appendChild(document.createElement('b'));
const dayLabel = readout.appendChild(document.createElement('div'));
const legend = readout.appendChild(document.createElement('table'));
let days: Candle[] = [];
let rows: { line: CycleLine; series: ISeriesApi<'Line', number>; roi: HTMLElement; when: HTMLElement }[] = [];
/** With the mouse off the chart, the readout shows the newest shown cycle's last day, to compare the others with it. */
const lastDay = () => (rows.findLast((r) => !state.hidden.has(String(r.line.year))) ?? rows.at(-1)!).line.points.at(-1)!.day;

function showDay(day: number) {
  dayLabel.textContent = `Day ${day} since each cycle's bottom`;
  for (const { line, roi, when } of rows) {
    const p = line.points.find((q) => q.day === day);
    roi.textContent = p ? formatRoi(p.roi) : '–';
    when.textContent = p ? date(line.bottom + day * DAY) : '';
  }
}

/** Redraws the lines and legend from the loaded candles and the picked options. */
function draw() {
  save();
  for (const r of rows) chart.removeSeries(r.series);
  const lines = cycleLines(days, CYCLES[state.asset], {
    length: state.length, secondPeak: state.peak === 'second', combine: state.combine === 'yes' && state.asset === 'btc',
  });
  legend.replaceChildren();
  rows = lines.map((line) => {
    const key = String(line.year);
    const series = chart.addSeries(LineSeries, {
      color: COLORS[line.year], lineWidth: 2, priceLineVisible: false, lastValueVisible: false, visible: !state.hidden.has(key),
    });
    series.setData(line.points.map((p) => ({ time: p.day, value: p.roi })));
    const tr = legend.insertRow();
    tr.title = 'Click to hide or show this cycle';
    tr.classList.toggle('off', state.hidden.has(key));
    tr.insertCell().innerHTML = `<i style="background:${COLORS[line.year]}"></i>${key} cycle`;
    tr.onclick = () => {
      const off = !state.hidden.delete(key);
      if (off) state.hidden.add(key);
      tr.classList.toggle('off', off);
      series.applyOptions({ visible: !off });
      showDay(lastDay());
      save();
    };
    return { line, series, roi: tr.insertCell(), when: tr.insertCell() };
  });
  chart.timeScale().fitContent();
  showDay(lastDay());
}

async function load() {
  const asset = state.asset;
  const candles = await fetchCandles(asset, '1D');
  if (asset !== state.asset) return; // a newer click won
  days = candles;
  title.textContent = `ROI from last cycle bottom: ${formatRoi(currentRoi(days, CYCLES[asset]))}`;
  // The 2021 peak buttons are named after this asset's months (BTC topped in April, ETH in May).
  const twice = CYCLES[asset].find((c) => c.secondPeak)!;
  peakButtons.forEach((b, i) => (b.textContent = month(i ? twice.secondPeak! : twice.peak)));
  pickCombine.disable(asset === 'btc' ? [] : ['no', 'yes']);
  draw();
}

const toolbar = document.getElementById('toolbar')!;
/** A labelled button group in the header; returns its setter and its buttons. */
function group<T extends string>(label: string, options: [T, string][], current: T, onPick: (value: T) => void, tip = '') {
  const box = toolbar.appendChild(document.createElement('div'));
  box.className = 'labelled';
  box.title = tip;
  box.append(label);
  return [buttonGroup(box, options, current, onPick), box.querySelectorAll('button')] as const;
}
group('Asset', (['btc', 'eth'] as const).map((a) => [a, ASSET_NAMES[a]]), state.asset, (a) => {
  state.asset = a;
  load();
});
group('Data length', [['peak', 'To peak'], ['3m', '3 months out'], ['bottom', 'To next bottom']], state.length, (l) => {
  state.length = l;
  draw();
}, 'How far each cycle runs: to its peak, 3 months past it, or to the next bottom (the current cycle: to today)');
const [, peakButtons] = group('2021 peak', [['first', 'April'], ['second', 'November']], state.peak, (p) => {
  state.peak = p;
  draw();
}, 'The 2021 top came twice; which one ends the 2018 cycle');
const [pickCombine] = group('Combine 2010 + 2011 cycles', [['no', 'No'], ['yes', 'Yes']], state.combine, (c) => {
  state.combine = c;
  draw();
}, 'BTC only: one cycle from the 2010 first price to the 2013 peak');
group('ROI scale', [['log', 'Log'], ['linear', 'Linear']], state.scale, (s) => {
  state.scale = s;
  setScale();
  save();
});

chart.subscribeCrosshairMove((p) => showDay(p.time ?? lastDay()));
setScale();
await load();

import type { Asset, Candle, Interval } from '../shared/types.ts';
import { fetchCandles, fetchDrawings, fetchStatus, saveDrawings } from './core/api.ts';
import { createMainChart, type Style } from './core/chart.ts';
import { drawingEditor } from './core/drawings.ts';
import { onBars, sma } from './indicators/sma.ts';
import { TOOLS } from './tools/index.ts';
import { buttonGroup, toggle } from './ui/buttons.ts';
import { readout } from './ui/readout.ts';

const ASSETS: [Asset, string][] = [['btc', 'BTC'], ['gold', 'Gold'], ['silver', 'Silver'], ['spx', 'S&P 500']];
const INTERVALS: [Interval, string][] = [['1h', '1h'], ['4h', '4h'], ['1D', '1D'], ['1W', '1W'], ['1M', '1M']];
/** Moving averages of daily closes, shown on every timeframe. */
const MAS = [{ name: '50D', length: 50, color: '#2962ff' }, { name: '200D', length: 200, color: '#ff9800' }];

// The view lives in the address bar, so a reload or bookmark keeps it.
const params = new URLSearchParams(location.search);
const state = {
  asset: (params.get('asset') ?? 'btc') as Asset,
  interval: (params.get('interval') ?? '1D') as Interval,
  log: params.get('scale') !== 'linear',
  style: (params.get('style') ?? 'candles') as Style,
  // Which MAs are on, by length, e.g. ma=50,200.
  mas: MAS.map((m) => (params.get('ma') ?? '50,200').split(',').includes(String(m.length))),
};
const save = () => history.replaceState(null, '', `?${new URLSearchParams({
  asset: state.asset, interval: state.interval, scale: state.log ? 'log' : 'linear', style: state.style,
  ma: MAS.filter((_, i) => state.mas[i]).map((m) => m.length).join(','),
})}`);

const chartEl = document.getElementById('chart')!;
const main = createMainChart(chartEl);
const show = readout(document.getElementById('readout')!);
const toolbar = document.getElementById('toolbar')!;
const refresh = document.getElementById('refresh') as HTMLButtonElement;
const delayed = document.getElementById('delayed')!;
let bars: Candle[] = [];
let drawnAsset: Asset | null = null; // whose drawings are on screen
let lines: ReturnType<typeof maLines> = [];
const index = new Map<number, number>(); // bar time -> position, for the hover readout

const maLines = (days: Candle[]) =>
  MAS.map((m) => ({ name: m.name, color: m.color, points: onBars(sma(days, m.length), bars) }));
const shownLines = () => lines.filter((_, i) => state.mas[i]);
const intraday = () => state.interval === '1h' || state.interval === '4h';
const showLast = () => show(bars, bars.length - 1, shownLines(), intraday());

/** Fetches and shows the current asset and timeframe; `keepView` keeps zoom and scroll (the Refresh button). */
async function load(keepView = false) {
  save();
  const { asset, interval } = state;
  const [candles, days, status, saved] = await Promise.all([
    fetchCandles(asset, interval), fetchCandles(asset, '1D'), fetchStatus(),
    asset === drawnAsset ? null : fetchDrawings(asset),
  ]);
  if (asset !== state.asset || interval !== state.interval) return; // a newer click won
  bars = candles;
  index.clear();
  bars.forEach((b, i) => index.set(b.time, i));
  lines = maLines(days);
  editor.setBars(bars);
  if (saved) {
    editor.load(saved);
    drawnAsset = asset;
  }
  main.setData(bars, lines, intraday(), keepView);
  showLast();
  delayed.hidden = status.failing.length === 0;
}

// Drawings are saved per asset and show on every timeframe; each change is sent to the server straight away.
const editor = drawingEditor(main.chart, main.series, chartEl, TOOLS,
  (list) => saveDrawings(state.asset, list), () => pickTool('cursor'));

const pickAsset = buttonGroup(toolbar, ASSETS, state.asset, (a) => { state.asset = a; load(); });
buttonGroup(toolbar, INTERVALS, state.interval, (i) => { state.interval = i; load(); });
buttonGroup(toolbar, [['log', 'Log'], ['linear', 'Linear']], state.log ? 'log' : 'linear', (s) => {
  state.log = s === 'log'; main.setLog(state.log); save();
});
buttonGroup(toolbar, [['candles', 'Candles'], ['line', 'Line']], state.style, (s) => {
  state.style = s; main.setStyle(s); save();
});
MAS.forEach((m, i) => toggle(toolbar, m.name, state.mas[i], (on) => {
  state.mas[i] = on; main.setOverlayVisible(i, on); showLast(); save();
}));
const pickTool = buttonGroup(toolbar, [['cursor', 'Cursor'], ...TOOLS.map((t): [string, string] => [t.type, t.label])],
  'cursor', (t) => editor.setTool(t === 'cursor' ? null : t));
const clear = toolbar.appendChild(document.createElement('div'));
clear.className = 'group';
clear.innerHTML = '<button title="Delete all drawings on this asset (Ctrl+Z undoes)">Clear all</button>';
clear.onclick = () => {
  const n = editor.count();
  const name = ASSETS.find(([a]) => a === state.asset)![1];
  if (n && confirm(`Delete all ${n} drawings on ${name}? (Ctrl+Z brings them back)`)) editor.clear();
};

// The server downloads new prices every 5 minutes; this shows them without losing your place.
refresh.onclick = () => {
  refresh.disabled = true;
  load(true).finally(() => (refresh.disabled = false));
};

// Keys 1-4 switch asset.
addEventListener('keydown', (e) => {
  const a = ASSETS[Number(e.key) - 1];
  if (!a || e.ctrlKey || e.metaKey || e.altKey || a[0] === state.asset) return;
  state.asset = a[0];
  pickAsset(a[0]);
  load();
});

main.onHover((time) => {
  if (time === null) return showLast();
  const i = index.get(time);
  if (i !== undefined) show(bars, i, shownLines(), intraday());
});

main.setLog(state.log);
main.setStyle(state.style);
state.mas.forEach((on, i) => main.setOverlayVisible(i, on));
await load();

import type { Asset, Candle, Interval } from '../shared/types.ts';
import { fetchCandles, fetchDrawings, fetchStatus, saveDrawings } from './core/api.ts';
import { createMainChart, type Style } from './core/chart.ts';
import { drawingEditor } from './core/drawings.ts';
import { onBars, sma } from './indicators/weekly-sma.ts';
import { TOOLS } from './tools/index.ts';
import { buttonGroup } from './ui/buttons.ts';
import { readout } from './ui/readout.ts';

const ASSETS: [Asset, string][] = [['btc', 'BTC'], ['gold', 'Gold'], ['silver', 'Silver'], ['spx', 'S&P 500']];
const INTERVALS: [Interval, string][] = [['1h', '1h'], ['4h', '4h'], ['1D', '1D'], ['1W', '1W'], ['1M', '1M']];
const MAS = [{ name: '50W', length: 50, color: '#2962ff' }, { name: '200W', length: 200, color: '#ff9800' }];

// The view lives in the address bar, so a reload or bookmark keeps it.
const params = new URLSearchParams(location.search);
const state = {
  asset: (params.get('asset') ?? 'btc') as Asset,
  interval: (params.get('interval') ?? '1D') as Interval,
  log: params.get('scale') !== 'linear',
  style: (params.get('style') ?? 'candles') as Style,
  mas: params.get('mas') !== 'off',
};
const save = () => history.replaceState(null, '', `?${new URLSearchParams({
  asset: state.asset, interval: state.interval, scale: state.log ? 'log' : 'linear', style: state.style,
  mas: state.mas ? 'on' : 'off',
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

const maLines = (weeks: Candle[]) =>
  MAS.map((m) => ({ name: m.name, color: m.color, points: onBars(sma(weeks, m.length), bars) }));
const intraday = () => state.interval === '1h' || state.interval === '4h';
const showLast = () => show(bars, bars.length - 1, state.mas ? lines : [], intraday());

/** Fetches and shows the current asset and timeframe; `keepView` keeps zoom and scroll (the Refresh button). */
async function load(keepView = false) {
  save();
  const { asset, interval } = state;
  const [candles, weeks, status, saved] = await Promise.all([
    fetchCandles(asset, interval), fetchCandles(asset, '1W'), fetchStatus(),
    asset === drawnAsset ? null : fetchDrawings(asset),
  ]);
  if (asset !== state.asset || interval !== state.interval) return; // a newer click won
  bars = candles;
  index.clear();
  bars.forEach((b, i) => index.set(b.time, i));
  lines = maLines(weeks);
  editor.setBars(bars.map((b) => b.time));
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
buttonGroup(toolbar, [['on', '50W/200W'], ['off', 'No MAs']], state.mas ? 'on' : 'off', (m) => {
  state.mas = m === 'on'; main.setOverlaysVisible(state.mas); showLast(); save();
});
const pickTool = buttonGroup(toolbar, [['cursor', 'Cursor'], ...TOOLS.map((t): [string, string] => [t.type, t.label])],
  'cursor', (t) => editor.setTool(t === 'cursor' ? null : t));

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
  if (i !== undefined) show(bars, i, state.mas ? lines : [], intraday());
});

main.setLog(state.log);
main.setStyle(state.style);
main.setOverlaysVisible(state.mas);
await load();

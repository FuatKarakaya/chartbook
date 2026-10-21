import { DAILY_ONLY, LINE_ONLY, tickerName, type Asset, type Candle, type Interval, type Ticker } from '../shared/types.ts';
import { fetchCandles, fetchDrawings, fetchStatus, saveDrawings } from './core/api.ts';
import { createMainChart, type Line, type Style } from './core/chart.ts';
import { drawingEditor } from './core/drawings.ts';
import { band } from './indicators/band.ts';
import { HALVINGS } from './indicators/halvings.ts';
import { onBars, sma } from './indicators/sma.ts';
import { TOOLS } from './tools/index.ts';
import { buttonGroup, shortcut, shortcuts, toggle } from './core/buttons.ts';
import { readout } from './ui/readout.ts';
import { loadSettings, settingsPanel } from './ui/settings.ts';
import { assetSwitcher } from './ui/switcher.ts';

const INTERVALS: Interval[] = ['1h', '4h', '1D', '1W', '1M'];
/** Open on a linear scale. */
const RATES: Asset[] = ['tnx', 'fed'];
/** Keys the drawing editor handles itself, for the shortcut list. */
const EDITOR_KEYS = [
  { key: 'Shift+click', label: 'Ruler' }, { key: 'Esc', label: 'Stop drawing, unselect' },
  { key: 'Delete', label: 'Delete the selected drawing' }, { key: 'Ctrl+Z', label: 'Undo a drawing change' },
];

// The view lives in the address bar, so a reload or bookmark keeps it.
const params = new URLSearchParams(location.search);
const state = {
  asset: (params.get('asset') ?? 'btc') as Asset,
  /** Priced in this asset instead of dollars: a ratio chart. */
  vs: (params.get('vs') || null) as Asset | null,
  interval: (params.get('interval') ?? '1D') as Interval,
  log: params.get('scale') !== 'linear',
  style: (params.get('style') ?? 'candles') as Style,
  /** What is switched on: ma1, ma2 (the two moving averages), band, halvings. */
  show: new Set((params.get('show') ?? 'ma1,ma2').split(',')),
};
const ticker = (): Ticker => (state.vs ? `${state.asset}/${state.vs}` : state.asset);
const save = () => history.replaceState(null, '', `?${new URLSearchParams({
  asset: state.asset, ...(state.vs && { vs: state.vs }), interval: state.interval, scale: state.log ? 'log' : 'linear',
  style: state.style, show: [...state.show].join(','),
})}`);

const chartEl = document.getElementById('chart')!;
const main = createMainChart(chartEl);
const show = readout(document.getElementById('readout')!);
const toolbar = document.getElementById('toolbar')!;
const refresh = document.getElementById('refresh') as HTMLButtonElement;
const picture = document.getElementById('picture') as HTMLButtonElement;
const delayed = document.getElementById('delayed')!;
const settings = loadSettings();
let bars: Candle[] = [];
let days: Candle[] = [];
let drawn: Ticker | null = null; // whose drawings are on screen
let lines: (Line & { key: string })[] = [];
const index = new Map<number, number>(); // bar time -> position, for the hover readout

/** M2 has one value a month: no daily closes for the moving averages and band. */
const monthly = () => state.asset === 'm2';
/** Drawn as a line, and the readout shows one value. */
const lineOnly = () => LINE_ONLY.includes(state.asset);

/** The lines over the bars, all from daily candles, so they agree on every timeframe. */
function makeLines() {
  const weekly = band(days);
  lines = monthly() ? [] : [
    ...settings.ma.map((m, i) => ({
      key: `ma${i + 1}`, name: `${m.length}D`, color: m.color, points: onBars(sma(days, m.length), bars),
    })),
    { key: 'band', name: '20W SMA', color: settings.band, points: onBars(weekly.sma, bars) },
    { key: 'band', name: '21W EMA', color: settings.band, points: onBars(weekly.ema, bars), band: true },
  ];
}
const shownLines = () => lines.filter((l) => state.show.has(l.key));
const intraday = () => state.interval === '1h' || state.interval === '4h';
const showBar = (i: number) => show(bars, i, shownLines(), intraday(), lineOnly());
const showLast = () => showBar(bars.length - 1);
/** Puts what is switched on over the bars. */
function showLines() {
  main.setLines(shownLines());
  main.setMarks(state.show.has('halvings') ? HALVINGS : []);
  showLast();
}

/** Fetches and shows the current chart and timeframe; `keepView` keeps zoom and scroll (the Refresh button). */
async function load(keepView = false) {
  save();
  const t = ticker();
  const { interval } = state;
  const [candles, daily, status, saved] = await Promise.all([
    fetchCandles(t, interval), fetchCandles(t, '1D'), fetchStatus(), t === drawn ? null : fetchDrawings(t),
  ]);
  if (t !== ticker() || interval !== state.interval) return; // a newer click won
  bars = candles;
  days = daily;
  index.clear();
  bars.forEach((b, i) => index.set(b.time, i));
  main.setData(bars, intraday(), keepView);
  makeLines();
  showLines();
  editor.setBars(bars, t, interval);
  if (saved) {
    editor.load(saved);
    drawn = t;
  }
  delayed.hidden = status.failing.length === 0;
}

/** Shows `asset`, priced in `vs` (by default the one picked before), or in dollars when that is the asset itself. */
function showChart(asset: Asset, vs = state.vs) {
  // Rates open on a linear scale and the rest on log; between two of a kind the scale stays as picked.
  if (RATES.includes(asset) !== RATES.includes(state.asset)) setLog(!RATES.includes(asset));
  state.asset = asset;
  state.vs = vs === asset ? null : vs;
  showPick(asset, state.vs);
  // Greyed out where the chart can't show it: 1h/4h without hourly data (FRED), candles for a line, averages on M2.
  const daily = ticker().split('/').some((a) => DAILY_ONLY.includes(a as Asset));
  pickInterval.disable(daily ? ['1h', '4h'] : []);
  if (daily && intraday()) {
    state.interval = '1D';
    pickInterval('1D');
  }
  const style = lineOnly() ? 'line' : state.style;
  pickStyle.disable(lineOnly() ? ['candles'] : []);
  pickStyle(style);
  main.setStyle(style);
  toggles.slice(0, 3).forEach((b) => (b.disabled = monthly())); // the averages and band, not halvings
  return load();
}
// Drawings are saved per chart (a ratio has its own) and show on every timeframe; each change is sent straight away.
const editor = drawingEditor(main, chartEl, TOOLS, {
  save: (list) => saveDrawings(ticker(), list), toolDone: () => pickTool('cursor'),
  showAsset(t) {
    const [asset, vs = null] = t.split('/') as [Asset, Asset?];
    return showChart(asset, vs);
  },
});

const showPick = assetSwitcher(toolbar, state.asset, showChart);
const pickInterval = buttonGroup(toolbar, INTERVALS.map((i, n) => [i, i, `Shift+${n + 1}`]), state.interval, (i) => {
  state.interval = i; load();
});
const setLog = (log: boolean) => {
  state.log = log; main.setLog(log); pickScale(log ? 'log' : 'linear'); save();
};
const pickScale = buttonGroup(toolbar, [['log', 'Log'], ['linear', 'Linear']], state.log ? 'log' : 'linear', (s) => setLog(s === 'log'), 'L');
const pickStyle = buttonGroup(toolbar, [['candles', 'Candles'], ['line', 'Line']], state.style, (s) => {
  state.style = s; main.setStyle(s); save();
}, 'C');
const toggles = ([
  ['ma1', `${settings.ma[0].length}D`, 'Moving average of daily closes (length and colour in Settings)'],
  ['ma2', `${settings.ma[1].length}D`, 'Moving average of daily closes (length and colour in Settings)'],
  ['band', '20W/21W', 'Bull market support band: 20-week SMA and 21-week EMA of weekly closes'],
  ['halvings', 'Halvings', 'Bitcoin halving dates, and the next one (estimated)'],
] as const).map(([key, label, title]) => Object.assign(toggle(toolbar, label, state.show.has(key), (on) => {
  if (on) state.show.add(key);
  else state.show.delete(key);
  showLines();
  save();
}), { title }));
const pickTool = buttonGroup(toolbar, [['cursor', 'Cursor'], ...TOOLS.map((t): [string, string, string] => [t.type, t.label, t.key])],
  'cursor', (t) => editor.setTool(t === 'cursor' ? null : t));
const clear = toolbar.appendChild(document.createElement('div'));
clear.className = 'group';
clear.innerHTML = '<button title="Delete all drawings on this chart (Ctrl+Z undoes)">Clear all</button>';
clear.onclick = () => {
  const n = editor.count();
  if (n && confirm(`Delete all ${n} drawings on ${tickerName(ticker())}? (Ctrl+Z brings them back)`)) editor.clear();
};

// The server downloads new prices every 5 minutes; this shows them without losing your place.
refresh.onclick = () => {
  refresh.disabled = true;
  load(true).finally(() => (refresh.disabled = false));
};

// A PNG of what is on screen, named e.g. "BTC-Gold-1D-2026-10-19.png".
picture.onclick = () => {
  const a = document.createElement('a');
  a.href = main.picture(`${tickerName(ticker())} · ${state.interval}`).toDataURL('image/png');
  a.download = `${tickerName(ticker()).replace(/[ /]+/g, '-')}-${state.interval}-${new Date().toISOString().slice(0, 10)}.png`;
  a.click();
};
shortcut('P', 'Save the chart as a picture', () => picture.click());

settingsPanel(document.getElementById('settings')!, settings, () => {
  settings.ma.forEach((m, i) => (toggles[i].textContent = `${m.length}D`));
  makeLines();
  showLines();
}, [...shortcuts, ...EDITOR_KEYS]);

main.onHover((time) => {
  if (time === null) return showLast();
  const i = index.get(time);
  if (i !== undefined) showBar(i);
});

main.setLog(state.log);
await showChart(state.asset);

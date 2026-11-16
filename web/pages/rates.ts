import { createOptionsChart, LineSeries, LineStyle, PriceScaleMode, type ISeriesApi } from 'lightweight-charts';
import { averageHikes, HIKE_DATES, hikeLines, smoothHike, utc, DAY, type HikeKind } from '../../shared/rate-hikes.ts';
import { ASSET_NAMES, type Asset, type Candle } from '../../shared/types.ts';
import { fetchCandles } from '../core/api.ts';

const assets: Asset[] = ['btc', 'eth', 'gold', 'silver', 'spx', 'ixic', 'dxy'];
const params = new URLSearchParams(location.search);
const state = {
  asset: (assets.includes(params.get('asset') as Asset) ? params.get('asset') : 'silver') as Asset,
  kind: (params.get('kind') === 'september' ? 'september' : 'first') as HikeKind,
  length: [90, 180, 365, 730].includes(Number(params.get('length'))) ? Number(params.get('length')) : 365,
  ma: [1, 7, 30].includes(Number(params.get('ma'))) ? Number(params.get('ma')) : 1,
  scale: params.get('scale') === 'log' ? 'log' : 'linear',
  view: params.get('view') ?? 'all', hidden: new Set((params.get('hide') ?? '').split(',').filter(Boolean)),
};
const save = () => history.replaceState(null, '', `?${new URLSearchParams({ asset: state.asset, kind: state.kind, length: String(state.length), ma: String(state.ma), scale: state.scale, view: state.view, hide: [...state.hidden].join(',') })}`);
const $ = (id: string) => document.getElementById(id)!;
const toolbar = $('toolbar');
function select(label: string, entries: [string, string][], value: string, change: (v: string) => void) {
  const wrapper = toolbar.appendChild(document.createElement('label'));
  wrapper.className = 'control-label'; wrapper.append(label);
  const picker = wrapper.appendChild(document.createElement('select'));
  picker.ariaLabel = label;
  for (const [value, text] of entries) picker.add(new Option(text, value));
  picker.value = value; picker.onchange = () => change(picker.value);
  return picker;
}
select('Asset', assets.map(a => [a, ASSET_NAMES[a]]), state.asset, v => { state.asset = v as Asset; void load(); });
select('Event', [['first', 'First rate hike'], ['september', 'September midterm hike']], state.kind, v => { state.kind = v as HikeKind; state.view = 'all'; state.hidden.clear(); draw(); });
select('Window', [['90', '90 days'], ['180', '180 days'], ['365', '1 year'], ['730', '2 years']], String(state.length), v => { state.length = Number(v); draw(); });
select('Moving average', [['1', 'None'], ['7', '7 days'], ['30', '30 days']], String(state.ma), v => { state.ma = Number(v); draw(); });
select('ROI scale', [['linear', 'Linear'], ['log', 'Logarithmic']], state.scale, v => { state.scale = v; draw(); });
const viewPicker = select('View', [['all', 'All cycles + average']], state.view, v => { state.view = v; state.hidden.clear(); draw(); });

const chart = createOptionsChart($('rate-chart'), {
  autoSize: true, layout: { background: { color: '#0f1219' }, textColor: '#8b91a0', attributionLogo: true },
  grid: { vertLines: { visible: false }, horzLines: { color: '#1d2330' } },
  rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.06 } }, timeScale: { borderColor: '#262c39', minBarSpacing: 0.1 },
  localization: { priceFormatter: (p: number) => p.toFixed(2), precision: 0, timeFormatter: (day: number) => `Day ${day}` },
});
const colors = ['#60a5fa', '#a78bfa', '#34d399', '#22d3ee', '#818cf8', '#fb7185', '#fbbf24'];
type Row = { key: string; name: string; color: string; points: { day: number; roi: number }[]; series: ISeriesApi<'Line', number> };
let rows: Row[] = [], bars: Candle[] = [], generation = 0;
let average: ReturnType<typeof averageHikes> = [];
const visible = (key: string) => !state.hidden.has(key) && (state.view === 'all' || state.view === key || (state.view === 'latest' && (key === 'average' || key === HIKE_DATES[state.kind].at(-1))));
const label = (date: string) => new Date(utc(date) * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
function hover(day: number) {
  $('rate-hover').replaceChildren();
  const title = document.createElement('strong'); title.textContent = `Day ${day}`; $('rate-hover').append(title);
  for (const row of rows.filter(r => r.series.options().visible)) {
    const p = row.points.find(p => p.day === day);
    const div = document.createElement('div'); div.style.color = row.color;
    const n = row.key === 'average' ? average.find(p => p.day === day)?.count : undefined;
    const date = row.key === 'average' ? `${n ?? 0} cycles` : new Date((utc(row.key) + day * DAY) * 1000).toISOString().slice(0, 10);
    div.textContent = `${row.name}: ${p ? `${p.roi.toFixed(3)} (${((p.roi - 1) * 100).toFixed(1)}%)` : '—'} · ${date}`;
    $('rate-hover').append(div);
  }
}
function draw() {
  const dates = HIKE_DATES[state.kind];
  const lines = hikeLines(bars, dates, state.length);
  average = averageHikes(lines.filter(l => l.date !== dates.at(-1)));
  const options: [string, string][] = [['all', 'All cycles + average'], ['average', 'Average only'], ['latest', 'Latest + average'], ...lines.map(l => [l.date, `${label(l.date)} only`] as [string, string])];
  if (!options.some(([v]) => v === state.view)) state.view = 'all';
  viewPicker.replaceChildren(...options.map(([v, name]) => new Option(name, v))); viewPicker.value = state.view;
  for (const row of rows) chart.removeSeries(row.series);
  rows = [];
  $('rate-legend').replaceChildren();
  const add = (key: string, name: string, points: Row['points'], color: string) => {
    const series = chart.addSeries(LineSeries, { color, lineWidth: key === 'average' ? 3 : 2, lineStyle: key === 'average' ? LineStyle.Dashed : LineStyle.Solid, visible: visible(key), lastValueVisible: false, priceLineVisible: false });
    const smoothed = smoothHike(points, state.ma);
    series.setData(smoothed.map(p => ({ time: p.day, value: p.roi })));
    rows.push({ key, name, color, points: smoothed, series });
    const button = $('rate-legend').appendChild(document.createElement('button'));
    button.className = 'cycle-toggle'; button.style.setProperty('--cycle-color', color);
    button.setAttribute('aria-pressed', String(visible(key)));
    button.innerHTML = `<i></i><span>${name}<small>${key === 'average' ? 'Prior cycles · equal weight' : key}</small></span><b>${points.at(-1)!.roi.toFixed(2)}×</b>`;
    button.onclick = () => {
      // Preserve the current view while allowing individual legend switches.
      const shown = new Set(rows.filter(r => r.series.options().visible).map(r => r.key));
      if (shown.has(key)) shown.delete(key); else shown.add(key);
      state.view = 'all'; state.hidden = new Set(rows.filter(r => !shown.has(r.key)).map(r => r.key)); draw();
    };
  };
  for (const line of lines) add(line.date, label(line.date), line.points, colors[HIKE_DATES.first.indexOf(line.date)] ?? colors[dates.indexOf(line.date) + 4]);
  if (average.length) add('average', 'Historical average', average, '#e2e8f0');
  if (rows[0]) rows[0].series.createPriceLine({ price: 1, color: '#475569', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false });
  chart.applyOptions({ rightPriceScale: { mode: state.scale === 'log' ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal } });
  chart.timeScale().fitContent();
  $('rate-title').textContent = `${ASSET_NAMES[state.asset]} after ${state.kind === 'first' ? 'the first rate hike' : 'September midterm hikes'}`;
  $('rate-status').textContent = lines.length ? `${lines.length} cycles · ${average[0]?.count ?? 0} in historical average · Daily history from ${new Date(bars[0].time * 1000).toISOString().slice(0, 10)} · Latest close ${new Date(bars.at(-1)!.time * 1000).toISOString().slice(0, 10)}` : 'No daily history overlaps these hike dates. Choose another asset.';
  ($('open-overlay') as HTMLAnchorElement).href = `./?asset=fed&overlay=${state.asset}&scale=linear&show=`;
  hover(0); save();
}
$('show-all').onclick = () => { state.hidden.clear(); state.view = 'all'; draw(); };
chart.subscribeCrosshairMove(p => hover(p.time ?? 0));
new ResizeObserver(() => chart.timeScale().fitContent()).observe($('rate-chart'));
async function load() {
  const id = ++generation; save();
  for (const row of rows) chart.removeSeries(row.series); rows = []; bars = [];
  $('rate-legend').replaceChildren(); $('rate-hover').replaceChildren();
  $('rate-title').textContent = `${ASSET_NAMES[state.asset]} after a rate hike`;
  $('rate-status').textContent = 'Loading price history…';
  try { const data = await fetchCandles(state.asset, '1D'); if (id !== generation) return; bars = data; draw(); }
  catch { if (id === generation) { $('rate-status').textContent = 'Could not load price history. '; const retry = document.createElement('button'); retry.textContent = 'Retry'; retry.onclick = () => void load(); $('rate-status').append(retry); } }
}
await load();

// Seasonality page: each month's % change (a rate's: in percentage points), a row per year, with the average, median
// and % of years up under it.
import { monthlyReturns, pickYears, stats, type Cell, type Phase, type Stats, type YearRow } from '../../shared/seasonality.ts';
import { ASSET_NAMES, RATES, type Asset } from '../../shared/types.ts';
import { fetchCandles } from '../core/api.ts';
import { assetButtons, buttonGroup, yearRange } from '../core/buttons.ts';
import { heatCell, top, withSign } from '../core/heat.ts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The years of the 4-year cycle (see Phase), for the title line. */
const PHASES = ['election and halving years', 'post-election years (halving +1)', 'midterm years (halving +2)',
  'pre-election years (halving +3)'];
type CycleYear = 'all' | `${Phase}`;

// The view lives in the address bar, so a reload or bookmark keeps it.
const params = new URLSearchParams(location.search);
const state = {
  asset: (params.get('asset') ?? 'btc') as Asset,
  /** First and last year shown; null: from the first year there is, up to the latest (so a new year shows up). */
  from: Number(params.get('from')) || null,
  to: Number(params.get('to')) || null,
  cycle: (params.get('cycle') ?? 'all') as CycleYear,
};
const save = () => history.replaceState(null, '', `?${new URLSearchParams({
  asset: state.asset, ...(state.from && { from: String(state.from) }), ...(state.to && { to: String(state.to) }),
  cycle: state.cycle,
})}`);

const pct = (x: number) => `${withSign(Math.abs(x * 100).toFixed(Math.abs(x) < 1 ? 1 : 0), x)}%`;
/** A rate's change, in percentage points. */
const points = (x: number) => withSign(Math.abs(x).toFixed(2), x);
const changes = (cells: (Cell | null)[]) => cells.filter((c) => c !== null).map((c) => c.change);

const title = document.getElementById('title')!;
const table = document.getElementById('table')!;
/** Every year of the picked asset, newest first. */
let all: YearRow[] = [];

/** Rebuilds the year lists, title and table from the loaded months and the picked options. */
function draw() {
  save();
  const { from, to } = showYears(all.map((r) => r.year).reverse());
  if (!all.length) { // its source was down on the very first download
    title.textContent = `No ${ASSET_NAMES[state.asset]} prices downloaded yet`;
    table.replaceChildren();
    return;
  }
  const rate = RATES.includes(state.asset);
  const format = rate ? points : pct;
  /** A year's month or full year; faded when partial. */
  const cell = (c: Cell | null, top: number, partialTip: string) => c === null ? '<td></td>'
    : heatCell(c.change, top, format(c.change), c.partial ? ` class="partial" title="${partialTip}"` : '');

  const phase = state.cycle === 'all' ? null : Number(state.cycle) as Phase;
  const rows = pickYears(all, { from, to, phase });
  const monthTop = top(changes(rows.flatMap((r) => r.months)));
  const yearTop = top(changes(rows.map((r) => r.full)));
  title.innerHTML = `<b>${ASSET_NAMES[state.asset]} ${rate ? 'monthly change, in percentage points' : 'monthly returns'}</b>
    ${from}–${to}${phase === null ? '' : `, ${PHASES[phase]} only`} (${rows.length} years) ·
    faded = not over yet, or only partly in the data; left out of the bottom rows`;

  const body = rows.map((r) => `<tr><th>${r.year}</th>${
    r.months.map((c, m) => cell(c, monthTop, `${MONTHS[m]} so far: the month isn't over`)).join('')}${
    cell(r.full, yearTop, r === all[0] ? `${r.year} so far: the year isn't over` : 'Only from the first month in the data')}</tr>`);
  const columns = stats(rows);
  const statRow = (label: string, tip: string, show: (s: Stats, top: number) => string) =>
    `<tr title="${tip}"><th>${label}</th>${columns.map((s, m) => s ? show(s, m < 12 ? monthTop : yearTop) : '<td></td>').join('')}</tr>`;
  table.innerHTML = `<thead><tr><th>Year</th>${MONTHS.map((m) => `<th>${m}</th>`).join('')}<th>Full year</th></tr></thead>
    <tbody>${body.join('')}</tbody><tfoot>${
    statRow('Average', 'Average of the years shown (faded cells left out)', (s, t) => heatCell(s.average, t, format(s.average)))}${
    statRow('Median', 'The middle year: half did better, half worse (faded cells left out)', (s, t) =>
      heatCell(s.median, t, format(s.median)))}${
    statRow('% years up', 'Share of the years shown that went up (faded cells left out)', (s) =>
      heatCell(s.up - 0.5, 0.5, `${Math.round(s.up * 100)}%`, ` title="${Math.round(s.up * s.years)} of ${s.years} years up"`))}</tfoot>`;
}

async function load() {
  const asset = state.asset;
  const months = await fetchCandles(asset, '1M');
  if (asset !== state.asset) return; // a newer click won
  all = monthlyReturns(months, Date.now() / 1000, RATES.includes(asset));
  draw();
}

const toolbar = document.getElementById('toolbar')!;
assetButtons(toolbar, state.asset, (a) => {
  state.asset = a;
  load();
});
const showYears = yearRange(toolbar, state, draw);

/** A cycle filter row. Both rows pick the same years, so each lights up its match in the other. */
function cycleRow(label: string, options: [CycleYear, string][], tip: string) {
  const box = toolbar.appendChild(document.createElement('div'));
  box.className = 'labelled';
  box.title = tip;
  box.append(label);
  return buttonGroup(box, [['all', 'All'], ...options], state.cycle, (c) => {
    state.cycle = c;
    election(c);
    halving(c);
    draw();
  });
}
const election = cycleRow('Election cycle', [['1', 'Post-election'], ['2', 'Midterm'], ['3', 'Pre-election'], ['0', 'Election']],
  'US presidential election cycle. Post-election: 2025, 2021… Midterm: 2026, 2022… Pre-election: 2027, 2023… Election: 2028, 2024…');
const halving = cycleRow('Halving cycle', [['0', 'Halving year'], ['1', '+1'], ['2', '+2'], ['3', '+3']],
  'BTC halving years (2012, 2016, 2020, 2024, 2028) and the 1, 2 or 3 years after. '
  + 'Halvings fall in US election years, so this row picks the same years as the one before it.');

await load();

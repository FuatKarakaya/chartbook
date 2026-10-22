// DCA page: buying the same dollar amount every week, once for each weekday: which day's buys got the most for the money.
import { weekdayBuys, type WeekdayBuys } from '../../shared/dca.ts';
import { ASSET_GROUPS, ASSET_NAMES, type Asset, type Candle } from '../../shared/types.ts';
import { fetchCandles } from '../core/api.ts';
import { assetButtons, buttonGroup, yearRange } from '../core/buttons.ts';
import { heatCell, withSign } from '../core/heat.ts';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
/** Dollars bought every week. */
const AMOUNT = 100;
/** Full bar and full colour at 0.5% more or less: the same for every asset, so a small difference looks small. */
const SCALE = 0.005;
const yearOf = (t: number) => new Date(t * 1000).getUTCFullYear();
const yearStart = (y: number) => Date.UTC(y, 0, 1) / 1000;
const years = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const dollars = (x: number) => `$${Math.round(x).toLocaleString('en-US')}`;
/** Rounded to 3 digits, for an estimate: $441,000. */
const about = (x: number) => `about $${Math.round(Number(x.toPrecision(3))).toLocaleString('en-US')}`;
const price = (x: number) =>
  `$${x.toLocaleString('en-US', x < 1 ? { maximumSignificantDigits: 4 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (x: number, digits: number) => `${withSign(
  Math.abs(x * 100).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }), x)}%`;
const best = (list: WeekdayBuys[]) => list.reduce((a, b) => (b.more > a.more ? b : a));
const worst = (list: WeekdayBuys[]) => list.reduce((a, b) => (b.more < a.more ? b : a));
/** A bar from the middle line: right and green for more of the asset, left and red for less. */
function bar(x: number) {
  const width = Math.min(1, Math.abs(x) / SCALE) * 50;
  return `<span><i style="left:${x > 0 ? 50 : 50 - width}%;width:${width}%;background:${x > 0 ? '#26a69a' : '#ef5350'}"></i></span>`;
}

// The view lives in the address bar, so a reload or bookmark keeps it.
const params = new URLSearchParams(location.search);
const state = {
  asset: (params.get('asset') ?? 'btc') as Asset,
  /**
   * First and last year; null: from the first year there is, up to the latest. Opens on the last 10 years: from the
   * start, early BTC (bought at cents) dwarfs everything after.
   */
  from: params.get('from') === 'start' ? null : Number(params.get('from')) || new Date().getUTCFullYear() - 9,
  to: Number(params.get('to')) || null,
  /** Buy at the day's opening or closing price. */
  at: (params.get('at') ?? 'close') as 'open' | 'close',
};
const save = () => history.replaceState(null, '', `?${new URLSearchParams({
  asset: state.asset, from: String(state.from ?? 'start'), ...(state.to && { to: String(state.to) }), at: state.at,
})}`);

const [title, headline, summary, byYearTitle, byYear] =
  ['title', 'headline', 'summary', 'by-year-title', 'by-year'].map((id) => document.getElementById(id)!);
let days: Candle[] = [];

/** Rebuilds the year lists, headline and both tables from the loaded daily candles and the picked years. */
function draw() {
  save();
  const name = ASSET_NAMES[state.asset];
  const { from, to } = showYears(days.length ? years(yearOf(days[0].time), yearOf(days.at(-1)!.time)) : []);
  if (!days.length) { // its source was down on the very first download
    title.textContent = `No ${name} prices downloaded yet`;
    [headline, summary, byYearTitle, byYear].forEach((el) => el.replaceChildren());
    return;
  }
  const end = yearStart(to + 1) - 1;
  const all = weekdayBuys(days, yearStart(from), end, state.at);
  const top1 = best(all);
  const bottom = worst(all);
  const perYear = years(from, to).reverse()
    .map((y) => ({ y, buys: weekdayBuys(days, yearStart(y), yearStart(y + 1) - 1, state.at) }));
  const yearsBest = (weekday: number) => perYear.filter((p) => best(p.buys).weekday === weekday).length;
  // What the plan came to, much the same whichever day: the average of the days.
  const put = AMOUNT * Math.round(all.reduce((s, r) => s + r.buys, 0) / all.length);
  const worth = AMOUNT * all.reduce((s, r) => s + r.units, 0) / all.length * days.findLast((d) => d.time <= end)!.close;

  title.innerHTML = `<b>Buying ${dollars(AMOUNT)} of ${name} every week, ${from}–${to}</b>
    once for each weekday, at that day's ${state.at === 'open' ? 'opening' : 'closing'} price${
    all.length === 7 ? ` (${state.at === 'open' ? '00:00' : '24:00'} UTC)` : ''}. Each buy is compared with the same money
    spread evenly over the week around it (${all.length === 7 ? '3 days' : '2 trading days'} either side), so a rising
    market favours no day. A buy that falls on a holiday happens the next trading day.`;
  headline.innerHTML = `Best day: <b class="up">${WEEKDAYS[top1.weekday]}</b>, whose buys got ${signed(top1.more, 2).slice(1)}
    more ${name} than the days around them (the best day in ${yearsBest(top1.weekday)} of ${perYear.length} years).
    Worst: <b class="down">${WEEKDAYS[bottom.weekday]}</b>, ${signed(bottom.more, 2).slice(1)} less.<br>
    Whichever day, ${dollars(AMOUNT)} a week put in ${dollars(put)}, worth ${about(worth)}
    ${to === yearOf(days.at(-1)!.time) ? 'now' : `at the end of ${to}`} (${signed(worth / put - 1, 0)}).
    The best day instead of the worst: ${about((top1.more - bottom.more) * worth)} more.`;

  summary.innerHTML = `<thead><tr><th>Buying every</th><th>More ${name} than the days around it</th><th>Best day in</th></tr></thead>
    <tbody>${all.map((r) => `<tr${r === top1 ? ' class="best"' : ''}><th>${WEEKDAYS[r.weekday]}</th>
      <td class="bar">${bar(r.more)}${signed(r.more, 2)}</td><td>${yearsBest(r.weekday)} of ${perYear.length} years</td></tr>`)
    .join('')}</tbody>`;

  byYearTitle.innerHTML = `<b>Year by year</b> the same, each year on its own; the best day in bold. Point at a number for
    that day's average price.`;
  byYear.innerHTML = `<thead><tr><th>Year</th>${all.map((r) => `<th>${WEEKDAYS[r.weekday].slice(0, 3)}</th>`).join('')}</tr></thead>
    <tbody>${perYear.map(({ y, buys }) => `<tr><th>${y}</th>${all.map(({ weekday }) => {
    const r = buys.find((b) => b.weekday === weekday);
    return r ? heatCell(r.more, SCALE, signed(r.more, 2), `${r === best(buys) ? ' class="best"' : ''}
      title="${WEEKDAYS[weekday]}s in ${y}: ${r.buys} buys at ${price(r.buys / r.units)} on average"`) : '<td></td>';
  }).join('')}</tr>`).join('')}</tbody>`;
}

async function load() {
  const asset = state.asset;
  const candles = await fetchCandles(asset, '1D');
  if (asset !== state.asset) return; // a newer click won
  days = candles;
  draw();
}

// Only markets: the macro series (rates, M2, the dollar index) aren't things you buy.
const toolbar = document.getElementById('toolbar')!;
assetButtons(toolbar, state.asset, (a) => {
  state.asset = a;
  load();
}, [ASSET_GROUPS[0]]);
const showYears = yearRange(toolbar, state, draw);
const atBox = toolbar.appendChild(document.createElement('div'));
atBox.className = 'labelled';
atBox.title = 'BTC and ETH trade around the clock, so a day opens at the price the day before closed on: '
  + "Monday's open is Sunday's close. Stock and metal markets open at a different price than they closed on.";
atBox.append('Buy at');
buttonGroup(atBox, [['close', "Day's close"], ['open', "Day's open"]], state.at, (at) => {
  state.at = at;
  draw();
});

await load();

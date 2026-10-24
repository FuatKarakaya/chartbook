// Dates in the empty space right of the last bar, where fractals and pattern overlays project to: the chart itself
// only labels times that have a bar. Drawn on the time axis in their own colour, with the date under the mouse there.
import type { IChartApi, IPrimitivePaneView, ISeriesApi, ISeriesPrimitiveAxisView, SeriesType } from 'lightweight-charts';

/** Future dates' colour: apart from real ones, as what is drawn there is a projection. */
export const FUTURE = '#ce93d8';
/** The chart's own font (Lightweight Charts' default). */
const FONT = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HOUR = 3600;
const DAY = 24 * HOUR;
/** Least room between two date labels, and between the first and the last bar (CSS pixels). */
const GAP = 64;

/** A tick step: its rough length, and the first tick after a time. */
interface Step { seconds: number; next(t: number): number }
const utc = (t: number) => new Date(t * 1000);
const hours = (h: number): Step => ({ seconds: h * HOUR, next: (t) => (Math.floor(t / (h * HOUR)) + 1) * h * HOUR });
/** Days 1, 1 + k, 1 + 2k... of each month. */
const days = (k: number): Step => ({
  seconds: k * DAY,
  next(t) {
    let d = (Math.floor(t / DAY) + 1) * DAY;
    while ((utc(d).getUTCDate() - 1) % k) d += DAY;
    return d;
  },
});
const months = (m: number): Step => ({
  seconds: m * 30 * DAY,
  next(t) {
    let month = utc(t).getUTCMonth() + 1;
    while (month % m) month++;
    return Date.UTC(utc(t).getUTCFullYear(), month, 1) / 1000;
  },
});
const years = (n: number): Step => ({
  seconds: n * 365 * DAY,
  next(t) {
    let year = utc(t).getUTCFullYear() + 1;
    while (year % n) year++;
    return Date.UTC(year, 0, 1) / 1000;
  },
});
/** Fine to coarse; daily and longer charts start at days. */
const STEPS = [...[1, 2, 3, 6, 12].map(hours), ...[1, 2, 7, 14].map(days), ...[1, 3, 6].map(months), ...[1, 2, 5, 10].map(years)];

/** "2027", "Nov", "15" or "12:00", as the chart labels its own ticks, and how much each matters when room is short. */
function tick(t: number) {
  const d = utc(t);
  if (t % DAY) return { text: d.toISOString().slice(11, 16), weight: 1 };
  if (d.getUTCDate() > 1) return { text: String(d.getUTCDate()), weight: 2 };
  return d.getUTCMonth() ? { text: MONTHS[d.getUTCMonth()], weight: 3 } : { text: String(d.getUTCFullYear()), weight: 4 };
}

/**
 * The dates to label after the last bar (`from`) up to `to`, at screen positions `x(time)`: the finest step with room
 * between labels, then where two still crowd (a month's 29th and the next 1st), the one that matters more.
 */
export function futureTicks(from: number, to: number, x: (t: number) => number, intraday: boolean) {
  const step = STEPS.slice(intraday ? 0 : 5).find((s) => x(from + s.seconds) - x(from) >= GAP);
  if (!step) return [];
  const all = [];
  for (let t = step.next(from); t <= to; t = step.next(t)) all.push({ time: t, x: x(t), ...tick(t) });
  const shown = [{ x: x(from) }]; // the chart's own labels end around the last bar
  for (const k of all.sort((a, b) => b.weight - a.weight)) if (shown.every((s) => Math.abs(s.x - k.x) >= GAP)) shown.push(k);
  return (shown.slice(1) as typeof all).sort((a, b) => a.time - b.time);
}

/** "30 Oct '26", with the hour on 1h/4h: as the chart writes the date under the mouse. */
function fullDate(t: number, intraday: boolean) {
  const d = utc(t);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}${intraday ? ` ${d.toISOString().slice(11, 16)}` : ''}`;
}

/** What the dates need from the chart: its last bar, the time at a bar position (also past the last), and where a time is. */
export interface Timeline { last(): number; toTime(l: number): number; x(t: number): number; intraday(): boolean }

/** Adds the future dates to `series`' time axis; they show while the series does (candles, or the line). */
export function futureDates(chart: IChartApi, series: ISeriesApi<SeriesType>, line: Timeline) {
  let requestUpdate = () => {};
  let hover = { x: 0, text: '' };
  let labels: ISeriesPrimitiveAxisView[] = [];
  const label: ISeriesPrimitiveAxisView = {
    coordinate: () => hover.x, text: () => hover.text, textColor: () => '#0f1219', backColor: () => FUTURE, tickVisible: () => false,
  };
  const shown = () => series.options().visible && line.last() >= 0;
  chart.subscribeCrosshairMove(({ logical }) => {
    const future = shown() && logical !== undefined && logical > line.last();
    if (future) hover = { x: chart.timeScale().logicalToCoordinate(logical)!, text: fullDate(line.toTime(logical), line.intraday()) };
    labels = future ? [label] : [];
    requestUpdate();
  });
  const axis: IPrimitivePaneView[] = [{
    renderer: () => ({
      draw: (target) => target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        const range = chart.timeScale().getVisibleLogicalRange();
        if (!shown() || !range) return;
        context.font = `12px ${FONT}`;
        context.fillStyle = FUTURE;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        for (const t of futureTicks(line.toTime(line.last()), line.toTime(range.to), line.x, line.intraday())) {
          context.fillText(t.text, t.x, mediaSize.height / 2);
        }
      }),
    }),
  }];
  series.attachPrimitive({
    attached: (p) => void (requestUpdate = p.requestUpdate),
    timeAxisViews: () => labels,
    timeAxisPaneViews: () => axis,
  });
}

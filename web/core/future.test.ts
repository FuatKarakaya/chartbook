import { expect, it } from 'vitest';
import { futureTicks } from './future.ts';

const HOUR = 3600;
const DAY = 24 * HOUR;
const LAST = Date.UTC(2026, 9, 23) / 1000; // the last bar: Friday 23 October 2026
/** Screen x of a time: `perDay` pixels a day from the last bar. */
const at = (perDay: number) => (t: number) => ((t - LAST) / DAY) * perDay;
const texts = (from: number, to: number, perDay: number, intraday = false) =>
  futureTicks(from, to, at(perDay), intraday).map((t) => t.text);

it('labels a daily chart by the week, with month and year names, the more important first where they crowd', () => {
  // 10 px a day: days 1, 8, 15, 22 (a 29th is too near the next 1st); the first, Oct 29, too near the last bar.
  expect(texts(LAST, Date.UTC(2027, 1, 28) / 1000, 10)).toEqual([
    'Nov', '8', '15', '22', 'Dec', '8', '15', '22', '2027', '8', '15', '22', 'Feb', '8', '15', '22',
  ]);
});

it('labels months, then years, as the chart zooms out', () => {
  // November 1st and 2027 come too soon after the last bar to fit a label between.
  expect(texts(LAST, Date.UTC(2027, 6, 1) / 1000, 3)).toEqual(['Dec', '2027', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul']);
  expect(texts(LAST, Date.UTC(2031, 0, 1) / 1000, 0.25)).toEqual(['2028', '2029', '2030', '2031']);
});

it('labels hours on 1h/4h, with the day at midnight; never hours on a daily chart', () => {
  const from = LAST + HOUR; // the last hourly bar: 01:00
  expect(texts(from, from + 30 * HOUR, 30 * 24, true)).toEqual(['06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '24', '03:00', '06:00']);
  expect(texts(LAST, LAST + 5 * DAY, 100)).toEqual(['24', '25', '26', '27', '28']);
});

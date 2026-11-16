import { expect, it } from 'vitest';
import { averageHikes, DAY, hikeLines, overlayPoints, smoothHike, utc } from './rate-hikes.ts';
import type { Candle } from './types.ts';
const bar = (date: string, close: number): Candle => ({ time: utc(date), open: close, high: close, low: close, close });

it('normalizes silver closes and carries weekends without extending unfinished cycles', () => {
  const bars = [bar('2022-03-16', 25), bar('2022-03-17', 26), bar('2022-03-18', 27), bar('2022-03-21', 30)];
  const [line] = hikeLines(bars, ['1994-02-04', '2022-03-16', '2026-09-16'], 90);
  expect(line.points).toEqual([1, 1.04, 1.08, 1.08, 1.08, 1.2].map((roi, day) => ({ day, roi })));
});
it('does not use future prices or stale history as a baseline', () => {
  expect(hikeLines([bar('2022-03-17', 25)], ['2022-03-16'], 90)).toEqual([]);
  expect(hikeLines([bar('2022-03-01', 25), bar('2022-03-20', 30)], ['2022-03-16'], 90)).toEqual([]);
});
it('caps the horizon, handles empty data and skips long missing stretches', () => {
  expect(hikeLines([], ['2022-03-16'], 90)).toEqual([]);
  const bars = [bar('2022-03-16', 10), bar('2022-03-25', 20)];
  expect(hikeLines(bars, ['2022-03-16'], 2)[0].points).toHaveLength(3);
  expect(hikeLines(bars, ['2022-03-16'], 90)[0].points.map(p => p.day)).toEqual([0, 1, 2, 3, 4, 9]);
});
it('averages normalized paths equally and reports changing sample counts', () => {
  expect(averageHikes([{ date: 'a', points: [{ day: 0, roi: 1 }, { day: 1, roi: 2 }] },
    { date: 'b', points: [{ day: 0, roi: 1 }] }])).toEqual([{ day: 0, roi: 1, count: 2 }, { day: 1, roi: 2, count: 1 }]);
  expect(averageHikes([])).toEqual([]);
});
it('smooths using only trailing calendar days', () => {
  expect(smoothHike([{ day: 0, roi: 1 }, { day: 1, roi: 3 }, { day: 5, roi: 9 }], 2).map(p => p.roi)).toEqual([1, 2, 9]);
});
it('aligns overlays without introducing extra chart dates or extending stale values', () => {
  const base = ['2022-03-15', '2022-03-16', '2022-03-19', '2022-03-21', '2022-03-22'].map(d => bar(d, 1));
  expect(overlayPoints(base, [bar('2022-03-16', 25), bar('2022-03-21', 30)], 4 * DAY)).toEqual([
    { time: utc('2022-03-16'), value: 25 }, { time: utc('2022-03-19'), value: 25 }, { time: utc('2022-03-21'), value: 30 },
  ]);
});

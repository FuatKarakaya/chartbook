import type { Candle, Point } from './types.ts';

export const DAY = 86400;
export const utc = (date: string) => Date.parse(`${date}T00:00:00Z`) / 1000;
/** FOMC announcement dates, not the next day's implementation date. Modern cycles since 1994.
 * Sources: federalreserve.gov/monetarypolicy/openmarket.htm and openmarket_archive.htm;
 * 2026: federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm. */
export const HIKE_DATES = {
  first: ['1994-02-04', '1997-03-25', '1999-06-30', '2004-06-30', '2015-12-16', '2022-03-16', '2026-09-16'],
  september: ['2018-09-26', '2022-09-21', '2026-09-16'],
};
export type HikeKind = keyof typeof HIKE_DATES;
export interface HikeLine { date: string; points: { day: number; roi: number }[] }

/** Calendar-day alignment. Closed markets carry their last close for at most four days.
 * Never backfill before inception or extend beyond the last observation. */
export function hikeLines(bars: Candle[], dates: string[], length: number): HikeLine[] {
  return dates.flatMap(date => {
    const start = utc(date);
    let i = bars.findIndex(b => b.time > start) - 1;
    if (i === -2) i = bars.length - 1;
    const base = bars[i];
    if (!base || base.close <= 0 || start - base.time > 4 * DAY) return [];
    const points = [];
    const end = Math.min(length, Math.floor((bars.at(-1)!.time - start) / DAY));
    for (let day = 0; day <= end; day++) {
      const time = start + day * DAY;
      while (bars[i + 1]?.time <= time) i++;
      if (time - bars[i].time > 4 * DAY || bars[i].close <= 0) continue;
      points.push({ day, roi: bars[i].close / base.close });
    }
    return points.length ? [{ date, points }] : [];
  });
}

/** Equal-weight arithmetic mean at each day; counts expose missing history. */
export function averageHikes(lines: HikeLine[]) {
  const days = new Map<number, { sum: number; count: number }>();
  for (const line of lines) for (const p of line.points) {
    const value = days.get(p.day) ?? { sum: 0, count: 0 };
    value.sum += p.roi; value.count++;
    days.set(p.day, value);
  }
  return [...days].sort(([a], [b]) => a - b).map(([day, v]) => ({ day, roi: v.sum / v.count, count: v.count }));
}

/** Trailing calendar-day mean, using only available past observations. */
export function smoothHike(points: HikeLine['points'], window: number) {
  let sum = 0, left = 0;
  return points.map((p, i) => {
    sum += p.roi;
    while (points[left].day <= p.day - window) sum -= points[left++].roi;
    return { day: p.day, roi: sum / (i - left + 1) };
  });
}

/** Sample an overlay on the base chart's dates so drawings retain their logical positions. */
export function overlayPoints(base: Candle[], asset: Candle[], maxAge: number): Point[] {
  let i = -1;
  return base.flatMap(b => {
    while (asset[i + 1]?.time <= b.time) i++;
    const a = asset[i];
    return a && b.time <= asset.at(-1)!.time && b.time - a.time <= maxAge ? [{ time: b.time, value: a.close }] : [];
  });
}

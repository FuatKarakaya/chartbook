import { expect, it } from 'vitest';
import { parseSilverHistory, silverWeeks, validateSilverCoverage } from './silver-history.ts';

const csv = 'Date,Open,High,Low,Close\n1970-01-04,1.8,1.9,1.7,1.85\n1970-01-11,1.85,2,1.8,1.95';
it('preserves weekly OHLC and maps Stooq week-ending Sundays to Mondays', () => {
  const out = parseSilverHistory(csv);
  expect(out).toHaveLength(2);
  expect(new Date(out[0].time * 1000).toISOString().slice(0, 10)).toBe('1969-12-29');
  expect(out[1]).toMatchObject({open: 1.85, high: 2, low: 1.8, close: 1.95});
  expect(parseSilverHistory(csv.replaceAll(',', ';'))).toEqual(out);
});
it('rejects access pages, corrupt prices, bad dates and daily files before touching the database', () => {
  for (const bad of ['Exceeded the daily site hits limit', csv.replace('1.9', '1.1'), csv.replace('1970-01-04', '1970-02-30'),
    csv.replace('1970-01-11', '1970-01-02'), csv.replace('1.95', 'NaN')]) {
    expect(() => parseSilverHistory(bad)).toThrow();
  }
});
it('prefers the complete modern aggregation at the join, with no duplicated week', () => {
  const history = parseSilverHistory(csv);
  const daily = [{time: history[1].time + 86400, open: 3, high: 5, low: 2, close: 4}];
  const result = silverWeeks(history, daily);
  expect(result).toEqual([history[0], {...daily[0],time:history[1].time}]);
  expect(silverWeeks([], daily)).toHaveLength(1);
});
it('requires coverage back to 1970 and through the existing-data seam', () => {
  const history = parseSilverHistory(csv);
  expect(() => validateSilverCoverage(history, history.at(-1)!.time + 7 * 86400)).not.toThrow();
  expect(() => validateSilverCoverage(history, Date.UTC(2001,0,1)/1000)).toThrow();
});

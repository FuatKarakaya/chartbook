import { expect, it } from 'vitest';
import { parseSilverContract, silverArchiveWeeks } from './silver-archive.ts';
import { bucket } from '../../shared/time.ts';

const t = Date.UTC(1980, 0, 14) / 1000;
const old = (rows: string) => parseSilverContract('SI80H.txt', rows);
it('normalizes both archive encodings to USD per troy ounce without altering OHLC', () => {
  const a = old('800114,3650,3700,3600,3680,1000,5000').bars[0];
  const b = parseSilverContract('SI80H.txt', '"Date","Open","High","Low","Close","Volume","OpenInt"\n01/14/1980,365000,370000,360000,368000,1000,5000').bars[0];
  expect(a).toEqual(b);
  expect(a).toMatchObject({ time: t, open: 36.5, high: 37, low: 36, close: 36.8 });
});
it('selects one complete active contract per week, including an active delivery month', () => {
  const jan = parseSilverContract('SI80F.txt', '800114,4800,4900,4700,4850,2000,5000\n800115,4850,5036,4800,4900,2000,5000');
  const march = old('800114,3650,3700,3600,3680,1000,5000\n800115,3680,3750,3650,3700,1000,5000');
  // A partial contract must not win just because one day had a large volume.
  const partial = parseSilverContract('SI80K.txt', '800114,3700,3800,3600,3750,100000,5000');
  const out = silverArchiveWeeks([march, jan, partial], t, t + 7 * 86400);
  expect(out.candles).toEqual([{ time: t, open: 48, high: 50.36, low: 47, close: 49 }]);
  expect(out.audit).toEqual([{ time: t, contract: 'SI80F.txt', volume: 4000, days: 2 }]);
  expect(silverArchiveWeeks([jan], t, t).candles).toEqual([]);
});
it('fails on corrupt, duplicate or impossible rows and weeks without an active complete contract', () => {
  for (const s of ['800114,3650,3500,3600,3680,1000,5', '800230,3650,3700,3600,3680,1000,5',
    '800114,3650,3700,3600,3680,-1,5', '800114,3650,3700,3600,3680,1000,5\n800114,3650,3700,3600,3680,1000,5']) {
    expect(() => old(s)).toThrow();
  }
  expect(() => silverArchiveWeeks([old('800114,3650,3700,3600,3680,0,5')], t, t + 86400)).toThrow();
  expect(bucket['1W'](t)).toBe(t);
});

import { expect, it } from 'vitest';
import type { Candle } from '../shared/types.ts';
import { openDb } from './db.ts';

const bar = (time: number, close: number): Candle => ({ time, open: close, high: close, low: close, close });

it('a save that fails part-way changes nothing and the next save still works', () => {
  const db = openDb(':memory:');
  db.save('fed', '1D', [bar(86400, 5)]);
  // What a web page sent instead of data turns into: no time.
  expect(() => db.save('fed', '1D', [bar(86400, 6), bar(NaN, 7)])).toThrow();
  expect(db.candles('fed', '1D')).toEqual([bar(86400, 5)]);
  db.save('btc', '1D', [bar(86400, 1)]);
  db.saveDrawings('btc', [{ id: 'a', type: 'trend' }]);
  expect(db.candles('btc', '1D')).toEqual([bar(86400, 1)]);
  expect(db.drawings('btc')).toEqual([{ id: 'a', type: 'trend' }]);
});

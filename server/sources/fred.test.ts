import { expect, it } from 'vitest';
import { parseFred } from './fred.ts';

it('reads a FRED CSV as flat candles at UTC midnight, skipping days with no value', () => {
  const csv = 'observation_date,DFF\n1954-07-01,1.13\n1954-07-02,.\n1954-07-03,1.25\n';
  expect(parseFred(csv)).toEqual([
    { time: Date.UTC(1954, 6, 1) / 1000, open: 1.13, high: 1.13, low: 1.13, close: 1.13 },
    { time: Date.UTC(1954, 6, 3) / 1000, open: 1.25, high: 1.25, low: 1.25, close: 1.25 },
  ]);
});

import { expect, it } from 'vitest';
import early from './btc-2010-2011.json' with { type: 'json' };

it('covers every day from the first Mt. Gox trade to the end of 2011, with consistent candles', () => {
  expect(early[0].time).toBe(Date.parse('2010-07-17') / 1000);
  expect(early.at(-1)!.time).toBe(Date.parse('2011-12-31') / 1000);
  early.forEach((c, i) => {
    if (i > 0) expect(c.time - early[i - 1].time).toBe(86400);
    if (i > 0) expect(c.open).toBe(early[i - 1].close);
    expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
    expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
    expect(c.low).toBeGreaterThan(0);
  });
});

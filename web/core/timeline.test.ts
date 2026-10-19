import { expect, it } from 'vitest';
import { timeline } from './timeline.ts';

const DAY = 86400;
// Mon-Fri, then the next Monday (a weekend gap like stock data).
const days = [0, 1, 2, 3, 4, 7].map((d) => d * DAY);

it('maps bar times to their positions and back', () => {
  const t = timeline(days);
  days.forEach((time, i) => {
    expect(t.toLogical(time)).toBe(i);
    expect(t.toTime(i)).toBe(time);
  });
});

it('interpolates between bars, across gaps too', () => {
  const t = timeline(days);
  expect(t.toLogical(1.5 * DAY)).toBe(1.5);
  expect(t.toLogical(5.5 * DAY)).toBeCloseTo(4.5);
  expect(t.toTime(4.5)).toBe(5.5 * DAY);
});

it('projects past the last bar with the average bar spacing', () => {
  const t = timeline(days); // 7 days over 5 bars
  const step = (7 * DAY) / 5;
  expect(t.toTime(7)).toBeCloseTo(7 * DAY + 2 * step);
  expect(t.toLogical(7 * DAY + 2 * step)).toBeCloseTo(7);
  expect(t.toLogical(-step)).toBeCloseTo(-1);
  expect(t.toTime(-1)).toBeCloseTo(-step);
});

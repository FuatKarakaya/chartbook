import { describe, expect, it } from 'vitest';
import { carryRange, timeline } from './timeline.ts';

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

describe('carryRange', () => {
  const WEEK = 7 * DAY;
  const daily = timeline(Array.from({ length: 700 }, (_, i) => i * DAY));
  const weekly = timeline(Array.from({ length: 100 }, (_, i) => i * WEEK));

  it('keeps the view as it is on the same bars (a refresh)', () => {
    expect(carryRange({ from: 100, to: 300 }, daily, daily, 20, 5000)).toEqual({ from: 100, to: 300 });
  });

  it('shows the same dates on another timeframe', () => {
    const r = carryRange({ from: 140, to: 350 }, daily, weekly, 20, 5000);
    expect(r.from).toBeCloseTo(20);
    expect(r.to).toBeCloseTo(50);
  });

  it('gives the empty space after the last bar the same share of the screen', () => {
    // 280 days of bars and 70 empty days: 40 weeks of bars, then 10 empty weeks.
    const r = carryRange({ from: 419, to: 769 }, daily, weekly, 20, 5000);
    expect(r.from).toBeCloseTo(59.86);
    expect((r.to - 99) / (r.to - r.from)).toBeCloseTo(0.2);
  });

  it('widens a too short stretch to the left, and cuts a too long one keeping the latest bar', () => {
    expect(carryRange({ from: 600, to: 620 }, daily, weekly, 20, 5000)).toEqual({ from: expect.closeTo(68.57), to: expect.closeTo(88.57) });
    const r = carryRange({ from: 10, to: 109 }, weekly, daily, 20, 100);
    expect(r.to - r.from).toBeCloseTo(100);
    expect((r.to - 699) / (r.to - r.from)).toBeCloseTo(10 / 99);
  });
});

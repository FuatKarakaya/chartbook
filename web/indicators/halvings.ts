import type { Mark } from '../core/chart.ts';

const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 1000;

/** Bitcoin halvings (the block reward halves every 210,000 blocks), on the UTC day of the halving block. */
export const HALVINGS: Mark[] = [
  ...['2012-11-28', '2016-07-09', '2020-05-11', '2024-04-20'].map((d) => ({ time: day(d), label: `Halving ${d}` })),
  // Block 1,050,000: about 80,000 blocks to go in October 2026 at about 144 a day. Put in the real date once it happens.
  { time: day('2028-04-13'), label: 'Next halving ~Apr 2028 (estimate)', estimate: true },
];

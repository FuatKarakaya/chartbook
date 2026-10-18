export type Asset = 'btc' | 'gold' | 'silver' | 'spx';
export type Interval = '1h' | '4h' | '1D' | '1W' | '1M';

/** One bar. `time` is the bar's open in UTC seconds. */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

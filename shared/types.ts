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

/** A point on the chart, stored as time (UTC seconds) + price so it survives zoom, scroll and timeframe changes. */
export interface Anchor {
  time: number;
  price: number;
}

/** One saved drawing; `type` names its tool in web/tools/. */
export interface Drawing {
  id: string;
  type: string;
  points: Anchor[];
}

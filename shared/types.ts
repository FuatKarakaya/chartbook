export type Asset = 'btc' | 'gold' | 'silver' | 'spx';
/** Display names, in switcher order (keys 1-4). */
export const ASSET_NAMES: Record<Asset, string> = { btc: 'BTC', gold: 'Gold', silver: 'Silver', spx: 'S&P 500' };
export type Interval = '1h' | '4h' | '1D' | '1W' | '1M';

/** What a chart shows: an asset, or one asset priced in another (a ratio chart, e.g. 'btc/gold' = BTC in ounces of gold). */
export type Ticker = Asset | `${Asset}/${Asset}`;
/** 'BTC', or 'BTC / Gold' for a ratio. */
export const tickerName = (t: Ticker) => t.split('/').map((a) => ASSET_NAMES[a as Asset]).join(' / ');

/** One bar. `time` is the bar's open in UTC seconds. */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** One value of a line (a moving average) at a bar's time. */
export interface Point {
  time: number;
  value: number;
}

/** A point on the chart, stored as time (UTC seconds) + price so it survives zoom, scroll and timeframe changes. */
export interface Anchor {
  time: number;
  price: number;
}

/** One saved drawing; `type` names its tool in web/tools/, which decides its other fields. */
export interface Drawing {
  id: string;
  type: string;
}

/** A drawing made of the points that were clicked: trend line, ray, horizontal line, measure. */
export interface PointDrawing extends Drawing {
  points: Anchor[];
}

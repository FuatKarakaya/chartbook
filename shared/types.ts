export type Asset = 'btc' | 'eth' | 'gold' | 'silver' | 'spx' | 'ixic' | 'dxy' | 'tnx' | 'fed' | 'm2';
/** Display names, in switcher order (keys 1-9, 0): markets, then macro (US Dollar Index, 10Y yield, Fed funds rate, M2). */
export const ASSET_NAMES: Record<Asset, string> = {
  btc: 'BTC', eth: 'ETH', gold: 'Gold', silver: 'Silver', spx: 'S&P 500', ixic: 'Nasdaq',
  dxy: 'DXY', tnx: '10Y', fed: 'Fed rate', m2: 'M2',
};
export const ASSETS = Object.keys(ASSET_NAMES) as Asset[];
/** The switcher's two labelled groups. */
export const ASSET_GROUPS: [string, Asset[]][] = [['Markets', ASSETS.slice(0, 6)], ['Macro', ASSETS.slice(6)]];
/** One value a day or month, not OHLC: stored as open = high = low = close and always drawn as a line. */
export const LINE_ONLY: Asset[] = ['tnx', 'fed', 'm2'];
/** From FRED, which has no hourly data (so no 1h/4h). */
export const DAILY_ONLY: Asset[] = ['fed', 'm2'];
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

# chartbook spec

Personal TradingView-lite. Runs on owner's Windows PC at http://localhost:3000. Owner is PM and writes no code.

## v1 features
- Assets: BTC, Gold, Silver, S&P 500 (keys 1-4).
- Timeframes: 1h, 4h, 1D, 1W, 1M. 4h built from 1h (blocks from 00:00 UTC); W/M built from 1D (weeks start Monday).
- Log scale (default) / linear toggle. Candles or line.
- Crosshair readout: date, OHLC, candle % change.
- Empty space right of last bar so drawings can project into the future.
- 50D + 200D SMA, always from daily closes, shown on every timeframe; each has its own on/off button. Length, colour in settings.
- Drawing tools: trend line, ray, horizontal line, measure (% change + weeks). Select, move, drag handles, Delete, Ctrl+Z, Clear all. Saved per asset on server.
- Ruler (temporary, not saved; button or Shift+click): two clicks, each end jumps to the nearest open/high/low/close of
  the candle under the mouse; shows % and price change + time between. The next click or Esc clears it.
- Fractal tool (like TradingView "Bars Pattern"): pick source range (any asset) -> ghost copy anchored at last candle -> drag to move; handles scale time and move size; label "time x1.25 · moves x0.6"; flip, colour, opacity, delete.
  - Stored: {sourceAsset, srcStart, srcEnd, anchorTime, anchorPrice, timeScale, moveScale, flip, style}
  - price_i = anchorPrice * (c_i / c_0) ^ (moveScale * (flip ? -1 : 1)); t_i = anchorTime + timeScale * (t_i_src - t_0_src)
- Later, not v1: ratio charts, 20W SMA + 21W EMA band, BTC halving lines, fib/channel, PNG export, 15m, notes, compare mode, BTC log regression bands.
- Out of scope: accounts, password, alerts, deployment/Docker, timeframes < 15m, live ticks, trading, indicator libraries.

## After v1: more data + two extra pages
- More assets (M6): ETH, Nasdaq Composite, US Dollar Index (DXY), US 10Y yield, Fed funds rate, M2 money supply.
  - Switcher groups them: Markets (BTC, ETH, Gold, Silver, S&P 500, Nasdaq) and Macro (DXY, 10Y, Fed rate, M2). Keys 1-9, 0.
  - Fed rate, 10Y and M2 have one value per day/month, not OHLC: stored as o=h=l=c, always drawn as a line.
    Rates default to linear scale. FRED series have no 1h/4h (those buttons disabled).
- Pages: header links "Chart · Cycles · Seasonality · DCA". Each page is its own Vite entry (web/<page>.html + web/pages/<page>.ts),
  using core/ and shared/ only. Both read existing 1D candles from /api/candles; no new server data.
- Cycles page (M7), like the "Bitcoin Market Cycle Bottom ROI" chart, BTC only: one line per market cycle, x = days since that
  cycle's bottom, y = ROI = close / bottom close (starts at 1).
  - Controls (button groups): Data length: To peak / 3 months out / To next bottom (current cycle: to today)
    · 2021 peak: April / November · Combine 2010 + 2011 cycles: No / Yes (one cycle from 2010 to the 2013 peak)
    · ROI scale: Log (default) / Linear.
  - Cycle colours + names by bottom year ("2015 cycle"); click a legend name to hide/show it. Title line:
    "ROI from last cycle bottom: 5.16". Hover readout: day N, each visible cycle's ROI and date.
  - Cycle dates live in one file (shared/cycles.ts), not auto-detected. From stored daily closes:
    bottoms 2010-07-17 (first price), 2011-11-18, 2015-01-14, 2018-12-15, 2022-11-21; peaks 2011-06-08, 2013-12-04,
    2017-12-16, 2021-04-13 or 2021-11-08, 2025-10-06. A new bottom is added only when the owner says it is confirmed. No ETH: the owner finds cycles only useful for BTC.
  - Lightweight Charts with a numeric (non-time) x axis; no new dependency.
- Seasonality page (M8): table of monthly % returns, rows = years, columns = Jan..Dec + full year, cells green/red
  by size. Bottom rows: average, median, % of years up. Current, unfinished month shown faded and left out of stats.
  - Controls: Asset (any) · Years from/to · 4-year cycle filter, two kinds:
    - US election cycle: All / Post-election (2025, 2021…) / Midterm (2026, 2022…) / Pre-election (2027, 2023…) / Election (2028, 2024…).
    - BTC halving cycle: All / Halving year (2012, 2016, 2020, 2024, 2028) / +1 / +2 / +3.
  - Monthly return = this month's close / last month's close - 1, from monthly candles built from 1D (M2 aggregation).
    Rates (10Y, Fed rate) instead show the change in percentage points (5.25% -> 5.5% = +0.25).
- DCA page (M9): buying the same dollar amount every week, which weekday is best (the owner heard "Monday").
  - Markets only (BTC, ETH, Gold, Silver, S&P 500, Nasdaq) · Years from/to (opens on the last 10) · Buy at: day's close / open.
  - Per weekday: how much more of the asset its buys got than the same money spread evenly over the trading week
    around each buy (3 days either side; 2 trading days for markets closed at weekends), a bar for it, and how many
    years it was the best day. Under it the same per year, colour-coded. Headline: best and worst day, what $100 a
    week put in and is worth, and roughly what the best day instead of the worst is worth in dollars.

## Data
| Asset | Daily | Hourly |
|---|---|---|
| BTC | Yahoo BTC-USD (2014-09+), Bitstamp 2012-2014, saved file for 2010-07 to 2011 (below) | Bitstamp (2011-08+; nothing earlier exists online) |
| S&P 500 | Yahoo ^GSPC (1927+) | Yahoo (last 730 days only) |
| Gold | Yahoo GC=F (2000+); Stooq xauusd earlier if STOOQ_API_KEY set | Yahoo |
| Silver | Dukascopy XAGUSD spot (2001+); today from Yahoo's most traded contract (e.g. SIZ26.CMX), scaled to spot | Same |
| ETH (M6) | Yahoo ETH-USD (2017-11+), Bitstamp ethusd for 2017-08 to 2017-11 | Bitstamp (2017-08+) |
| Nasdaq Composite (M6) | Yahoo ^IXIC (1971+) | Yahoo |
| US Dollar Index (M6) | Yahoo DX-Y.NYB (1971+) | Yahoo |
| US 10Y yield (M6) | Yahoo ^TNX (1962+), value in % | Yahoo |
| Fed funds rate (M6) | FRED DFF, daily effective rate (1954+) | none |
| M2 money supply (M6) | FRED M2SL, monthly, $bn (1959+) | none |

- Yahoo via yahoo-finance2. Bitstamp/Stooq/Dukascopy via plain fetch. Not CoinGecko (free tier = 365 days).
- Not Yahoo SI=F for silver: it follows thinly traded contract months, so most days are near-flat bars. Dukascopy publishes
  a day only once it is over and often answers "busy", so its files are fetched one a second with retries.
- Yahoo hourly: the 20:00 UTC S&P closing print is folded into the last bar, flat after-hours repeats are dropped.
- BTC 2010-07-17 to 2011-12-31 daily is a committed file (server/sources/btc-2010-2011.json, made by
  scripts/btc-2010-2011.ts): CoinMetrics daily close + Mt. Gox high/low from bitcoinity.org (no wicks after the
  June 2011 hack), open = previous close. Bitstamp's 2011 daily data is too thin (no trades on ~40% of days).
- DATA_VERSION in updater.ts: bump it when a source change needs history re-downloaded; the app then does one full
  re-download on its next start (stored in SQLite's user_version).
- FRED via plain fetch of the public CSV (fred.stlouisfed.org/graph/fredgraph.csv?id=DFF), no key. Refreshed hourly, not every 5 min.
- Backfill command for full history. Updater every 5 min: last 2 days of 1h + last 10 days of 1D, upsert. On startup, catch up from last saved candle first.
- SQLite via node:sqlite, file in gitignored data/. Tables: candles(asset, interval, time, o, h, l, c), drawings(id, asset, json).
- Source fails: log it, keep serving stored data, page shows "data delayed".

## Stack
TypeScript everywhere, Node 22+. Hono server serves API and built page (one process). Vite + plain TS, no React. Lightweight Charts v5 (Apache-2.0: enable attributionLogo). Vitest for maths, Playwright screenshots for self-checking UI. start.bat: git pull, npm install, build, start, open browser.

```
server/  sources/{yahoo,bitstamp,dukascopy,silver,stooq,fred}.ts  db.ts  updater.ts  routes.ts
web/     core/{chart,store,api}.ts  indicators/  tools/  ui/  pages/{cycles,seasonality,dca}.ts  {index,cycles,seasonality,dca}.html
shared/  types.ts  time.ts  cycles.ts  seasonality.ts  dca.ts
```

## Rules (put in CLAUDE.md)
1. Features never import each other, only core/ and shared/. New feature = one file + one registry line.
2. Drawing tool contract: create from clicks, draw, hitTest, drag handles, toJSON. Indicator = pure function candles -> series.
3. Drawings stored as time + price, never pixels.
4. Pure maths (MAs, aggregation, fractal projection) gets Vitest tests. UI checked with Playwright screenshots.
5. No abstraction until needed twice. No defensive code for impossible cases. No new dependency without a one-line reason. Files under ~200 lines. Delete dead code.
6. One milestone per session. Finish with tests passing, screenshot checked, short summary + click-by-click test steps for the owner.

## Milestones
- [x] M0 Skeleton: CLAUDE.md, PLAN.md, install LWC agent skill (npx skills add https://github.com/tradingview/lightweight-charts), server + page, BTC chart from a small sample file, start.bat.
- [x] M1 Data: sources, backfill, updater, SQLite, candles API. Done: all 4 assets load in 1h and 1D with the start dates above. (Stooq pre-2000 gold/silver not done yet.)
- [x] M2 Chart core: asset switcher, 1h/4h/1D/1W/1M, log/linear, crosshair readout, 50D/200D (changed from 50W/200W), right-side space. Opens on the last 400 bars (all of them if fewer); MAs show as steps on 1h/4h (each bar uses its latest day).
- [x] M3 Drawing tools + saving. Drawings snap to bars in time, show on every timeframe (a 1D point lands between bars on 1W), and can sit in the empty future space.
- [x] M4 Fractal tool. The copy starts at the last candle; the chart scrolls to it and the price scale fits it. Handles: start (move),
  end (time), biggest move (size; dragging it past the start flips). A bar under the readout for the selected drawing: flip, colour,
  opacity, copy onto another asset (starts at its last candle), Delete (every tool gets the Delete button). On 1h/4h a stretch
  older than the hourly history is copied from daily candles.
- [x] M5 Settings panel (MA length/colour), keyboard shortcuts, ratio charts, 20W/21W band, halving lines, PNG export.
  Settings (both MA lengths + colours, band colour) are kept in the browser; the panel also lists the keys: 1-4 asset,
  Shift+1-5 timeframe, L log/linear, C candles/line, T/R/H/M/U/F tools, P picture. Ratio = an asset "in" another
  (BTC in Gold, tickers like btc/gold): divided bar by bar on the server, the divisor holding its last close where it
  has no bar (S&P at the weekend); own drawings; MAs/band of the ratio. Band = 20W SMA + 21W EMA of weekly closes as
  each day saw them (no peeking at the week's close), shaded between. Halving lines on every asset, the next (2028)
  dotted as an estimate. Picture = the chart with its drawings, a title and the line names.
- [x] M6 More data: ETH, Nasdaq, DXY, US 10Y, Fed funds rate, M2 (FRED source, line-only series, grouped switcher). Done: all load with the start dates above.
  ETH joins Bitstamp (from 2017-08-17) to Yahoo (from 2017-11-09). 10Y keeps only Yahoo's close, like the FRED series.
  Picking a rate (10Y, Fed rate) switches to Linear, then picking a non-rate switches back to Log; between two of a kind
  the scale stays as picked. Line-only: Candles greyed out, readout shows just C. A ratio with Fed rate or M2 has no 1h/4h
  either. M2 is monthly, so its 50D/200D/band buttons are greyed out. The "in USD" list is grouped the same way.
  FRED refreshes look back a year, as M2 gets revised.
- [x] M7 Cycles page: BTC cycle-bottom ROI chart with the controls above. Tests: ROI maths, data-length cut-offs.
  Header links "Chart · Cycles" (Seasonality joins in M8). Opens on To next bottom; 3 months out = 3 calendar months
  after the peak. With the mouse off the chart the readout shows the newest shown cycle's last day (today, or its peak), to compare the others with it.
  Options and hidden cycles live in the address bar. ui/buttons.ts moved to core/ so both pages can use it.
- [x] M8 Seasonality page: monthly returns table with election- and halving-cycle filters. Tests: monthly returns, filters, stats rows.
  Newest year on top; the month names and the three stats rows stay in view while the years scroll. Full year = the
  year's months compounded (its last close over last December's). Faded and left out of the stats: the running month,
  the running year, and a first year the data starts partway through (BTC 2010 = Aug-Dec). Colour is full strength from
  the 75th percentile change size of the shown table (full-year column scaled on its own), so BTC and S&P are both readable.
  Elections and halvings both fall in years divisible by 4, so the two filter rows pick the same years: Midterm lights +2.
  Picking the first / last year in the lists means "from the start" / "up to the latest". Asset keys 1-9, 0 work here too;
  options live in the address bar. The asset buttons moved to core/ so the Chart and Seasonality pages share them.
  Later: rates (10Y, Fed rate) in percentage points, the full year added up.
- [x] M9 DCA page: weekly buys on each weekday compared. Tests: buys, holidays, open/close, the comparison.
  Why "against the week around it" and not each weekday's own total: totals mostly measure where the range starts.
  2017 began on a Sunday, so only Sunday got a buy that first week, at ~$1,000, worth ten later buys: +1% for Sunday.
  Counting whole Monday-Sunday weeks instead hands Monday a head start in a rising market (BTC gained ~0.1% a day).
  Against the surrounding days neither matters, and BTC's Sunday close and Monday open (the same moment) agree.
  Bars and colours have one fixed scale (full at 0.5%) so gold's tiny differences look tiny. Colour-coded cells
  (core/heat.ts) and the Years lists (core/buttons.ts) are shared with Seasonality.

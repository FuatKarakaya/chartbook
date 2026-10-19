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
- Pages: header links "Chart · Cycles · Seasonality". Each page is its own Vite entry (web/<page>.html + web/pages/<page>.ts),
  using core/ and shared/ only. Both read existing 1D candles from /api/candles; no new server data.
- Cycles page (M7), like the "Bitcoin Market Cycle Bottom ROI" chart: one line per market cycle, x = days since that
  cycle's bottom, y = ROI = close / bottom close (starts at 1).
  - Controls (button groups): Asset (BTC, ETH) · Data length: To peak / 3 months out / To next bottom (current cycle: to today)
    · 2021 peak: April / November · Combine 2010 + 2011 cycles: No / Yes (one cycle from 2010 to the 2013 peak)
    · ROI scale: Log (default) / Linear.
  - Cycle colours + names by bottom year ("2015 cycle"); click a legend name to hide/show it. Title line:
    "ROI from last cycle bottom: 5.16". Hover readout: day N, each visible cycle's ROI and date.
  - Cycle dates live in one file (shared/cycles.ts), not auto-detected. BTC, from stored daily closes:
    bottoms 2010-07-17 (first price), 2011-11-18, 2015-01-14, 2018-12-15, 2022-11-21; peaks 2011-06-08, 2013-12-04,
    2017-12-16, 2021-04-13 or 2021-11-08, 2025-10-06. A new bottom is added only when the owner says it is confirmed. ETH dates picked the same way in M7.
  - Lightweight Charts with a numeric (non-time) x axis; no new dependency.
- Seasonality page (M8): table of monthly % returns, rows = years, columns = Jan..Dec + full year, cells green/red
  by size. Bottom rows: average, median, % of years up. Current, unfinished month shown faded and left out of stats.
  - Controls: Asset (any) · Years from/to · 4-year cycle filter, two kinds:
    - US election cycle: All / Post-election (2025, 2021…) / Midterm (2026, 2022…) / Pre-election (2027, 2023…) / Election (2028, 2024…).
    - BTC halving cycle: All / Halving year (2012, 2016, 2020, 2024, 2028) / +1 / +2 / +3.
  - Monthly return = this month's close / last month's close - 1, from monthly candles built from 1D (M2 aggregation).

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
web/     core/{chart,store,api}.ts  indicators/  tools/  ui/  pages/{cycles,seasonality}.ts  {index,cycles,seasonality}.html
shared/  types.ts  time.ts  cycles.ts
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
- [ ] M4 Fractal tool.
- [ ] M5 Settings panel (MA length/colour), keyboard shortcuts, ratio charts, 20W/21W band, halving lines, PNG export.
- [ ] M6 More data: ETH, Nasdaq, DXY, US 10Y, Fed funds rate, M2 (FRED source, line-only series, grouped switcher). Done: all load with the start dates above.
- [ ] M7 Cycles page: BTC + ETH cycle-bottom ROI chart with the controls above. Tests: ROI maths, data-length cut-offs.
- [ ] M8 Seasonality page: monthly returns table with election- and halving-cycle filters. Tests: monthly returns, filters, stats rows.

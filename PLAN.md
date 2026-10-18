# chartbook spec

Personal TradingView-lite. Runs on owner's Windows PC at http://localhost:3000. Owner is PM and writes no code.

## v1 features
- Assets: BTC, Gold, Silver, S&P 500 (keys 1-4).
- Timeframes: 1h, 4h, 1D, 1W, 1M. 4h built from 1h (blocks from 00:00 UTC); W/M built from 1D (weeks start Monday).
- Log scale (default) / linear toggle. Candles or line.
- Crosshair readout: date, OHLC, candle % change.
- Empty space right of last bar so drawings can project into the future.
- 50W + 200W SMA, always from weekly closes, shown on every timeframe. Toggle, length, colour in settings.
- Drawing tools: trend line, ray, horizontal line, measure (% change + weeks). Select, move, drag handles, Delete, Ctrl+Z. Saved per asset on server.
- Fractal tool (like TradingView "Bars Pattern"): pick source range (any asset) -> ghost copy anchored at last candle -> drag to move; handles scale time and move size; label "time x1.25 · moves x0.6"; flip, colour, opacity, delete.
  - Stored: {sourceAsset, srcStart, srcEnd, anchorTime, anchorPrice, timeScale, moveScale, flip, style}
  - price_i = anchorPrice * (c_i / c_0) ^ (moveScale * (flip ? -1 : 1)); t_i = anchorTime + timeScale * (t_i_src - t_0_src)
- Later, not v1: ratio charts, 20W SMA + 21W EMA band, BTC halving lines, fib/channel, PNG export, 15m, notes, compare mode, BTC log regression bands.
- Out of scope: accounts, password, alerts, deployment/Docker, timeframes < 15m, live ticks, trading, indicator libraries.

## Data
| Asset | Daily | Hourly |
|---|---|---|
| BTC | Yahoo BTC-USD (2014+), Bitstamp public API for 2011-2014 | Bitstamp (2011+) |
| S&P 500 | Yahoo ^GSPC (1927+) | Yahoo (last 730 days only) |
| Gold | Yahoo GC=F (2000+); Stooq xauusd earlier if STOOQ_API_KEY set | Yahoo |
| Silver | Yahoo SI=F (2000+); Stooq xagusd earlier if STOOQ_API_KEY set | Yahoo |

- Yahoo via yahoo-finance2. Bitstamp/Stooq via plain fetch. Not CoinGecko (free tier = 365 days).
- Backfill command for full history. Updater every 5 min: last 2 days of 1h + last 10 days of 1D, upsert. On startup, catch up from last saved candle first.
- SQLite via node:sqlite, file in gitignored data/. Tables: candles(asset, interval, time, o, h, l, c), drawings(id, asset, json).
- Source fails: log it, keep serving stored data, page shows "data delayed".

## Stack
TypeScript everywhere, Node 22+. Hono server serves API and built page (one process). Vite + plain TS, no React. Lightweight Charts v5 (Apache-2.0: enable attributionLogo). Vitest for maths, Playwright screenshots for self-checking UI. start.bat: git pull, npm install, build, start, open browser.

```
server/  sources/{yahoo,bitstamp,stooq}.ts  db.ts  updater.ts  routes.ts
web/     core/{chart,store,api}.ts  indicators/  tools/  ui/
shared/  types.ts  time.ts
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
- [ ] M2 Chart core: asset switcher, 1h/4h/1D/1W/1M, log/linear, crosshair readout, 50W/200W, right-side space.
- [ ] M3 Drawing tools + saving.
- [ ] M4 Fractal tool.
- [ ] M5 Settings panel (MA length/colour), keyboard shortcuts, ratio charts, 20W/21W band, halving lines, PNG export.

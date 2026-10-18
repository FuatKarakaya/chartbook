# chartbook

Personal TradingView-lite. Full spec and milestones: PLAN.md (tick milestones there when done).
Owner runs it on Windows via `start.bat` at http://localhost:3000, is a PM and writes no code —
explain results in plain language with click-by-click test steps.

## Commands
- `npm run build` — build the page (Vite, `web/` -> `dist/web/`)
- `npm start` — one Hono process: API + built page on port 3000
- `npm test` — Vitest
- `npm run typecheck` — tsc
- `npm run shot` — Playwright screenshot of the running app -> `shots/chart.png` (gitignored)

Lightweight Charts v5 skill is installed in `.claude/skills/lightweight-charts`; use it, and check
`node_modules/lightweight-charts/dist/typings.d.ts` before using an API.

## Rules
1. Features never import each other, only core/ and shared/. New feature = one file + one registry line.
2. Drawing tool contract: create from clicks, draw, hitTest, drag handles, toJSON. Indicator = pure function candles -> series.
3. Drawings stored as time + price, never pixels.
4. Pure maths (MAs, aggregation, fractal projection) gets Vitest tests. UI checked with Playwright screenshots.
5. No abstraction until needed twice. No defensive code for impossible cases. No new dependency without a one-line reason. Files under ~200 lines. Delete dead code.
6. One milestone per session. Finish with tests passing, screenshot checked, short summary + click-by-click test steps for the owner.

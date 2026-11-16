// Browser regressions against the real app. Drawing writes stay in browser memory.
// npm start first; then npx tsx scripts/check-ui.ts. Uses installed Edge.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ optimizeDeps: { entries: ['index.html'] }, server: { port: 3001, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors: string[] = [];
const saved = new Map<string, any[]>();
let delayBtc = false;
let staleBtc = false;
const checks: string[] = [];
const pass = (s: string) => { checks.push(s); console.log(`PASS ${s}`); };
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.route('**/api/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const asset = url.searchParams.get('asset')!;
  if (url.pathname === '/api/drawings') {
    if (request.method() === 'PUT') {
      saved.set(asset, request.postDataJSON());
      return route.fulfill({ status: 204 });
    }
    if (saved.has(asset)) return route.fulfill({ json: saved.get(asset) });
  }
  url.port = '3000';
  const response = await route.fetch({ url: url.href });
  if (asset === 'btc' && delayBtc) await new Promise(r => setTimeout(r, 700));
  if (asset === 'btc' && staleBtc && url.pathname === '/api/candles' && url.searchParams.get('interval') === '1D') {
    staleBtc = false;
    const bars = await response.json();
    bars.at(-1).close = 1; bars.at(-1).low = 1;
    await new Promise(r => setTimeout(r, 1000));
    return route.fulfill({ json: bars });
  }
  await route.fulfill({ response });
});
// Browser-local inspection of the real chart APIs; these hooks never enter the production build.
await page.route('**/main.ts', async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: await response.text() + '\nglobalThis.__check={main,editor,state,bars:()=>bars,drawn:()=>drawn};' });
});
const settle = async () => { await page.waitForTimeout(150); };
const waitAsset = async (asset: string) => {
  await page.waitForFunction(a => { const c = (window as any).__check; return c?.drawn() === a && c.bars().length; }, asset);
  await settle();
};
async function captureFractal(p: Page) {
  await p.evaluate(async () => {
    const modulePath = '/tools/fractal.ts';
    const { fractal } = await import(/* @vite-ignore */ modulePath);
    const draw = fractal.draw;
    fractal.draw = (ctx: any, px: any, f: any, v: any, selected: any) => {
      (window as any).__frame = { px, f: structuredClone(f), copy: fractal.candles(f, v), xs: fractal.candles(f, v).map((b: any) => v.x(b.time)) };
      return draw(ctx, px, f, v, selected);
    };
    (window as any).__check.main.resetView();
  });
  await settle();
}
const frame = async () => page.evaluate(() => (window as any).__frame);
async function dragHandle(index: number, dx: number, dy: number) {
  const f = await frame();
  const box = (await page.locator('#chart').boundingBox())!;
  const p = f.px[index];
  await page.mouse.move(box.x + p.x, box.y + p.y);
  await page.mouse.down();
  await page.mouse.move(box.x + p.x + dx, box.y + p.y + dy, { steps: 12 });
  await page.mouse.up();
  await settle();
}
async function createFractal() {
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await settle();
  const points = await page.evaluate(() => {
    const c = (window as any).__check, b = c.bars(), r = document.querySelector('#chart')!.getBoundingClientRect();
    return [b.length - 150, b.length - 130].map(i => ({ x: r.x + c.main.x(b[i].time), y: r.y + c.main.series.priceToCoordinate(b[i].close) }));
  });
  await page.locator('summary').filter({ hasText: /^Draw$/ }).click();
  await page.getByRole('button', { name: 'Fractal', exact: true }).click();
  for (const p of points) await page.mouse.click(p.x, p.y);
  await settle();
  assert.match(await page.locator('.drawing-bar').innerText(), /Fractal of/);
}
try {
  // Built production page, not the development instrumentation.
  await page.goto('http://localhost:3000/?asset=silver&interval=1W');
  await page.waitForFunction(() => document.querySelector('#readout')?.textContent);
  assert.equal(await page.locator('#history-source').isVisible(), true);
  await page.screenshot({ path: 'shots/silver-weekly-latest.png' });
  await page.keyboard.press('Home');
  pass('built production page loads silver weekly history and Home works');

  await page.goto('http://localhost:3001/?asset=silver&interval=1D');
  await waitAsset('silver'); await captureFractal(page);
  await createFractal();
  const first = await frame();
  assert.equal(first.f.sourceInterval, '1D');
  await dragHandle(0, -240, -20);
  const moved = await frame();
  assert.equal(moved.f.timeScale, 1);
  const gaps = moved.xs.slice(1).map((x: number, i: number) => x - moved.xs[i]);
  assert.ok(Math.max(...gaps) - Math.min(...gaps) < 0.05);
  await dragHandle(1, 60, 0);
  assert.ok((await frame()).f.timeScale > 1);
  await dragHandle(2, 0, -35);
  assert.notEqual((await frame()).f.moveScale, 1);
  await page.locator('.drawing-bar').getByRole('button', { name: 'Flip', exact: true }).click();
  await settle();
  const daily = await frame();
  assert.equal(daily.f.flip, true);
  pass('daily fractal translates uniformly across weekends; time, size and flip controls work');
  await page.reload(); await waitAsset('silver'); await captureFractal(page);
  assert.deepEqual((await frame()).copy, daily.copy);
  await page.getByRole('button', { name: '1W', exact: true }).click(); await settle();
  assert.deepEqual((await frame()).copy, daily.copy);
  pass('saved daily fractal survives reload and weekly timeframe switch with identical OHLC/times');

  await createFractal();
  assert.equal((await frame()).f.sourceInterval, '1W');
  await dragHandle(0, -80, 10); await dragHandle(1, 40, 0); await dragHandle(2, 0, -25);
  const weekly = await frame();
  await page.getByRole('button', { name: '1D', exact: true }).click(); await settle();
  assert.deepEqual((await frame()).copy, weekly.copy);
  pass('weekly fractal handles work and daily display preserves weekly geometry');
  const copied = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().includes('asset=gold'));
  await page.locator('.drawing-bar').getByRole('button', { name: 'Gold', exact: true }).click();
  await copied;
  await waitAsset('gold');
  await settle();
  assert.equal(saved.get('gold')!.at(-1).sourceAsset, 'silver');
  assert.equal(saved.get('gold')!.at(-1).sourceInterval, '1W');
  pass('cross-asset copy preserves the original source and timeframe');

  const writes = JSON.stringify([...saved]);
  delayBtc = true;
  await page.locator('.drawing-bar').getByRole('button', { name: 'BTC', exact: true }).click();
  await page.locator('#toolbar').getByRole('button', { name: 'ETH', exact: true }).click();
  await page.waitForTimeout(1100); delayBtc = false;
  assert.equal(JSON.stringify([...saved]), writes);
  pass('a superseded copy cannot write a drawing onto the wrong asset');
  staleBtc = true;
  await page.locator('#toolbar').getByRole('button', { name: 'BTC', exact: true }).click();
  await page.locator('#toolbar').getByRole('button', { name: 'Silver', exact: true }).click();
  await page.locator('#toolbar').getByRole('button', { name: 'BTC', exact: true }).click();
  await page.waitForTimeout(1500);
  assert.ok(await page.evaluate(() => (window as any).__check.bars().at(-1).close > 1));
  pass('rapid BTC / Silver / BTC loading rejects a deliberately delayed stale response');

  await page.evaluate(() => { const c = (window as any).__check; c.main.chart.priceScale('right').applyOptions({ autoScale: false }); c.main.chart.timeScale().setVisibleLogicalRange({ from: c.bars().length + 100, to: c.bars().length + 300 }); });
  await page.getByRole('button', { name: '1W', exact: true }).click(); await settle();
  let range = await page.evaluate(() => (window as any).__check.main.chart.timeScale().getVisibleLogicalRange());
  assert.ok(Number.isFinite(range.from) && range.to > range.from);
  await page.keyboard.press('Home'); await settle();
  assert.equal(await page.evaluate(() => (window as any).__check.main.chart.priceScale('right').options().autoScale), true);
  await page.evaluate(() => (window as any).__check.main.chart.priceScale('right').applyOptions({ autoScale: false }));
  await page.locator('#toolbar').getByRole('button', { name: 'Silver', exact: true }).click(); await waitAsset('silver');
  assert.equal(await page.evaluate(() => (window as any).__check.main.chart.priceScale('right').options().autoScale), true);
  await page.evaluate(() => (window as any).__check.main.chart.priceScale('right').applyOptions({ autoScale: false }));
  await page.locator('#toolbar > select').selectOption('gold'); await settle();
  assert.equal(await page.evaluate(() => (window as any).__check.main.chart.priceScale('right').options().autoScale), true);
  await page.locator('#toolbar > select').selectOption(''); await settle();
  await page.evaluate(() => (window as any).__check.main.chart.timeScale().setVisibleLogicalRange({ from: 0, to: 590 }));
  await settle(); await page.screenshot({ path: 'shots/silver-1970s.png' });
  pass('future-only timeframe switch, Home, asset switches and ratios recover a finite visible chart');
  await page.mouse.move(800, 500);
  const old = await page.evaluate(() => { const c = (window as any).__check; return { bars: c.bars().slice(0, 3), firstX: c.main.x(c.bars()[0].time) }; });
  assert.equal(new Date(old.bars[1].time * 1000).getUTCFullYear(), 1970);
  pass('1970s silver weekly candles render on the actual chart');
  assert.deepEqual(errors, []);
  writeFileSync('shots/ui-check.json', JSON.stringify({ checks, errors, drawingsWrittenToServer: 0 }, null, 2));
} catch (error) {
  await page.screenshot({ path: 'shots/ui-failure.png' });
  console.error('Browser errors:', errors);
  throw error;
} finally {
  await browser.close(); await server.close();
}

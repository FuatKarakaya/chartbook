// Self-check for Claude: screenshot the running app (npm start first) into shots/.
// Usage: npm run shot [-- url [file]]
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:3000';
const out = process.argv[3] ?? 'shots/chart.png';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 800 }, locale: 'en-US' });
page.on('pageerror', (err) => console.error('page error:', err.message));
await page.goto(url);
await page.waitForFunction(() => document.querySelector('#readout, .heat')?.textContent);
await page.waitForTimeout(500);
await page.screenshot({ path: out });
await browser.close();
console.log(`saved ${out}`);

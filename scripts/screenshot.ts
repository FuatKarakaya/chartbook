// Self-check for Claude: screenshot the running app (npm start first) into shots/.
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:3000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 800 }, locale: 'en-US' });
page.on('pageerror', (err) => console.error('page error:', err.message));
await page.goto(url);
await page.waitForSelector('#chart canvas');
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/chart.png' });
await browser.close();
console.log('saved shots/chart.png');

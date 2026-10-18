// Rebuilds server/sources/btc-2010-2011.json, BTC daily candles from the first market price (Mt. Gox, 2010-07-17)
// to 2011-12-31, where Bitstamp's data is too thin to use. History doesn't change, so this ran once; kept to show
// where the numbers come from. Usage: npx tsx scripts/btc-2010-2011.ts
// - close: CoinMetrics community data (daily reference rate at 00:00 UTC next day), every day.
// - high/low: Mt. Gox daily range from bitcoinity.org; only up to the June 2011 hack (empty after), so later
//   candles have no wicks. Open = previous close.
import { writeFileSync } from 'node:fs';
import type { Candle } from '../shared/types.ts';

const END = '2011-12-31';

async function csv(url: string): Promise<Record<string, string>[]> {
  const [head, ...lines] = (await (await fetch(url)).text()).trim().split('\n');
  const keys = head.split(',');
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [keys[i], v])));
}

const closes = new Map(
  (await csv('https://raw.githubusercontent.com/coinmetrics/data/master/csv/btc.csv'))
    .filter((r) => r.PriceUSD)
    .map((r) => [r.time, +r.PriceUSD]),
);
const gox = new Map(
  (await csv('https://data.bitcoinity.org/export_data.csv?currency=USD&data_type=price&exchange=mtgox&r=day&t=l&timespan=all'))
    .map((r) => [r.Time.slice(0, 10), r]),
);

const round = (x: number) => +x.toPrecision(6);
const out: Candle[] = [];
for (let t = Date.parse('2010-07-17') / 1000; t <= Date.parse(END) / 1000; t += 86400) {
  const day = new Date(t * 1000).toISOString().slice(0, 10);
  const r = gox.get(day);
  const close = round(closes.get(day) ?? +r!.avg); // CoinMetrics starts a day after Mt. Gox's first trade
  const open = out.at(-1)?.close ?? close;
  const [max, min] = r && +r.max > 0 ? [+r.max, +r.min] : [0, Infinity];
  out.push({ time: t, open, high: round(Math.max(max, open, close)), low: round(Math.min(min, open, close)), close });
}

writeFileSync('server/sources/btc-2010-2011.json', `[\n${out.map((c) => JSON.stringify(c)).join(',\n')}\n]\n`);
console.log(`saved ${out.length} candles, ${out[0].time} .. ${out.at(-1)!.time}`);

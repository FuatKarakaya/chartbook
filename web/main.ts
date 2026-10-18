import type { Asset, Interval } from '../shared/types.ts';
import { fetchCandles, fetchStatus } from './core/api.ts';
import { createMainChart } from './core/chart.ts';

// Until M2's switcher: pick with the address bar, e.g. ?asset=gold&interval=1h
const params = new URLSearchParams(location.search);
const asset = (params.get('asset') ?? 'btc') as Asset;
const interval = (params.get('interval') ?? '1D') as Interval;

const main = createMainChart(document.getElementById('chart')!);
const candles = await fetchCandles(asset, interval);
main.setCandles(candles);

const first = candles[0] ? new Date(candles[0].time * 1000).toISOString().slice(0, 10) : 'no data yet';
document.getElementById('title')!.textContent = `${asset.toUpperCase()} · ${interval} · since ${first}`;
const { failing } = await fetchStatus();
document.getElementById('delayed')!.hidden = failing.length === 0;

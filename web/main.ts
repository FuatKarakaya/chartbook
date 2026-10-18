import { fetchCandles } from './core/api.ts';
import { createMainChart } from './core/chart.ts';

const main = createMainChart(document.getElementById('chart')!);
main.setCandles(await fetchCandles('btc', '1D'));

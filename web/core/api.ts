import type { Asset, Candle, Interval } from '../../shared/types.ts';

export async function fetchCandles(asset: Asset, interval: Interval): Promise<Candle[]> {
  const res = await fetch(`/api/candles?asset=${asset}&interval=${interval}`);
  if (!res.ok) throw new Error(`candles ${asset} ${interval}: HTTP ${res.status}`);
  return res.json();
}

export async function fetchStatus(): Promise<{ failing: string[] }> {
  return (await fetch('/api/status')).json();
}

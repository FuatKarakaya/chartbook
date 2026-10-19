import type { Asset, Candle, Drawing, Interval } from '../../shared/types.ts';

export async function fetchCandles(asset: Asset, interval: Interval): Promise<Candle[]> {
  const res = await fetch(`/api/candles?asset=${asset}&interval=${interval}`);
  if (!res.ok) throw new Error(`candles ${asset} ${interval}: HTTP ${res.status}`);
  return res.json();
}

export async function fetchStatus(): Promise<{ failing: string[] }> {
  return (await fetch('/api/status')).json();
}

export async function fetchDrawings(asset: Asset): Promise<Drawing[]> {
  return (await fetch(`/api/drawings?asset=${asset}`)).json();
}

export async function saveDrawings(asset: Asset, drawings: Drawing[]) {
  const res = await fetch(`/api/drawings?asset=${asset}`, { method: 'PUT', body: JSON.stringify(drawings) });
  if (!res.ok) throw new Error(`save drawings ${asset}: HTTP ${res.status}`);
}

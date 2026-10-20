import type { Candle, Drawing, Interval, Ticker } from '../../shared/types.ts';

export async function fetchCandles(ticker: Ticker, interval: Interval): Promise<Candle[]> {
  const res = await fetch(`/api/candles?asset=${ticker}&interval=${interval}`);
  if (!res.ok) throw new Error(`candles ${ticker} ${interval}: HTTP ${res.status}`);
  return res.json();
}

export async function fetchStatus(): Promise<{ failing: string[] }> {
  return (await fetch('/api/status')).json();
}

export async function fetchDrawings(ticker: Ticker): Promise<Drawing[]> {
  return (await fetch(`/api/drawings?asset=${ticker}`)).json();
}

export async function saveDrawings(ticker: Ticker, drawings: Drawing[]) {
  const res = await fetch(`/api/drawings?asset=${ticker}`, { method: 'PUT', body: JSON.stringify(drawings) });
  if (!res.ok) throw new Error(`save drawings ${ticker}: HTTP ${res.status}`);
}

import type { Candle } from '../../shared/types.ts';

const PAGE = 1000;

interface Row { timestamp: string; open: string; high: string; low: string; close: string }

/** Candles of a pair ('btcusd') from Bitstamp's public API, `from`..`to` (UTC seconds), paging 1000 bars at a time. */
export async function fetchBitstamp(pair: string, interval: '1h' | '1D', from: number, to = Date.now() / 1000): Promise<Candle[]> {
  const step = interval === '1h' ? 3600 : 86400;
  const out: Candle[] = [];
  for (let start = from; start < to; start += PAGE * step) {
    const res = await fetch(`https://www.bitstamp.net/api/v2/ohlc/${pair}/?step=${step}&limit=${PAGE}&start=${Math.floor(start)}`);
    if (!res.ok) throw new Error(`Bitstamp HTTP ${res.status}`);
    const rows: Row[] = (await res.json()).data.ohlc;
    for (const r of rows) {
      const time = Number(r.timestamp);
      if (time < from || time >= to || time <= (out.at(-1)?.time ?? -Infinity)) continue;
      out.push({ time, open: +r.open, high: +r.high, low: +r.low, close: +r.close });
    }
  }
  return out;
}

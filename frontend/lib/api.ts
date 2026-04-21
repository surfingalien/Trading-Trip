/**
 * API client — calls the Render backend directly from the browser.
 * Set NEXT_PUBLIC_API_URL to your Render service URL in production.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8001';

export async function fetchPrices(symbols: string[]) {
  const res = await fetch(`${API_BASE}/api/prices?symbols=${symbols.join(',')}`);
  if (!res.ok) throw new Error('prices fetch failed');
  return res.json();
}

export async function fetchSnapshot() {
  const res = await fetch(`${API_BASE}/api/snapshot`);
  if (!res.ok) throw new Error('snapshot fetch failed');
  return res.json();
}

export async function fetchBacktest(symbol: string, strategy = 'rsi', period = '1y') {
  const res = await fetch(`${API_BASE}/api/backtest/${symbol}?strategy=${strategy}&period=${period}`);
  if (!res.ok) throw new Error('backtest fetch failed');
  return res.json();
}

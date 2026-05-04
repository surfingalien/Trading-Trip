/**
 * Live stock/ETF/index data via the backend API
 * Connects to trading-trip-api (Render) which wraps yfinance
 */

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp?: number;
  source?: string;
}

export interface MarketSnapshot {
  indices: StockQuote[];
  topMovers: {
    gainers: StockQuote[];
    losers: StockQuote[];
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const CACHE_DURATION = 30_000; // 30 seconds

const cache: Record<string, { data: any; timestamp: number }> = {};

function getCached(key: string): any | null {
  const cached = cache[key];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any) {
  cache[key] = { data, timestamp: Date.now() };
}

/**
 * Fetch a single quote
 */
export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const cacheKey = `quote-${symbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${API_BASE}/api/price/${symbol.toUpperCase()}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const quote: StockQuote = {
      symbol: data.symbol || symbol.toUpperCase(),
      price: data.price,
      change: data.change ?? 0,
      changePercent: data.changePercent ?? data.change_pct ?? 0,
      timestamp: Date.now(),
      source: 'live',
    };

    setCache(cacheKey, quote);
    return quote;
  } catch (e) {
    console.error(`Failed to fetch quote for ${symbol}:`, e);
    throw e;
  }
}

/**
 * Fetch bulk quotes
 */
export async function getStockQuotes(symbols: string[]): Promise<StockQuote[]> {
  if (!symbols.length) return [];

  const cacheKey = `quotes-${symbols.map((s) => s.toUpperCase()).sort().join(',')}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const symbolStr = symbols.map((s) => s.toUpperCase()).join(',');
    const res = await fetch(`${API_BASE}/api/prices?symbols=${encodeURIComponent(symbolStr)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const quotes: StockQuote[] = (Array.isArray(data) ? data : [data]).map((item) => ({
      symbol: item.symbol,
      price: item.price,
      change: item.change ?? 0,
      changePercent: item.changePercent ?? item.change_pct ?? 0,
      timestamp: Date.now(),
      source: 'live',
    }));

    setCache(cacheKey, quotes);
    return quotes;
  } catch (e) {
    console.error('Failed to fetch quotes:', e);
    throw e;
  }
}

/**
 * Fetch market snapshot (indices, top movers)
 */
export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const cacheKey = 'market-snapshot';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${API_BASE}/api/snapshot`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const snapshot: MarketSnapshot = {
      indices: (data.indices || []).map((item: any) => ({
        symbol: item.symbol,
        price: item.price,
        change: item.change ?? 0,
        changePercent: item.changePercent ?? item.change_pct ?? 0,
        timestamp: Date.now(),
        source: 'live',
      })),
      topMovers: {
        gainers: (data.topMovers?.gainers || []).map((item: any) => ({
          symbol: item.symbol,
          price: item.price,
          change: item.change ?? 0,
          changePercent: item.changePercent ?? item.change_pct ?? 0,
          timestamp: Date.now(),
          source: 'live',
        })),
        losers: (data.topMovers?.losers || []).map((item: any) => ({
          symbol: item.symbol,
          price: item.price,
          change: item.change ?? 0,
          changePercent: item.changePercent ?? item.change_pct ?? 0,
          timestamp: Date.now(),
          source: 'live',
        })),
      },
    };

    setCache(cacheKey, snapshot);
    return snapshot;
  } catch (e) {
    console.error('Failed to fetch market snapshot:', e);
    throw e;
  }
}

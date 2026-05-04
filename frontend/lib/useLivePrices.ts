/**
 * React hooks for live price data
 * Combines crypto (CoinGecko), stocks (backend), and sentiment (alternative.me)
 */

import { useState, useEffect, useCallback } from 'react';
import { getCryptoPrices, getTopCryptos, getFearGreedIndex, CryptoQuote, FearGreedData } from './cryptoLive';
import { getStockQuotes, getMarketSnapshot, StockQuote, MarketSnapshot } from './marketDataLive';

export interface UseLivePricesState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook: Fetch crypto prices for specific symbols
 * Polls every 60s by default
 */
export function useCryptoPrices(
  symbols: string[],
  pollInterval = 60_000
): UseLivePricesState<Record<string, CryptoQuote>> {
  const [data, setData] = useState<Record<string, CryptoQuote> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (!symbols.length) {
      setData({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const quotes = await getCryptoPrices(symbols);
      const record = Object.fromEntries(quotes.map((q) => [q.symbol, q]));
      setData(record);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, pollInterval);
    return () => clearInterval(interval);
  }, [fetch, pollInterval]);

  return { data, loading, error };
}

/**
 * Hook: Fetch stock/ETF quotes for specific symbols
 * Polls every 60s by default
 */
export function useStockPrices(
  symbols: string[],
  pollInterval = 60_000
): UseLivePricesState<Record<string, StockQuote>> {
  const [data, setData] = useState<Record<string, StockQuote> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (!symbols.length) {
      setData({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const quotes = await getStockQuotes(symbols);
      const record = Object.fromEntries(quotes.map((q) => [q.symbol, q]));
      setData(record);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, pollInterval);
    return () => clearInterval(interval);
  }, [fetch, pollInterval]);

  return { data, loading, error };
}

/**
 * Hook: Fetch top N cryptocurrencies
 * Polls every 60s by default
 */
export function useTopCrypto(
  limit = 10,
  pollInterval = 60_000
): UseLivePricesState<CryptoQuote[]> {
  const [data, setData] = useState<CryptoQuote[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const top = await getTopCryptos(limit);
      setData(top);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, pollInterval);
    return () => clearInterval(interval);
  }, [fetch, pollInterval]);

  return { data, loading, error };
}

/**
 * Hook: Fetch market snapshot (indices, top movers)
 * Polls every 60s by default
 */
export function useMarketSnapshot(
  pollInterval = 60_000
): UseLivePricesState<MarketSnapshot> {
  const [data, setData] = useState<MarketSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const snapshot = await getMarketSnapshot();
      setData(snapshot);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, pollInterval);
    return () => clearInterval(interval);
  }, [fetch, pollInterval]);

  return { data, loading, error };
}

/**
 * Hook: Fetch Fear & Greed Index
 * Polls every 60s by default
 */
export function useFearGreed(
  pollInterval = 60_000
): UseLivePricesState<FearGreedData> {
  const [data, setData] = useState<FearGreedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const fg = await getFearGreedIndex();
      if (fg) setData(fg);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, pollInterval);
    return () => clearInterval(interval);
  }, [fetch, pollInterval]);

  return { data, loading, error };
}

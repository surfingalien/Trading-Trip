/**
 * Direct CoinGecko API integration for real-time crypto data
 * No API key required; suitable for browser-side requests
 */

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const CACHE_DURATION = 30_000; // 30 seconds

interface CoinMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  ath: number;
  atl: number;
}

export interface CryptoQuote {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  marketCap?: number;
  volume24h?: number;
}

export interface FearGreedData {
  value: number;
  value_classification: string;
  timestamp: string;
}

// Simple in-memory cache
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
 * Fetch top N cryptocurrencies by market cap
 */
export async function getTopCryptos(limit = 10): Promise<CryptoQuote[]> {
  const cacheKey = `top-cryptos-${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&sparkline=false&locale=en`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data: CoinMarketData[] = await res.json();
    const result = data.map((coin) => ({
      symbol: coin.symbol.toUpperCase(),
      price: coin.current_price,
      change24h: coin.price_change_24h,
      changePercent24h: coin.price_change_percentage_24h,
      marketCap: coin.market_cap,
      volume24h: coin.total_volume,
    }));

    setCache(cacheKey, result);
    return result;
  } catch (e) {
    console.error('Failed to fetch top cryptos:', e);
    throw e;
  }
}

/**
 * Fetch quotes for specific crypto symbols
 */
export async function getCryptoPrices(symbols: string[]): Promise<CryptoQuote[]> {
  if (!symbols.length) return [];

  const ids = symbols
    .map((s) => {
      const symbolMap: Record<string, string> = {
        BTC: 'bitcoin',
        ETH: 'ethereum',
        BNB: 'binancecoin',
        XRP: 'ripple',
        SOL: 'solana',
        ADA: 'cardano',
        DOGE: 'dogecoin',
        DOT: 'polkadot',
        LINK: 'chainlink',
        MATIC: 'matic-network',
        AVAX: 'avalanche-2',
        CRO: 'crypto-com-chain',
        LTC: 'litecoin',
        NEAR: 'near',
        ATOM: 'cosmos',
        UNI: 'uniswap',
        USDC: 'usd-coin',
        USDT: 'tether',
        BUSD: 'binance-usd',
        XLM: 'stellar',
        XMR: 'monero',
        ZEC: 'zcash',
        BCH: 'bitcoin-cash',
        ETC: 'ethereum-classic',
      };
      return symbolMap[s.toUpperCase()];
    })
    .filter(Boolean);

  if (!ids.length) return [];

  const cacheKey = `crypto-prices-${ids.sort().join(',')}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&sparkline=false&locale=en`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data: CoinMarketData[] = await res.json();
    const result = data.map((coin) => ({
      symbol: coin.symbol.toUpperCase(),
      price: coin.current_price,
      change24h: coin.price_change_24h,
      changePercent24h: coin.price_change_percentage_24h,
      marketCap: coin.market_cap,
      volume24h: coin.total_volume,
    }));

    setCache(cacheKey, result);
    return result;
  } catch (e) {
    console.error('Failed to fetch crypto prices:', e);
    throw e;
  }
}

/**
 * Fetch Fear & Greed Index from alternative.me
 */
export async function getFearGreedIndex(): Promise<FearGreedData | null> {
  const cacheKey = 'fear-greed';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const result = data.data[0];

    setCache(cacheKey, result);
    return result;
  } catch (e) {
    console.error('Failed to fetch Fear & Greed:', e);
    return null;
  }
}

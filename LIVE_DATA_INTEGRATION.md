# FinSight Live Data Implementation Summary

## What Was Built

### 1. Frontend Live Data Layer

Three new files in `frontend/lib/`:

#### **cryptoLive.ts** — Direct CoinGecko integration
```ts
// Functions
- getCryptoPrices(symbols)     → Fetch live crypto quotes
- getTopCryptos(limit)          → Top N cryptos by market cap
- getFearGreedIndex()           → Crypto sentiment (alternative.me)

// Returns
{
  symbol: 'BTC',
  price: 43250.50,
  change24h: 1250.00,
  changePercent24h: 2.97,
  marketCap: 850000000000,
  volume24h: 25000000000,
}
```

#### **marketDataLive.ts** — Backend (yfinance) integration
```ts
// Functions
- getStockQuote(symbol)         → Single quote via backend
- getStockQuotes(symbols)       → Bulk quotes via backend
- getMarketSnapshot()           → Indices + top movers

// Returns
{
  symbol: 'AAPL',
  price: 175.43,
  change: 2.15,
  changePercent: 1.24,
  timestamp: 1714783200000,
  source: 'live',
}
```

#### **useLivePrices.ts** — React Hooks
```ts
// Crypto Hooks
- useCryptoPrices(symbols, pollInterval?)
- useTopCrypto(limit?, pollInterval?)
- useFearGreed(pollInterval?)

// Stock/ETF Hooks
- useStockPrices(symbols, pollInterval?)
- useMarketSnapshot(pollInterval?)

// Returns
{
  data: { SYMBOL: { price, change, changePercent, ... } } | null,
  loading: boolean,
  error: Error | null,
}
```

### 2. Backend Enhancements

**api/server.py:**
- ✅ CORS configured for Vercel domains
- ✅ CORS allows regex: `*.vercel.app`
- ✅ Environment variable support: `FINSIGHT_ALLOWED_ORIGINS`
- ✅ Existing endpoints: `/api/price`, `/api/prices`, `/api/snapshot`

### 3. Environment Configuration

**frontend/.env.local.example** (dev):
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8001
```

**frontend/.env.production** (Vercel):
```
NEXT_PUBLIC_API_URL=https://trading-trip-api.onrender.com
NEXT_PUBLIC_WS_URL=wss://trading-trip-api.onrender.com
```

---

## How to Use in Your Component

### Step 1: Import the hooks

```tsx
import {
  useCryptoPrices,
  useStockPrices,
  useTopCrypto,
  useMarketSnapshot,
  useFearGreed,
} from '@/lib/useLivePrices';
```

### Step 2: Initialize in your component

```tsx
export default function MyDashboard() {
  // Define your watchlists
  const stockSymbols = ['AAPL', 'MSFT', 'NVDA', 'SPY'];
  const cryptoSymbols = ['BTC', 'ETH', 'SOL'];
  
  // Fetch live data
  const { data: stocks, loading: stocksLoading, error: stocksError } = 
    useStockPrices(stockSymbols);
  
  const { data: cryptos, loading: cryptosLoading } = 
    useCryptoPrices(cryptoSymbols);
  
  const { data: topCrypto } = useTopCrypto(10);
  
  const { data: snapshot } = useMarketSnapshot();
  
  const { data: fearGreed } = useFearGreed();

  return (
    <div>
      {/* Your JSX here, use stocks, cryptos, topCrypto, snapshot, fearGreed */}
    </div>
  );
}
```

### Step 3: Access the data

```tsx
// Single stock quote
if (stocks?.AAPL) {
  console.log(`Apple: $${stocks.AAPL.price}, +${stocks.AAPL.changePercent}%`);
}

// Iterate over all cryptos
{cryptos && Object.entries(cryptos).map(([sym, quote]) => (
  <div key={sym}>
    {sym}: ${quote.price.toFixed(2)} ({quote.changePercent > 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%)
  </div>
))}

// Top cryptos
{topCrypto?.slice(0, 5).map(coin => (
  <div key={coin.symbol}>{coin.symbol} — ${coin.price}</div>
))}

// Market indices
{snapshot?.indices.map(idx => (
  <div key={idx.symbol}>{idx.symbol}: {idx.changePercent >= 0 ? '📈' : '📉'}</div>
))}

// Fear & Greed
{fearGreed && <p>Fear & Greed: {fearGreed.value_classification} ({fearGreed.value})</p>}
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Your Component (page.tsx)                              │
│                                                         │
│  const { data: stocks } = useStockPrices(['AAPL'])     │
│  const { data: cryptos } = useCryptoPrices(['BTC'])    │
└─────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ useCryptoPrices  │ │ useStockPrices   │ │ useFearGreed     │
│ (React Hook)     │ │ (React Hook)     │ │ (React Hook)     │
└──────────────────┘ └──────────────────┘ └──────────────────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ cryptoLive.ts    │ │ marketDataLive.ts│ │ cryptoLive.ts    │
│ getCryptoPrices()│ │ getStockQuotes() │ │ getFearGreedIdx()│
└──────────────────┘ └──────────────────┘ └──────────────────┘
        │                  │                  │
        │                  │                  │
        ▼                  ▼                  ▼
  CoinGecko API    Render Backend          Alternative.me
  api.coingecko    (yfinance)              (Fear & Greed)
```

---

## Polling & Caching Strategy

- **Default poll interval:** 60 seconds
- **Cache duration:** 30 seconds
- **Timeout:** 10 seconds per request

### Customize polling

```tsx
// Poll every 30 seconds
const { data } = useStockPrices(['AAPL'], 30_000);

// Poll every 2 minutes
const { data } = useCryptoPrices(['BTC', 'ETH'], 120_000);
```

---

## Error Handling

All hooks return an `error` field. Handle it in your component:

```tsx
const { data, loading, error } = useStockPrices(['AAPL']);

if (error) {
  return <div className="error">Failed to load prices: {error.message}</div>;
}

if (loading) {
  return <div>Loading...</div>;
}

return <div>Price: ${data?.AAPL?.price}</div>;
```

---

## What Was Committed

```bash
commit 15e9300
Author: Suhas GM
Date:   May 3 2026

    feat: live data layer (CoinGecko + Render backend) with React hooks
    
    - frontend/lib/cryptoLive.ts (CoinGecko direct integration)
    - frontend/lib/marketDataLive.ts (Backend integration)
    - frontend/lib/useLivePrices.ts (React hooks)
    - frontend/.env.production (Render URL)
    - api/server.py (CORS + env var support)

commit 0c18345
Author: Suhas GM
Date:   May 3 2026

    docs: add comprehensive deployment guide for Vercel + Render
    
    - DEPLOYMENT_GUIDE.md (full step-by-step instructions)
```

---

## Next Steps

1. **Integrate hooks into `frontend/app/page.tsx`**
   - Import the hooks
   - Replace mock data with live data calls
   - Update JSX to render real prices

2. **Deploy frontend to Vercel**
   - Follow DEPLOYMENT_GUIDE.md Step 2
   - Set `NEXT_PUBLIC_API_URL` environment variable
   - Get your Vercel URL (e.g., `finsight-yourname.vercel.app`)

3. **Update backend CORS**
   - Add your Vercel URL to `FINSIGHT_ALLOWED_ORIGINS` on Render
   - Verify in browser DevTools → Network tab

4. **Smoke test**
   - Load the Vercel URL
   - Check Network tab for successful requests
   - Verify prices are real and update on reload

---

## FAQ

**Q: Do I need an API key for CoinGecko?**
A: No, the free tier works directly from the browser.

**Q: What if my backend is sleeping on Render free tier?**
A: First request takes 30-60 seconds (cold start). The frontend retries with exponential backoff.

**Q: Can I run this locally?**
A: Yes! 
```bash
cd frontend && npm install && npm run dev
# Runs on http://localhost:3000
# Uses NEXT_PUBLIC_API_URL=http://localhost:8000 from .env.local
```

**Q: How do I test the hooks in isolation?**
A: Create a test component:
```tsx
import { useCryptoPrices } from '@/lib/useLivePrices';

export default function TestHook() {
  const { data, loading, error } = useCryptoPrices(['BTC', 'ETH']);
  
  return (
    <pre>{JSON.stringify({ data, loading, error }, null, 2)}</pre>
  );
}
```

**Q: Why is the polling every 60 seconds?**
A: Respects CoinGecko free tier rate limits (~10-30 req/min). Adjust via the second argument if needed.

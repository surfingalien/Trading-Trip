# FinSight Go-Live Deployment Guide

## Status: Ready to Deploy

All necessary code changes have been completed:
- ✅ Live data layer created (CoinGecko, yfinance via backend)
- ✅ React hooks for polling (cryptoLive, marketDataLive, useLivePrices)
- ✅ Backend CORS configured for Vercel
- ✅ Environment variables configured
- ✅ Changes committed to git

---

## Step 1: Ensure Backend is Running & Deployed

The Render backend (`trading-trip-api`) handles stock/ETF quotes via yfinance.

### 1a. Verify backend is healthy

```bash
# Replace with your actual Render URL (from render.yaml config)
curl https://trading-trip-api.onrender.com/health
# Expected: {"status": "ok"}

# Test stock quotes
curl 'https://trading-trip-api.onrender.com/api/prices?symbols=AAPL,MSFT'
```

**If it returns "Not Found" or times out:** 
- The free tier may be sleeping (cold start). Render will wake it on first request.
- Production deployment will do this automatically when Vercel frontend makes its first request.
- To eliminate cold starts, upgrade Render to Starter plan ($7/month).

### 1b. Push backend code (if needed)

```bash
git push origin main
# Render auto-redeploys on push
```

---

## Step 2: Deploy Frontend to Vercel

### 2a. Link your Vercel account

Go to https://vercel.com and sign in with GitHub.

### 2b. Import the project

1. Click **Add New... → Project**
2. Select your GitHub repository (`finsight-trading-trip`)
3. **Framework Preset:** Next.js (auto-detected)
4. **Root Directory:** `frontend` ← **Important!**
5. **Build Command:** `npm run build` (default)
6. **Output Directory:** `.next` (default)
7. Leave other settings as default (vercel.json handles them)

### 2c. Add environment variable

In the Vercel project settings → **Environment Variables:**

| Name                  | Value                                   |
|-----------------------|-----------------------------------------|
| `NEXT_PUBLIC_API_URL` | `https://trading-trip-api.onrender.com` |

Apply to: **Production, Preview, Development**

### 2d. Click Deploy

First build takes ~2 minutes. You'll get a URL like:
```
https://finsight-yourname.vercel.app
```

### 2e. Update backend CORS allowlist

Once Vercel gives you the URL:

1. Go to Render dashboard → `trading-trip-api` service
2. Settings → **Environment**
3. Add (or update) the environment variable:
   ```
   FINSIGHT_ALLOWED_ORIGINS=https://finsight-yourname.vercel.app
   ```
4. Save. Render auto-redeploys.

---

## Step 3: Wire the hooks into the frontend (if needed)

The hooks are already created, but you may need to integrate them into `frontend/app/page.tsx`.

### 3a. Import the hooks

At the top of `page.tsx`:

```tsx
import {
  useCryptoPrices,
  useStockPrices,
  useTopCrypto,
  useMarketSnapshot,
  useFearGreed,
} from '@/lib/useLivePrices';
```

### 3b. Use them in your component

Example:

```tsx
const [stockSymbols] = useState(['AAPL', 'MSFT', 'NVDA', 'SPY']);
const [cryptoSymbols] = useState(['BTC', 'ETH']);

const { data: stockQuotes, loading: stockLoading } = useStockPrices(stockSymbols);
const { data: cryptoQuotes, loading: cryptoLoading } = useCryptoPrices(cryptoSymbols);
const { data: topCrypto } = useTopCrypto(10);
const { data: snapshot } = useMarketSnapshot();
const { data: fearGreed } = useFearGreed();
```

The `stockQuotes` and `cryptoQuotes` objects have this shape:
```ts
{
  'AAPL': { symbol: 'AAPL', price: 175.43, change: 2.15, changePercent: 1.24, ... },
  'MSFT': { symbol: 'MSFT', price: 415.26, change: -1.45, changePercent: -0.35, ... },
  ...
}
```

Replace any existing mock data bindings with these hooks.

---

## Step 4: Smoke Test the Live Deployment

### 4a. Open the deployed frontend

```
https://finsight-yourname.vercel.app
```

### 4b. Open DevTools → Network tab

Refresh the page and look for these requests:

| Expected Request | Status | Source |
|------------------|--------|--------|
| `api.coingecko.com/api/v3/...` | 200 | Browser (crypto quotes) |
| `trading-trip-api.onrender.com/api/prices` | 200 | Browser (stock quotes) |
| `api.alternative.me/fng/` | 200 | Browser (Fear & Greed) |

### 4c. Verify in UI

- [ ] Crypto watchlist shows **real prices** (compare to coingecko.com)
- [ ] Stock watchlist shows **real prices** (compare to finance.yahoo.com)
- [ ] Fear & Greed **displays and updates**
- [ ] Page **auto-refreshes** within 60 seconds (no manual reload needed)
- [ ] Prices **change on each refresh** (within the 30s cache window)

---

## Step 5: Deployment Checklist

- [ ] Backend (trading-trip-api) is running on Render
  - [ ] `/health` returns `{"status": "ok"}`
  - [ ] `/api/prices?symbols=AAPL,MSFT` returns real data
- [ ] Frontend is deployed to Vercel
  - [ ] URL: `https://finsight-yourname.vercel.app`
  - [ ] `NEXT_PUBLIC_API_URL` env var is set
- [ ] Backend CORS allows Vercel domain
  - [ ] `FINSIGHT_ALLOWED_ORIGINS` includes your Vercel URL
- [ ] Network calls visible in DevTools
  - [ ] CoinGecko requests: 200
  - [ ] Backend requests: 200
  - [ ] Fear & Greed requests: 200
- [ ] UI displays live data
  - [ ] Prices are real (not cached/mock)
  - [ ] Prices refresh on page reload

---

## Troubleshooting

### "API returned 403 Forbidden"

**Cause:** CORS not configured on backend.

**Fix:** 
1. In Render dashboard, check that `trading-trip-api` has redeployed after you set `FINSIGHT_ALLOWED_ORIGINS`.
2. Add your Vercel URL explicitly:
   ```
   FINSIGHT_ALLOWED_ORIGINS=https://finsight-yourname.vercel.app,https://other-vercel-url.vercel.app
   ```

### "Backend returning 'Not Found' (404)"

**Cause:** Service is cold-started or endpoints are renamed.

**Fix:**
1. Render free tier sleeps after 15min inactivity. First request wakes it (~30-60s).
2. Verify endpoints match:
   - `/api/price/{symbol}` ← single quote
   - `/api/prices?symbols=A,B,C` ← bulk quotes
   - `/api/snapshot` ← market data
3. Check `api/server.py` for typos.

### "CoinGecko returns rate-limit error"

**Cause:** Free tier limit is ~10-30 req/min per IP.

**Fix:**
- Current polling: 60s interval, well under the cap.
- If you add more users, upgrade to CoinGecko Demo API (free, registered).

### Build fails in Vercel

**Cause:** TypeScript errors or missing dependencies.

**Fix:**
1. Run locally: `cd frontend && npm run build`
2. Fix any errors shown.
3. Commit and push: `git add . && git commit -m "fix: build errors" && git push`
4. Vercel will retry automatically.

---

## What Happens Next

### Instant (< 1s)
- Frontend loads from Vercel CDN
- React mounts, hooks initialize

### First tick (0-1s)
- All hooks fire their initial `fetch()` calls in parallel
- CoinGecko, backend, and Fear & Greed requests go out
- Network tab shows 3-4 requests in-flight

### Response (1-5s depending on backend cold-start)
- All data arrives
- Component re-renders with live prices
- UI shows real BTC, ETH, AAPL, MSFT, etc.

### Polling (every 60s by default)
- Each hook re-fetches
- Cache (30s window) returns stale data if called multiple times
- Real data flows back after 30s

### On manual reload
- Fresh cycle: requests go out, data arrives, UI updates

---

## Production Optimization Tips

1. **Reduce cold starts:** Upgrade Render to Starter plan ($7/mo)
2. **Cache crypto data longer:** Modify pollInterval in hooks if price volatility is acceptable
3. **Add custom domain:** Vercel Settings → Domains (costs money if not using Vercel's free `*.vercel.app`)
4. **Monitor errors:** Set up Sentry or Vercel Analytics
5. **Pre-warm backend:** Add a cron job that hits `/health` every 10 minutes

---

## Next Steps (After Go-Live)

- [ ] Add authentication (NextAuth.js) if you want user-specific data
- [ ] Add persistence (Vercel KV or a DB) for watchlists
- [ ] Set up email alerts for price thresholds
- [ ] Add TradingView widgets for charting
- [ ] Deploy a mobile app using React Native

---

**Questions?** Check the inline comments in:
- `frontend/lib/cryptoLive.ts` — CoinGecko integration
- `frontend/lib/marketDataLive.ts` — Backend integration
- `frontend/lib/useLivePrices.ts` — React hooks
- `api/server.py` — CORS + endpoints

"""
FinSight Trading Analysis API — FastAPI server.
Run: uvicorn api.server:app --reload --port 8000
"""
from __future__ import annotations

import sys
import os
import glob
import math
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

# Local dev: find tradingview-mcp-server installed via uv tool
_uv_candidates = glob.glob(
    os.path.expanduser("~/.local/share/uv/tools/tradingview-mcp-server/lib/python*/site-packages")
)
if _uv_candidates and _uv_candidates[0] not in sys.path:
    sys.path.insert(0, _uv_candidates[0])

from fastapi import FastAPI, HTTPException, Query, Path, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

try:
    import numpy as np
    import pandas as pd
    import yfinance as yf
    _YF_AVAILABLE = True
except ImportError:
    _YF_AVAILABLE = False

try:
    from tradingview_mcp.core.services.yahoo_finance_service import get_price, get_market_snapshot
    from tradingview_mcp.core.services.backtest_service import (
        run_backtest, compare_strategies, walk_forward_backtest,
    )
    from tradingview_mcp.core.services.coingecko_service import (
        get_bitcoin_dominance, get_crypto_market_data, get_bitcoin_fear_greed_index,
        get_exchange_flows, get_large_bitcoin_transactions,
    )
    from tradingview_mcp.core.services.sentiment_service import analyze_sentiment
    from tradingview_mcp.core.services.news_service import fetch_news_summary
    _TV_MCP_AVAILABLE = True
except ImportError:
    _TV_MCP_AVAILABLE = False

app = FastAPI(title="FinSight Trading API", version="2.0.0")
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Global 30-second request timeout — returns 504 instead of hanging
class TimeoutMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            return await asyncio.wait_for(call_next(request), timeout=30.0)
        except asyncio.TimeoutError:
            return Response("Request timed out", status_code=504)

app.add_middleware(TimeoutMiddleware)

# Shared thread pool for blocking yfinance calls (avoids spawning unlimited threads)
_executor = ThreadPoolExecutor(max_workers=8)

async def _yf_fetch(fn, timeout: float = 10.0):
    """Run a blocking yfinance call in the thread pool with a hard timeout."""
    loop = asyncio.get_event_loop()
    try:
        return await asyncio.wait_for(loop.run_in_executor(_executor, fn), timeout=timeout)
    except asyncio.TimeoutError:
        raise HTTPException(504, "yfinance data fetch timed out — please retry")

_allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "https://surfingalien.github.io",
    "https://finsight-app-mauve.vercel.app",
    "https://finsight-app-surfingaliens-projects.vercel.app",
]
_env_origins = os.getenv("FINSIGHT_ALLOWED_ORIGINS", "").split(",")
_allowed_origins.extend([o.strip() for o in _env_origins if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=r"^https://([a-z0-9-]+\.)*vercel\.app$",
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=True,
)

# ─── In-memory stock index ────────────────────────────────────────────────────
_STOCK_INDEX: List[Dict] = [
    {"symbol": "AAPL",    "name": "Apple Inc.",                             "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "MSFT",    "name": "Microsoft Corporation",                  "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "GOOGL",   "name": "Alphabet Inc.",                          "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "GOOG",    "name": "Alphabet Inc. Class C",                  "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "AMZN",    "name": "Amazon.com Inc.",                        "sector": "Consumer Discretionary",  "exchange": "NASDAQ"},
    {"symbol": "NVDA",    "name": "NVIDIA Corporation",                     "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "META",    "name": "Meta Platforms Inc.",                    "sector": "Communication Services",  "exchange": "NASDAQ"},
    {"symbol": "TSLA",    "name": "Tesla Inc.",                             "sector": "Consumer Discretionary",  "exchange": "NASDAQ"},
    {"symbol": "BRK.B",   "name": "Berkshire Hathaway Inc.",                "sector": "Financials",              "exchange": "NYSE"},
    {"symbol": "LLY",     "name": "Eli Lilly and Company",                  "sector": "Health Care",             "exchange": "NYSE"},
    {"symbol": "JPM",     "name": "JPMorgan Chase & Co.",                   "sector": "Financials",              "exchange": "NYSE"},
    {"symbol": "V",       "name": "Visa Inc.",                              "sector": "Financials",              "exchange": "NYSE"},
    {"symbol": "XOM",     "name": "Exxon Mobil Corporation",                "sector": "Energy",                  "exchange": "NYSE"},
    {"symbol": "UNH",     "name": "UnitedHealth Group Inc.",                "sector": "Health Care",             "exchange": "NYSE"},
    {"symbol": "JNJ",     "name": "Johnson & Johnson",                      "sector": "Health Care",             "exchange": "NYSE"},
    {"symbol": "WMT",     "name": "Walmart Inc.",                           "sector": "Consumer Staples",        "exchange": "NYSE"},
    {"symbol": "MA",      "name": "Mastercard Inc.",                        "sector": "Financials",              "exchange": "NYSE"},
    {"symbol": "PG",      "name": "Procter & Gamble Co.",                   "sector": "Consumer Staples",        "exchange": "NYSE"},
    {"symbol": "AVGO",    "name": "Broadcom Inc.",                          "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "HD",      "name": "The Home Depot Inc.",                    "sector": "Consumer Discretionary",  "exchange": "NYSE"},
    {"symbol": "CVX",     "name": "Chevron Corporation",                    "sector": "Energy",                  "exchange": "NYSE"},
    {"symbol": "MRK",     "name": "Merck & Co. Inc.",                       "sector": "Health Care",             "exchange": "NYSE"},
    {"symbol": "ABBV",    "name": "AbbVie Inc.",                            "sector": "Health Care",             "exchange": "NYSE"},
    {"symbol": "KO",      "name": "The Coca-Cola Company",                  "sector": "Consumer Staples",        "exchange": "NYSE"},
    {"symbol": "COST",    "name": "Costco Wholesale Corporation",           "sector": "Consumer Staples",        "exchange": "NASDAQ"},
    {"symbol": "PEP",     "name": "PepsiCo Inc.",                           "sector": "Consumer Staples",        "exchange": "NASDAQ"},
    {"symbol": "TMO",     "name": "Thermo Fisher Scientific Inc.",          "sector": "Health Care",             "exchange": "NYSE"},
    {"symbol": "AMD",     "name": "Advanced Micro Devices Inc.",            "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "ORCL",    "name": "Oracle Corporation",                     "sector": "Technology",              "exchange": "NYSE"},
    {"symbol": "NFLX",    "name": "Netflix Inc.",                           "sector": "Communication Services",  "exchange": "NASDAQ"},
    {"symbol": "CRM",     "name": "Salesforce Inc.",                        "sector": "Technology",              "exchange": "NYSE"},
    {"symbol": "ACN",     "name": "Accenture plc",                          "sector": "Technology",              "exchange": "NYSE"},
    {"symbol": "ADBE",    "name": "Adobe Inc.",                             "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "MCD",     "name": "McDonald's Corporation",                 "sector": "Consumer Discretionary",  "exchange": "NYSE"},
    {"symbol": "QCOM",    "name": "Qualcomm Inc.",                          "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "DIS",     "name": "The Walt Disney Company",                "sector": "Communication Services",  "exchange": "NYSE"},
    {"symbol": "GS",      "name": "The Goldman Sachs Group Inc.",           "sector": "Financials",              "exchange": "NYSE"},
    {"symbol": "BAC",     "name": "Bank of America Corporation",            "sector": "Financials",              "exchange": "NYSE"},
    {"symbol": "INTC",    "name": "Intel Corporation",                      "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "IBM",     "name": "International Business Machines Corp.",  "sector": "Technology",              "exchange": "NYSE"},
    {"symbol": "PYPL",    "name": "PayPal Holdings Inc.",                   "sector": "Financials",              "exchange": "NASDAQ"},
    {"symbol": "UBER",    "name": "Uber Technologies Inc.",                 "sector": "Industrials",             "exchange": "NYSE"},
    {"symbol": "SPOT",    "name": "Spotify Technology S.A.",                "sector": "Communication Services",  "exchange": "NYSE"},
    {"symbol": "COIN",    "name": "Coinbase Global Inc.",                   "sector": "Financials",              "exchange": "NASDAQ"},
    {"symbol": "PLTR",    "name": "Palantir Technologies Inc.",             "sector": "Technology",              "exchange": "NYSE"},
    {"symbol": "SQ",      "name": "Block Inc.",                             "sector": "Financials",              "exchange": "NYSE"},
    {"symbol": "SHOP",    "name": "Shopify Inc.",                           "sector": "Technology",              "exchange": "NYSE"},
    {"symbol": "SNOW",    "name": "Snowflake Inc.",                         "sector": "Technology",              "exchange": "NYSE"},
    {"symbol": "ARM",     "name": "Arm Holdings plc",                      "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "TSM",     "name": "Taiwan Semiconductor Manufacturing Co.", "sector": "Technology",              "exchange": "NYSE"},
    {"symbol": "ASML",    "name": "ASML Holding N.V.",                      "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "SMCI",    "name": "Super Micro Computer Inc.",              "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "NET",     "name": "Cloudflare Inc.",                        "sector": "Technology",              "exchange": "NYSE"},
    {"symbol": "DDOG",    "name": "Datadog Inc.",                           "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "ZS",      "name": "Zscaler Inc.",                           "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "CRWD",    "name": "CrowdStrike Holdings Inc.",              "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "PANW",    "name": "Palo Alto Networks Inc.",                "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "NOW",     "name": "ServiceNow Inc.",                        "sector": "Technology",              "exchange": "NYSE"},
    {"symbol": "WDAY",    "name": "Workday Inc.",                           "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "MSTR",    "name": "MicroStrategy Inc.",                     "sector": "Technology",              "exchange": "NASDAQ"},
    {"symbol": "F",       "name": "Ford Motor Company",                     "sector": "Consumer Discretionary",  "exchange": "NYSE"},
    {"symbol": "GM",      "name": "General Motors Company",                 "sector": "Consumer Discretionary",  "exchange": "NYSE"},
    {"symbol": "BA",      "name": "The Boeing Company",                     "sector": "Industrials",             "exchange": "NYSE"},
    {"symbol": "CAT",     "name": "Caterpillar Inc.",                       "sector": "Industrials",             "exchange": "NYSE"},
    {"symbol": "DE",      "name": "Deere & Company",                        "sector": "Industrials",             "exchange": "NYSE"},
    {"symbol": "LMT",     "name": "Lockheed Martin Corporation",            "sector": "Industrials",             "exchange": "NYSE"},
    {"symbol": "RTX",     "name": "RTX Corporation",                        "sector": "Industrials",             "exchange": "NYSE"},
    {"symbol": "GE",      "name": "GE Aerospace",                          "sector": "Industrials",             "exchange": "NYSE"},
    {"symbol": "UPS",     "name": "United Parcel Service Inc.",             "sector": "Industrials",             "exchange": "NYSE"},
    {"symbol": "FDX",     "name": "FedEx Corporation",                      "sector": "Industrials",             "exchange": "NYSE"},
    {"symbol": "WFC",     "name": "Wells Fargo & Company",                  "sector": "Financials",              "exchange": "NYSE"},
    {"symbol": "C",       "name": "Citigroup Inc.",                         "sector": "Financials",              "exchange": "NYSE"},
    {"symbol": "MS",      "name": "Morgan Stanley",                         "sector": "Financials",              "exchange": "NYSE"},
    {"symbol": "BLK",     "name": "BlackRock Inc.",                         "sector": "Financials",              "exchange": "NYSE"},
    {"symbol": "SCHW",    "name": "Charles Schwab Corporation",             "sector": "Financials",              "exchange": "NYSE"},
    {"symbol": "AXP",     "name": "American Express Company",               "sector": "Financials",              "exchange": "NYSE"},
    {"symbol": "SPY",     "name": "SPDR S&P 500 ETF Trust",                 "sector": "ETF",                     "exchange": "NYSE"},
    {"symbol": "QQQ",     "name": "Invesco QQQ Trust",                      "sector": "ETF",                     "exchange": "NASDAQ"},
    {"symbol": "IWM",     "name": "iShares Russell 2000 ETF",               "sector": "ETF",                     "exchange": "NYSE"},
    {"symbol": "GLD",     "name": "SPDR Gold Shares",                       "sector": "ETF",                     "exchange": "NYSE"},
    {"symbol": "TLT",     "name": "iShares 20+ Year Treasury Bond ETF",     "sector": "ETF",                     "exchange": "NASDAQ"},
    {"symbol": "BTC-USD", "name": "Bitcoin USD",                            "sector": "Crypto",                  "exchange": "Crypto"},
    {"symbol": "ETH-USD", "name": "Ethereum USD",                           "sector": "Crypto",                  "exchange": "Crypto"},
    {"symbol": "SOL-USD", "name": "Solana USD",                             "sector": "Crypto",                  "exchange": "Crypto"},
]

_SYNONYMS: Dict[str, str] = {
    "apple": "AAPL", "microsoft": "MSFT", "google": "GOOGL", "alphabet": "GOOGL",
    "amazon": "AMZN", "nvidia": "NVDA", "meta": "META", "facebook": "META",
    "tesla": "TSLA", "berkshire": "BRK.B", "lilly": "LLY", "jpmorgan": "JPM",
    "visa": "V", "exxon": "XOM", "unitedhealth": "UNH", "johnson": "JNJ",
    "walmart": "WMT", "mastercard": "MA", "broadcom": "AVGO", "netflix": "NFLX",
    "disney": "DIS", "intel": "INTC", "paypal": "PYPL", "bitcoin": "BTC-USD",
    "ethereum": "ETH-USD", "solana": "SOL-USD", "amd": "AMD", "oracle": "ORCL",
    "salesforce": "CRM", "palantir": "PLTR", "coinbase": "COIN", "shopify": "SHOP",
    "snowflake": "SNOW", "spotify": "SPOT", "uber": "UBER", "block": "SQ",
    "square": "SQ", "crowdstrike": "CRWD", "cloudflare": "NET", "datadog": "DDOG",
    "servicenow": "NOW", "workday": "WDAY", "boeing": "BA", "caterpillar": "CAT",
    "lockheed": "LMT", "blackrock": "BLK", "schwab": "SCHW", "ford": "F",
    "microstrategy": "MSTR", "gold": "GLD", "treasury": "TLT",
}

# Build lowercase lookup maps for fast search
_SYM_MAP   = {row["symbol"].lower(): row for row in _STOCK_INDEX}
_NAME_WORDS: Dict[str, List[Dict]] = {}
for _row in _STOCK_INDEX:
    for _word in _row["name"].lower().split():
        _word = _word.strip(".,")
        _NAME_WORDS.setdefault(_word, []).append(_row)


# ─── Indicator helpers ────────────────────────────────────────────────────────

def _ema(s: "pd.Series", span: int) -> "pd.Series":
    return s.ewm(span=span, adjust=False).mean()


def _rsi(s: "pd.Series", period: int = 14) -> "pd.Series":
    delta = s.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / period, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / period, adjust=False).mean()
    rs = gain / loss.replace(0, float("nan"))
    return 100 - 100 / (1 + rs)


def _macd(s: "pd.Series"):
    fast, slow, sig = _ema(s, 12), _ema(s, 26), None
    line = fast - slow
    sig  = _ema(line, 9)
    return line, sig, line - sig


def _atr(high: "pd.Series", low: "pd.Series", close: "pd.Series", period: int = 14) -> "pd.Series":
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low  - close.shift()).abs(),
    ], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / period, adjust=False).mean()


def _bollinger(s: "pd.Series", window: int = 20):
    mid   = s.rolling(window).mean()
    std   = s.rolling(window).std()
    upper = mid + 2 * std
    lower = mid - 2 * std
    pct_b = (s - lower) / (upper - lower + 1e-9)
    width = (upper - lower) / (mid + 1e-9)
    return upper, mid, lower, pct_b, width


def _swing_low(s: "pd.Series", window: int = 20) -> float:
    return float(s.rolling(window).min().iloc[-1])


def _swing_high(s: "pd.Series", window: int = 20) -> float:
    return float(s.rolling(window).max().iloc[-1])


def _vol_ratio(vol: "pd.Series", window: int = 20) -> float:
    avg = vol.rolling(window).mean().iloc[-1]
    return float(vol.iloc[-1] / avg) if avg > 0 else 1.0


def _fetch_ohlcv(symbol: str, period: str = "1y") -> "pd.DataFrame":
    tk = yf.Ticker(symbol)
    df = tk.history(period=period, auto_adjust=True)
    if df.empty:
        raise ValueError(f"No data for {symbol}")
    df.columns = [c.lower() for c in df.columns]
    return df


def _stochastic(high: "pd.Series", low: "pd.Series", close: "pd.Series",
                k_period: int = 14, d_period: int = 3):
    """Stochastic Oscillator %K and %D lines."""
    lo = low.rolling(k_period).min()
    hi = high.rolling(k_period).max()
    pct_k = 100 * (close - lo) / (hi - lo + 1e-9)
    pct_d = pct_k.rolling(d_period).mean()
    return pct_k, pct_d


def _obv(close: "pd.Series", volume: "pd.Series") -> "pd.Series":
    """On-Balance Volume — cumulative signed volume."""
    direction = close.diff().apply(lambda x: 1 if x > 0 else (-1 if x < 0 else 0))
    return (direction * volume).cumsum()


def _fibonacci_levels(swing_high: float, swing_low: float) -> dict:
    """Classic Fibonacci retracement levels between a swing high and low."""
    diff = swing_high - swing_low
    return {
        "0.0":   round(swing_low, 2),
        "23.6":  round(swing_low + 0.236 * diff, 2),
        "38.2":  round(swing_low + 0.382 * diff, 2),
        "50.0":  round(swing_low + 0.500 * diff, 2),
        "61.8":  round(swing_low + 0.618 * diff, 2),
        "78.6":  round(swing_low + 0.786 * diff, 2),
        "100.0": round(swing_high, 2),
    }


def _rsi_divergence(price: "pd.Series", rsi: "pd.Series", lookback: int = 14) -> str:
    """Detect bullish/bearish RSI divergence over the most recent N bars."""
    p = price.iloc[-lookback:]
    r = rsi.iloc[-lookback:]
    price_up = float(p.iloc[-1]) > float(p.iloc[0])
    rsi_up   = float(r.iloc[-1]) > float(r.iloc[0])
    if price_up and not rsi_up:
        return "bearish"   # price new high, RSI declining → bearish divergence
    if not price_up and rsi_up:
        return "bullish"   # price new low, RSI rising → bullish divergence
    return "none"


def _golden_death_cross(ema50: "pd.Series", ema200: "pd.Series") -> str:
    if len(ema50) < 2 or len(ema200) < 2:
        return "none"
    prev = float(ema50.iloc[-2]) - float(ema200.iloc[-2])
    curr = float(ema50.iloc[-1]) - float(ema200.iloc[-1])
    if prev < 0 <= curr:
        return "golden_cross"
    if prev > 0 >= curr:
        return "death_cross"
    return "above_200" if curr > 0 else "below_200"


# ─── Routes: health ───────────────────────────────────────────────────────────

@app.get("/health")
@app.get("/healthz")
def health():
    return {"status": "ok", "version": "2.0.0", "timestamp": datetime.now(timezone.utc).isoformat()}


# ─── Routes: search ───────────────────────────────────────────────────────────

@app.get("/api/search")
def search(
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(10, ge=1, le=50),
    sector: Optional[str] = None,
    exchange: Optional[str] = None,
):
    t0 = time.time()
    q_clean = q.strip().lower().replace("%", "").replace(";", "")
    results: List[Dict] = []
    seen: set = set()

    def _add(row: Dict, match_type: str, score: int):
        sym = row["symbol"]
        if sym in seen:
            return
        if sector   and row.get("sector",   "").lower() != sector.lower():
            return
        if exchange and row.get("exchange", "").lower() != exchange.lower():
            return
        seen.add(sym)
        results.append({**row, "match_type": match_type, "_score": score})

    # 1. Exact symbol
    if q_clean.upper() in _SYM_MAP:
        _add(_SYM_MAP[q_clean.upper()], "exact_symbol", 100)

    # 2. Synonym hit
    syn = _SYNONYMS.get(q_clean)
    if syn and syn.lower() in _SYM_MAP:
        _add(_SYM_MAP[syn.lower()], "synonym", 90)

    # 3. Prefix match on symbol
    for sym_lower, row in _SYM_MAP.items():
        if sym_lower.startswith(q_clean) and sym_lower != q_clean:
            _add(row, "prefix", 80 - len(sym_lower))

    # 4. Word match in name
    for word, rows in _NAME_WORDS.items():
        if word.startswith(q_clean):
            for row in rows:
                _add(row, "fts", 60)

    # 5. Fuzzy substring on symbol or name
    for row in _STOCK_INDEX:
        sym_l = row["symbol"].lower()
        name_l = row["name"].lower()
        if q_clean in sym_l or q_clean in name_l:
            _add(row, "fuzzy", 40)

    results.sort(key=lambda r: -r["_score"])
    cleaned = [{k: v for k, v in r.items() if k != "_score"} for r in results[:limit]]

    return {
        "results":  cleaned,
        "source":   "memory",
        "took_ms":  round((time.time() - t0) * 1000, 1),
        "total":    len(cleaned),
    }


# ─── Routes: quotes / history ─────────────────────────────────────────────────

@app.get("/api/quotes")
async def quotes(symbols: str = Query(..., description="Comma-separated symbols")):
    if not _YF_AVAILABLE:
        raise HTTPException(503, "yfinance not available")
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()][:20]

    async def fetch_one(sym: str) -> dict:
        try:
            def _get():
                tk = yf.Ticker(sym)
                info = tk.fast_info
                return {
                    "symbol":              sym,
                    "price":               round(float(info.last_price or 0), 4),
                    "change":              round(float((info.last_price or 0) - (info.previous_close or 0)), 4),
                    "change_pct":          round(float(((info.last_price or 0) / (info.previous_close or 1) - 1) * 100), 2),
                    "volume":              int(info.three_month_average_volume or 0),
                    "market_cap":          float(info.market_cap or 0),
                    "fifty_two_week_high": float(info.fifty_two_week_high or 0),
                    "fifty_two_week_low":  float(info.fifty_two_week_low  or 0),
                }
            return await _yf_fetch(_get, timeout=10.0)
        except Exception as exc:
            return {"symbol": sym, "error": str(exc)}

    return await asyncio.gather(*[fetch_one(s) for s in syms])


@app.get("/api/history/{symbol}")
async def history(
    symbol: str = Path(...),
    period: str = Query("6mo", description="1mo|3mo|6mo|1y|2y|5y"),
    interval: str = Query("1d"),
):
    if not _YF_AVAILABLE:
        raise HTTPException(503, "yfinance not available")
    try:
        df = await _yf_fetch(lambda: _fetch_ohlcv(symbol.upper(), period))
        rows = []
        for ts, row in df.iterrows():
            rows.append({
                "date":   ts.strftime("%Y-%m-%d"),
                "open":   round(float(row["open"]),   4),
                "high":   round(float(row["high"]),   4),
                "low":    round(float(row["low"]),    4),
                "close":  round(float(row["close"]),  4),
                "volume": int(row.get("volume", 0)),
            })
        return {"symbol": symbol.upper(), "period": period, "bars": rows}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, str(exc))


# ─── Routes: fundamentals ────────────────────────────────────────────────────

@app.get("/api/fundamentals/{symbol}")
async def fundamentals(symbol: str = Path(...)):
    """Fundamental data: valuation, margins, analyst consensus, balance-sheet ratios."""
    if not _YF_AVAILABLE:
        raise HTTPException(503, "yfinance not available")
    sym = symbol.upper()
    try:
        def _get():
            tk   = yf.Ticker(sym)
            info = tk.info or {}
            fi   = tk.fast_info
            def _f(key, fallback=0.0):
                v = info.get(key)
                try: return float(v) if v is not None else fallback
                except: return fallback
            def _pct(key):
                v = _f(key)
                return round(v * 100, 2) if abs(v) <= 10 else round(v, 2)  # some already in %
            return {
                "symbol":   sym,
                "name":     info.get("longName") or info.get("shortName", sym),
                "sector":   info.get("sector", ""),
                "industry": info.get("industry", ""),
                "exchange": info.get("exchange", ""),
                "currency": info.get("currency", "USD"),
                "description": (info.get("longBusinessSummary", "") or "")[:400],
                # Price
                "price":               round(float(fi.last_price or 0), 2),
                "market_cap":          float(fi.market_cap or 0),
                "enterprise_value":    _f("enterpriseValue"),
                "beta":                round(_f("beta", 1.0), 2),
                # Valuation
                "pe_ratio":     round(_f("trailingPE"), 2),
                "forward_pe":   round(_f("forwardPE"),  2),
                "peg_ratio":    round(_f("pegRatio"),   2),
                "price_to_book":round(_f("priceToBook"),2),
                "price_to_sales": round(_f("priceToSalesTrailing12Months"), 2),
                "ev_to_ebitda": round(_f("enterpriseToEbitda"), 2),
                "ev_to_revenue":round(_f("enterpriseToRevenue"), 2),
                # Per-share
                "eps_ttm":     round(_f("trailingEps"), 2),
                "eps_forward": round(_f("forwardEps"),  2),
                # Revenue / earnings
                "revenue_ttm":         _f("totalRevenue"),
                "revenue_growth_yoy":  _pct("revenueGrowth"),
                "earnings_growth_yoy": _pct("earningsGrowth"),
                "gross_margins":       _pct("grossMargins"),
                "operating_margins":   _pct("operatingMargins"),
                "profit_margins":      _pct("profitMargins"),
                # Balance sheet
                "debt_to_equity":  round(_f("debtToEquity"),  2),
                "current_ratio":   round(_f("currentRatio"),  2),
                "roe":             _pct("returnOnEquity"),
                "roa":             _pct("returnOnAssets"),
                "free_cash_flow":  _f("freeCashflow"),
                # Dividends
                "dividend_yield": round(_f("dividendYield") * 100, 2),
                "dividend_rate":  round(_f("dividendRate"), 2),
                "payout_ratio":   _pct("payoutRatio"),
                # Analyst consensus
                "analyst_target":  round(_f("targetMeanPrice"), 2),
                "analyst_low":     round(_f("targetLowPrice"),  2),
                "analyst_high":    round(_f("targetHighPrice"), 2),
                "recommendation":  info.get("recommendationKey", ""),
                "num_analysts":    int(_f("numberOfAnalystOpinions")),
                # Technical
                "fifty_two_week_high": float(fi.fifty_two_week_high or 0),
                "fifty_two_week_low":  float(fi.fifty_two_week_low  or 0),
                "avg_volume":          float(_f("averageVolume")),
                "short_ratio":         round(_f("shortRatio"), 2),
            }
        return await _yf_fetch(_get, timeout=12.0)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, str(exc))


# ─── Routes: full technical dashboard ────────────────────────────────────────

@app.get("/api/technicals/{symbol}")
async def technical_dashboard(
    symbol: str = Path(...),
    period: str = Query("6mo", description="3mo|6mo|1y|2y"),
):
    """Complete technical analysis: Stochastic, OBV, Fibonacci, Golden/Death Cross, RSI Divergence."""
    if not _YF_AVAILABLE:
        raise HTTPException(503, "yfinance not available")
    sym = symbol.upper()
    safe_period = period if period in {"3mo", "6mo", "1y", "2y"} else "6mo"
    try:
        df = await _yf_fetch(lambda: _fetch_ohlcv(sym, safe_period))
        if len(df) < 50:
            raise ValueError("Need at least 50 bars for technical analysis")

        close  = df["close"]
        high   = df["high"]
        low    = df["low"]
        volume = df.get("volume", pd.Series(dtype=float))
        price  = float(close.iloc[-1])

        # Moving averages
        ema20  = _ema(close, 20)
        ema50  = _ema(close, 50)
        ema200 = _ema(close, 200) if len(close) >= 200 else _ema(close, len(close))

        # Indicators
        rsi_s           = _rsi(close, 14)
        rsi_val         = float(rsi_s.iloc[-1])
        ml, ms, mh      = _macd(close)
        bb_up, bb_mid, bb_lo, bb_pb, bb_w = _bollinger(close, 20)
        atr_s           = _atr(high, low, close, 14)
        atr_val         = float(atr_s.iloc[-1])
        stoch_k, stoch_d = _stochastic(high, low, close)
        sk, sd          = float(stoch_k.iloc[-1]), float(stoch_d.iloc[-1])
        obv_s           = _obv(close, volume)
        cross           = _golden_death_cross(ema50, ema200)
        divergence      = _rsi_divergence(close, rsi_s)

        # Fibonacci (52-week range)
        bars_1y = min(252, len(high))
        sh52 = float(high.iloc[-bars_1y:].max())
        sl52 = float(low.iloc[-bars_1y:].min())
        fib  = _fibonacci_levels(sh52, sl52)

        # Nearest fib level
        fib_vals = [(float(v), k) for k, v in fib.items()]
        nearest_fib = min(fib_vals, key=lambda x: abs(x[0] - price))

        # OBV trend (compare last bar vs 20 bars ago)
        obv_trend = "rising" if float(obv_s.iloc[-1]) > float(obv_s.iloc[-20]) else "falling"

        # Volume
        vol_r = _vol_ratio(volume, 20) if not volume.empty else 1.0

        # Overall score (0–100)
        s = 0
        if price > float(ema200.iloc[-1]): s += 20
        if float(ema20.iloc[-1]) > float(ema50.iloc[-1]) > float(ema200.iloc[-1]): s += 15
        if 40 <= rsi_val <= 70: s += 15
        if float(mh.iloc[-1]) > 0: s += 10
        if sk < 80: s += 10
        if obv_trend == "rising": s += 10
        if cross in ("golden_cross", "above_200"): s += 10
        if divergence == "bullish": s += 10
        if rsi_val > 75: s -= 15
        if divergence == "bearish": s -= 10
        if cross == "death_cross": s -= 20
        tech_score = max(0, min(100, s))

        return {
            "symbol":      sym,
            "price":       round(price, 2),
            "tech_score":  tech_score,
            "outlook":     "bullish" if tech_score >= 60 else ("bearish" if tech_score < 40 else "neutral"),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "moving_averages": {
                "ema20":            round(float(ema20.iloc[-1]),  2),
                "ema50":            round(float(ema50.iloc[-1]),  2),
                "ema200":           round(float(ema200.iloc[-1]), 2),
                "cross":            cross,
                "price_vs_ema200_pct": round((price / float(ema200.iloc[-1]) - 1) * 100, 2),
                "bullish_stack":    float(ema20.iloc[-1]) > float(ema50.iloc[-1]) > float(ema200.iloc[-1]),
            },
            "momentum": {
                "rsi14":            round(rsi_val, 1),
                "rsi_zone":         "overbought" if rsi_val > 70 else ("oversold" if rsi_val < 30 else "neutral"),
                "rsi_divergence":   divergence,
                "stoch_k":          round(sk, 1),
                "stoch_d":          round(sd, 1),
                "stoch_zone":       "overbought" if sk > 80 else ("oversold" if sk < 20 else "neutral"),
                "stoch_crossover":  "bullish" if sk > sd and float(stoch_k.iloc[-2]) <= float(stoch_d.iloc[-2]) else (
                                    "bearish" if sk < sd and float(stoch_k.iloc[-2]) >= float(stoch_d.iloc[-2]) else "none"),
                "macd_line":        round(float(ml.iloc[-1]), 4),
                "macd_signal_line": round(float(ms.iloc[-1]), 4),
                "macd_hist":        round(float(mh.iloc[-1]), 4),
                "macd_crossover":   "bullish" if float(mh.iloc[-1]) > 0 > float(mh.iloc[-2]) else (
                                    "bearish" if float(mh.iloc[-1]) < 0 < float(mh.iloc[-2]) else "none"),
            },
            "volatility": {
                "atr14":      round(atr_val, 4),
                "atr_pct":    round(atr_val / price * 100, 2),
                "bb_upper":   round(float(bb_up.iloc[-1]),  2),
                "bb_mid":     round(float(bb_mid.iloc[-1]), 2),
                "bb_lower":   round(float(bb_lo.iloc[-1]),  2),
                "bb_pct_b":   round(float(bb_pb.iloc[-1]),  3),
                "bb_width":   round(float(bb_w.iloc[-1]),   3),
                "bb_squeeze": float(bb_w.iloc[-1]) < float(bb_w.rolling(20).mean().iloc[-1]) * 0.8,
            },
            "volume": {
                "obv_trend":  obv_trend,
                "vol_ratio":  round(vol_r, 2),
                "vol_signal": "high" if vol_r > 1.5 else ("low" if vol_r < 0.7 else "normal"),
            },
            "levels": {
                "support_20d":    round(_swing_low(low, 20),   2),
                "resistance_20d": round(_swing_high(high, 20), 2),
                "support_60d":    round(_swing_low(low, 60),   2),
                "resistance_60d": round(_swing_high(high, 60), 2),
                "fibonacci":      fib,
                "nearest_fib":    {"level": nearest_fib[1], "price": nearest_fib[0]},
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, str(exc))


# ─── Routes: trading tips ─────────────────────────────────────────────────────

@app.get("/api/tips/{symbol}")
async def trading_tips(
    symbol: str = Path(...),
    portfolio_equity: float = Query(100_000, ge=1_000),
):
    if not _YF_AVAILABLE:
        raise HTTPException(503, "yfinance not available")
    sym = symbol.upper()
    try:
        # Fetch symbol OHLCV and VIX in parallel
        df, vix_df = await asyncio.gather(
            _yf_fetch(lambda: _fetch_ohlcv(sym, "1y")),
            _yf_fetch(lambda: yf.Ticker("^VIX").history(period="5d", auto_adjust=True), timeout=8.0),
        )

        if len(df) < 60:
            raise ValueError("Insufficient history")

        close  = df["close"]
        high   = df["high"]
        low    = df["low"]
        volume = df.get("volume", pd.Series(dtype=float))

        ema20_s = _ema(close, 20)
        ema50_s = _ema(close, 50)
        ema200_s= _ema(close, 200)
        ema20  = float(ema20_s.iloc[-1])
        ema50  = float(ema50_s.iloc[-1])
        ema200 = float(ema200_s.iloc[-1])
        rsi_s  = _rsi(close, 14)
        rsi14  = float(rsi_s.iloc[-1])
        _ml, _ms, _mh = _macd(close)
        macd_hist = float(_mh.iloc[-1])
        macd_prev = float(_mh.iloc[-2])
        atr14  = float(_atr(high, low, close, 14).iloc[-1])
        _, _, _, bb_pct_b, _ = _bollinger(close, 20)
        bb_val = float(bb_pct_b.iloc[-1])
        swing_lo20 = _swing_low(low, 20)
        swing_hi20 = _swing_high(high, 20)
        swing_lo60 = _swing_low(low, 60)
        vol_r  = _vol_ratio(volume, 20) if not volume.empty else 1.0
        price  = float(close.iloc[-1])
        # New indicators
        stoch_k_s, stoch_d_s = _stochastic(high, low, close)
        stoch_k = float(stoch_k_s.iloc[-1])
        stoch_d = float(stoch_d_s.iloc[-1])
        obv_s   = _obv(close, volume)
        obv_rising = not volume.empty and float(obv_s.iloc[-1]) > float(obv_s.iloc[-20])
        cross   = _golden_death_cross(ema50_s, ema200_s)
        rsi_div = _rsi_divergence(close, rsi_s)
        # Fibonacci (52-week)
        bars_1y = min(252, len(high))
        fib_hi  = float(high.iloc[-bars_1y:].max())
        fib_lo  = float(low.iloc[-bars_1y:].min())
        fib     = _fibonacci_levels(fib_hi, fib_lo)

        # VIX from parallel result
        try:
            vix = float(vix_df["Close"].iloc[-1]) if not vix_df.empty else 20.0
        except Exception:
            vix = 20.0

        # ── Stop-loss ──────────────────────────────────────────────────────────
        vix_mult = 1.2 if vix < 15 else (2.5 if vix > 30 else 1.2 + (vix - 15) / 15 * 1.3)
        atr_stop_val = price - vix_mult * atr14
        structural = max(swing_lo20 * 0.99, ema200 * 0.99)
        stop_loss  = max(atr_stop_val, structural)
        sl_method  = "atr" if atr_stop_val >= structural else "structural"

        # ── Position sizing ────────────────────────────────────────────────────
        risk_per_share = price - stop_loss
        if risk_per_share <= 0:
            stop_loss = price * 0.95
            risk_per_share = price - stop_loss
            sl_method = "atr"

        dollar_risk   = portfolio_equity * 0.01
        raw_shares    = dollar_risk / risk_per_share
        max_alloc     = portfolio_equity * 0.05
        capped_shares = math.floor(max_alloc / price)
        shares        = min(raw_shares, capped_shares)
        shares        = max(1, math.floor(shares))
        dollar_value  = round(shares * price, 2)
        position_pct  = round(dollar_value / portfolio_equity * 100, 2)
        actual_risk   = round(shares * risk_per_share / portfolio_equity * 100, 3)

        # ── Targets ───────────────────────────────────────────────────────────
        r = price - stop_loss
        tp1 = round(price + r,       2)
        tp2 = round(price + 2 * r,   2)
        tp3 = round(price + 3 * r,   2)
        rr_ratio = round((tp2 - price) / r, 2) if r > 0 else 0

        # ── Entry zone ────────────────────────────────────────────────────────
        entry_low  = round(price * 0.997, 2)
        entry_high = round(price * 1.003, 2)

        # ── Signal scoring ────────────────────────────────────────────────────
        score = 0
        rationale: List[str] = []
        signals: List[Dict] = []

        def _sig(label: str, active: bool, pts: int, reason: str = ""):
            nonlocal score
            signals.append({"label": label, "active": active})
            if active:
                score += pts
                if reason:
                    rationale.append(reason)

        _sig("EMA Bullish Stack (20>50>200)", ema20 > ema50 > ema200, 20,
             f"EMAs aligned bullishly: {ema20:.2f} > {ema50:.2f} > {ema200:.2f}")
        _sig("Price Above EMA200",            price > ema200,          10,
             f"Price {price:.2f} above 200-EMA {ema200:.2f}")
        _sig("RSI Sweet Spot (45-70)",        45 <= rsi14 <= 70,       12,
             f"RSI {rsi14:.1f} in momentum zone")
        _sig("MACD Bullish Crossover",        macd_hist > 0 > macd_prev, 15,
             "MACD histogram just turned positive — momentum shift")
        _sig("High Relative Volume",          vol_r > 1.5,              8,
             f"Volume {vol_r:.1f}× above 20-day average")
        _sig("BB Not Overbought (%B < 0.85)", bb_val < 0.85,            8,
             f"Bollinger %B at {bb_val:.2f} — room to run")
        _sig("Near Swing Support",            price <= swing_lo20 * 1.03, 8,
             f"Price within 3% of 20-day swing low {swing_lo20:.2f}")
        _sig("Stochastic Not Overbought",     stoch_k < 80,             7,
             f"Stochastic %K {stoch_k:.0f} not overbought")
        _sig("OBV Confirming Trend",          obv_rising,               7,
             "On-Balance Volume rising — volume confirms price trend")
        _sig("Golden Cross (50>200 EMA)",     cross in ("golden_cross", "above_200"), 10,
             f"EMA cross status: {cross.replace('_',' ')}")
        _sig("Bullish RSI Divergence",        rsi_div == "bullish",      10,
             "Bullish RSI divergence — price weakness not confirmed by momentum")
        if rsi14 > 75:
            score -= 15
            rationale.append(f"RSI {rsi14:.1f} overbought — caution")
        if rsi_div == "bearish":
            score -= 10
            rationale.append("Bearish RSI divergence — momentum weakening")
        if cross == "death_cross":
            score -= 15
            rationale.append("Death cross (50 EMA below 200 EMA) — bearish long-term signal")
        if vix > 25:
            score -= 10
            rationale.append(f"Elevated VIX {vix:.1f} increases risk")

        score = max(0, min(100, score))
        if score >= 60:
            signal_label = "BULLISH"
        elif score >= 35:
            signal_label = "NEUTRAL"
        else:
            signal_label = "BEARISH"

        trailing_activation = round(price * 1.08, 2)
        trailing_atr        = round(2 * atr14, 2)

        return {
            "symbol":       sym,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "signal":       signal_label,
            "score":        score,
            "entry_zone": {
                "low":      entry_low,
                "high":     entry_high,
                "midpoint": round(price, 2),
            },
            "stop_loss": {
                "stop_loss":       round(stop_loss, 2),
                "method":          sl_method,
                "atr_stop":        round(atr_stop_val, 2),
                "structural_stop": round(structural, 2),
                "risk_pct_equity": round(actual_risk, 3),
            },
            "targets": {
                "tp1":      tp1,
                "tp2":      tp2,
                "tp3":      tp3,
                "rr_ratio": rr_ratio,
            },
            "position_size": {
                "shares":              shares,
                "dollar_value":        dollar_value,
                "position_pct":        position_pct,
                "risk_pct":            actual_risk,
                "dollar_risk":         round(shares * risk_per_share, 2),
                "capped_by_allocation": shares == capped_shares,
            },
            "trailing_stop": {
                "activation_price": trailing_activation,
                "trail_atr":        trailing_atr,
                "rule":             "Trail 2×ATR once price reaches +8%",
            },
            "signals":   signals,
            "rationale": rationale if rationale else ["No strong directional signal at this time"],
            "technicals": {
                "close":        round(price,     2),
                "ema20":        round(ema20,     2),
                "ema50":        round(ema50,     2),
                "ema200":       round(ema200,    2),
                "rsi14":        round(rsi14,     1),
                "atr14":        round(atr14,     4),
                "macd_hist":    round(macd_hist, 4),
                "vol_ratio":    round(vol_r,     2),
                "vix":          round(vix,       1),
                "bb_pct_b":     round(bb_val,    3),
                "stoch_k":      round(stoch_k,   1),
                "stoch_d":      round(stoch_d,   1),
                "obv_trend":    "rising" if obv_rising else "falling",
                "ema_cross":    cross,
                "rsi_divergence": rsi_div,
                "fibonacci":    fib,
            },
        }
    except Exception as exc:
        raise HTTPException(400, str(exc))


# ─── Routes: market regime ────────────────────────────────────────────────────

@app.get("/api/regime")
async def market_regime():
    if not _YF_AVAILABLE:
        raise HTTPException(503, "yfinance not available")
    try:
        spy_df, vix_df, qqq_df = await asyncio.gather(
            _yf_fetch(lambda: yf.Ticker("SPY").history(period="1y",  auto_adjust=True)),
            _yf_fetch(lambda: yf.Ticker("^VIX").history(period="5d", auto_adjust=True), timeout=8.0),
            _yf_fetch(lambda: yf.Ticker("QQQ").history(period="1y",  auto_adjust=True)),
        )

        spy_close = spy_df["Close"]
        spy_price = float(spy_close.iloc[-1])
        spy_ma50  = float(spy_close.rolling(50).mean().iloc[-1])
        spy_ma200 = float(spy_close.rolling(200).mean().iloc[-1])

        qqq_close = qqq_df["Close"]
        qqq_ma50  = float(qqq_close.rolling(50).mean().iloc[-1])
        qqq_price = float(qqq_close.iloc[-1])

        vix = float(vix_df["Close"].iloc[-1]) if not vix_df.empty else 20.0

        spy_vs_200 = (spy_price / spy_ma200 - 1) * 100
        spy_vs_50  = (spy_price / spy_ma50  - 1) * 100
        qqq_above_50 = qqq_price > qqq_ma50

        # ── Scoring ────────────────────────────────────────────────────────────
        bull_pts = 0
        bear_pts = 0
        stress_pts = 0

        if vix > 30:
            stress_pts += 3
        elif vix > 25:
            stress_pts += 1

        if spy_price > spy_ma200:
            bull_pts += 2
        else:
            bear_pts += 2

        if spy_price > spy_ma50:
            bull_pts += 1
        else:
            bear_pts += 1

        if qqq_above_50:
            bull_pts += 1
        else:
            bear_pts += 1

        if spy_vs_200 > 5:
            bull_pts += 1
        elif spy_vs_200 < -5:
            bear_pts += 1

        # ── Classification ─────────────────────────────────────────────────────
        if stress_pts >= 3 or vix > 35:
            regime = "high_vol_stress"
            label  = "High Volatility / Stress"
            confidence = min(95, 60 + stress_pts * 10)
            position_size_adj = 0.5
            stop_atr_mult     = 2.5
            preferred_sectors = ["Consumer Staples", "Health Care", "Utilities", "Gold"]
            strategy_notes    = [
                "Reduce position sizes by 50% — capital preservation mode",
                "Use wider ATR stops (2.5×) to avoid whipsaws",
                "Avoid new long exposure until VIX drops below 25",
                "Hedge with TLT or GLD if already long",
            ]
        elif bear_pts > bull_pts + 1:
            regime = "bearish_trend"
            label  = "Bearish Trend"
            confidence = min(90, 50 + (bear_pts - bull_pts) * 8)
            position_size_adj = 0.6
            stop_atr_mult     = 2.0
            preferred_sectors = ["Energy", "Health Care", "Consumer Staples"]
            strategy_notes    = [
                "SPY below key moving averages — trend is down",
                "Prefer defensive sectors and dividend payers",
                "Consider cash positions or inverse ETFs for hedging",
                "Trail stops tightly on any longs",
            ]
        elif bull_pts > bear_pts + 1 and vix < 20:
            regime = "bullish_trend"
            label  = "Bullish Trend"
            confidence = min(90, 50 + (bull_pts - bear_pts) * 8)
            position_size_adj = 1.0
            stop_atr_mult     = 1.5
            preferred_sectors = ["Technology", "Consumer Discretionary", "Financials", "Industrials"]
            strategy_notes    = [
                "SPY above 50 & 200-day MA — risk-on environment",
                "Growth and momentum names outperform",
                "Full position sizing appropriate",
                "Trail stops loosely with ATR × 1.5",
            ]
        else:
            regime = "range_bound"
            label  = "Range-Bound / Choppy"
            confidence = 55
            position_size_adj = 0.75
            stop_atr_mult     = 1.8
            preferred_sectors = ["Financials", "Utilities", "Real Estate", "Consumer Staples"]
            strategy_notes    = [
                "Mixed signals — market lacks clear direction",
                "Reduce size to 75% of normal",
                "Buy support / sell resistance within the range",
                "Prefer mean-reversion over momentum strategies",
            ]

        return {
            "regime":             regime,
            "label":              label,
            "confidence":         confidence,
            "vix":                round(vix,       1),
            "spy_price":          round(spy_price,  2),
            "spy_ma50":           round(spy_ma50,   2),
            "spy_ma200":          round(spy_ma200,  2),
            "spy_vs_200ma":       round(spy_vs_200, 2),
            "spy_vs_50ma":        round(spy_vs_50,  2),
            "qqq_above_50ma":     qqq_above_50,
            "position_size_adj":  position_size_adj,
            "stop_atr_mult":      stop_atr_mult,
            "preferred_sectors":  preferred_sectors,
            "strategy_notes":     strategy_notes,
            "generated_at":       datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        raise HTTPException(500, str(exc))


# ─── Routes: ML price prediction (statistical) ────────────────────────────────

@app.get("/api/predict")
async def predict(
    symbol: str = Query(..., min_length=1, max_length=20),
    horizon: int = Query(7, ge=1, le=90),
):
    if not _YF_AVAILABLE:
        raise HTTPException(503, "yfinance not available")
    sym = symbol.upper()
    try:
        df = await _yf_fetch(lambda: _fetch_ohlcv(sym, "2y"))
        if len(df) < 60:
            raise ValueError("Insufficient history for prediction")

        close = df["close"].values
        n     = len(close)
        price = float(close[-1])

        # Log returns
        log_ret = np.diff(np.log(close))
        mu      = float(np.mean(log_ret))         # daily drift
        sigma   = float(np.std(log_ret))           # daily vol

        # Annualized
        ann_vol   = sigma * math.sqrt(252)
        ann_ret   = (mu + 0.5 * sigma ** 2) * 252

        # Trend from last 60 days
        window = min(60, n)
        x = np.arange(window)
        y = np.log(close[-window:])
        slope, intercept = np.polyfit(x, y, 1)
        trend_daily = slope  # log-price slope per day

        # Adjust drift toward recent trend
        adjusted_mu = 0.5 * mu + 0.5 * trend_daily

        # Monte Carlo via analytical percentiles (no sim needed)
        h = horizon
        expected_log   = adjusted_mu * h
        std_log        = sigma * math.sqrt(h)

        # Percentiles via lognormal
        median_price  = round(price * math.exp(expected_log),                  2)
        target_price  = round(price * math.exp(expected_log + 0.5 * std_log),  2)
        conf_high     = round(price * math.exp(expected_log + 1.645 * std_log), 2)  # 95th pct
        conf_low      = round(price * math.exp(expected_log - 1.645 * std_log), 2)  # 5th pct
        bull_price    = round(price * math.exp(expected_log + 2.0 * std_log),   2)
        bear_price    = round(price * math.exp(expected_log - 2.0 * std_log),   2)

        # Probabilities using normal CDF approximation
        def _norm_cdf(z: float) -> float:
            return 0.5 * (1 + math.erf(z / math.sqrt(2)))

        def _prob_above(threshold_pct: float) -> float:
            target_log = math.log(1 + threshold_pct / 100)
            z = (expected_log - target_log) / std_log if std_log > 0 else 0
            return round(_norm_cdf(z) * 100, 1)

        prob_up5  = _prob_above(5)
        prob_up10 = _prob_above(10)
        prob_up15 = _prob_above(15)
        prob_down = round(100 - _prob_above(0), 1)

        direction = "up" if expected_log > 0 else "down"

        # Directional accuracy approximation based on recent trend consistency
        pos_days = int(np.sum(log_ret > 0))
        dir_acc  = round(pos_days / len(log_ret) * 100, 1)

        # Bull scenario: 75th pct; Bear: 25th pct
        bull_prob = round(_norm_cdf((expected_log + std_log - 0) / std_log) * 100 * 0.25, 1)
        base_prob = round(50.0, 1)
        bear_prob = round(100 - bull_prob - base_prob, 1)

        return {
            "symbol":        sym,
            "horizon":       horizon,
            "horizon_label": f"{horizon}d",
            "current_price": round(price, 2),
            "target_price":  target_price,
            "median_price":  median_price,
            "confidence_low":  conf_low,
            "confidence_high": conf_high,
            "direction":       direction,
            "expected_return_pct": round((math.exp(expected_log) - 1) * 100, 2),
            "ann_vol_pct":    round(ann_vol * 100, 1),
            "prob_up_5pct":   prob_up5,
            "prob_up_10pct":  prob_up10,
            "prob_up_15pct":  prob_up15,
            "prob_down":      prob_down,
            "scenarios": [
                {
                    "label":       "Bull",
                    "price":       bull_price,
                    "probability": bull_prob,
                    "return_pct":  round((bull_price / price - 1) * 100, 1),
                },
                {
                    "label":       "Base",
                    "price":       median_price,
                    "probability": base_prob,
                    "return_pct":  round((median_price / price - 1) * 100, 1),
                },
                {
                    "label":       "Bear",
                    "price":       bear_price,
                    "probability": bear_prob,
                    "return_pct":  round((bear_price / price - 1) * 100, 1),
                },
            ],
            "model_meta": {
                "version":             "stat-v1.0",
                "method":              "lognormal-drift",
                "directional_accuracy": dir_acc,
                "ann_drift_pct":       round(ann_ret * 100, 1),
                "weights":             {"drift": 0.5, "trend_60d": 0.5},
                "note":                "Statistical model using log-normal price dynamics.",
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        raise HTTPException(400, str(exc))


# ─── Legacy routes (tradingview_mcp) ─────────────────────────────────────────

def _require_tv():
    if not _TV_MCP_AVAILABLE:
        raise HTTPException(503, "tradingview_mcp not available in this environment")


@app.get("/api/price/{symbol}")
def price(symbol: str):
    _require_tv()
    try:
        return get_price(symbol.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/prices")
def prices(symbols: str = Query(..., description="Comma-separated symbols")):
    _require_tv()
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    results = []
    for sym in syms:
        try:
            results.append(get_price(sym))
        except Exception as e:
            results.append({"symbol": sym, "error": str(e)})
    return results


@app.get("/api/snapshot")
def snapshot():
    _require_tv()
    try:
        return get_market_snapshot()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/backtest/{symbol}")
def backtest(
    symbol: str,
    strategy: str = Query("rsi"),
    period:   str = Query("1y"),
    interval: str = Query("1d"),
):
    _require_tv()
    try:
        return run_backtest(symbol.upper(), strategy, period, interval=interval)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/compare/{symbol}")
def compare(symbol: str, period: str = Query("1y")):
    _require_tv()
    try:
        return compare_strategies(symbol.upper(), period)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/walkforward/{symbol}")
def walkforward(
    symbol: str,
    strategy: str = Query("rsi"),
    period:   str = Query("2y"),
    n_splits: int = Query(3),
):
    _require_tv()
    try:
        return walk_forward_backtest(symbol.upper(), strategy, period, n_splits=n_splits)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sentiment/{symbol}")
def sentiment(symbol: str):
    _require_tv()
    try:
        return analyze_sentiment(symbol.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/news/{symbol}")
def news(symbol: str):
    _require_tv()
    try:
        return fetch_news_summary(symbol.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/crypto/overview")
def crypto_overview(limit: int = Query(10, ge=1, le=50)):
    _require_tv()
    try:
        btc_price = get_price("BTC-USD")
        return {
            "btc_price":             btc_price,
            "bitcoin_dominance_pct": get_bitcoin_dominance(),
            "fear_greed_index":      get_bitcoin_fear_greed_index(),
            "exchange_flows":        get_exchange_flows(),
            "large_transactions":    get_large_bitcoin_transactions(5),
            "top_cryptos":           get_crypto_market_data(limit),
            "timestamp":             btc_price.get("timestamp"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/crypto/research")
def crypto_research(period: str = Query("1y")):
    _require_tv()
    try:
        return compare_strategies("BTC-USD", period)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/portfolio/analysis")
def portfolio_analysis(symbols: str = Query(...)):
    _require_tv()
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    results = []
    for sym in syms:
        try:
            price_data = get_price(sym)
            bt = run_backtest(sym, "rsi", "1y")
            results.append({
                "symbol": sym,
                "price":  price_data,
                "backtest": {
                    "return_pct":   bt.get("total_return_pct"),
                    "win_rate":     bt.get("win_rate_pct"),
                    "sharpe":       bt.get("sharpe_ratio"),
                    "max_drawdown": bt.get("max_drawdown_pct"),
                    "total_trades": bt.get("total_trades"),
                },
            })
        except Exception as e:
            results.append({"symbol": sym, "error": str(e)})
    return results


# ═══════════════════════════════════════════════════════════════════════════
# AI BRAIN — autonomous investment intelligence endpoints
# ═══════════════════════════════════════════════════════════════════════════

try:
    from api.brain.claude_brain import generate_report as _brain_report, get_brain_status
    from api.brain.sentiment import fetch_sentiment as _brain_sentiment
    from api.brain.macro import fetch_macro_context as _brain_macro
    from api.brain.ml_forecast import xgb_forecast as _brain_forecast
    from api.brain.portfolio_optimizer import optimize_portfolio as _brain_optimize, compute_correlation_matrix as _brain_corr
    from api.brain.alerts import scan_alerts as _brain_alerts
    _BRAIN_AVAILABLE = True
except ImportError as _brain_err:
    _BRAIN_AVAILABLE = False
    import logging as _bl; _bl.getLogger(__name__).warning("AI Brain import failed: %s", _brain_err)


def _require_brain():
    if not _BRAIN_AVAILABLE:
        raise HTTPException(503, "AI Brain modules not available — check server logs")


@app.get("/api/brain/status")
async def brain_status():
    """Return which AI Brain features are active."""
    if not _BRAIN_AVAILABLE:
        return {
            "claude_available": False,
            "vader_available":  False,
            "macro_available":  False,
            "memory_available": False,
            "model":            "unavailable",
            "brain_available":  False,
        }
    result = await _yf_fetch(get_brain_status, timeout=5.0)
    result["brain_available"] = True
    # Debug: show any env var names containing "ANTHROP" or "CLAUDE" or "API_KEY"
    import os as _os
    result["env_keys_found"] = [
        k for k in _os.environ
        if any(x in k.upper() for x in ("ANTHROP", "CLAUDE", "API_KEY"))
    ]
    return result


@app.get("/api/brain/report/{symbol}")
async def brain_report(
    symbol: str = Path(...),
    include_macro: bool = Query(True),
    use_cache: bool = Query(True),
):
    """
    Generate (or retrieve cached) institutional-grade investment report.
    Powered by Claude AI when ANTHROPIC_API_KEY is set; statistical fallback otherwise.
    """
    _require_brain()
    sym = symbol.upper()
    try:
        report = await _yf_fetch(
            lambda: _brain_report(sym, include_macro=include_macro, use_cache=use_cache),
            timeout=45.0,
        )
        return report
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Brain report failed: {exc}")


@app.get("/api/brain/sentiment/{symbol}")
async def brain_sentiment(symbol: str = Path(...)):
    """News + VADER sentiment analysis for a symbol."""
    _require_brain()
    sym = symbol.upper()
    try:
        return await _yf_fetch(lambda: _brain_sentiment(sym), timeout=15.0)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))


@app.get("/api/brain/macro")
async def brain_macro():
    """FRED macroeconomic indicators: rates, inflation, unemployment, yield curve."""
    _require_brain()
    try:
        return await _yf_fetch(_brain_macro, timeout=12.0)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))


@app.get("/api/brain/forecast/{symbol}")
async def brain_forecast(
    symbol: str = Path(...),
    horizon: int = Query(7, ge=1, le=90),
):
    """XGBoost ML price forecast for 7, 30, or 90 day horizons."""
    _require_brain()
    sym = symbol.upper()
    try:
        return await _yf_fetch(lambda: _brain_forecast(sym, horizon), timeout=30.0)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))


# BaseModel already imported via fastapi/pydantic above; just alias here
try:
    from pydantic import BaseModel as _BaseModel
except ImportError:
    _BaseModel = object  # type: ignore

class _PortfolioOptReq(_BaseModel):
    symbols: List[str]
    current_weights: Optional[Dict[str, float]] = None
    risk_free_rate: float = 0.04


@app.post("/api/brain/portfolio/optimize")
async def brain_portfolio_optimize(req: _PortfolioOptReq):
    """Mean-Variance / Max-Sharpe portfolio optimizer."""
    _require_brain()
    if len(req.symbols) < 2:
        raise HTTPException(422, "Provide at least 2 symbols")
    if len(req.symbols) > 20:
        raise HTTPException(422, "Maximum 20 symbols per optimization request")
    try:
        return await _yf_fetch(
            lambda: _brain_optimize(req.symbols, req.current_weights, req.risk_free_rate),
            timeout=30.0,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))


@app.get("/api/brain/portfolio/correlations")
async def brain_correlations(symbols: str = Query(..., description="Comma-separated symbols")):
    """Correlation matrix for portfolio heatmap."""
    _require_brain()
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()][:20]
    if len(sym_list) < 2:
        raise HTTPException(422, "Provide at least 2 symbols")
    try:
        return await _yf_fetch(lambda: _brain_corr(sym_list), timeout=25.0)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))


@app.get("/api/brain/alerts")
async def brain_alerts(symbols: str = Query(..., description="Comma-separated symbols")):
    """Scan symbols for real-time alerts: RSI extremes, volume spikes, crosses, divergences."""
    _require_brain()
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()][:25]
    if not sym_list:
        raise HTTPException(422, "Provide at least 1 symbol")
    try:
        return await _yf_fetch(lambda: _brain_alerts(sym_list), timeout=40.0)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))


@app.get("/api/brain/forecast-all/{symbol}")
async def brain_forecast_all(symbol: str = Path(...)):
    """Return 7, 30, and 90-day XGBoost forecasts in one call."""
    _require_brain()
    sym = symbol.upper()
    try:
        h7, h30, h90 = await asyncio.gather(
            _yf_fetch(lambda: _brain_forecast(sym, 7),  timeout=30.0),
            _yf_fetch(lambda: _brain_forecast(sym, 30), timeout=30.0),
            _yf_fetch(lambda: _brain_forecast(sym, 90), timeout=30.0),
        )
        return {"symbol": sym, "horizons": {"7d": h7, "30d": h30, "90d": h90}}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)

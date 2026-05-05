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

        ema20  = float(_ema(close, 20).iloc[-1])
        ema50  = float(_ema(close, 50).iloc[-1])
        ema200 = float(_ema(close, 200).iloc[-1])
        rsi14  = float(_rsi(close, 14).iloc[-1])
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

        _sig("EMA Bullish Stack (20>50>200)", ema20 > ema50 > ema200, 25,
             f"EMAs aligned bullishly: {ema20:.2f} > {ema50:.2f} > {ema200:.2f}")
        _sig("Price Above EMA200",            price > ema200,          10,
             f"Price {price:.2f} above 200-EMA {ema200:.2f}")
        _sig("RSI in Sweet Spot (45-70)",     45 <= rsi14 <= 70,       15,
             f"RSI {rsi14:.1f} in momentum zone")
        _sig("MACD Bullish Crossover",        macd_hist > 0 > macd_prev, 20,
             "MACD histogram just turned positive — momentum shift")
        _sig("High Relative Volume",          vol_r > 1.5,              10,
             f"Volume {vol_r:.1f}× above 20-day average")
        _sig("BB Not Overbought (%B < 0.85)", bb_val < 0.85,            10,
             f"Bollinger %B at {bb_val:.2f} — room to run")
        _sig("Near Swing Support",            price <= swing_lo20 * 1.03, 10,
             f"Price within 3% of 20-day swing low {swing_lo20:.2f}")
        if rsi14 > 75:
            score -= 15
            rationale.append(f"RSI {rsi14:.1f} overbought — caution")
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
                "close":     round(price,     2),
                "ema20":     round(ema20,     2),
                "ema50":     round(ema50,     2),
                "ema200":    round(ema200,    2),
                "rsi14":     round(rsi14,     1),
                "atr14":     round(atr14,     4),
                "macd_hist": round(macd_hist, 4),
                "vol_ratio": round(vol_r,     2),
                "vix":       round(vix,       1),
                "bb_pct_b":  round(bb_val,    3),
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)

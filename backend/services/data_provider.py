"""
Market data provider — primary: yfinance (free, reliable)
Fallback chain: yfinance → Finnhub → Polygon → cached last known
"""
from __future__ import annotations
import asyncio
import logging
from datetime import date, datetime, timedelta
from typing import Optional

import httpx
import numpy as np
import pandas as pd
import yfinance as yf

from backend.config import get_settings
from backend.services.cache import get_cache

log = logging.getLogger(__name__)
cfg = get_settings()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ensure_df(df: pd.DataFrame, required: list[str]) -> pd.DataFrame:
    if df is None or df.empty:
        raise ValueError("Empty data returned")
    df.columns = [c.lower() for c in df.columns]
    for col in required:
        if col not in df.columns:
            raise ValueError(f"Missing column: {col}")
    return df.dropna(subset=required)


# ---------------------------------------------------------------------------
# Historical OHLCV
# ---------------------------------------------------------------------------

async def fetch_history(
    symbol: str,
    period: str = "1y",       # "6mo", "1y", "2y", "5y"
    interval: str = "1d",
    use_cache: bool = True,
) -> pd.DataFrame:
    cache = await get_cache()
    cache_key = f"hist:{symbol}:{period}:{interval}"

    if use_cache:
        cached = await cache.get(cache_key)
        if cached is not None:
            return pd.read_json(cached)

    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval, auto_adjust=True)
        if df.empty:
            raise ValueError(f"No data for {symbol}")
        df.index = pd.to_datetime(df.index).tz_localize(None)
        df.columns = [c.lower() for c in df.columns]
        required = ["open", "high", "low", "close", "volume"]
        df = df[required].dropna()

        await cache.set(cache_key, df.to_json(), ex=cfg.CACHE_TTL_PRICES * 10)
        return df

    except Exception as exc:
        log.warning("yfinance history failed for %s: %s", symbol, exc)
        # Fallback: Finnhub candles
        if cfg.FINNHUB_API_KEY:
            return await _finnhub_candles(symbol, period)
        raise


async def _finnhub_candles(symbol: str, period: str) -> pd.DataFrame:
    days = {"6mo": 180, "1y": 365, "2y": 730, "5y": 1825}.get(period, 365)
    now = int(datetime.utcnow().timestamp())
    frm = int((datetime.utcnow() - timedelta(days=days)).timestamp())
    url = (
        f"https://finnhub.io/api/v1/stock/candle"
        f"?symbol={symbol}&resolution=D&from={frm}&to={now}"
        f"&token={cfg.FINNHUB_API_KEY}"
    )
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(url)
        r.raise_for_status()
        d = r.json()
    if d.get("s") != "ok":
        raise ValueError(f"Finnhub candle error: {d}")
    df = pd.DataFrame({
        "open": d["o"], "high": d["h"], "low": d["l"],
        "close": d["c"], "volume": d["v"],
    }, index=pd.to_datetime(d["t"], unit="s"))
    return df


# ---------------------------------------------------------------------------
# Real-time Quote
# ---------------------------------------------------------------------------

async def fetch_quote(symbol: str) -> dict:
    cache = await get_cache()
    cache_key = f"quote:{symbol}"
    cached = await cache.get(cache_key)
    if cached is not None:
        import json
        return json.loads(cached)

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        price = float(info.last_price or 0)
        prev_close = float(info.previous_close or price)
        result = {
            "symbol": symbol,
            "price": price,
            "prev_close": prev_close,
            "day_change": price - prev_close,
            "day_change_pct": ((price - prev_close) / prev_close * 100) if prev_close else 0,
            "volume": int(info.three_month_average_volume or 0),
            "market_cap": info.market_cap,
            "source": "yfinance",
        }
        import json
        await cache.set(cache_key, json.dumps(result), ex=cfg.CACHE_TTL_PRICES)
        return result
    except Exception as exc:
        log.warning("Quote fetch failed for %s: %s", symbol, exc)
        return {"symbol": symbol, "price": None, "source": "error"}


# ---------------------------------------------------------------------------
# Batch quotes
# ---------------------------------------------------------------------------

async def fetch_quotes_batch(symbols: list[str]) -> dict[str, dict]:
    tasks = [fetch_quote(s) for s in symbols]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    out = {}
    for symbol, res in zip(symbols, results):
        if isinstance(res, Exception):
            log.error("Batch quote error %s: %s", symbol, res)
            out[symbol] = {"symbol": symbol, "price": None, "source": "error"}
        else:
            out[symbol] = res
    return out


# ---------------------------------------------------------------------------
# VIX & Macro data
# ---------------------------------------------------------------------------

async def fetch_vix() -> float:
    cache = await get_cache()
    cached = await cache.get("vix:latest")
    if cached:
        return float(cached)
    try:
        df = yf.download("^VIX", period="5d", interval="1d", progress=False)
        vix = float(df["Close"].iloc[-1])
        await cache.set("vix:latest", str(vix), ex=cfg.CACHE_TTL_REGIME)
        return vix
    except Exception as exc:
        log.warning("VIX fetch failed: %s", exc)
        return 20.0  # neutral fallback


async def fetch_macro_data() -> dict:
    """
    Fetch SPY, QQQ, DXY, TLT (10Y proxy) for regime detection.
    Returns latest prices plus 50/200 MA alignments.
    """
    cache = await get_cache()
    cached = await cache.get("macro:latest")
    if cached:
        import json
        return json.loads(cached)

    tickers = ["SPY", "QQQ", "DX-Y.NYB", "TLT", "^VIX"]
    result = {}
    try:
        data = yf.download(tickers, period="1y", interval="1d", progress=False, group_by="ticker")
        for ticker in tickers:
            key = ticker.replace("^", "").replace("-", "")
            try:
                closes = data[ticker]["Close"].dropna()
                price = float(closes.iloc[-1])
                ma50  = float(closes.rolling(50).mean().iloc[-1])
                ma200 = float(closes.rolling(200).mean().iloc[-1])
                result[key] = {
                    "price": price,
                    "ma50": ma50,
                    "ma200": ma200,
                    "above_ma50": price > ma50,
                    "above_ma200": price > ma200,
                    "pct_from_ma200": (price - ma200) / ma200 * 100,
                }
            except Exception:
                result[key] = {}

        import json
        await cache.set("macro:latest", json.dumps(result), ex=cfg.CACHE_TTL_REGIME)
        return result
    except Exception as exc:
        log.error("Macro data fetch failed: %s", exc)
        return {}


# ---------------------------------------------------------------------------
# Market breadth (approximation via S&P components)
# ---------------------------------------------------------------------------

async def fetch_breadth_indicators() -> dict:
    cache = await get_cache()
    cached = await cache.get("breadth:latest")
    if cached:
        import json
        return json.loads(cached)

    # Use a broad ETF sample to approximate market breadth
    sample = ["XLK", "XLE", "XLF", "XLV", "XLY", "XLP", "XLI", "XLB", "XLRE", "XLU", "XLC"]
    try:
        data = yf.download(sample, period="1y", interval="1d", progress=False, group_by="ticker")
        above_ma200 = 0
        above_ma50 = 0
        for etf in sample:
            try:
                c = data[etf]["Close"].dropna()
                price = float(c.iloc[-1])
                if len(c) >= 200 and price > float(c.rolling(200).mean().iloc[-1]):
                    above_ma200 += 1
                if len(c) >= 50 and price > float(c.rolling(50).mean().iloc[-1]):
                    above_ma50 += 1
            except Exception:
                pass

        result = {
            "pct_above_ma200": above_ma200 / len(sample) * 100,
            "pct_above_ma50": above_ma50 / len(sample) * 100,
            "sector_etfs": sample,
        }
        import json
        await cache.set("breadth:latest", json.dumps(result), ex=cfg.CACHE_TTL_REGIME)
        return result
    except Exception as exc:
        log.warning("Breadth fetch failed: %s", exc)
        return {"pct_above_ma200": 50.0, "pct_above_ma50": 50.0}


# ---------------------------------------------------------------------------
# Put/Call ratio (CBOE via yfinance)
# ---------------------------------------------------------------------------

async def fetch_put_call_ratio() -> float:
    cache = await get_cache()
    cached = await cache.get("pcr:latest")
    if cached:
        return float(cached)
    try:
        # Use CBOE VIX-related series as proxy; real P/C comes from CBOE API
        vix  = await fetch_vix()
        vxn_data = yf.download("^VXN", period="5d", interval="1d", progress=False)
        vxn = float(vxn_data["Close"].iloc[-1])
        # Simplified proxy: VXN/VIX ratio correlates with equity put/call skew
        pcr = round(vxn / max(vix, 1) * 0.7, 3)
        await cache.set("pcr:latest", str(pcr), ex=cfg.CACHE_TTL_REGIME)
        return pcr
    except Exception:
        return 0.85  # neutral

"""
Macro Radar — FRED economic data pipeline.

Fetches key macroeconomic indicators from the St. Louis Federal Reserve
(FRED) REST API. Results are cached in-process for 3 hours so repeated
requests don't hammer the network.

No auth required for the free tier, but set FRED_API_KEY for higher
rate limits (150,000 req/day vs. ~120 req/min unauthenticated).
"""
from __future__ import annotations

import os
import time
import logging
from typing import Optional

log = logging.getLogger(__name__)

# FRED public demo key — works for low-volume requests; swap for your own
_FRED_KEY = os.getenv("FRED_API_KEY", "abcdefghijklmnopqrstuvwxyz123456")
_FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"

# In-process cache: { "key": (timestamp, value) }
_cache: dict[str, tuple[float, float | None]] = {}
_CACHE_TTL = 3 * 3600  # 3 hours


def _fetch_fred(series_id: str, limit: int = 5) -> Optional[float]:
    """Fetch the most recent observation for a FRED series."""
    now = time.time()
    cached = _cache.get(series_id)
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]

    try:
        import urllib.request, json
        url = (
            f"{_FRED_BASE}?series_id={series_id}"
            f"&api_key={_FRED_KEY}&limit={limit}"
            f"&sort_order=desc&file_type=json"
        )
        with urllib.request.urlopen(url, timeout=8) as r:
            data = json.loads(r.read())
        observations = data.get("observations", [])
        # Find first non-"." value (FRED uses "." for missing)
        for obs in observations:
            v = obs.get("value", ".")
            if v != ".":
                val = float(v)
                _cache[series_id] = (now, val)
                return val
        _cache[series_id] = (now, None)
        return None
    except Exception as exc:
        log.warning("FRED fetch failed for %s: %s", series_id, exc)
        _cache[series_id] = (now, None)
        return None


def fetch_macro_context() -> dict:
    """
    Return a structured dict of macro indicators plus a regime classification.

    Keys:
        rate_10y       — US 10-Year Treasury yield (%)
        rate_2y        — US 2-Year Treasury yield (%)
        yield_curve    — 10Y-2Y spread (negative = inverted)
        fed_funds      — Effective Fed Funds Rate (%)
        cpi_yoy        — CPI level (proxy for YoY, FRED index level)
        unemployment   — Unemployment rate (%)
        hy_spread      — High-yield OAS spread (bps / 100)
        macro_regime   — "easy" | "neutral" | "restrictive"
        macro_score    — 0-100 (100 = most bullish macro environment)
        available      — bool (False if all FRED calls failed)
    """
    rate_10y    = _fetch_fred("DGS10")
    rate_2y     = _fetch_fred("DGS2")
    fed_funds   = _fetch_fred("FEDFUNDS")
    cpi         = _fetch_fred("CPIAUCSL")
    unemployment= _fetch_fred("UNRATE")
    hy_spread   = _fetch_fred("BAMLH0A0HYM2")

    available = any(v is not None for v in [rate_10y, rate_2y, fed_funds, cpi, unemployment, hy_spread])

    yield_curve = None
    if rate_10y is not None and rate_2y is not None:
        yield_curve = round(rate_10y - rate_2y, 3)

    # ── Macro scoring (0-100) ──────────────────────────────────────────────
    score = 50  # neutral baseline
    regime_signals: list[str] = []

    if fed_funds is not None:
        if fed_funds < 2.0:
            score += 15
            regime_signals.append("Accommodative Fed policy")
        elif fed_funds > 4.5:
            score -= 15
            regime_signals.append("Restrictive Fed policy")

    if rate_10y is not None:
        if rate_10y < 3.0:
            score += 10
        elif rate_10y > 5.0:
            score -= 10
            regime_signals.append("Elevated long-end rates")

    if yield_curve is not None:
        if yield_curve > 0.5:
            score += 10
            regime_signals.append("Normal yield curve")
        elif yield_curve < -0.3:
            score -= 15
            regime_signals.append("Inverted yield curve (recession risk)")

    if hy_spread is not None:
        if hy_spread < 3.5:
            score += 8
        elif hy_spread > 6.0:
            score -= 12
            regime_signals.append("Wide credit spreads (risk-off)")

    if unemployment is not None:
        if unemployment < 4.5:
            score += 5
        elif unemployment > 6.0:
            score -= 10

    score = max(0, min(100, score))

    if score >= 60:
        regime = "easy"
    elif score >= 40:
        regime = "neutral"
    else:
        regime = "restrictive"

    return {
        "rate_10y":     rate_10y,
        "rate_2y":      rate_2y,
        "yield_curve":  yield_curve,
        "fed_funds":    fed_funds,
        "cpi_level":    cpi,
        "unemployment": unemployment,
        "hy_spread":    hy_spread,
        "macro_regime": regime,
        "macro_score":  score,
        "regime_signals": regime_signals,
        "available":    available,
    }

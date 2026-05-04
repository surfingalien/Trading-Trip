"""
Market Regime Classifier — real-time macro context that auto-adjusts
trading recommendations across the entire application.

Regime labels:
  • bullish_trend      — SPY above both MAs, low VIX, positive breadth
  • bearish_trend      — SPY below both MAs, elevated VIX, weak breadth
  • range_bound        — mixed MA alignment, VIX 15-20, flat breadth
  • high_vol_stress    — VIX > 25, SPY below 200MA or rapid decline

GET /api/regime
"""
from __future__ import annotations
import logging
from dataclasses import dataclass, asdict
from typing import Optional

import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel

from backend.services.cache import get_cache
from backend.services.data_provider import (
    fetch_macro_data, fetch_vix, fetch_breadth_indicators, fetch_put_call_ratio,
)
from backend.config import get_settings

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/regime", tags=["Market Regime"])
cfg = get_settings()

# ---------------------------------------------------------------------------
# Regime constants
# ---------------------------------------------------------------------------

REGIME_BULLISH     = "bullish_trend"
REGIME_BEARISH     = "bearish_trend"
REGIME_RANGE_BOUND = "range_bound"
REGIME_HIGH_VOL    = "high_vol_stress"


# ---------------------------------------------------------------------------
# Data class for raw indicators
# ---------------------------------------------------------------------------

@dataclass
class MacroSnapshot:
    vix: float
    spy_above_ma50: bool
    spy_above_ma200: bool
    spy_pct_from_ma200: float
    qqq_above_ma50: bool
    qqq_above_ma200: bool
    pct_above_ma200: float       # breadth: % sector ETFs above 200MA
    pct_above_ma50: float
    put_call_ratio: float
    tlt_above_ma200: bool        # TLT proxy for 10Y bond trend
    dxy_above_ma50: bool         # DXY strength


# ---------------------------------------------------------------------------
# Scoring model
# ---------------------------------------------------------------------------

def _score_regime(snap: MacroSnapshot) -> dict[str, float]:
    """
    Returns a probability-like score for each regime (sum ≠ 1 — these are
    independent voting scores, not a softmax distribution).
    """
    scores = {
        REGIME_BULLISH: 0.0,
        REGIME_BEARISH: 0.0,
        REGIME_RANGE_BOUND: 0.0,
        REGIME_HIGH_VOL: 0.0,
    }

    # --- VIX votes ---
    if snap.vix < 15:
        scores[REGIME_BULLISH] += 30
    elif snap.vix < 20:
        scores[REGIME_BULLISH] += 15
        scores[REGIME_RANGE_BOUND] += 10
    elif snap.vix < 25:
        scores[REGIME_RANGE_BOUND] += 20
        scores[REGIME_BEARISH] += 10
    elif snap.vix < 35:
        scores[REGIME_HIGH_VOL] += 35
        scores[REGIME_BEARISH] += 15
    else:
        scores[REGIME_HIGH_VOL] += 50

    # --- SPY MA alignment ---
    if snap.spy_above_ma50 and snap.spy_above_ma200:
        scores[REGIME_BULLISH] += 25
    elif snap.spy_above_ma200 and not snap.spy_above_ma50:
        scores[REGIME_RANGE_BOUND] += 20
    elif not snap.spy_above_ma50 and not snap.spy_above_ma200:
        scores[REGIME_BEARISH] += 30
        scores[REGIME_HIGH_VOL] += 10

    # --- QQQ (tech confirmation) ---
    if snap.qqq_above_ma50 and snap.qqq_above_ma200:
        scores[REGIME_BULLISH] += 15
    elif not snap.qqq_above_ma50:
        scores[REGIME_BEARISH] += 10

    # --- Breadth ---
    if snap.pct_above_ma200 > 70:
        scores[REGIME_BULLISH] += 15
    elif snap.pct_above_ma200 > 50:
        scores[REGIME_BULLISH] += 5
        scores[REGIME_RANGE_BOUND] += 10
    elif snap.pct_above_ma200 > 30:
        scores[REGIME_RANGE_BOUND] += 15
    else:
        scores[REGIME_BEARISH] += 20

    # --- Put/call ratio ---
    if snap.put_call_ratio < 0.7:
        scores[REGIME_BULLISH] += 8          # complacency (mild)
    elif snap.put_call_ratio > 1.2:
        scores[REGIME_BEARISH] += 10         # fear / hedging
        scores[REGIME_HIGH_VOL] += 5

    # --- Bond trend (TLT above 200MA → risk-off environment) ---
    if snap.tlt_above_ma200:
        scores[REGIME_BEARISH] += 8
        scores[REGIME_HIGH_VOL] += 5
    else:
        scores[REGIME_BULLISH] += 8

    # --- DXY strength ---
    if snap.dxy_above_ma50:
        scores[REGIME_BEARISH] += 5          # strong USD tends to weigh on risk assets
    else:
        scores[REGIME_BULLISH] += 5

    # --- SPY distance from 200MA ---
    if snap.spy_pct_from_ma200 < -10:
        scores[REGIME_HIGH_VOL] += 15
        scores[REGIME_BEARISH] += 10

    return scores


def _classify(scores: dict[str, float]) -> tuple[str, float]:
    best_regime = max(scores, key=lambda k: scores[k])
    total = sum(scores.values()) or 1
    confidence = round(scores[best_regime] / total * 100, 1)
    return best_regime, confidence


# ---------------------------------------------------------------------------
# Strategy recommendations per regime
# ---------------------------------------------------------------------------

_REGIME_META = {
    REGIME_BULLISH: {
        "label": "Bullish Trend",
        "emoji": "🟢",
        "recommended_action": (
            "Favor long positions in high-beta, high-momentum names. "
            "Use standard 1–1.5× ATR stops. Sector leaders in Tech, Consumer Discretionary, Financials."
        ),
        "risk_environment": "LOW — Normal position sizing, tight stops acceptable.",
        "position_size_adj": 1.0,
        "stop_atr_mult": 1.5,
        "preferred_sectors": ["Technology", "Consumer Discretionary", "Financials", "Industrials"],
        "avoid_sectors": [],
        "strategy_notes": [
            "Run momentum screens: RSI > 50, price above 50-EMA",
            "Target R:R ≥ 1:2 with trailing stops after +8% gain",
            "Watch for sector rotation signals weekly",
        ],
    },
    REGIME_BEARISH: {
        "label": "Bearish Trend",
        "emoji": "🔴",
        "recommended_action": (
            "Reduce equity exposure. Defensive positioning: Consumer Staples, Healthcare, Utilities. "
            "Avoid leveraged positions. Consider cash or inverse ETFs for hedging."
        ),
        "risk_environment": "HIGH — Reduce position size by 30-50%. Widen stops.",
        "position_size_adj": 0.6,
        "stop_atr_mult": 2.0,
        "preferred_sectors": ["Consumer Staples", "Healthcare", "Utilities"],
        "avoid_sectors": ["Technology", "Consumer Discretionary"],
        "strategy_notes": [
            "Prioritize capital preservation over returns",
            "Only trade with the trend — short setups or cash",
            "Do not buy dips unless confirmed reversal with high breadth",
        ],
    },
    REGIME_RANGE_BOUND: {
        "label": "Range-Bound",
        "emoji": "🟡",
        "recommended_action": (
            "Mean-reversion strategies outperform. Buy near support, sell near resistance. "
            "Tight ranges — reduce position size by 20%."
        ),
        "risk_environment": "MODERATE — Standard stops, moderate sizing.",
        "position_size_adj": 0.8,
        "stop_atr_mult": 1.5,
        "preferred_sectors": ["Consumer Staples", "Healthcare", "Dividend/Value"],
        "avoid_sectors": ["Micro-cap", "High-beta growth"],
        "strategy_notes": [
            "Target shorter hold periods (days not weeks)",
            "Use Bollinger Band extremes for entries",
            "Avoid breakout strategies — whipsaws likely",
        ],
    },
    REGIME_HIGH_VOL: {
        "label": "High Volatility / Stress",
        "emoji": "🚨",
        "recommended_action": (
            "DEFENSIVE MODE: Widen all stops to 2× ATR. Halve position sizes. "
            "Avoid new long entries. Hold cash or short-duration Treasuries. "
            "Hedges (puts, inverse ETFs) are appropriate."
        ),
        "risk_environment": "EXTREME — Cut position size by 50%. Priority is capital preservation.",
        "position_size_adj": 0.5,
        "stop_atr_mult": 2.5,
        "preferred_sectors": ["Cash", "Gold (GLD)", "Short-term Treasuries (SHY/BIL)"],
        "avoid_sectors": ["All speculative growth", "Crypto-adjacent"],
        "strategy_notes": [
            "Do not bottom-fish — wait for VIX < 25 and SPY reclaiming 50-MA",
            "Vol is a risk, not an opportunity (without explicit vol strategy)",
            "Review stop-losses daily; consider tightening open positions",
        ],
    },
}


# ---------------------------------------------------------------------------
# Response model
# ---------------------------------------------------------------------------

class SectorRotation(BaseModel):
    etf: str
    name: str
    above_ma50: Optional[bool]
    above_ma200: Optional[bool]
    pct_from_ma200: Optional[float]


class RegimeResponse(BaseModel):
    regime: str
    label: str
    emoji: str
    confidence: float
    vix: float
    recommended_action: str
    risk_environment: str
    position_size_adj: float
    stop_atr_mult: float
    preferred_sectors: list[str]
    avoid_sectors: list[str]
    strategy_notes: list[str]
    indicators: dict
    sector_rotation: list[SectorRotation]
    last_updated: str
    source: str


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("", response_model=RegimeResponse)
async def get_market_regime():
    cache = await get_cache()
    cached = await cache.get_json("regime:latest")
    if cached:
        return RegimeResponse(**cached)

    # --- Fetch all macro data concurrently ---
    import asyncio
    vix_task     = fetch_vix()
    macro_task   = fetch_macro_data()
    breadth_task = fetch_breadth_indicators()
    pcr_task     = fetch_put_call_ratio()

    vix, macro, breadth, pcr = await asyncio.gather(
        vix_task, macro_task, breadth_task, pcr_task, return_exceptions=True
    )
    if isinstance(vix, Exception):     vix     = 20.0
    if isinstance(macro, Exception):   macro   = {}
    if isinstance(breadth, Exception): breadth = {}
    if isinstance(pcr, Exception):     pcr     = 0.85

    def _safe(d, *keys, default=None):
        for k in keys:
            if not isinstance(d, dict):
                return default
            d = d.get(k, default)
        return d

    spy  = macro.get("SPY", {})
    qqq  = macro.get("QQQ", {})
    tlt  = macro.get("TLT", {})
    dxy  = macro.get("DXYNYB", {}) or macro.get("DX-Y.NYB", {})

    snap = MacroSnapshot(
        vix=vix,
        spy_above_ma50=bool(spy.get("above_ma50", False)),
        spy_above_ma200=bool(spy.get("above_ma200", False)),
        spy_pct_from_ma200=float(spy.get("pct_from_ma200", 0)),
        qqq_above_ma50=bool(qqq.get("above_ma50", False)),
        qqq_above_ma200=bool(qqq.get("above_ma200", False)),
        pct_above_ma200=float(breadth.get("pct_above_ma200", 50)),
        pct_above_ma50=float(breadth.get("pct_above_ma50", 50)),
        put_call_ratio=float(pcr),
        tlt_above_ma200=bool(tlt.get("above_ma200", False)),
        dxy_above_ma50=bool(dxy.get("above_ma50", False)),
    )

    scores = _score_regime(snap)
    regime, confidence = _classify(scores)
    meta = _REGIME_META[regime]

    # --- Sector rotation ---
    sector_etfs = {
        "XLK": "Technology", "XLE": "Energy", "XLF": "Financials",
        "XLV": "Healthcare", "XLY": "Consumer Discr.", "XLP": "Consumer Staples",
        "XLI": "Industrials", "XLRE": "Real Estate", "XLU": "Utilities",
    }
    sector_rotation = []
    for etf, name in sector_etfs.items():
        etf_data = macro.get(etf, {})
        sector_rotation.append(SectorRotation(
            etf=etf, name=name,
            above_ma50=etf_data.get("above_ma50"),
            above_ma200=etf_data.get("above_ma200"),
            pct_from_ma200=etf_data.get("pct_from_ma200"),
        ))

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    response = RegimeResponse(
        regime=regime,
        label=meta["label"],
        emoji=meta["emoji"],
        confidence=confidence,
        vix=round(vix, 2),
        recommended_action=meta["recommended_action"],
        risk_environment=meta["risk_environment"],
        position_size_adj=meta["position_size_adj"],
        stop_atr_mult=meta["stop_atr_mult"],
        preferred_sectors=meta["preferred_sectors"],
        avoid_sectors=meta["avoid_sectors"],
        strategy_notes=meta["strategy_notes"],
        indicators={
            "spy_price": spy.get("price"),
            "spy_ma50": spy.get("ma50"),
            "spy_ma200": spy.get("ma200"),
            "spy_above_ma50": snap.spy_above_ma50,
            "spy_above_ma200": snap.spy_above_ma200,
            "spy_pct_from_ma200": round(snap.spy_pct_from_ma200, 2),
            "vix": round(vix, 2),
            "put_call_ratio": round(pcr, 3),
            "pct_above_ma200": round(snap.pct_above_ma200, 1),
            "pct_above_ma50": round(snap.pct_above_ma50, 1),
            "regime_scores": {k: round(v, 1) for k, v in scores.items()},
        },
        sector_rotation=sector_rotation,
        last_updated=now,
        source="live",
    )

    await cache.set_json("regime:latest", response.model_dump(), ex=cfg.CACHE_TTL_REGIME)
    return response

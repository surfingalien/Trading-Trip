"""
Trading Tips Engine — Rule-based signal generation with position sizing.

Produces structured trade plans:
  • Entry zone (low / high)
  • Stop-loss (ATR-based, structural, volatility-adjusted)
  • Take-profit targets (TP1 = 1R, TP2 = 2R)
  • Position size (1% portfolio risk)
  • Risk-reward validation (reject < 1:2)
  • Confidence score (0–100)
  • Rationale breakdown by signal category

GET /api/tips/{symbol}?portfolio_equity=100000
"""
from __future__ import annotations
import logging
import math
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.services.cache import get_cache
from backend.services.data_provider import fetch_history, fetch_vix
from backend.config import get_settings

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tips", tags=["Trading Tips"])
cfg = get_settings()

# ---------------------------------------------------------------------------
# Technical indicator helpers (pure numpy/pandas — no TA-Lib dependency)
# ---------------------------------------------------------------------------

def ema(series: pd.Series, n: int) -> pd.Series:
    return series.ewm(span=n, adjust=False).mean()


def rsi(series: pd.Series, n: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(n).mean()
    loss = (-delta.clip(upper=0)).rolling(n).mean()
    rs     = gain / loss.replace(0, np.nan)
    result = 100 - 100 / (1 + rs)
    # Pure uptrend: loss == 0 after window fills → RSI should be 100
    result = result.where(~((loss == 0) & gain.notna()), other=100.0)
    return result


def macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    fast_ema = ema(series, fast)
    slow_ema = ema(series, slow)
    macd_line = fast_ema - slow_ema
    signal_line = ema(macd_line, signal)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def atr(high: pd.Series, low: pd.Series, close: pd.Series, n: int = 14) -> pd.Series:
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low - close.shift()).abs(),
    ], axis=1).max(axis=1)
    return tr.ewm(span=n, adjust=False).mean()


def bollinger_bands(close: pd.Series, n: int = 20, k: float = 2.0):
    sma    = close.rolling(n).mean()
    std    = close.rolling(n).std()
    upper  = sma + k * std
    lower  = sma - k * std
    pct_b  = (close - lower) / (upper - lower).replace(0, np.nan)
    width  = (upper - lower) / sma.replace(0, np.nan)
    return upper, sma, lower, pct_b, width


def volume_ratio(vol: pd.Series, n: int = 20) -> pd.Series:
    avg = vol.rolling(n).mean()
    return vol / avg.replace(0, np.nan)


def swing_low(low: pd.Series, lookback: int = 20) -> float:
    return float(low.tail(lookback).min())


def swing_high(high: pd.Series, lookback: int = 20) -> float:
    return float(high.tail(lookback).max())


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class TechnicalContext:
    close: float
    ema20: float
    ema50: float
    ema200: float
    rsi14: float
    macd_hist: float
    macd_prev: float
    atr14: float
    vol_ratio: float
    bb_pct_b: float
    swing_lo20: float
    swing_hi20: float
    swing_lo60: float
    support_zones: list[float] = field(default_factory=list)


@dataclass
class SignalScore:
    score: float = 0.0
    rationale: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Signal detection
# ---------------------------------------------------------------------------

def _detect_entry_signals(ctx: TechnicalContext, vix: float) -> SignalScore:
    sig = SignalScore()

    # ---- EMA trend alignment ----
    if ctx.ema20 > ctx.ema50 > ctx.ema200:
        sig.score += 20
        sig.rationale.append("EMA stack bullish (20 > 50 > 200)")
    elif ctx.ema20 > ctx.ema50:
        sig.score += 10
        sig.rationale.append("Short-term EMA bullish (20 > 50)")

    # ---- Breakout above EMA + volume surge ----
    if ctx.close > ctx.ema50 and ctx.vol_ratio > 1.5:
        sig.score += 15
        sig.rationale.append(f"Breakout above 50-EMA with {ctx.vol_ratio:.1f}x volume surge")

    # ---- RSI momentum ----
    if 50 < ctx.rsi14 < 70:
        sig.score += 12
        sig.rationale.append(f"RSI {ctx.rsi14:.1f} in bullish momentum zone (50-70)")
    elif ctx.rsi14 > 70:
        sig.score -= 5
        sig.rationale.append(f"RSI {ctx.rsi14:.1f} overbought — caution")
    elif ctx.rsi14 < 40:
        sig.score -= 8
        sig.rationale.append(f"RSI {ctx.rsi14:.1f} below 40 — no momentum")

    # ---- MACD histogram turning positive ----
    if ctx.macd_hist > 0 > ctx.macd_prev:
        sig.score += 18
        sig.rationale.append("MACD histogram crossed above zero (bullish crossover)")
    elif ctx.macd_hist > 0:
        sig.score += 8
        sig.rationale.append("MACD histogram positive (upward momentum)")

    # ---- Bollinger %B ----
    if 0.4 <= ctx.bb_pct_b <= 0.75:
        sig.score += 7
        sig.rationale.append(f"Bollinger %B at {ctx.bb_pct_b:.2f} (mid-band momentum)")
    elif ctx.bb_pct_b > 0.95:
        sig.score -= 5
        sig.rationale.append("Near upper Bollinger band — extended")

    # ---- Near support zone ----
    if ctx.swing_lo20 > 0 and (ctx.close - ctx.swing_lo20) / ctx.close < 0.03:
        sig.score += 10
        sig.rationale.append("Near 20-session swing low support")

    # ---- VIX adjustment ----
    if vix > 30:
        sig.score -= 10
        sig.rationale.append(f"High VIX ({vix:.1f}) — elevated market stress reduces conviction")
    elif vix < 15:
        sig.score += 5
        sig.rationale.append(f"Low VIX ({vix:.1f}) — calm market environment")

    return sig


def _compute_entry_zone(ctx: TechnicalContext) -> tuple[float, float]:
    """Entry zone: current close ±0.5 ATR, pulled toward nearest support."""
    entry_mid  = ctx.close
    entry_low  = round(max(ctx.close - 0.5 * ctx.atr14, ctx.swing_lo20 * 0.995), 2)
    entry_high = round(ctx.close + 0.3 * ctx.atr14, 2)
    return entry_low, entry_high


# ---------------------------------------------------------------------------
# Stop-loss calculation (ATR + structural + volatility-adjusted)
# ---------------------------------------------------------------------------

def compute_stop_loss(ctx: TechnicalContext, vix: float, entry: float) -> dict:
    """
    Returns the tightest defensible stop-loss using three methods.
    In high-VIX regimes stop is widened; in low-VIX it's tightened.
    """
    atr_mult = 1.5
    if vix > 25:
        atr_mult = 2.0     # widen in stress
    elif vix < 15:
        atr_mult = 1.2     # tighten in calm markets

    # ATR-based
    atr_stop = round(entry - atr_mult * ctx.atr14, 2)

    # Structural: below swing low OR 200 EMA, whichever is closer (tighter)
    structural_candidates = [ctx.swing_lo20 * 0.99, ctx.ema200 * 0.99]
    structural_stop = max([s for s in structural_candidates if s < entry] or [atr_stop])
    structural_stop = round(structural_stop, 2)

    # Choose the tighter of ATR vs structural (higher price = smaller loss)
    best_stop = max(atr_stop, structural_stop)

    return {
        "stop_loss": best_stop,
        "atr_stop": atr_stop,
        "structural_stop": structural_stop,
        "atr_multiple": atr_mult,
        "method": "atr" if atr_stop > structural_stop else "structural",
    }


# ---------------------------------------------------------------------------
# Position sizing
# ---------------------------------------------------------------------------

def compute_position_size(
    portfolio_equity: float,
    entry: float,
    stop_loss: float,
    max_allocation_pct: float = 0.05,
    risk_pct: float = 0.01,
) -> dict:
    """
    Shares = (portfolio × risk_pct) / (entry - stop_loss)
    Capped at max_allocation_pct of portfolio.
    """
    risk_per_share = entry - stop_loss
    if risk_per_share <= 0:
        return {"error": "Stop loss must be below entry"}

    dollar_risk   = portfolio_equity * risk_pct
    raw_shares    = dollar_risk / risk_per_share
    max_shares    = (portfolio_equity * max_allocation_pct) / entry
    shares        = min(raw_shares, max_shares)

    position_value     = round(shares * entry, 2)
    position_pct       = round(position_value / portfolio_equity * 100, 2)
    actual_dollar_risk = round(shares * risk_per_share, 2)

    return {
        "shares": round(shares, 4),
        "position_value": position_value,
        "position_pct": position_pct,
        "dollar_risk": actual_dollar_risk,
        "risk_pct": round(actual_dollar_risk / portfolio_equity * 100, 3),
        "capped_by_allocation": shares < raw_shares,
    }


# ---------------------------------------------------------------------------
# Risk/reward validation and take-profit targets
# ---------------------------------------------------------------------------

def compute_targets(entry: float, stop_loss: float, min_rr: float = 2.0) -> Optional[dict]:
    """Returns TP1 (1R), TP2 (2R), TP3 (3R). Rejects if R:R < min_rr."""
    risk = entry - stop_loss
    if risk <= 0:
        return None
    tp1 = round(entry + 1 * risk, 2)
    tp2 = round(entry + 2 * risk, 2)
    tp3 = round(entry + 3 * risk, 2)
    rr  = round(tp2 / entry / (stop_loss / entry), 2)
    # Simple R:R = reward/risk
    reward = tp2 - entry
    rr_ratio = reward / risk

    if rr_ratio < min_rr:
        return None

    return {
        "tp1": tp1, "tp1_r": "1R",
        "tp2": tp2, "tp2_r": "2R",
        "tp3": tp3, "tp3_r": "3R",
        "rr_ratio": round(rr_ratio, 2),
        "risk_per_share": round(risk, 2),
    }


# ---------------------------------------------------------------------------
# Trailing stop logic (activate after +8% gain)
# ---------------------------------------------------------------------------

def trailing_stop_rule(entry: float, atr14: float) -> dict:
    activation_pct = 0.08
    activation_price = round(entry * (1 + activation_pct), 2)
    trail_atr = round(2 * atr14, 2)
    trail_pct = 0.15

    return {
        "activation_price": activation_price,
        "activation_pct": activation_pct * 100,
        "trail_atr": trail_atr,
        "trail_pct": trail_pct * 100,
        "note": f"Activate trailing stop at +{activation_pct*100:.0f}% gain. "
                f"Trail by max(2×ATR={trail_atr:.2f}, 15%) below peak.",
    }


# ---------------------------------------------------------------------------
# Main analysis pipeline
# ---------------------------------------------------------------------------

async def _build_technical_context(symbol: str) -> TechnicalContext:
    df = await fetch_history(symbol, period="1y", interval="1d")

    close = df["close"]
    high  = df["high"]
    low   = df["low"]
    vol   = df["volume"]

    e20  = ema(close, 20)
    e50  = ema(close, 50)
    e200 = ema(close, 200)
    r14  = rsi(close, 14)
    _, _, hist = macd(close)
    a14  = atr(high, low, close, 14)
    vr   = volume_ratio(vol, 20)
    _, _, _, pct_b, _ = bollinger_bands(close, 20)

    return TechnicalContext(
        close=float(close.iloc[-1]),
        ema20=float(e20.iloc[-1]),
        ema50=float(e50.iloc[-1]),
        ema200=float(e200.iloc[-1]),
        rsi14=float(r14.iloc[-1]),
        macd_hist=float(hist.iloc[-1]),
        macd_prev=float(hist.iloc[-2]),
        atr14=float(a14.iloc[-1]),
        vol_ratio=float(vr.iloc[-1]),
        bb_pct_b=float(pct_b.iloc[-1]),
        swing_lo20=swing_low(low, 20),
        swing_hi20=swing_high(high, 20),
        swing_lo60=swing_low(low, 60),
    )


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class PositionSizeResult(BaseModel):
    shares: float
    position_value: float
    position_pct: float
    dollar_risk: float
    risk_pct: float
    capped_by_allocation: bool


class StopLossResult(BaseModel):
    stop_loss: float
    atr_stop: float
    structural_stop: float
    atr_multiple: float
    method: str


class TargetsResult(BaseModel):
    tp1: float
    tp1_r: str
    tp2: float
    tp2_r: str
    tp3: float
    tp3_r: str
    rr_ratio: float
    risk_per_share: float


class TradeSignal(BaseModel):
    symbol: str
    signal_type: str           # buy_setup | sell_setup | neutral | no_signal
    confidence: float          # 0-100
    entry_low: float
    entry_high: float
    stop_loss: StopLossResult
    targets: Optional[TargetsResult]
    position_size: Optional[PositionSizeResult]
    trailing_stop: dict
    technicals: dict
    rationale: dict            # {technical:[], risk:[], sizing:[]}
    regime_note: str
    disclaimer: str


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/{symbol}", response_model=TradeSignal)
async def get_trading_tips(
    symbol: str,
    portfolio_equity: float = Query(100_000, ge=1000, description="Total portfolio equity in USD"),
):
    symbol = symbol.upper().strip()
    cache = await get_cache()
    cache_key = f"tips:{symbol}:{int(portfolio_equity/1000)}"
    cached = await cache.get_json(cache_key)
    if cached:
        return TradeSignal(**cached)

    try:
        ctx = await _build_technical_context(symbol)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not fetch data for {symbol}: {exc}")

    vix = await fetch_vix()

    # --- Entry signals ---
    signals = _detect_entry_signals(ctx, vix)
    confidence = max(0, min(100, signals.score))

    # --- Signal type ---
    if confidence >= 50:
        signal_type = "buy_setup"
    elif confidence <= 15:
        signal_type = "no_signal"
    else:
        signal_type = "neutral"

    # --- Entry zone ---
    entry_low, entry_high = _compute_entry_zone(ctx)
    entry_mid = (entry_low + entry_high) / 2

    # --- Stop-loss ---
    sl_data = compute_stop_loss(ctx, vix, entry_mid)
    stop_loss_result = StopLossResult(**sl_data)

    # --- Targets ---
    targets_data = compute_targets(entry_mid, sl_data["stop_loss"])
    targets_result = TargetsResult(**targets_data) if targets_data else None

    if targets_data is None and signal_type == "buy_setup":
        signal_type = "neutral"
        signals.rationale.append("R:R < 1:2 — trade plan rejected, waiting for better entry")
        confidence = min(confidence, 45)

    # --- Position sizing ---
    sizing = compute_position_size(portfolio_equity, entry_mid, sl_data["stop_loss"])
    sizing_result = PositionSizeResult(**sizing) if "error" not in sizing else None

    # --- Trailing stop ---
    trailing = trailing_stop_rule(entry_mid, ctx.atr14)

    # --- Regime note ---
    if vix > 30:
        regime_note = f"HIGH VOLATILITY (VIX {vix:.1f}) — widen stops, reduce size, prefer quality names."
    elif vix > 20:
        regime_note = f"ELEVATED VOLATILITY (VIX {vix:.1f}) — maintain disciplined stops."
    else:
        regime_note = f"NORMAL VOLATILITY (VIX {vix:.1f}) — standard position sizing applies."

    # --- Technicals summary ---
    technicals = {
        "price": ctx.close,
        "ema20": round(ctx.ema20, 2),
        "ema50": round(ctx.ema50, 2),
        "ema200": round(ctx.ema200, 2),
        "rsi14": round(ctx.rsi14, 1),
        "macd_hist": round(ctx.macd_hist, 4),
        "atr14": round(ctx.atr14, 2),
        "volume_ratio": round(ctx.vol_ratio, 2),
        "bb_pct_b": round(ctx.bb_pct_b, 3),
        "swing_low_20d": ctx.swing_lo20,
        "swing_high_20d": ctx.swing_hi20,
        "vix": vix,
    }

    result = TradeSignal(
        symbol=symbol,
        signal_type=signal_type,
        confidence=round(confidence, 1),
        entry_low=entry_low,
        entry_high=entry_high,
        stop_loss=stop_loss_result,
        targets=targets_result,
        position_size=sizing_result,
        trailing_stop=trailing,
        technicals=technicals,
        rationale={
            "technical": signals.rationale,
            "risk": [
                f"Stop method: {sl_data['method']} ({sl_data['atr_multiple']}× ATR)",
                f"Max risk per trade: 1% of equity = ${portfolio_equity * 0.01:,.0f}",
                f"Position cap: 5% allocation = ${portfolio_equity * 0.05:,.0f}",
            ],
            "sizing": [
                f"Entry: ${entry_mid:.2f} | Stop: ${sl_data['stop_loss']:.2f} | Risk/share: ${entry_mid - sl_data['stop_loss']:.2f}",
                f"Shares: {sizing_result.shares if sizing_result else '—'} | Position: ${sizing_result.position_value if sizing_result else '—':,}",
                f"Allocation: {sizing_result.position_pct if sizing_result else '—'}%",
            ],
        },
        regime_note=regime_note,
        disclaimer="This signal is rule-based and educational. Not financial advice. Always use stop-losses and consult a fiduciary before trading.",
    )

    await cache.set_json(cache_key, result.model_dump(), ex=3600)
    return result

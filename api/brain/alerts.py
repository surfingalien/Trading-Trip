"""
Alert Engine — real-time anomaly detection across a watchlist.

Detects: RSI extremes, volume spikes, Bollinger squeeze/breakouts,
EMA death cross, MACD divergence, approaching earnings.
"""
from __future__ import annotations

import time
import logging
from datetime import datetime, timezone
from typing import List

import numpy as np

log = logging.getLogger(__name__)

try:
    import pandas as pd
    import yfinance as yf
    _DATA_AVAILABLE = True
except ImportError:
    _DATA_AVAILABLE = False

# Cache: "symbol_list_key" -> (timestamp, alerts)
_cache: dict[str, tuple[float, list]] = {}
_CACHE_TTL = 1800  # 30 minutes


# ── Shared TA helpers (self-contained) ──────────────────────────────────────

def _ema(s: "pd.Series", n: int) -> "pd.Series":
    return s.ewm(span=n, adjust=False).mean()


def _rsi(s: "pd.Series", n: int = 14) -> "pd.Series":
    d = s.diff()
    g = d.clip(lower=0).rolling(n).mean()
    l_ = (-d.clip(upper=0)).rolling(n).mean()
    return 100 - 100 / (1 + g / l_.replace(0, np.nan))


def _atr(h: "pd.Series", l: "pd.Series", c: "pd.Series", n: int = 14) -> "pd.Series":
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    return tr.ewm(span=n, adjust=False).mean()


def _scan_symbol(sym: str) -> list[dict]:
    """Run all alert checks for a single symbol. Returns list of triggered alerts."""
    alerts = []
    try:
        df = yf.Ticker(sym).history(period="1y", auto_adjust=True)
        if df is None or len(df) < 30:
            return alerts

        close  = df["Close"]
        high   = df["High"]
        low    = df["Low"]
        volume = df["Volume"]
        price  = float(close.iloc[-1])
        now_ts = datetime.now(timezone.utc).isoformat()

        # ── RSI Extreme ───────────────────────────────────────────────────────
        rsi14 = _rsi(close, 14)
        rsi_val = float(rsi14.iloc[-1])
        if rsi_val > 80:
            alerts.append({
                "symbol":    sym, "type": "RSI_OVERBOUGHT",
                "severity":  "high",
                "message":   f"RSI at {rsi_val:.1f} — extremely overbought, reversal risk",
                "value":     round(rsi_val, 1), "triggered_at": now_ts,
            })
        elif rsi_val < 20:
            alerts.append({
                "symbol":    sym, "type": "RSI_OVERSOLD",
                "severity":  "medium",
                "message":   f"RSI at {rsi_val:.1f} — deeply oversold, bounce watch",
                "value":     round(rsi_val, 1), "triggered_at": now_ts,
            })

        # ── Volume Spike ──────────────────────────────────────────────────────
        vol_ma20 = volume.rolling(20).mean()
        if not vol_ma20.empty and float(vol_ma20.iloc[-1]) > 0:
            vol_ratio = float(volume.iloc[-1]) / float(vol_ma20.iloc[-1])
            if vol_ratio > 3.0:
                alerts.append({
                    "symbol":   sym, "type": "VOLUME_SPIKE",
                    "severity": "high",
                    "message":  f"Volume {vol_ratio:.1f}× above 20-day avg — institutional activity",
                    "value":    round(vol_ratio, 2), "triggered_at": now_ts,
                })
            elif vol_ratio > 2.0:
                alerts.append({
                    "symbol":   sym, "type": "VOLUME_SURGE",
                    "severity": "medium",
                    "message":  f"Volume {vol_ratio:.1f}× above average — elevated interest",
                    "value":    round(vol_ratio, 2), "triggered_at": now_ts,
                })

        # ── Bollinger Band Squeeze / Breakout ─────────────────────────────────
        sma20 = close.rolling(20).mean()
        std20 = close.rolling(20).std()
        bb_upper = sma20 + 2 * std20
        bb_lower = sma20 - 2 * std20
        bb_width  = (bb_upper - bb_lower) / sma20
        if len(bb_width.dropna()) >= 52:
            pct_20 = bb_width.dropna().quantile(0.20)
            curr_width = float(bb_width.iloc[-1])
            prev_width = float(bb_width.iloc[-2])
            if curr_width < pct_20:
                alerts.append({
                    "symbol":   sym, "type": "BB_SQUEEZE",
                    "severity": "medium",
                    "message":  "Bollinger Band squeeze — volatility compression, breakout imminent",
                    "value":    round(curr_width, 4), "triggered_at": now_ts,
                })
            elif curr_width > prev_width * 1.3 and prev_width < pct_20 * 1.5:
                alerts.append({
                    "symbol":   sym, "type": "BB_BREAKOUT",
                    "severity": "high",
                    "message":  "Bollinger Band expansion after squeeze — breakout in progress",
                    "value":    round(curr_width, 4), "triggered_at": now_ts,
                })

        # ── EMA Death / Golden Cross ──────────────────────────────────────────
        if len(close) >= 202:
            ema50  = _ema(close, 50)
            ema200 = _ema(close, 200)
            prev50  = float(ema50.iloc[-2])
            prev200 = float(ema200.iloc[-2])
            curr50  = float(ema50.iloc[-1])
            curr200 = float(ema200.iloc[-1])
            if prev50 > prev200 and curr50 <= curr200:
                alerts.append({
                    "symbol":   sym, "type": "DEATH_CROSS",
                    "severity": "high",
                    "message":  "Death Cross: 50 EMA crossed below 200 EMA — long-term bearish signal",
                    "value":    round(curr50 - curr200, 2), "triggered_at": now_ts,
                })
            elif prev50 < prev200 and curr50 >= curr200:
                alerts.append({
                    "symbol":   sym, "type": "GOLDEN_CROSS",
                    "severity": "medium",
                    "message":  "Golden Cross: 50 EMA crossed above 200 EMA — long-term bullish signal",
                    "value":    round(curr50 - curr200, 2), "triggered_at": now_ts,
                })

        # ── MACD Divergence ───────────────────────────────────────────────────
        ema12 = _ema(close, 12)
        ema26 = _ema(close, 26)
        macd  = ema12 - ema26
        macd_hist = macd - _ema(macd, 9)
        if len(macd_hist) >= 20:
            lookback = 20
            price_hi  = float(close.iloc[-lookback:].max())
            macd_hi   = float(macd_hist.iloc[-lookback:].max())
            price_now = price
            macd_now  = float(macd_hist.iloc[-1])
            if (price_now >= price_hi * 0.98) and (macd_now < macd_hi * 0.85) and macd_now > 0:
                alerts.append({
                    "symbol":   sym, "type": "BEARISH_DIVERGENCE",
                    "severity": "medium",
                    "message":  "Bearish MACD divergence — price near high but momentum weakening",
                    "value":    round(macd_now, 4), "triggered_at": now_ts,
                })

        # ── Price at 52-Week High ──────────────────────────────────────────────
        bars_1y = min(252, len(close))
        high_52w = float(close.iloc[-bars_1y:].max())
        if price >= high_52w * 0.995:
            alerts.append({
                "symbol":   sym, "type": "52W_HIGH",
                "severity": "low",
                "message":  f"At 52-week high (${high_52w:.2f}) — breakout or resistance test",
                "value":    round(price, 2), "triggered_at": now_ts,
            })

        # ── Earnings Approaching ──────────────────────────────────────────────
        try:
            cal = yf.Ticker(sym).calendar
            if cal is not None and "Earnings Date" in cal:
                earnings_dates = cal["Earnings Date"]
                if isinstance(earnings_dates, list) and earnings_dates:
                    from datetime import date
                    ed = earnings_dates[0]
                    if hasattr(ed, "date"):
                        ed = ed.date()
                    days_away = (ed - date.today()).days
                    if 0 <= days_away <= 10:
                        alerts.append({
                            "symbol":   sym, "type": "EARNINGS_APPROACHING",
                            "severity": "medium" if days_away > 3 else "high",
                            "message":  f"Earnings in {days_away} day{'s' if days_away != 1 else ''} — expect elevated volatility",
                            "value":    days_away, "triggered_at": now_ts,
                        })
        except Exception:
            pass  # calendar data not always available

    except Exception as exc:
        log.warning("Alert scan failed for %s: %s", sym, exc)

    return alerts


def scan_alerts(symbols: List[str]) -> dict:
    """
    Scan all given symbols and return triggered alerts sorted by severity.
    """
    if not _DATA_AVAILABLE:
        return {"available": False, "reason": "pandas/yfinance not installed", "alerts": []}

    syms = [s.upper() for s in symbols[:25]]
    cache_key = ",".join(sorted(syms))
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and now - cached[0] < _CACHE_TTL:
        return {"available": True, "alerts": cached[1], "cached": True,
                "scanned_at": datetime.now(timezone.utc).isoformat()}

    all_alerts = []
    for sym in syms:
        all_alerts.extend(_scan_symbol(sym))

    # Sort: high > medium > low
    sev_order = {"high": 0, "medium": 1, "low": 2}
    all_alerts.sort(key=lambda a: sev_order.get(a.get("severity", "low"), 2))

    _cache[cache_key] = (now, all_alerts)
    return {
        "available":  True,
        "alerts":     all_alerts,
        "cached":     False,
        "scanned":    len(syms),
        "total_alerts": len(all_alerts),
        "scanned_at": datetime.now(timezone.utc).isoformat(),
    }

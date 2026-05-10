"""
Claude AI Brain — institutional-grade investment intelligence orchestrator.

Aggregates all data sources (technical, fundamental, macro, sentiment,
memory) and generates a structured analysis report using Claude API.

Gracefully degrades to a rule-based statistical report if ANTHROPIC_API_KEY
is not set — all downstream features still work.
"""
from __future__ import annotations

import os
import json
import time
import logging
from datetime import datetime, timezone
from typing import Optional

log = logging.getLogger(__name__)

# ── Optional Claude API ──────────────────────────────────────────────────────
# NOTE: key is read dynamically at request time (not cached at import)
# so setting the env var on Render never requires a restart.
try:
    import anthropic as _anthropic_module
    _ANTHROPIC_SDK_AVAILABLE = True
except ImportError:
    _ANTHROPIC_SDK_AVAILABLE = False
    _anthropic_module = None  # type: ignore


def _get_api_key() -> str:
    """Read key fresh from environment every call — picks up Render env var changes."""
    return os.getenv("ANTHROPIC_API_KEY", "").strip()


def _claude_active() -> bool:
    return _ANTHROPIC_SDK_AVAILABLE and bool(_get_api_key())

# ── Data dependencies (all in brain package) ──────────────────────────────────
try:
    from api.brain.macro import fetch_macro_context
    _MACRO_OK = True
except ImportError:
    _MACRO_OK = False

try:
    from api.brain.sentiment import fetch_sentiment
    _SENT_OK = True
except ImportError:
    _SENT_OK = False

try:
    from api.brain.memory import get_context as get_memory, record_analysis
    _MEM_OK = True
except ImportError:
    _MEM_OK = False

try:
    import yfinance as yf
    import numpy as np
    import pandas as pd
    _YF_AVAILABLE = True
except ImportError:
    _YF_AVAILABLE = False

# ── Report cache ─────────────────────────────────────────────────────────────
_report_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 6 * 3600  # 6 hours


# ── Lightweight TA helpers for the fallback path ─────────────────────────────

def _ema(s: "pd.Series", n: int) -> "pd.Series":
    return s.ewm(span=n, adjust=False).mean()


def _rsi(s: "pd.Series", n: int = 14) -> "pd.Series":
    d = s.diff()
    g = d.clip(lower=0).rolling(n).mean()
    l_ = (-d.clip(upper=0)).rolling(n).mean()
    return 100 - 100 / (1 + g / l_.replace(0, np.nan))


def _get_quick_ta(symbol: str) -> dict:
    """Fetch a quick TA snapshot for the given symbol."""
    if not _YF_AVAILABLE:
        return {}
    try:
        df = yf.Ticker(symbol).history(period="6mo", auto_adjust=True)
        if df is None or len(df) < 30:
            return {}
        close  = df["Close"]
        high   = df["High"]
        low    = df["Low"]
        volume = df["Volume"]

        price   = float(close.iloc[-1])
        ema20   = float(_ema(close, 20).iloc[-1])
        ema50   = float(_ema(close, 50).iloc[-1])
        ema200  = float(_ema(close, 200).iloc[-1]) if len(close) >= 200 else price
        rsi14   = float(_rsi(close, 14).iloc[-1])
        ret_1m  = float((close.iloc[-1] / close.iloc[-22] - 1) * 100) if len(close) >= 22 else 0.0
        ret_3m  = float((close.iloc[-1] / close.iloc[-66] - 1) * 100) if len(close) >= 66 else 0.0
        vol_ma  = float(volume.rolling(20).mean().iloc[-1])
        vol_r   = float(volume.iloc[-1]) / vol_ma if vol_ma > 0 else 1.0

        high_52w = float(close.iloc[-min(252, len(close)):].max())
        low_52w  = float(close.iloc[-min(252, len(close)):].min())
        from_hi  = round((price / high_52w - 1) * 100, 1)

        # Simple EMA-based tech score
        tech_score = 50
        if price > ema50:  tech_score += 10
        if price > ema200: tech_score += 10
        if ema20 > ema50:  tech_score += 5
        if 40 < rsi14 < 70: tech_score += 10
        if rsi14 > 70: tech_score -= 10
        if vol_r > 1.5: tech_score += 5

        return {
            "price":        round(price, 2),
            "ema20":        round(ema20, 2),
            "ema50":        round(ema50, 2),
            "ema200":       round(ema200, 2),
            "rsi14":        round(rsi14, 1),
            "ret_1m_pct":   round(ret_1m, 1),
            "ret_3m_pct":   round(ret_3m, 1),
            "vol_ratio":    round(vol_r, 2),
            "high_52w":     round(high_52w, 2),
            "low_52w":      round(low_52w, 2),
            "from_52w_hi":  from_hi,
            "tech_score":   min(100, max(0, tech_score)),
        }
    except Exception as exc:
        log.warning("Quick TA failed for %s: %s", symbol, exc)
        return {}


def _get_quick_fundamentals(symbol: str) -> dict:
    """Fetch key fundamentals from yfinance."""
    if not _YF_AVAILABLE:
        return {}
    try:
        info = yf.Ticker(symbol).info or {}
        return {
            "name":           info.get("longName", symbol),
            "sector":         info.get("sector", "N/A"),
            "industry":       info.get("industry", "N/A"),
            "market_cap_b":   round((info.get("marketCap") or 0) / 1e9, 2),
            "pe":             info.get("trailingPE"),
            "forward_pe":     info.get("forwardPE"),
            "peg":            info.get("pegRatio"),
            "revenue_growth": info.get("revenueGrowth"),
            "eps_growth":     info.get("earningsGrowth"),
            "gross_margin":   info.get("grossMargins"),
            "profit_margin":  info.get("profitMargins"),
            "roe":            info.get("returnOnEquity"),
            "debt_equity":    info.get("debtToEquity"),
            "analyst_target": info.get("targetMeanPrice"),
            "analyst_rec":    info.get("recommendationKey", "N/A"),
            "beta":           info.get("beta"),
        }
    except Exception:
        return {}


# ── Statistical fallback report ──────────────────────────────────────────────

def _statistical_report(symbol: str, ta: dict, fund: dict, sent: dict, macro: dict) -> dict:
    """Generate a rule-based report when Claude API is unavailable."""
    price   = ta.get("price", 0)
    ts      = ta.get("tech_score", 50)
    ss      = sent.get("sentiment_score", 50)
    ms      = macro.get("macro_score", 50)
    rsi     = ta.get("rsi14", 50)
    ret_1m  = ta.get("ret_1m_pct", 0)
    ret_3m  = ta.get("ret_3m_pct", 0)
    from_hi = ta.get("from_52w_hi", 0)

    # Composite score
    composite = round(ts * 0.4 + ss * 0.3 + ms * 0.3, 1)

    if composite >= 65:
        thesis    = "bullish"
        action    = "Consider buying on dips into support. Risk management required."
        conviction = "medium"
    elif composite >= 45:
        thesis    = "neutral"
        action    = "Hold existing positions. Wait for clearer directional signals."
        conviction = "low"
    else:
        thesis    = "bearish"
        action    = "Reduce exposure. Defensive posture recommended."
        conviction = "medium"

    # Simple price targets
    pt_target = ta.get("analyst_target") or (price * (1.10 if thesis == "bullish" else 0.92))
    base_target = round(price * (1.05 if thesis == "bullish" else (0.98 if thesis == "neutral" else 0.90)), 2)
    bull_target = round(price * 1.15, 2)
    bear_target = round(price * 0.85, 2)

    catalysts = []
    risks = []

    if rsi < 35:
        catalysts.append("Oversold RSI — technical bounce potential")
    if from_hi < -20:
        catalysts.append(f"Trading {abs(from_hi):.0f}% below 52-week high — value opportunity")
    if ret_3m < -15:
        catalysts.append("Significant 3-month pullback — mean reversion candidate")
    if sent.get("bullish_count", 0) > sent.get("bearish_count", 0) + 2:
        catalysts.append("Positive news sentiment momentum")
    if macro.get("macro_regime") == "easy":
        catalysts.append("Accommodative macro environment supports risk assets")

    if rsi > 70:
        risks.append("Overbought RSI — short-term consolidation risk")
    if ta.get("ema200") and price < ta.get("ema200", price):
        risks.append("Price below 200-day EMA — long-term trend concern")
    if macro.get("macro_regime") == "restrictive":
        risks.append("Restrictive monetary policy — headwind for equities")
    if (fund.get("debt_equity") or 0) > 2.0:
        risks.append("High debt-to-equity ratio — balance sheet risk")
    if sent.get("bearish_count", 0) > sent.get("bullish_count", 0) + 2:
        risks.append("Negative news flow — sentiment headwind")

    if not catalysts:
        catalysts = ["Monitor for improved technical setup"]
    if not risks:
        risks = ["General market risk", "Execution risk on entry/exit"]

    return {
        "symbol":            symbol.upper(),
        "name":              fund.get("name", symbol.upper()),
        "generated_at":      datetime.now(timezone.utc).isoformat(),
        "ai_mode":           "statistical",
        "claude_powered":    False,
        "thesis":            thesis,
        "conviction":        conviction,
        "composite_score":   composite,
        "tech_score":        ts,
        "sentiment_score":   ss,
        "macro_score":       ms,
        "executive_summary": (
            f"{symbol.upper()} shows a {thesis} setup with a composite intelligence score of {composite}/100. "
            f"Technical score: {ts}/100 | Sentiment: {ss}/100 | Macro environment: {macro.get('macro_regime','N/A')}. "
            f"{action}"
        ),
        "key_catalysts":     catalysts[:4],
        "key_risks":         risks[:4],
        "price_targets": {
            "bull":    bull_target,
            "base":    base_target,
            "bear":    bear_target,
            "analyst": round(pt_target, 2) if pt_target else None,
        },
        "macro_impact":     f"Macro regime: {macro.get('macro_regime','N/A')} | Fed Funds: {macro.get('fed_funds','N/A')}% | 10Y: {macro.get('rate_10y','N/A')}%",
        "sentiment_read":   f"{sent.get('sentiment_label','N/A').replace('_',' ').title()} | {sent.get('article_count',0)} articles analyzed",
        "technical_read":   f"RSI {rsi:.0f} | {ta.get('from_52w_hi',0):+.1f}% from 52w high | 1M return: {ret_1m:+.1f}%",
        "recommended_action": action,
        "time_horizon":     "30-60 days",
        "fundamentals": {
            "sector":   fund.get("sector"),
            "pe":       fund.get("pe"),
            "forward_pe": fund.get("forward_pe"),
            "revenue_growth": fund.get("revenue_growth"),
            "profit_margin":  fund.get("profit_margin"),
            "analyst_rec":    fund.get("analyst_rec"),
        },
        "technicals": {
            "price":    ta.get("price"),
            "ema200":   ta.get("ema200"),
            "rsi14":    ta.get("rsi14"),
            "ret_1m":   ta.get("ret_1m_pct"),
            "ret_3m":   ta.get("ret_3m_pct"),
            "high_52w": ta.get("high_52w"),
            "low_52w":  ta.get("low_52w"),
        },
        "disclaimer": "Statistical analysis only — not financial advice. For informational purposes.",
    }


# ── Claude-powered report ─────────────────────────────────────────────────────

def _claude_report(symbol: str, ta: dict, fund: dict, sent: dict, macro: dict, mem: dict) -> dict:
    """Call Claude API to generate an institutional-quality report."""
    client = _anthropic_module.Anthropic(api_key=_get_api_key())

    # Compact data payload (~1500 tokens)
    data_blob = json.dumps({
        "symbol":      symbol.upper(),
        "company":     fund.get("name", symbol),
        "sector":      fund.get("sector"),
        "technicals":  {k: ta.get(k) for k in ["price","rsi14","ema20","ema50","ema200","ret_1m_pct","ret_3m_pct","vol_ratio","from_52w_hi","tech_score"]},
        "fundamentals":{k: fund.get(k) for k in ["pe","forward_pe","peg","revenue_growth","eps_growth","gross_margin","profit_margin","roe","debt_equity","analyst_rec","analyst_target","beta"]},
        "sentiment":   {k: sent.get(k) for k in ["mean_compound","sentiment_label","sentiment_score","bullish_count","bearish_count","article_count"]},
        "macro":       {k: macro.get(k) for k in ["rate_10y","fed_funds","yield_curve","macro_regime","macro_score","hy_spread","unemployment"]},
        "memory":      {k: mem.get(k) for k in ["prior_signals","signal_consistency","view_count","alert_history"]},
    }, default=str)

    system_prompt = (
        "You are a senior equity analyst at a top-tier hedge fund. "
        "You produce concise, data-driven investment reports in JSON. "
        "Never use disclaimers in the JSON body — add them only in the disclaimer field. "
        "Be direct, probability-based, and institutionally rigorous."
    )

    user_prompt = f"""Analyze the following financial data for {symbol.upper()} and produce a structured investment report.

DATA:
{data_blob}

Return ONLY valid JSON matching this exact schema (no markdown, no extra keys):
{{
  "thesis": "bullish"|"bearish"|"neutral",
  "conviction": "high"|"medium"|"low",
  "composite_score": <0-100 integer>,
  "executive_summary": "<2-3 sentence summary of the overall picture and recommended stance>",
  "key_catalysts": ["<catalyst 1>", "<catalyst 2>", "<catalyst 3>"],
  "key_risks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "price_targets": {{"bull": <price>, "base": <price>, "bear": <price>}},
  "macro_impact": "<1 sentence on how the macro environment affects this stock>",
  "sentiment_read": "<1 sentence on news/social sentiment>",
  "technical_read": "<1 sentence on technical picture>",
  "recommended_action": "<specific, actionable trade recommendation with entry context>",
  "time_horizon": "<e.g., 30-60 days>",
  "regime_fit": "<how well this stock fits the current market regime>",
  "disclaimer": "AI-generated analysis for informational purposes only. Not financial advice."
}}"""

    resp = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        system=[{
            "type": "text",
            "text": system_prompt,
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{"role": "user", "content": user_prompt}],
    )

    text = resp.content[0].text.strip()
    # Strip potential markdown code fences
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip().strip("```").strip()

    report_data = json.loads(text)

    # Merge in our own computed fields + raw data
    report_data.update({
        "symbol":          symbol.upper(),
        "name":            fund.get("name", symbol.upper()),
        "generated_at":    datetime.now(timezone.utc).isoformat(),
        "ai_mode":         "claude",
        "claude_powered":  True,
        "tech_score":      ta.get("tech_score", 50),
        "sentiment_score": sent.get("sentiment_score", 50),
        "macro_score":     macro.get("macro_score", 50),
        "technicals":      {k: ta.get(k) for k in ["price","rsi14","ema20","ema50","ema200","ret_1m_pct","ret_3m_pct","high_52w","low_52w","from_52w_hi"]},
        "fundamentals":    {k: fund.get(k) for k in ["sector","pe","forward_pe","revenue_growth","profit_margin","analyst_rec","analyst_target","beta"]},
    })
    return report_data


# ── Public interface ──────────────────────────────────────────────────────────

def generate_report(symbol: str, include_macro: bool = True, use_cache: bool = True) -> dict:
    """
    Main entry point — generate an institutional investment report.

    Tries Claude API first; falls back to statistical model if unavailable.
    Results are cached for 6 hours.
    """
    sym = symbol.upper()
    now = time.time()

    if use_cache:
        cached = _report_cache.get(sym)
        if cached and now - cached[0] < _CACHE_TTL:
            result = dict(cached[1])
            result["from_cache"] = True
            return result

    # ── Gather data ───────────────────────────────────────────────────────────
    ta   = _get_quick_ta(sym)
    fund = _get_quick_fundamentals(sym)
    sent = fetch_sentiment(sym) if _SENT_OK else {"available": False, "sentiment_score": 50}
    macro = fetch_macro_context() if (_MACRO_OK and include_macro) else {"available": False, "macro_score": 50, "macro_regime": "unknown"}
    mem  = get_memory(sym) if _MEM_OK else {}

    # ── Generate report ───────────────────────────────────────────────────────
    try:
        if _claude_active():
            report = _claude_report(sym, ta, fund, sent, macro, mem)
        else:
            report = _statistical_report(sym, ta, fund, sent, macro)
    except Exception as exc:
        log.warning("Claude report failed for %s (%s), using statistical fallback", sym, exc)
        report = _statistical_report(sym, ta, fund, sent, macro)

    report["from_cache"] = False

    # ── Persist to cache + memory ─────────────────────────────────────────────
    _report_cache[sym] = (now, report)
    if _MEM_OK:
        try:
            record_analysis(
                sym,
                signal=report.get("thesis", "neutral"),
                score=report.get("composite_score", 50),
                thesis=report.get("executive_summary", "")[:200],
                price=ta.get("price", 0),
            )
        except Exception:
            pass

    return report


def get_brain_status() -> dict:
    """Return feature availability for the /api/brain/status endpoint."""
    active = _claude_active()
    return {
        "claude_available":  active,
        "vader_available":   _SENT_OK,
        "macro_available":   _MACRO_OK,
        "memory_available":  _MEM_OK,
        "model":             "claude-sonnet-4-5" if active else "statistical-fallback",
        "sdk_available":     _ANTHROPIC_SDK_AVAILABLE,
        "key_set":           bool(_get_api_key()),
        "deploy_v":          "v2-dynamic",
    }

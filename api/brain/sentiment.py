"""
Sentiment Engine — news + social sentiment analysis.

Uses yfinance .news property for headlines and VADER for NLP scoring.
VADER is lightweight (~100KB) and purpose-built for short financial text.
Falls back gracefully if vaderSentiment is not installed.
"""
from __future__ import annotations

import time
import logging
from datetime import datetime, timezone
from typing import Optional

log = logging.getLogger(__name__)

# Try to import VADER — graceful fallback if not installed
try:
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    _vader = SentimentIntensityAnalyzer()
    _VADER_AVAILABLE = True
except ImportError:
    _VADER_AVAILABLE = False
    _vader = None

try:
    import yfinance as yf
    _YF_AVAILABLE = True
except ImportError:
    _YF_AVAILABLE = False

# In-process cache: symbol -> (timestamp, result)
_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 1800  # 30 minutes


def _score_headline(text: str) -> float:
    """Return VADER compound score [-1, +1]."""
    if not _VADER_AVAILABLE or not _vader:
        return 0.0
    return _vader.polarity_scores(text)["compound"]


def fetch_sentiment(symbol: str) -> dict:
    """
    Fetch and score recent news headlines for a symbol.

    Returns:
        symbol, article_count, mean_compound, bullish_count, bearish_count,
        neutral_count, sentiment_label, sentiment_score (0-100),
        top_headlines, available
    """
    sym = symbol.upper()
    now = time.time()
    cached = _cache.get(sym)
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]

    if not _YF_AVAILABLE:
        result = {"symbol": sym, "available": False, "reason": "yfinance not installed"}
        _cache[sym] = (now, result)
        return result

    try:
        ticker = yf.Ticker(sym)
        news_items = ticker.news or []
    except Exception as exc:
        log.warning("yfinance news failed for %s: %s", sym, exc)
        result = {"symbol": sym, "available": False, "reason": str(exc)}
        _cache[sym] = (now, result)
        return result

    # Score each headline
    scored: list[dict] = []
    for item in news_items[:15]:
        title = item.get("title", "")
        if not title:
            continue
        compound = _score_headline(title)
        publisher = item.get("publisher", "Unknown")
        ts = item.get("providerPublishTime", 0)
        pub_dt = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%b %d %H:%M") if ts else ""
        scored.append({
            "title":     title,
            "publisher": publisher,
            "published": pub_dt,
            "compound":  round(compound, 4),
            "label":     "bullish" if compound > 0.05 else ("bearish" if compound < -0.05 else "neutral"),
        })

    if not scored:
        result = {
            "symbol":        sym,
            "available":     _VADER_AVAILABLE,
            "article_count": 0,
            "mean_compound": 0.0,
            "bullish_count": 0,
            "bearish_count": 0,
            "neutral_count": 0,
            "sentiment_label": "no_data",
            "sentiment_score": 50,
            "top_headlines": [],
        }
        _cache[sym] = (now, result)
        return result

    compounds = [s["compound"] for s in scored]
    mean_c = sum(compounds) / len(compounds)
    bullish = sum(1 for s in scored if s["label"] == "bullish")
    bearish = sum(1 for s in scored if s["label"] == "bearish")
    neutral = len(scored) - bullish - bearish

    # Normalise compound [-1,+1] to score [0,100]
    sentiment_score = int((mean_c + 1) / 2 * 100)

    if mean_c > 0.2:
        label = "strongly_bullish"
    elif mean_c > 0.05:
        label = "slightly_bullish"
    elif mean_c < -0.2:
        label = "strongly_bearish"
    elif mean_c < -0.05:
        label = "slightly_bearish"
    else:
        label = "neutral"

    result = {
        "symbol":          sym,
        "available":       _VADER_AVAILABLE,
        "article_count":   len(scored),
        "mean_compound":   round(mean_c, 4),
        "bullish_count":   bullish,
        "bearish_count":   bearish,
        "neutral_count":   neutral,
        "sentiment_label": label,
        "sentiment_score": sentiment_score,
        "top_headlines":   scored[:8],
    }
    _cache[sym] = (now, result)
    return result

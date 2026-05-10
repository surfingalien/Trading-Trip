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

    # yfinance changed its news format in 0.2.50+:
    #   Old format: {"title": "...", "publisher": "...", "providerPublishTime": 123}
    #   New format: {"id": "...", "content": {"title": "...", "pubDate": "...", "provider": {"displayName": "..."}}}
    # We support both.
    def _parse_news_item(item: dict) -> tuple[str, str, str]:
        """Return (title, publisher, pub_dt) for either format."""
        # New nested format
        content = item.get("content") or {}
        if content:
            title = content.get("title", "")
            publisher = (content.get("provider") or {}).get("displayName", "Unknown")
            pub_date = content.get("pubDate", "")
            # pubDate is ISO string like "2025-01-15T10:30:00Z"
            try:
                from datetime import datetime as _dt
                pub_dt = _dt.fromisoformat(pub_date.replace("Z", "+00:00")).strftime("%b %d %H:%M") if pub_date else ""
            except Exception:
                pub_dt = pub_date[:10] if pub_date else ""
        else:
            # Old flat format
            title = item.get("title", "")
            publisher = item.get("publisher", "Unknown")
            ts = item.get("providerPublishTime", 0)
            pub_dt = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%b %d %H:%M") if ts else ""
        return title, publisher, pub_dt

    # Score each headline
    scored: list[dict] = []
    for item in news_items[:15]:
        title, publisher, pub_dt = _parse_news_item(item)
        if not title:
            continue
        compound = _score_headline(title)
        scored.append({
            "title":     title,
            "publisher": publisher,
            "published": pub_dt,
            "compound":  round(compound, 4),
            "label":     "bullish" if compound > 0.05 else ("bearish" if compound < -0.05 else "neutral"),
        })

    # If yfinance returned nothing at all, fall back to Yahoo Finance RSS
    if not scored and not news_items:
        try:
            import urllib.request
            import xml.etree.ElementTree as ET
            url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={sym}&region=US&lang=en-US"
            with urllib.request.urlopen(url, timeout=8) as resp:
                tree = ET.parse(resp)
            ns = {"dc": "http://purl.org/dc/elements/1.1/"}
            for item_el in tree.findall(".//item")[:15]:
                title = (item_el.findtext("title") or "").strip()
                publisher = item_el.findtext("dc:creator", namespaces=ns) or "Yahoo Finance"
                pub_raw = item_el.findtext("pubDate") or ""
                try:
                    from email.utils import parsedate_to_datetime
                    pub_dt = parsedate_to_datetime(pub_raw).strftime("%b %d %H:%M") if pub_raw else ""
                except Exception:
                    pub_dt = ""
                if not title:
                    continue
                compound = _score_headline(title)
                scored.append({
                    "title":     title,
                    "publisher": publisher,
                    "published": pub_dt,
                    "compound":  round(compound, 4),
                    "label":     "bullish" if compound > 0.05 else ("bearish" if compound < -0.05 else "neutral"),
                })
        except Exception as rss_exc:
            log.warning("RSS fallback failed for %s: %s", sym, rss_exc)

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

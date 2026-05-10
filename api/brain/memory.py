"""
Adaptive Memory Engine — persists analysis history for self-learning context.

Stores per-symbol analysis records in a JSON file so Claude can reference
prior signals, outcomes, and patterns in its reasoning.
"""
from __future__ import annotations

import json
import os
import time
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

log = logging.getLogger(__name__)

_DATA_DIR  = Path(__file__).parent / "data"
_MEMORY_FILE = _DATA_DIR / "memory.json"
_MAX_SYMBOLS = 500
_MAX_HISTORY_PER_SYMBOL = 10

# In-process state — loaded once, written on each update
_memory: dict[str, Any] = {}
_loaded = False


def _load():
    global _memory, _loaded
    if _loaded:
        return
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    if _MEMORY_FILE.exists():
        try:
            with open(_MEMORY_FILE) as f:
                _memory = json.load(f)
        except Exception as exc:
            log.warning("Memory load failed: %s — starting fresh", exc)
            _memory = {}
    _loaded = True


def _save():
    try:
        _DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(_MEMORY_FILE, "w") as f:
            json.dump(_memory, f, indent=2)
    except Exception as exc:
        log.warning("Memory save failed: %s", exc)


def _prune():
    """Remove least-recently-accessed symbols if over limit."""
    if len(_memory) <= _MAX_SYMBOLS:
        return
    by_access = sorted(_memory.items(), key=lambda x: x[1].get("last_accessed", 0))
    for sym, _ in by_access[:len(_memory) - _MAX_SYMBOLS]:
        del _memory[sym]


def record_analysis(symbol: str, signal: str, score: int, thesis: str,
                    price: float, metadata: Optional[dict] = None):
    """Record a new analysis entry for a symbol."""
    _load()
    sym = symbol.upper()
    if sym not in _memory:
        _memory[sym] = {"signal_history": [], "view_count": 0, "alert_history": []}

    entry = {
        "ts":      datetime.now(timezone.utc).isoformat(),
        "signal":  signal,
        "score":   score,
        "thesis":  thesis,
        "price":   price,
        **(metadata or {}),
    }
    hist = _memory[sym].setdefault("signal_history", [])
    hist.append(entry)
    if len(hist) > _MAX_HISTORY_PER_SYMBOL:
        hist.pop(0)

    _memory[sym]["last_accessed"] = time.time()
    _memory[sym]["last_signal"] = signal
    _memory[sym]["last_price"] = price
    _pruney()  # typo fix below
    _save()


def _pruney():
    _prune()


def increment_views(symbol: str):
    """Track how often a symbol is viewed (popularity signal)."""
    _load()
    sym = symbol.upper()
    _memory.setdefault(sym, {"signal_history": [], "view_count": 0})
    _memory[sym]["view_count"] = _memory[sym].get("view_count", 0) + 1
    _memory[sym]["last_accessed"] = time.time()
    _save()


def record_alert(symbol: str, alert_type: str):
    """Record a fired alert for context."""
    _load()
    sym = symbol.upper()
    _memory.setdefault(sym, {"signal_history": [], "view_count": 0, "alert_history": []})
    alerts = _memory[sym].setdefault("alert_history", [])
    alerts.append({"type": alert_type, "ts": datetime.now(timezone.utc).isoformat()})
    if len(alerts) > 20:
        alerts.pop(0)
    _save()


def get_context(symbol: str) -> dict:
    """
    Return memory context for a symbol — injected into Claude prompts
    to give the AI historical awareness of prior signals and patterns.
    """
    _load()
    sym = symbol.upper()
    increment_views(sym)
    data = _memory.get(sym, {})

    history = data.get("signal_history", [])
    # Compute signal consistency (last 5 signals)
    recent_signals = [h.get("signal", "") for h in history[-5:]]
    bullish_count  = recent_signals.count("BULLISH")
    bearish_count  = recent_signals.count("BEARISH")
    consistency    = "consistently_bullish" if bullish_count >= 4 else (
                     "consistently_bearish" if bearish_count >= 4 else "mixed")

    return {
        "symbol":          sym,
        "view_count":      data.get("view_count", 0),
        "prior_signals":   recent_signals,
        "signal_consistency": consistency,
        "last_signal":     data.get("last_signal"),
        "last_price":      data.get("last_price"),
        "alert_history":   [a.get("type") for a in data.get("alert_history", [])[-5:]],
        "has_history":     len(history) > 0,
    }

"""
ML Prediction Endpoint.

GET /api/predict?symbol=AAPL&horizon=7
GET /api/predict?symbol=NVDA&horizon=30&refresh=true

Response includes:
  • Point forecast (% return & predicted price)
  • 80% confidence interval (p10 / p90)
  • Probability of upside > 5%, 10%, 15%
  • Scenario table: Base / Bull / Bear
  • Model metadata (version, accuracy, features)

Cache TTL: 6h for 7d, 24h for 30d/90d forecasts.
On-demand refresh via ?refresh=true (rate-limited to 1/hour per symbol-horizon).
"""
from __future__ import annotations
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import yfinance as yf
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.config import get_settings
from backend.services.cache import get_cache

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/predict", tags=["ML Prediction"])
cfg = get_settings()

HORIZONS = {7: cfg.CACHE_TTL_7D, 30: cfg.CACHE_TTL_30D, 90: cfg.CACHE_TTL_90D}

# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class ScenarioRow(BaseModel):
    scenario: str       # Base / Bull / Bear
    return_pct: float
    price: float
    probability: float


class ModelMeta(BaseModel):
    version: str
    directional_accuracy: float
    training_date: str
    n_training_samples: int
    features: list[str]
    xgb_weight: float
    lstm_weight: float


class PredictionResponse(BaseModel):
    symbol: str
    horizon_days: int
    base_price: float
    predicted_return_pct: float
    predicted_price: float
    lower_bound: float           # p10 price
    upper_bound: float           # p90 price
    prob_up_5pct: float
    prob_up_10pct: float
    prob_up_15pct: float
    scenarios: list[ScenarioRow]
    model_meta: Optional[ModelMeta]
    generated_at: str
    cached: bool
    disclaimer: str


# ---------------------------------------------------------------------------
# Inference helpers
# ---------------------------------------------------------------------------

def _model_path(symbol: str, horizon: int) -> str:
    return os.path.join(cfg.MODEL_DIR, f"{symbol}_{horizon}d_ensemble.pkl")


def _meta_path(symbol: str, horizon: int) -> str:
    return _model_path(symbol, horizon).replace(".pkl", "_metadata.json")


def _load_model_with_meta(symbol: str, horizon: int):
    mpath = _model_path(symbol, horizon)
    if not os.path.exists(mpath):
        return None, None
    from backend.ml.models import load_model
    model = load_model(mpath)
    meta_p = _meta_path(symbol, horizon)
    meta = json.loads(Path(meta_p).read_text()) if os.path.exists(meta_p) else {}
    return model, meta


def _compute_probabilities(base_price: float, lower: float, upper: float) -> dict:
    """
    Approximate probabilities from triangular distribution defined by
    lower/base/upper (p10/point/p90 of forecast return).
    """
    def prob_above_threshold(threshold_pct: float) -> float:
        target_price = base_price * (1 + threshold_pct)
        rng = upper - lower
        if rng <= 0:
            return 0.5
        if target_price >= upper:
            return 0.05
        if target_price <= lower:
            return 0.95
        # Linear interpolation in forecast distribution
        frac_above = (upper - target_price) / rng
        return round(frac_above * 0.8, 4)  # 80% CI → scale to full distribution

    return {
        "prob_up_5pct":  prob_above_threshold(0.05),
        "prob_up_10pct": prob_above_threshold(0.10),
        "prob_up_15pct": prob_above_threshold(0.15),
    }


def _build_scenarios(base_price: float, ret_pct: float, lower_ret: float, upper_ret: float) -> list[ScenarioRow]:
    bull_ret = upper_ret + abs(upper_ret - ret_pct) * 0.5
    bear_ret = lower_ret - abs(ret_pct - lower_ret) * 0.5

    scenarios = [
        ScenarioRow(
            scenario="Base",
            return_pct=round(ret_pct * 100, 2),
            price=round(base_price * (1 + ret_pct), 2),
            probability=0.50,
        ),
        ScenarioRow(
            scenario="Bull",
            return_pct=round(bull_ret * 100, 2),
            price=round(base_price * (1 + bull_ret), 2),
            probability=0.25,
        ),
        ScenarioRow(
            scenario="Bear",
            return_pct=round(bear_ret * 100, 2),
            price=round(base_price * (1 + bear_ret), 2),
            probability=0.25,
        ),
    ]
    return scenarios


async def _run_inference(symbol: str, horizon: int) -> PredictionResponse:
    """Load model → build features → predict → build response."""
    from backend.ml.features import build_features, FEATURE_COLS

    model, meta_data = _load_model_with_meta(symbol, horizon)

    # Fetch latest data
    df_raw = yf.download(symbol, period="2y", interval="1d", progress=False, auto_adjust=True)
    df_raw.columns = [c.lower() for c in df_raw.columns]
    if df_raw.empty:
        raise HTTPException(status_code=422, detail=f"No market data for {symbol}")

    vix_raw = yf.download("^VIX", period="2y", interval="1d", progress=False, auto_adjust=True)
    spy_raw = yf.download("SPY",  period="2y", interval="1d", progress=False, auto_adjust=True)
    vix_s = vix_raw["Close"].squeeze() if not vix_raw.empty else None
    spy_s = spy_raw["Close"].squeeze() if not spy_raw.empty else None

    feat_df = build_features(df_raw, vix_series=vix_s, spy_series=spy_s,
                             include_target=False, horizon_days=horizon)
    feat_df = feat_df.dropna()
    if feat_df.empty:
        raise HTTPException(status_code=422, detail=f"Feature engineering returned empty frame for {symbol}")

    X = feat_df[FEATURE_COLS].values
    base_price = float(df_raw["close"].iloc[-1])
    now_ts = datetime.now(timezone.utc).isoformat()

    # --- Model inference ---
    if model is not None:
        try:
            unc = model.predict_with_uncertainty(X)
            ret_pct   = float(unc["point"])
            lower_ret = float(unc["lower"])
            upper_ret = float(unc["upper"])
            prob_pos  = float(unc["prob_positive"])
        except Exception as exc:
            log.warning("Model inference failed for %s: %s", symbol, exc)
            model = None  # fall through to statistical fallback

    if model is None:
        # Statistical fallback: historical mean + std over horizon window
        log.info("Using statistical fallback for %s %dd", symbol, horizon)
        df_close = df_raw["close"]
        fwd_rets  = df_close.pct_change(horizon).dropna()
        ret_pct   = float(fwd_rets.mean())
        std       = float(fwd_rets.std())
        lower_ret = ret_pct - 1.28 * std   # p10
        upper_ret = ret_pct + 1.28 * std   # p90
        prob_pos  = float((fwd_rets > 0).mean())
        meta_data = None

    # --- Build response ---
    probs = _compute_probabilities(base_price, base_price * (1 + lower_ret), base_price * (1 + upper_ret))
    scenarios = _build_scenarios(base_price, ret_pct, lower_ret, upper_ret)

    model_meta = None
    if meta_data:
        val_metrics = meta_data.get("validation_metrics", {})
        feat_list   = meta_data.get("feature_cols", FEATURE_COLS)
        model_meta = ModelMeta(
            version=meta_data.get("model_version", "unknown"),
            directional_accuracy=round(val_metrics.get("directional_accuracy", 0), 4),
            training_date=meta_data.get("model_version", "")[:8],
            n_training_samples=meta_data.get("n_samples", 0),
            features=feat_list[:10],  # show top 10
            xgb_weight=meta_data.get("xgb_weight", 0.6),
            lstm_weight=meta_data.get("lstm_weight", 0.4),
        )

    return PredictionResponse(
        symbol=symbol,
        horizon_days=horizon,
        base_price=round(base_price, 2),
        predicted_return_pct=round(ret_pct * 100, 3),
        predicted_price=round(base_price * (1 + ret_pct), 2),
        lower_bound=round(base_price * (1 + lower_ret), 2),
        upper_bound=round(base_price * (1 + upper_ret), 2),
        prob_up_5pct=probs["prob_up_5pct"],
        prob_up_10pct=probs["prob_up_10pct"],
        prob_up_15pct=probs["prob_up_15pct"],
        scenarios=scenarios,
        model_meta=model_meta,
        generated_at=now_ts,
        cached=False,
        disclaimer=(
            "ML forecasts are probabilistic estimates based on historical patterns and are NOT guarantees. "
            "Past performance does not predict future results. Always apply stop-losses and position sizing. "
            "Consult a licensed financial advisor before making investment decisions."
        ),
    )


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("", response_model=PredictionResponse)
async def get_prediction(
    symbol: str = Query(..., min_length=1, max_length=10),
    horizon: int = Query(7, description="Forecast horizon in days", enum=[7, 30, 90]),
    refresh: bool = Query(False, description="Force refresh (rate-limited)"),
):
    symbol = symbol.upper().strip()
    cache = await get_cache()
    cache_key = f"predict:{symbol}:{horizon}"

    if not refresh:
        cached = await cache.get_json(cache_key)
        if cached:
            cached["cached"] = True
            return PredictionResponse(**cached)

    # Rate-limit refresh: 1 per hour per symbol-horizon
    if refresh:
        rl_key = f"predict_rl:{symbol}:{horizon}"
        if await cache.exists(rl_key):
            raise HTTPException(status_code=429, detail="Refresh rate-limited — 1/hour per symbol")
        await cache.set(rl_key, "1", ex=3600)

    try:
        result = await _run_inference(symbol, horizon)
    except HTTPException:
        raise
    except Exception as exc:
        log.error("Prediction error for %s %dd: %s", symbol, horizon, exc)
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}")

    ttl = HORIZONS.get(horizon, cfg.CACHE_TTL_7D)
    await cache.set_json(cache_key, result.model_dump(), ex=ttl)
    return result

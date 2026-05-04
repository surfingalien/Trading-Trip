"""
ML Training Pipeline with Walk-Forward Validation.

Orchestrates:
  1. Data fetch + feature engineering
  2. Walk-forward splits (no look-ahead bias)
  3. Train XGBoost + LSTM per split, measure metrics
  4. Determine final ensemble weights
  5. Retrain on full data, save model + metadata
  6. Register with MLflow

Usage:
  python -m backend.ml.pipeline --symbol AAPL --horizon 7
  python -m backend.ml.pipeline --symbol NVDA --horizon 30 --full-universe
"""
from __future__ import annotations
import argparse
import json
import logging
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def directional_accuracy(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.sign(y_true) == np.sign(y_pred)))


def sharpe_of_strategy(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Sharpe of a long/flat strategy: long when prediction > 0."""
    signals  = (y_pred > 0).astype(float)
    strategy = signals * y_true
    if strategy.std() == 0:
        return 0.0
    return float(strategy.mean() / strategy.std() * np.sqrt(252))


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    mae  = float(np.mean(np.abs(y_true - y_pred)))
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    da   = directional_accuracy(y_true, y_pred)
    sharpe = sharpe_of_strategy(y_true, y_pred)
    return {"mae": mae, "rmse": rmse, "directional_accuracy": da, "sharpe": sharpe}


# ---------------------------------------------------------------------------
# Training pipeline
# ---------------------------------------------------------------------------

def train_symbol(
    symbol: str,
    horizon_days: int = 7,
    model_dir: str = "backend/ml/models",
    use_mlflow: bool = False,
) -> dict:
    """
    Full training pipeline for a single symbol + horizon.
    Returns metadata dict with metrics and model path.
    """
    from backend.ml.features import build_features, walk_forward_splits, FEATURE_COLS
    from backend.ml.models import (
        XGBoostForecaster, LSTMForecaster, WeightedEnsemble, save_model
    )

    t0 = time.time()
    log.info("Training %s horizon=%dd", symbol, horizon_days)

    # --- Fetch data ---
    import asyncio, yfinance as yf
    df_raw = yf.download(symbol, period="5y", interval="1d", progress=False, auto_adjust=True)
    df_raw.columns = [c.lower() for c in df_raw.columns]
    if df_raw.empty or len(df_raw) < 300:
        raise ValueError(f"Insufficient data for {symbol}")

    # Fetch VIX + SPY for macro context
    vix_raw = yf.download("^VIX", period="5y", interval="1d", progress=False, auto_adjust=True)
    spy_raw = yf.download("SPY",  period="5y", interval="1d", progress=False, auto_adjust=True)

    vix_s = vix_raw["Close"].squeeze() if not vix_raw.empty else None
    spy_s = spy_raw["Close"].squeeze() if not spy_raw.empty else None

    # --- Feature engineering ---
    feat_df = build_features(df_raw, vix_series=vix_s, spy_series=spy_s,
                             include_target=True, horizon_days=horizon_days)
    feat_df = feat_df.dropna()
    if len(feat_df) < 200:
        raise ValueError(f"Too few samples after feature engineering: {len(feat_df)}")

    X    = feat_df[FEATURE_COLS].values
    y_ret = feat_df["target_ret"].values
    y_dir = feat_df["target_dir"].values

    # --- Walk-forward validation ---
    splits = list(walk_forward_splits(feat_df, n_splits=5, val_rows=63))
    xgb_da_vals, lstm_da_vals = [], []
    all_metrics = []

    for i, (train_idx, val_idx) in enumerate(splits):
        train_mask = feat_df.index.isin(train_idx)
        val_mask   = feat_df.index.isin(val_idx)

        X_tr, y_tr_ret, y_tr_dir = X[train_mask], y_ret[train_mask], y_dir[train_mask]
        X_val, y_val_ret          = X[val_mask], y_ret[val_mask]

        # XGBoost fold
        xgb = XGBoostForecaster(n_estimators=300)
        xgb.fit(X_tr, y_tr_ret, y_tr_dir)
        xgb_preds = xgb.predict(X_val)
        xgb_da = directional_accuracy(y_val_ret, xgb_preds)
        xgb_da_vals.append(xgb_da)

        # LSTM fold (lighter config for speed)
        lstm = LSTMForecaster(input_size=X.shape[1], epochs=20, seq_len=20)
        try:
            lstm.fit(X_tr, y_tr_ret, y_tr_dir)
            lstm_preds = np.array([lstm.predict(X_tr) for _ in range(1)]).squeeze()
            # For val, predict point-by-point
            lstm_val_preds = []
            for j in range(len(X_val)):
                ctx = np.vstack([X_tr[-20:], X_val[:j+1]])
                lstm_val_preds.append(float(lstm.predict(ctx)))
            lstm_val_preds = np.array(lstm_val_preds)
            lstm_da = directional_accuracy(y_val_ret, lstm_val_preds)
        except Exception as exc:
            log.warning("LSTM fold %d failed: %s", i, exc)
            lstm_da = 0.5
        lstm_da_vals.append(lstm_da)

        fold_metrics = compute_metrics(y_val_ret, xgb_preds)
        fold_metrics["fold"] = i
        fold_metrics["xgb_da"] = xgb_da
        fold_metrics["lstm_da"] = lstm_da
        all_metrics.append(fold_metrics)
        log.info("Fold %d | XGB DA=%.3f | LSTM DA=%.3f", i, xgb_da, lstm_da)

    mean_xgb_da  = float(np.mean(xgb_da_vals))
    mean_lstm_da = float(np.mean(lstm_da_vals))
    avg_metrics  = {k: float(np.mean([m[k] for m in all_metrics if k in m]))
                    for k in ["mae", "rmse", "directional_accuracy", "sharpe"]}

    # --- Full retrain ---
    final_xgb  = XGBoostForecaster(n_estimators=500)
    final_lstm = LSTMForecaster(input_size=X.shape[1], epochs=50, seq_len=30)
    ensemble   = WeightedEnsemble(final_xgb, final_lstm)
    ensemble.fit(X, y_ret, y_dir)
    ensemble.update_weights_from_validation(mean_xgb_da, mean_lstm_da)

    # --- Save ---
    model_path = os.path.join(model_dir, f"{symbol}_{horizon_days}d_ensemble.pkl")
    save_model(ensemble, model_path)

    metadata = {
        "symbol": symbol,
        "horizon_days": horizon_days,
        "model_path": model_path,
        "model_version": datetime.utcnow().strftime("%Y%m%d_%H%M%S"),
        "n_samples": len(feat_df),
        "n_features": len(FEATURE_COLS),
        "feature_cols": FEATURE_COLS,
        "xgb_weight": ensemble.xgb_weight,
        "lstm_weight": ensemble.lstm_weight,
        "validation_metrics": avg_metrics,
        "fold_metrics": all_metrics,
        "training_seconds": round(time.time() - t0, 1),
    }

    # Save metadata alongside model
    meta_path = model_path.replace(".pkl", "_metadata.json")
    Path(meta_path).write_text(json.dumps(metadata, indent=2))
    log.info("Model saved → %s (%.1fs)", model_path, metadata["training_seconds"])

    # --- MLflow logging ---
    if use_mlflow:
        try:
            import mlflow
            with mlflow.start_run(run_name=f"{symbol}_{horizon_days}d"):
                mlflow.log_params({
                    "symbol": symbol, "horizon": horizon_days,
                    "n_samples": len(feat_df), "n_features": len(FEATURE_COLS),
                })
                mlflow.log_metrics(avg_metrics)
                mlflow.log_artifact(model_path)
                mlflow.log_artifact(meta_path)
        except Exception as exc:
            log.warning("MLflow logging failed: %s", exc)

    return metadata


# ---------------------------------------------------------------------------
# Batch retraining scheduler
# ---------------------------------------------------------------------------

def retrain_universe(symbols: list[str], horizons: list[int] = [7, 30, 90], **kwargs):
    results = {}
    for symbol in symbols:
        for horizon in horizons:
            try:
                meta = train_symbol(symbol, horizon, **kwargs)
                results[f"{symbol}_{horizon}d"] = {"status": "ok", "metrics": meta["validation_metrics"]}
            except Exception as exc:
                log.error("Failed %s %dd: %s", symbol, horizon, exc)
                results[f"{symbol}_{horizon}d"] = {"status": "error", "error": str(exc)}
    return results


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", default="AAPL")
    parser.add_argument("--horizon", type=int, default=7, choices=[7, 30, 90])
    parser.add_argument("--model-dir", default="backend/ml/models")
    parser.add_argument("--mlflow", action="store_true")
    args = parser.parse_args()

    Path(args.model_dir).mkdir(parents=True, exist_ok=True)
    meta = train_symbol(args.symbol, args.horizon, args.model_dir, use_mlflow=args.mlflow)
    print(json.dumps(meta["validation_metrics"], indent=2))

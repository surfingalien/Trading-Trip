"""
ML Forecasting Engine — XGBoost price forecaster.

Trains an XGBoost regressor on feature-engineered OHLCV data.
Runs purely on CPU (tree_method="hist"), fits in 512MB RAM.
Models are cached in-process for 24 hours per (symbol, horizon) pair.
"""
from __future__ import annotations

import time
import logging
from datetime import datetime, timezone
from typing import Optional

import numpy as np

log = logging.getLogger(__name__)

try:
    import pandas as pd
    import yfinance as yf
    _DATA_AVAILABLE = True
except ImportError:
    _DATA_AVAILABLE = False

try:
    import xgboost as xgb
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import TimeSeriesSplit
    _XGB_AVAILABLE = True
except ImportError:
    _XGB_AVAILABLE = False

# Cache: (symbol, horizon) -> (timestamp, result_dict)
_model_cache: dict[tuple, tuple[float, dict]] = {}
_CACHE_TTL = 24 * 3600  # 24 hours


# ── Feature engineering (self-contained, no backend.ml dependency) ──────────

def _ema(s: "pd.Series", n: int) -> "pd.Series":
    return s.ewm(span=n, adjust=False).mean()


def _rsi(s: "pd.Series", n: int = 14) -> "pd.Series":
    d = s.diff()
    g = d.clip(lower=0).rolling(n).mean()
    l_ = (-d.clip(upper=0)).rolling(n).mean()
    rs = g / l_.replace(0, np.nan)
    return 100 - 100 / (1 + rs)


def _macd_hist(s: "pd.Series") -> "pd.Series":
    m = _ema(s, 12) - _ema(s, 26)
    return m - _ema(m, 9)


def _atr(h: "pd.Series", l: "pd.Series", c: "pd.Series", n: int = 14) -> "pd.Series":
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    return tr.ewm(span=n, adjust=False).mean()


def _bbands_pctb(c: "pd.Series", n: int = 20) -> "pd.Series":
    sma = c.rolling(n).mean()
    std = c.rolling(n).std()
    upper = sma + 2 * std
    lower = sma - 2 * std
    return (c - lower) / (upper - lower).replace(0, np.nan)


def _build_features(df: "pd.DataFrame") -> "pd.DataFrame":
    """Engineer features from OHLCV DataFrame."""
    close  = df["Close"]
    high   = df["High"]
    low    = df["Low"]
    volume = df["Volume"]

    feats = pd.DataFrame(index=df.index)

    # Returns
    feats["ret_1d"]  = close.pct_change(1)
    feats["ret_5d"]  = close.pct_change(5)
    feats["ret_20d"] = close.pct_change(20)
    feats["ret_60d"] = close.pct_change(60)

    # Volatility
    feats["vol_20d"] = feats["ret_1d"].rolling(20).std()
    feats["vol_60d"] = feats["ret_1d"].rolling(60).std()

    # Momentum indicators
    feats["rsi"]       = _rsi(close, 14)
    feats["macd_hist"] = _macd_hist(close)
    feats["bb_pctb"]   = _bbands_pctb(close, 20)

    # EMA features
    ema20  = _ema(close, 20)
    ema50  = _ema(close, 50)
    ema200 = _ema(close, 200)
    feats["price_vs_ema20"]  = (close - ema20)  / ema20
    feats["price_vs_ema50"]  = (close - ema50)  / ema50
    feats["price_vs_ema200"] = (close - ema200) / ema200
    feats["ema20_vs_ema50"]  = (ema20 - ema50)  / ema50

    # ATR ratio (normalised volatility)
    atr = _atr(high, low, close, 14)
    feats["atr_ratio"] = atr / close

    # Volume
    vol_ma20 = volume.rolling(20).mean()
    feats["vol_ratio"] = volume / vol_ma20.replace(0, np.nan)
    feats["vol_trend"] = vol_ma20.pct_change(5)

    # Z-scores (rolling 60-bar)
    for col in ["ret_1d", "rsi", "macd_hist"]:
        mu  = feats[col].rolling(60).mean()
        sig = feats[col].rolling(60).std()
        feats[f"{col}_z"] = (feats[col] - mu) / sig.replace(0, np.nan)

    return feats.replace([np.inf, -np.inf], np.nan)


def xgb_forecast(symbol: str, horizon: int = 7) -> dict:
    """
    Train (or retrieve cached) XGBoost model and return a price forecast.

    Args:
        symbol:  Ticker symbol
        horizon: Forecast horizon in calendar days (7, 30, or 90)

    Returns dict with keys:
        symbol, horizon, current_price, forecast_price, forecast_return_pct,
        confidence_low, confidence_high, directional_accuracy,
        feature_importances (top 5), model_info, available
    """
    sym = symbol.upper()
    key = (sym, horizon)
    now = time.time()

    cached = _model_cache.get(key)
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]

    if not _DATA_AVAILABLE:
        return {"symbol": sym, "horizon": horizon, "available": False, "reason": "pandas/yfinance not installed"}
    if not _XGB_AVAILABLE:
        return {"symbol": sym, "horizon": horizon, "available": False, "reason": "xgboost/sklearn not installed"}

    try:
        df = yf.Ticker(sym).history(period="3y", auto_adjust=True)
        if df is None or len(df) < 120:
            return {"symbol": sym, "horizon": horizon, "available": False, "reason": "insufficient price history"}

        df = df[["Open", "High", "Low", "Close", "Volume"]].copy()

        # Build features
        feats = _build_features(df)

        # Target: forward log-return at horizon days (using trading-day approximation)
        td_horizon = max(1, int(horizon * 5 / 7))  # calendar → trading days
        target = np.log(df["Close"].shift(-td_horizon) / df["Close"])

        # Align and drop NaN
        X = feats.copy()
        y = target.copy()
        mask = (~X.isnull().any(axis=1)) & (~y.isnull())
        X = X[mask]
        y = y[mask]

        if len(X) < 80:
            return {"symbol": sym, "horizon": horizon, "available": False, "reason": "too few valid samples after feature engineering"}

        # Time-series split: last 60 bars = test, rest = train
        n_test = min(60, int(len(X) * 0.15))
        X_train, X_test = X.iloc[:-n_test], X.iloc[-n_test:]
        y_train, y_test = y.iloc[:-n_test], y.iloc[-n_test:]

        scaler = StandardScaler()
        X_train_s = scaler.fit_transform(X_train)
        X_test_s  = scaler.transform(X_test)

        model = xgb.XGBRegressor(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            tree_method="hist",
            n_jobs=1,
            random_state=42,
        )
        model.fit(X_train_s, y_train, eval_set=[(X_test_s, y_test)], verbose=False)

        # Directional accuracy on test set
        y_pred_test = model.predict(X_test_s)
        dir_acc = float(np.mean(np.sign(y_pred_test) == np.sign(y_test)))

        # Predict on the latest complete bar
        latest_feats = feats.iloc[-1:].copy()
        if latest_feats.isnull().any(axis=1).iloc[0]:
            # Fill with last valid
            latest_feats = feats.dropna().iloc[-1:]
        X_latest = scaler.transform(latest_feats)
        log_ret_pred = float(model.predict(X_latest)[0])

        current_price = float(df["Close"].iloc[-1])
        forecast_price = round(current_price * np.exp(log_ret_pred), 2)
        ret_pct = round((forecast_price / current_price - 1) * 100, 2)

        # Confidence interval: ±1 std of test residuals
        residuals = y_pred_test - y_test.values
        ci_std = np.std(residuals)
        ci_low  = round(current_price * np.exp(log_ret_pred - 1.645 * ci_std), 2)
        ci_high = round(current_price * np.exp(log_ret_pred + 1.645 * ci_std), 2)

        # Feature importances (top 5)
        importances = model.feature_importances_
        feat_names = list(X_train.columns)
        top5_idx = np.argsort(importances)[::-1][:5]
        top5 = [{"feature": feat_names[i], "importance": round(float(importances[i]), 4)} for i in top5_idx]

        result = {
            "symbol":               sym,
            "horizon":              horizon,
            "available":            True,
            "current_price":        round(current_price, 2),
            "forecast_price":       forecast_price,
            "forecast_return_pct":  ret_pct,
            "confidence_low":       ci_low,
            "confidence_high":      ci_high,
            "directional_accuracy": round(dir_acc, 3),
            "feature_importances":  top5,
            "training_samples":     len(X_train),
            "model_info":           f"XGBoost-100trees-d4 trained on {len(X_train)} bars",
            "generated_at":         datetime.now(timezone.utc).isoformat(),
        }
        _model_cache[key] = (now, result)
        return result

    except Exception as exc:
        log.exception("XGBoost forecast failed for %s h=%d: %s", sym, horizon, exc)
        return {"symbol": sym, "horizon": horizon, "available": False, "reason": str(exc)}

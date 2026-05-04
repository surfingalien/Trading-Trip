"""
Feature Engineering Pipeline for ML Price Prediction.

Produces a feature matrix from raw OHLCV + macro data with:
  • Lag features (5d, 20d, 60d returns & volatility)
  • Technical indicators (EMA crossovers, RSI, MACD, Bollinger %B, ATR)
  • Volume profile features
  • Macro context (VIX level, SPY trend)
  • Rolling z-score normalization
  • No look-ahead bias — all features computed from t=0 perspective
"""
from __future__ import annotations
import warnings
from typing import Optional

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore", category=FutureWarning)


# ---------------------------------------------------------------------------
# Technical helpers (self-contained — no TA-Lib dependency)
# ---------------------------------------------------------------------------

def _ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False).mean()


def _rsi(s: pd.Series, n: int = 14) -> pd.Series:
    d = s.diff()
    g = d.clip(lower=0).rolling(n).mean()
    l_ = (-d.clip(upper=0)).rolling(n).mean()
    rs = g / l_.replace(0, np.nan)
    return 100 - 100 / (1 + rs)


def _macd(s: pd.Series, fast=12, slow=26, sig=9):
    m = _ema(s, fast) - _ema(s, slow)
    return m, _ema(m, sig), m - _ema(m, sig)


def _atr(h, l, c, n=14) -> pd.Series:
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    return tr.ewm(span=n, adjust=False).mean()


def _bbands(c, n=20, k=2.0):
    sma = c.rolling(n).mean()
    std = c.rolling(n).std()
    upper = sma + k * std
    lower = sma - k * std
    pct_b = (c - lower) / (upper - lower).replace(0, np.nan)
    bw    = (upper - lower) / sma.replace(0, np.nan)
    return upper, sma, lower, pct_b, bw


def _zscore(s: pd.Series, window: int) -> pd.Series:
    mean = s.rolling(window).mean()
    std  = s.rolling(window).std()
    return (s - mean) / std.replace(0, np.nan)


def _volume_profile(vol: pd.Series, n: int = 20) -> pd.Series:
    """Volume relative to rolling average."""
    return vol / vol.rolling(n).mean().replace(0, np.nan)


# ---------------------------------------------------------------------------
# Feature column names (used for consistent ordering across train/inference)
# ---------------------------------------------------------------------------

FEATURE_COLS = [
    # Price returns (lag features)
    "ret_1d", "ret_5d", "ret_20d", "ret_60d",
    # Volatility
    "vol_5d", "vol_20d", "vol_60d",
    # EMA-based features
    "ema8_cross_ema21",     # EMA8 - EMA21 / price
    "ema21_cross_ema55",
    "price_vs_ema200",      # (price - EMA200) / price
    # RSI
    "rsi_14", "rsi_z_20",
    # MACD
    "macd_hist", "macd_hist_delta",
    # Bollinger Bands
    "bb_pct_b", "bb_width",
    # ATR (normalised)
    "atr_pct",
    # Volume
    "vol_ratio_5d", "vol_ratio_20d",
    "vol_price_trend",      # correlation of volume & price last 5d
    # Momentum
    "mom_10d", "mom_20d",
    # Calendar
    "day_of_week",          # 0=Mon…4=Fri
    "month",
    # Macro (filled from regime endpoint or defaults)
    "vix_level", "vix_regime",   # 0=low, 1=normal, 2=high, 3=extreme
    "spy_trend",                  # 1=bullish, -1=bearish, 0=neutral
]


# ---------------------------------------------------------------------------
# Main feature builder
# ---------------------------------------------------------------------------

def build_features(
    df: pd.DataFrame,
    vix_series: Optional[pd.Series] = None,
    spy_series: Optional[pd.Series] = None,
    include_target: bool = True,
    horizon_days: int = 7,
) -> pd.DataFrame:
    """
    Parameters
    ----------
    df            : OHLCV dataframe with columns [open, high, low, close, volume].
                    Index must be DatetimeIndex, sorted ascending.
    vix_series    : Optional VIX daily close series aligned to df.index.
    spy_series    : Optional SPY daily close series aligned to df.index.
    include_target: If True, append forward return columns (training mode).
    horizon_days  : Target horizon in days (7, 30, 90).

    Returns
    -------
    DataFrame with FEATURE_COLS + optionally "target_ret" and "target_dir".
    NaN rows from warmup period are dropped.
    """
    df = df.copy()
    c = df["close"]
    h = df["high"]
    l = df["low"]
    v = df["volume"].astype(float)

    feat = pd.DataFrame(index=df.index)

    # --- Returns ---
    feat["ret_1d"]  = c.pct_change(1)
    feat["ret_5d"]  = c.pct_change(5)
    feat["ret_20d"] = c.pct_change(20)
    feat["ret_60d"] = c.pct_change(60)

    # --- Rolling volatility (log returns std) ---
    lr = np.log(c / c.shift(1))
    feat["vol_5d"]  = lr.rolling(5).std()  * np.sqrt(252)
    feat["vol_20d"] = lr.rolling(20).std() * np.sqrt(252)
    feat["vol_60d"] = lr.rolling(60).std() * np.sqrt(252)

    # --- EMA crossovers (normalised by price) ---
    e8   = _ema(c, 8)
    e21  = _ema(c, 21)
    e55  = _ema(c, 55)
    e200 = _ema(c, 200)
    feat["ema8_cross_ema21"]  = (e8 - e21) / c
    feat["ema21_cross_ema55"] = (e21 - e55) / c
    feat["price_vs_ema200"]   = (c - e200) / c

    # --- RSI ---
    feat["rsi_14"]  = _rsi(c, 14) / 100   # normalise to [0,1]
    feat["rsi_z_20"] = _zscore(_rsi(c, 14), 20) / 4  # z-score clipped

    # --- MACD ---
    _, _, hist = _macd(c)
    feat["macd_hist"]       = hist / c
    feat["macd_hist_delta"] = hist.diff(1) / c

    # --- Bollinger ---
    _, _, _, pct_b, bw = _bbands(c, 20)
    feat["bb_pct_b"] = pct_b
    feat["bb_width"]  = bw

    # --- ATR ---
    atr = _atr(h, l, c, 14)
    feat["atr_pct"] = atr / c

    # --- Volume ---
    feat["vol_ratio_5d"]  = _volume_profile(v, 5)
    feat["vol_ratio_20d"] = _volume_profile(v, 20)
    # volume–price correlation over 5 days
    feat["vol_price_trend"] = (
        pd.concat([v.pct_change(), c.pct_change()], axis=1)
        .rolling(5)
        .corr()
        .unstack()
        .iloc[:, 1]  # corr of vol with price
        if False else feat["vol_ratio_5d"] * feat["ret_5d"]  # simplified proxy
    )
    feat["vol_price_trend"] = v.pct_change().rolling(5).corr(c.pct_change())

    # --- Momentum ---
    feat["mom_10d"] = c / c.shift(10) - 1
    feat["mom_20d"] = c / c.shift(20) - 1

    # --- Calendar ---
    feat["day_of_week"] = df.index.dayofweek.astype(float) / 4  # normalise
    feat["month"]       = (df.index.month.astype(float) - 1) / 11

    # --- Macro ---
    if vix_series is not None:
        aligned_vix = vix_series.reindex(df.index).ffill()
        feat["vix_level"] = aligned_vix / 40  # normalise (40 ≈ historical high)
        feat["vix_regime"] = pd.cut(
            aligned_vix,
            bins=[-np.inf, 15, 20, 25, np.inf],
            labels=[0, 1, 2, 3],
        ).astype(float) / 3
    else:
        feat["vix_level"]  = 0.5
        feat["vix_regime"] = 0.33

    if spy_series is not None:
        spy_a = spy_series.reindex(df.index).ffill()
        spy_e50  = _ema(spy_a, 50)
        spy_e200 = _ema(spy_a, 200)
        feat["spy_trend"] = np.where(
            spy_a > spy_e50,  1.0,
            np.where(spy_a < spy_e200, -1.0, 0.0)
        )
    else:
        feat["spy_trend"] = 0.0

    # --- Targets (training mode only) ---
    if include_target:
        fwd_ret = c.pct_change(horizon_days).shift(-horizon_days)
        feat["target_ret"] = fwd_ret
        feat["target_dir"] = (fwd_ret > 0).astype(int)

    # Drop NaN warmup rows
    feat = feat.replace([np.inf, -np.inf], np.nan)
    required = [col for col in FEATURE_COLS if col in feat.columns]
    feat = feat.dropna(subset=required)

    return feat[required + (["target_ret", "target_dir"] if include_target else [])]


# ---------------------------------------------------------------------------
# Walk-forward splitter (no look-ahead bias)
# ---------------------------------------------------------------------------

def walk_forward_splits(
    df: pd.DataFrame,
    n_splits: int = 5,
    train_min_rows: int = 252,    # ~1 year
    val_rows: int = 63,           # ~1 quarter
    gap_rows: int = 5,            # buffer between train/val to avoid leakage
):
    """
    Yields (train_idx, val_idx) tuples for purged walk-forward validation.
    """
    n = len(df)
    step = max((n - train_min_rows - val_rows - gap_rows) // n_splits, 1)
    for i in range(n_splits):
        train_end = train_min_rows + i * step
        val_start = train_end + gap_rows
        val_end   = val_start + val_rows
        if val_end > n:
            break
        train_idx = df.index[:train_end]
        val_idx   = df.index[val_start:val_end]
        yield train_idx, val_idx


# ---------------------------------------------------------------------------
# Feature importance summary
# ---------------------------------------------------------------------------

def feature_importance_summary(model, feature_names: list[str]) -> pd.DataFrame:
    """Returns a sorted importance DataFrame for XGBoost/LightGBM models."""
    try:
        imps = model.feature_importances_
        return (
            pd.DataFrame({"feature": feature_names, "importance": imps})
            .sort_values("importance", ascending=False)
            .reset_index(drop=True)
        )
    except AttributeError:
        return pd.DataFrame()

"""
Portfolio Optimizer — Mean-Variance / Max-Sharpe optimization.

Uses scipy SLSQP solver with Monte Carlo frontier mapping.
All computation is pure numpy/pandas/scipy — no GPU needed.
"""
from __future__ import annotations

import time
import logging
from typing import List, Optional

import numpy as np

log = logging.getLogger(__name__)

try:
    import pandas as pd
    import yfinance as yf
    _DATA_AVAILABLE = True
except ImportError:
    _DATA_AVAILABLE = False

try:
    from scipy.optimize import minimize
    _SCIPY_AVAILABLE = True
except ImportError:
    _SCIPY_AVAILABLE = False

_CACHE_TTL = 3600  # 1 hour
_cache: dict[str, tuple[float, dict]] = {}


def _get_returns(symbols: List[str]) -> Optional["pd.DataFrame"]:
    """Download 1-year daily close prices and return a returns DataFrame."""
    try:
        if len(symbols) == 1:
            df = yf.Ticker(symbols[0]).history(period="1y", auto_adjust=True)[["Close"]]
            df.columns = symbols
        else:
            raw = yf.download(symbols, period="1y", auto_adjust=True, progress=False)
            if isinstance(raw.columns, pd.MultiIndex):
                df = raw["Close"]
            else:
                df = raw[["Close"]]
                df.columns = symbols
        df = df.dropna(how="all").dropna(axis=1, how="any")
        return df.pct_change().dropna()
    except Exception as exc:
        log.warning("price download failed: %s", exc)
        return None


def optimize_portfolio(symbols: List[str], current_weights: Optional[dict] = None,
                       risk_free_rate: float = 0.04) -> dict:
    """
    Compute Max-Sharpe portfolio and compare to current weights.

    Returns optimized_weights, current_sharpe, optimized_sharpe,
    rebalance_suggestions, frontier_points (for chart).
    """
    if not _DATA_AVAILABLE:
        return {"available": False, "reason": "pandas/yfinance not installed"}
    if not _SCIPY_AVAILABLE:
        return {"available": False, "reason": "scipy not installed"}

    symbols = [s.upper() for s in symbols[:20]]
    cache_key = ",".join(sorted(symbols))
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]

    returns = _get_returns(symbols)
    if returns is None or returns.empty or len(returns) < 30:
        return {"available": False, "reason": "insufficient price data for portfolio optimization"}

    # Use only symbols that survived download
    available_syms = list(returns.columns)
    n = len(available_syms)

    # Annualised stats
    mu  = returns.mean() * 252          # expected returns
    cov = returns.cov() * 252           # covariance
    rf_daily = risk_free_rate / 252

    def neg_sharpe(w):
        port_ret = float(w @ mu)
        port_vol = float(np.sqrt(w @ cov.values @ w))
        return -(port_ret - risk_free_rate) / (port_vol + 1e-9)

    def port_vol(w):
        return float(np.sqrt(w @ cov.values @ w))

    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}]
    bounds = [(0.01, 0.60)] * n  # 1-60% per asset
    w0 = np.ones(n) / n

    res = minimize(neg_sharpe, w0, method="SLSQP", bounds=bounds, constraints=constraints,
                   options={"ftol": 1e-9, "maxiter": 500})

    opt_weights = res.x if res.success else w0
    opt_weights = opt_weights / opt_weights.sum()

    opt_ret = float(opt_weights @ mu)
    opt_vol = float(np.sqrt(opt_weights @ cov.values @ opt_weights))
    opt_sharpe = (opt_ret - risk_free_rate) / (opt_vol + 1e-9)

    # Current portfolio stats
    if current_weights:
        cw_vec = np.array([current_weights.get(s, 0.0) for s in available_syms], dtype=float)
        total = cw_vec.sum()
        cw_vec = cw_vec / total if total > 0 else w0
    else:
        cw_vec = w0

    cur_ret = float(cw_vec @ mu)
    cur_vol = float(np.sqrt(cw_vec @ cov.values @ cw_vec))
    cur_sharpe = (cur_ret - risk_free_rate) / (cur_vol + 1e-9)

    # Rebalance suggestions
    suggestions = []
    for sym, cw, ow in zip(available_syms, cw_vec, opt_weights):
        diff = float(ow - cw)
        suggestions.append({
            "symbol":       sym,
            "current_pct":  round(float(cw) * 100, 1),
            "optimal_pct":  round(float(ow) * 100, 1),
            "delta_pct":    round(diff * 100, 1),
            "action":       "increase" if diff > 0.02 else ("decrease" if diff < -0.02 else "hold"),
        })
    suggestions.sort(key=lambda x: abs(x["delta_pct"]), reverse=True)

    # Monte Carlo frontier (2000 random portfolios)
    np.random.seed(42)
    mc_rets, mc_vols, mc_sharpes = [], [], []
    for _ in range(2000):
        w = np.random.dirichlet(np.ones(n))
        r = float(w @ mu)
        v = float(np.sqrt(w @ cov.values @ w))
        mc_rets.append(round(r * 100, 2))
        mc_vols.append(round(v * 100, 2))
        mc_sharpes.append(round((r - risk_free_rate) / (v + 1e-9), 3))

    # Return ~60 frontier points for the chart (thin the 2000 to avoid bloat)
    frontier_indices = sorted(range(2000), key=lambda i: mc_vols[i])[::33]
    frontier_points = [
        {"vol": mc_vols[i], "ret": mc_rets[i], "sharpe": mc_sharpes[i]}
        for i in frontier_indices
    ]

    result = {
        "available":        True,
        "symbols":          available_syms,
        "optimized_weights": {s: round(float(w), 4) for s, w in zip(available_syms, opt_weights)},
        "current_weights":   {s: round(float(w), 4) for s, w in zip(available_syms, cw_vec)},
        "current_return_pct":   round(cur_ret * 100, 2),
        "current_vol_pct":      round(cur_vol * 100, 2),
        "current_sharpe":       round(cur_sharpe, 3),
        "optimized_return_pct": round(opt_ret * 100, 2),
        "optimized_vol_pct":    round(opt_vol * 100, 2),
        "optimized_sharpe":     round(opt_sharpe, 3),
        "sharpe_improvement_pct": round((opt_sharpe - cur_sharpe) / (abs(cur_sharpe) + 1e-9) * 100, 1),
        "rebalance_suggestions": suggestions,
        "frontier_points":       frontier_points,
        "optimization_success":  res.success,
    }
    _cache[cache_key] = (now, result)
    return result


def compute_correlation_matrix(symbols: List[str]) -> dict:
    """Return correlation matrix for a list of symbols (for heatmap rendering)."""
    symbols = [s.upper() for s in symbols[:20]]
    if not _DATA_AVAILABLE:
        return {"available": False}
    returns = _get_returns(symbols)
    if returns is None or returns.empty:
        return {"available": False, "reason": "no data"}

    available_syms = list(returns.columns)
    corr = returns.corr()
    matrix = []
    for s1 in available_syms:
        row = []
        for s2 in available_syms:
            row.append(round(float(corr.loc[s1, s2]), 3) if s1 in corr and s2 in corr.columns else 0.0)
        matrix.append(row)

    return {
        "available": True,
        "symbols":   available_syms,
        "matrix":    matrix,
    }

"""
Trading Analysis API — FastAPI server wrapping tradingview-mcp skills.
Run: uvicorn server:app --reload --port 8000
"""
from __future__ import annotations

import sys
import os
import glob

# Auto-discover site-packages for tradingview-mcp-server
_candidates = glob.glob(
    os.path.expanduser("~/.local/share/uv/tools/tradingview-mcp-server/lib/python*/site-packages")
)
if _candidates:
    sys.path.insert(0, _candidates[0])

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from tradingview_mcp.core.services.yahoo_finance_service import get_price, get_market_snapshot
from tradingview_mcp.core.services.backtest_service import (
    run_backtest,
    compare_strategies,
    walk_forward_backtest,
)
from tradingview_mcp.core.services.sentiment_service import analyze_sentiment
from tradingview_mcp.core.services.news_service import fetch_news_summary

app = FastAPI(title="Trading Analysis API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/price/{symbol}")
def price(symbol: str):
    try:
        return get_price(symbol.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/prices")
def prices(symbols: str = Query(..., description="Comma-separated symbols")):
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    results = []
    for sym in syms:
        try:
            results.append(get_price(sym))
        except Exception as e:
            results.append({"symbol": sym, "error": str(e)})
    return results


@app.get("/api/snapshot")
def snapshot():
    try:
        return get_market_snapshot()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/backtest/{symbol}")
def backtest(
    symbol: str,
    strategy: str = Query("rsi", description="rsi|bollinger|macd|ema_cross|supertrend|donchian"),
    period: str = Query("1y", description="1mo|3mo|6mo|1y|2y"),
    interval: str = Query("1d", description="1h|1d"),
):
    try:
        return run_backtest(symbol.upper(), strategy, period, interval=interval)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/compare/{symbol}")
def compare(symbol: str, period: str = Query("1y")):
    try:
        return compare_strategies(symbol.upper(), period)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/walkforward/{symbol}")
def walkforward(
    symbol: str,
    strategy: str = Query("rsi"),
    period: str = Query("2y"),
    n_splits: int = Query(3),
):
    try:
        return walk_forward_backtest(symbol.upper(), strategy, period, n_splits=n_splits)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sentiment/{symbol}")
def sentiment(symbol: str):
    try:
        return analyze_sentiment(symbol.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/news/{symbol}")
def news(symbol: str):
    try:
        return fetch_news_summary(symbol.upper())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/portfolio/analysis")
def portfolio_analysis(symbols: str = Query(...)):
    """Run backtest + price for every symbol in the portfolio."""
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    results = []
    for sym in syms:
        try:
            price_data = get_price(sym)
            bt = run_backtest(sym, "rsi", "1y")
            results.append({
                "symbol": sym,
                "price": price_data,
                "backtest": {
                    "return_pct": bt.get("total_return_pct"),
                    "win_rate": bt.get("win_rate_pct"),
                    "sharpe": bt.get("sharpe_ratio"),
                    "max_drawdown": bt.get("max_drawdown_pct"),
                    "total_trades": bt.get("total_trades"),
                },
            })
        except Exception as e:
            results.append({"symbol": sym, "error": str(e)})
    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)

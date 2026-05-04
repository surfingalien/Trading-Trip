"""
FinSight v2 — FastAPI Application Entry Point.

Endpoints:
  GET /api/search?q=...&limit=10              → ranked instrument search
  GET /api/tips/{symbol}?portfolio_equity=...  → trade plan (entry/SL/TP/sizing)
  GET /api/regime                              → market regime classification
  GET /api/predict?symbol=...&horizon=7|30|90 → ML price forecast
  GET /api/quotes?symbols=AAPL,MSFT           → batch real-time quotes
  GET /healthz                                 → liveness probe

Run:
  uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
"""
from __future__ import annotations
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from backend.config import get_settings
from backend.api import search, trading_tips, market_regime, predict
from backend.services.cache import get_cache

log = logging.getLogger(__name__)
cfg = get_settings()

logging.basicConfig(
    level=logging.DEBUG if cfg.DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)


# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("FinSight API v%s starting up", cfg.APP_VERSION)
    # Warm cache connection
    cache = await get_cache()
    log.info("Cache backend: %s", type(cache._b).__name__)
    # Schedule weekly retraining (non-blocking)
    _schedule_ml_retraining()
    yield
    log.info("Shutting down")
    await cache.close()


def _schedule_ml_retraining():
    """Register weekly APScheduler job for ML retraining."""
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
        from backend.ml.pipeline import retrain_universe

        DEFAULT_UNIVERSE = [
            "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL",
            "TSLA", "META", "AVGO", "AMD", "COIN",
        ]

        async def _retrain():
            log.info("Weekly ML retraining triggered")
            retrain_universe(DEFAULT_UNIVERSE, horizons=[7, 30, 90],
                             model_dir=cfg.MODEL_DIR)

        scheduler = AsyncIOScheduler()
        scheduler.add_job(_retrain, CronTrigger.from_crontab(cfg.RETRAIN_SCHEDULE))
        scheduler.start()
        log.info("ML retraining scheduled: %s", cfg.RETRAIN_SCHEDULE)
    except Exception as exc:
        log.warning("APScheduler not available: %s", exc)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title=cfg.APP_NAME,
    version=cfg.APP_VERSION,
    description="Real-time portfolio intelligence with search, trading tips, regime detection, and ML forecasting.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# --- CORS ---
origins = [o.strip() for o in cfg.ALLOWED_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=500)

# --- Routers ---
app.include_router(search.router)
app.include_router(trading_tips.router)
app.include_router(market_regime.router)
app.include_router(predict.router)


# ---------------------------------------------------------------------------
# Core endpoints
# ---------------------------------------------------------------------------

@app.get("/healthz", tags=["Meta"])
async def health():
    cache = await get_cache()
    cache_ok = True
    try:
        await cache.set("_ping", "1", ex=5)
        await cache.get("_ping")
    except Exception:
        cache_ok = False
    return {"status": "ok", "version": cfg.APP_VERSION, "cache": cache_ok}


@app.get("/api/quotes", tags=["Prices"])
async def batch_quotes(
    symbols: str = Query(..., description="Comma-separated list of symbols"),
):
    """Return real-time quotes for up to 30 symbols."""
    from backend.services.data_provider import fetch_quotes_batch
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()][:30]
    if not syms:
        raise HTTPException(status_code=400, detail="No valid symbols provided")
    quotes = await fetch_quotes_batch(syms)
    return {"quotes": quotes, "count": len(quotes)}


@app.get("/api/history/{symbol}", tags=["Prices"])
async def symbol_history(
    symbol: str,
    period: str = Query("1y", description="1mo, 3mo, 6mo, 1y, 2y, 5y"),
    interval: str = Query("1d", description="1d, 1wk, 1mo"),
):
    """OHLCV history for charting."""
    from backend.services.data_provider import fetch_history
    allowed_periods = {"1mo", "3mo", "6mo", "1y", "2y", "5y"}
    allowed_intervals = {"1d", "1wk", "1mo"}
    if period not in allowed_periods or interval not in allowed_intervals:
        raise HTTPException(status_code=400, detail="Invalid period or interval")
    try:
        df = await fetch_history(symbol.upper(), period=period, interval=interval)
        return {
            "symbol": symbol.upper(),
            "period": period,
            "interval": interval,
            "data": df.reset_index().rename(columns={"index": "date"}).to_dict(orient="records"),
        }
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ---------------------------------------------------------------------------
# Global error handler
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    log.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

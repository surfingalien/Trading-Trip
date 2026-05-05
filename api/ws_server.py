"""
WebSocket server for real-time price streaming.
Broadcasts prices every 5 seconds to all connected clients.
Run alongside main server: python ws_server.py
"""
import asyncio
import json
import sys
import os
import glob

# Local dev: find tradingview-mcp-server installed via uv tool
_uv_candidates = glob.glob(
    os.path.expanduser("~/.local/share/uv/tools/tradingview-mcp-server/lib/python*/site-packages")
)
if _uv_candidates and _uv_candidates[0] not in sys.path:
    sys.path.insert(0, _uv_candidates[0])

try:
    from tradingview_mcp.core.services.yahoo_finance_service import get_price as _tv_get_price
    _TV_AVAILABLE = True
except ImportError:
    _TV_AVAILABLE = False

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware


def _get_price_yf(symbol: str) -> dict:
    """yfinance fallback for price fetching."""
    import yfinance as yf
    ticker = yf.Ticker(symbol)
    info = ticker.fast_info
    price = getattr(info, "last_price", None) or getattr(info, "regular_market_price", None)
    prev = getattr(info, "previous_close", None) or getattr(info, "regular_market_previous_close", None)
    change = round(price - prev, 4) if price and prev else 0
    change_pct = round(change / prev * 100, 2) if prev else 0
    return {"symbol": symbol, "price": round(price, 4) if price else None,
            "change": change, "change_pct": change_pct}


def get_price(symbol: str) -> dict:
    if _TV_AVAILABLE:
        try:
            return _tv_get_price(symbol)
        except Exception:
            pass
    return _get_price_yf(symbol)


SYMBOLS = [
    "AAPL", "ADSK", "AMD", "AMZN", "AVGO", "BABA", "BROS", "CL",
    "COIN", "GOOG", "INTC", "MSFT", "NVDA", "ORCL", "PG", "QCOM",
    "SOUN", "TSLA", "TSM", "TXN", "XOM",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(broadcast_loop())
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://surfingalien.github.io",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

clients: set[WebSocket] = set()


@app.get("/health")
@app.get("/healthz")
def health():
    return {"status": "ok"}


async def broadcast_loop():
    while True:
        if clients:
            prices = await asyncio.get_event_loop().run_in_executor(
                None, lambda: [get_price(s) for s in SYMBOLS]
            )
            msg = json.dumps({"type": "prices", "data": prices})
            dead = set()
            for ws in clients:
                try:
                    await ws.send_text(msg)
                except Exception:
                    dead.add(ws)
            clients.difference_update(dead)
        await asyncio.sleep(5)


@app.websocket("/ws/prices")
async def ws_prices(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    try:
        prices = await asyncio.get_event_loop().run_in_executor(
            None, lambda: [get_price(s) for s in SYMBOLS]
        )
        await ws.send_text(json.dumps({"type": "prices", "data": prices}))
        while True:
            await asyncio.sleep(30)  # keep-alive
    except WebSocketDisconnect:
        clients.discard(ws)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)

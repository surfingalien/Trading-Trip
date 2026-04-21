"""
WebSocket server for real-time price streaming.
Broadcasts prices every 5 seconds to all connected clients.
Run alongside main server: python ws_server.py
"""
import asyncio
import json
import sys, os, glob

_candidates = glob.glob(
    os.path.expanduser("~/.local/share/uv/tools/tradingview-mcp-server/lib/python*/site-packages")
)
if _candidates:
    sys.path.insert(0, _candidates[0])

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from tradingview_mcp.core.services.yahoo_finance_service import get_price

SYMBOLS = [
    "AAPL","ADSK","AMD","AMZN","AVGO","BABA","BROS","CL",
    "COIN","GOOG","INTC","MSFT","NVDA","ORCL","PG","QCOM",
    "SOUN","TSLA","TSM","TXN","XOM",
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


async def fetch_prices():
    results = []
    for sym in SYMBOLS:
        try:
            results.append(get_price(sym))
        except Exception as e:
            results.append({"symbol": sym, "error": str(e)})
    return results


async def broadcast_loop():
    while True:
        if clients:
            prices = await asyncio.get_event_loop().run_in_executor(None, lambda: [
                get_price(s) for s in SYMBOLS
            ])
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
        # Send initial snapshot immediately
        prices = await asyncio.get_event_loop().run_in_executor(None, lambda: [
            get_price(s) for s in SYMBOLS
        ])
        await ws.send_text(json.dumps({"type": "prices", "data": prices}))
        while True:
            await asyncio.sleep(30)  # keep alive
    except WebSocketDisconnect:
        clients.discard(ws)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

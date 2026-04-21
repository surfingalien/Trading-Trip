#!/bin/bash
# Start the Trading Analysis API backend
VENV="$HOME/.local/share/uv/tools/tradingview-mcp-server"
cd "$(dirname "$0")"
echo "Starting Trading Analysis API on http://localhost:8000"
echo "Interactive docs: http://localhost:8000/docs"
"$VENV/bin/uvicorn" server:app --reload --host 0.0.0.0 --port 8000

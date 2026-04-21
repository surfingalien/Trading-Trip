FROM python:3.10-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy project files
COPY ../../pyproject.toml ../../uv.lock ./
COPY ../../src ./src

# Install all dependencies including fastapi/uvicorn
RUN uv pip install --system \
    fastapi \
    uvicorn[standard] \
    tradingview-screener \
    tradingview-ta \
    feedparser \
    yfinance \
    praw \
    "mcp[cli]"

# Install the package itself
RUN uv pip install --system -e .

COPY . .

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]

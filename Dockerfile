# Use the official Python image
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv package manager
RUN curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR="/usr/local/bin" sh

# Set the working directory
WORKDIR /app

# Copy dependency files first for caching
COPY pyproject.toml .

# Install dependencies using uv
RUN uv pip install --system -e .

# Copy the rest of the application code
COPY . .

# Create non-root user for security
RUN useradd -m mcpuser
RUN chown -R mcpuser:mcpuser /app
USER mcpuser

# Expose the HTTP port (FastMCP defaults)
EXPOSE 8000

# Run the server. Using streamable-http for Docker deployments by default
ENTRYPOINT ["tradingview-mcp"]
CMD ["streamable-http", "--host", "0.0.0.0", "--port", "8000"]

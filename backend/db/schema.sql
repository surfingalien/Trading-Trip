-- ============================================================
-- FinSight v2 — PostgreSQL Schema
-- Enable extensions first
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;        -- fuzzy search
CREATE EXTENSION IF NOT EXISTS btree_gin;       -- GIN index support
CREATE EXTENSION IF NOT EXISTS vector;          -- pgvector for embeddings (optional)

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email       TEXT UNIQUE NOT NULL,
    display_name TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INSTRUMENT CATALOG  (search index source of truth)
-- ============================================================
CREATE TABLE instruments (
    symbol          TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    exchange        TEXT,               -- NASDAQ, NYSE, AMEX, etc.
    asset_type      TEXT DEFAULT 'stock', -- stock, etf, crypto, index
    sector          TEXT,
    industry        TEXT,
    isin            TEXT,
    market_cap_tier TEXT,               -- mega, large, mid, small, micro, nano
    country         TEXT DEFAULT 'US',
    currency        TEXT DEFAULT 'USD',
    is_active       BOOLEAN DEFAULT TRUE,
    description     TEXT,
    -- FTS vector generated from symbol + name + sector + keywords
    search_vector   tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(symbol, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(name, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(sector, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(industry, '')), 'D')
    ) STORED,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigram index for fuzzy partial matching
CREATE INDEX idx_instruments_symbol_trgm  ON instruments USING gin (symbol gin_trgm_ops);
CREATE INDEX idx_instruments_name_trgm    ON instruments USING gin (name gin_trgm_ops);
-- Full-text search index
CREATE INDEX idx_instruments_fts          ON instruments USING gin (search_vector);
-- Exchange + sector filters
CREATE INDEX idx_instruments_exchange     ON instruments (exchange);
CREATE INDEX idx_instruments_sector       ON instruments (sector);
CREATE INDEX idx_instruments_active       ON instruments (is_active) WHERE is_active;

-- Synonym mapping (e.g., "Apple" → AAPL)
CREATE TABLE search_synonyms (
    id          SERIAL PRIMARY KEY,
    alias       TEXT NOT NULL,          -- e.g., "Apple", "Cupertino"
    symbol      TEXT REFERENCES instruments(symbol) ON DELETE CASCADE,
    alias_lower TEXT GENERATED ALWAYS AS (lower(alias)) STORED
);
CREATE INDEX idx_synonyms_alias ON search_synonyms USING gin (alias_lower gin_trgm_ops);

-- ============================================================
-- PORTFOLIOS & HOLDINGS
-- ============================================================
CREATE TABLE portfolios (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL DEFAULT 'My Portfolio',
    currency    TEXT DEFAULT 'USD',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE holdings (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    symbol      TEXT REFERENCES instruments(symbol),
    shares      NUMERIC(18, 6) NOT NULL CHECK (shares > 0),
    avg_cost    NUMERIC(18, 4) NOT NULL,
    opened_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes       TEXT
);
CREATE INDEX idx_holdings_portfolio ON holdings (portfolio_id);
CREATE INDEX idx_holdings_symbol    ON holdings (symbol);

CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id    UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    symbol          TEXT NOT NULL,
    tx_type         TEXT NOT NULL CHECK (tx_type IN ('buy','sell','dividend','split')),
    shares          NUMERIC(18, 6) NOT NULL,
    price           NUMERIC(18, 4) NOT NULL,
    commission      NUMERIC(10, 4) DEFAULT 0,
    executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes           TEXT
);
CREATE INDEX idx_tx_portfolio  ON transactions (portfolio_id, executed_at DESC);
CREATE INDEX idx_tx_symbol     ON transactions (symbol, executed_at DESC);

-- Cash balances per portfolio
CREATE TABLE cash_positions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id    UUID REFERENCES portfolios(id) ON DELETE CASCADE UNIQUE,
    value           NUMERIC(18, 4) NOT NULL DEFAULT 0,
    currency        TEXT DEFAULT 'USD',
    apy             NUMERIC(6,4) DEFAULT 0,
    label           TEXT DEFAULT 'Cash'
);

-- ============================================================
-- PRICE DATA  (materialized for backtesting & analytics)
-- ============================================================
CREATE TABLE daily_prices (
    symbol      TEXT NOT NULL,
    date        DATE NOT NULL,
    open        NUMERIC(18,4),
    high        NUMERIC(18,4),
    low         NUMERIC(18,4),
    close       NUMERIC(18,4) NOT NULL,
    adj_close   NUMERIC(18,4),
    volume      BIGINT,
    PRIMARY KEY (symbol, date)
);
-- Hypertable-style range partition on date for large datasets
CREATE INDEX idx_prices_symbol_date ON daily_prices (symbol, date DESC);

-- ============================================================
-- TRADING TIPS  (cached rule-based signals per symbol)
-- ============================================================
CREATE TABLE trading_signals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol          TEXT NOT NULL,
    signal_type     TEXT NOT NULL, -- 'buy_setup', 'sell_setup', 'neutral'
    entry_low       NUMERIC(18,4),
    entry_high      NUMERIC(18,4),
    stop_loss       NUMERIC(18,4),
    tp1             NUMERIC(18,4),
    tp2             NUMERIC(18,4),
    rr_ratio        NUMERIC(6,3),
    confidence      NUMERIC(5,2),  -- 0-100
    rationale       JSONB,         -- {"technical":[], "fundamental":[], "macro":[]}
    regime_context  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);
CREATE INDEX idx_signals_symbol     ON trading_signals (symbol, created_at DESC);
CREATE INDEX idx_signals_expires    ON trading_signals (expires_at);

-- ============================================================
-- ML PREDICTIONS
-- ============================================================
CREATE TABLE ml_predictions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol          TEXT NOT NULL,
    horizon_days    INT NOT NULL CHECK (horizon_days IN (7, 30, 90)),
    predicted_price NUMERIC(18,4),
    lower_bound     NUMERIC(18,4),  -- 10th percentile
    upper_bound     NUMERIC(18,4),  -- 90th percentile
    prob_up_5pct    NUMERIC(5,4),
    prob_up_10pct   NUMERIC(5,4),
    prob_up_15pct   NUMERIC(5,4),
    base_price      NUMERIC(18,4),  -- price at prediction time
    model_version   TEXT,
    features_hash   TEXT,           -- SHA256 of input feature vector
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY     (id)
);
CREATE UNIQUE INDEX idx_predictions_latest
    ON ml_predictions (symbol, horizon_days, date_trunc('hour', created_at) DESC);
CREATE INDEX idx_predictions_symbol ON ml_predictions (symbol, horizon_days, created_at DESC);

-- ============================================================
-- MARKET REGIME  (cached macro state)
-- ============================================================
CREATE TABLE market_regimes (
    id              SERIAL PRIMARY KEY,
    regime          TEXT NOT NULL,      -- 'bullish_trend','bearish_trend','range_bound','high_vol_stress'
    vix             NUMERIC(8,4),
    spy_vs_50ma     NUMERIC(8,4),
    spy_vs_200ma    NUMERIC(8,4),
    breadth_adv_dec NUMERIC(8,4),
    pct_above_200ma NUMERIC(8,4),
    put_call_ratio  NUMERIC(8,4),
    dxy_trend       TEXT,
    recommended_action TEXT,
    risk_environment   TEXT,
    raw_indicators  JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_regime_created ON market_regimes (created_at DESC);

-- ============================================================
-- SEARCH AUDIT / RECENT SEARCHES  (per-user, for UX)
-- ============================================================
CREATE TABLE search_history (
    id          SERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    query       TEXT NOT NULL,
    result_symbol TEXT,
    searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_search_history_user ON search_history (user_id, searched_at DESC);

-- ============================================================
-- WATCHLISTS
-- ============================================================
CREATE TABLE watchlists (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    symbol      TEXT NOT NULL,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes       TEXT,
    UNIQUE (user_id, symbol)
);

-- ============================================================
-- ALERTS
-- ============================================================
CREATE TABLE price_alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    symbol          TEXT NOT NULL,
    alert_type      TEXT NOT NULL CHECK (alert_type IN ('above','below','pct_change')),
    threshold       NUMERIC(18,4) NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    triggered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SEED: Synonym mappings
-- ============================================================
INSERT INTO search_synonyms (alias, symbol) VALUES
  ('Apple', 'AAPL'), ('iPhone maker', 'AAPL'), ('Cupertino', 'AAPL'),
  ('Nvidia', 'NVDA'), ('Jensen Huang', 'NVDA'),
  ('Google', 'GOOG'), ('Alphabet', 'GOOG'),
  ('Microsoft', 'MSFT'), ('Satya Nadella', 'MSFT'),
  ('Tesla', 'TSLA'), ('Elon Musk', 'TSLA'),
  ('Amazon', 'AMZN'), ('AWS', 'AMZN'),
  ('Meta', 'META'), ('Facebook', 'META'),
  ('Netflix', 'NFLX'),
  ('Berkshire', 'BRK-B'), ('Warren Buffett', 'BRK-B')
ON CONFLICT DO NOTHING;

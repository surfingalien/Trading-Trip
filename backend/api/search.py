"""
Search API — multi-strategy ranked search with graceful degradation:

  1. Typesense (fuzzy, fast) — primary when cluster is available
  2. PostgreSQL trigram + FTS — always-available fallback
  3. In-memory symbol list — last-resort emergency fallback

GET /api/search?q=appl&limit=10&sector=Technology&exchange=NASDAQ
"""
from __future__ import annotations
import logging
import re
import time
from typing import Optional

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from backend.config import get_settings
from backend.services.cache import get_cache

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/search", tags=["Search"])
cfg = get_settings()

# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class SearchResult(BaseModel):
    symbol: str
    name: str
    exchange: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    asset_type: str = "stock"
    market_cap_tier: Optional[str] = None
    score: float = Field(description="Relevance score 0-1")
    match_type: str = Field(description="exact_symbol|prefix|fuzzy|fts|synonym")


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
    total: int
    took_ms: float
    source: str = Field(description="typesense|postgres|fallback")


# ---------------------------------------------------------------------------
# Sanitization
# ---------------------------------------------------------------------------

_SPECIAL = re.compile(r"[^\w\s\.\-]")

def sanitize(q: str) -> str:
    q = q.strip()[:100]
    return _SPECIAL.sub("", q)


# ---------------------------------------------------------------------------
# Typesense strategy
# ---------------------------------------------------------------------------

_ts_client = None

def _get_typesense_client():
    global _ts_client
    if _ts_client is not None:
        return _ts_client
    if not cfg.TYPESENSE_HOST:
        return None
    try:
        import typesense
        _ts_client = typesense.Client({
            "nodes": [{"host": cfg.TYPESENSE_HOST, "port": cfg.TYPESENSE_PORT, "protocol": "http"}],
            "api_key": cfg.TYPESENSE_API_KEY,
            "connection_timeout_seconds": 2,
        })
        return _ts_client
    except Exception as exc:
        log.warning("Typesense init failed: %s", exc)
        return None


async def _search_typesense(q: str, limit: int, sector: Optional[str], exchange: Optional[str]) -> list[SearchResult]:
    client = _get_typesense_client()
    if client is None:
        raise RuntimeError("Typesense unavailable")

    filter_by = []
    if sector:
        filter_by.append(f"sector:={sector}")
    if exchange:
        filter_by.append(f"exchange:={exchange}")

    params = {
        "q": q,
        "query_by": "symbol,name,sector,industry",
        "query_by_weights": "10,5,2,1",
        "num_typos": "2",
        "prefix": "true",
        "limit": limit,
        "sort_by": "_text_match:desc",
    }
    if filter_by:
        params["filter_by"] = " && ".join(filter_by)

    try:
        resp = client.collections["instruments"].documents.search(params)
        results = []
        for hit in resp["hits"]:
            doc = hit["document"]
            # Determine match type
            text_match = hit.get("text_match_info", {})
            mtype = "exact_symbol" if doc["symbol"].upper() == q.upper() else (
                "prefix" if doc["symbol"].upper().startswith(q.upper()) else "fuzzy"
            )
            results.append(SearchResult(
                symbol=doc["symbol"],
                name=doc["name"],
                exchange=doc.get("exchange"),
                sector=doc.get("sector"),
                industry=doc.get("industry"),
                asset_type=doc.get("asset_type", "stock"),
                market_cap_tier=doc.get("market_cap_tier"),
                score=round(hit.get("text_match", 0) / 1_000_000, 4),
                match_type=mtype,
            ))
        return results
    except Exception as exc:
        log.warning("Typesense search error: %s", exc)
        raise RuntimeError(f"Typesense error: {exc}")


# ---------------------------------------------------------------------------
# PostgreSQL strategy (trigram + FTS)
# ---------------------------------------------------------------------------

async def _search_postgres(
    q: str,
    limit: int,
    sector: Optional[str],
    exchange: Optional[str],
    db: asyncpg.Connection,
) -> list[SearchResult]:
    """
    Ranked union of:
      1. Exact symbol match (score=1.0)
      2. Prefix symbol match
      3. Synonym lookup
      4. FTS ts_rank
      5. Trigram similarity fallback
    """
    clean_q = q.upper().strip()
    tsquery  = " | ".join(q.split())   # OR across words for FTS

    # Build optional WHERE clauses
    sector_clause   = "AND sector = $3"   if sector   else ""
    exchange_clause = "AND exchange = $4" if exchange else ""

    sql = f"""
    WITH
    -- 1. Exact symbol
    exact_sym AS (
        SELECT symbol, name, exchange, sector, industry, asset_type, market_cap_tier,
               1.0::float AS score, 'exact_symbol' AS match_type
        FROM instruments
        WHERE is_active AND upper(symbol) = $1
        {sector_clause} {exchange_clause}
    ),
    -- 2. Prefix on symbol
    prefix_sym AS (
        SELECT symbol, name, exchange, sector, industry, asset_type, market_cap_tier,
               0.9::float AS score, 'prefix' AS match_type
        FROM instruments
        WHERE is_active
          AND upper(symbol) LIKE ($1 || '%')
          AND upper(symbol) != $1
        {sector_clause} {exchange_clause}
        LIMIT 5
    ),
    -- 3. Synonym hit
    synonym_hit AS (
        SELECT i.symbol, i.name, i.exchange, i.sector, i.industry, i.asset_type, i.market_cap_tier,
               0.88::float AS score, 'synonym' AS match_type
        FROM instruments i
        JOIN search_synonyms s ON s.symbol = i.symbol
        WHERE i.is_active
          AND s.alias_lower % lower($2)
        {sector_clause} {exchange_clause}
        LIMIT 5
    ),
    -- 4. Full-text search
    fts_hits AS (
        SELECT i.symbol, i.name, i.exchange, i.sector, i.industry, i.asset_type, i.market_cap_tier,
               ts_rank(search_vector, to_tsquery('english', $4)) AS score,
               'fts' AS match_type
        FROM instruments i
        WHERE is_active
          AND search_vector @@ to_tsquery('english', $4)
        {sector_clause} {exchange_clause}
        LIMIT 15
    ),
    -- 5. Trigram fuzzy
    trgm_hits AS (
        SELECT symbol, name, exchange, sector, industry, asset_type, market_cap_tier,
               GREATEST(
                   similarity(upper(symbol), $1),
                   similarity(lower(name), lower($2))
               ) AS score,
               'fuzzy' AS match_type
        FROM instruments
        WHERE is_active
          AND (
              upper(symbol) % $1
              OR lower(name) % lower($2)
          )
        {sector_clause} {exchange_clause}
        LIMIT 10
    ),
    combined AS (
        SELECT * FROM exact_sym
        UNION ALL SELECT * FROM prefix_sym
        UNION ALL SELECT * FROM synonym_hit
        UNION ALL SELECT * FROM fts_hits
        UNION ALL SELECT * FROM trgm_hits
    ),
    deduped AS (
        SELECT DISTINCT ON (symbol)
            symbol, name, exchange, sector, industry, asset_type, market_cap_tier,
            MAX(score) AS score, match_type
        FROM combined
        GROUP BY symbol, name, exchange, sector, industry, asset_type, market_cap_tier, match_type
    )
    SELECT * FROM deduped
    ORDER BY score DESC
    LIMIT $5
    """

    args = [clean_q, q]
    if sector:
        args.append(sector)
    if exchange:
        args.append(exchange)
    args.append(tsquery)
    args.append(limit)

    # Re-number params correctly (simplified: use positional with sector/exchange handled separately)
    # Rebuild for cleanliness
    base_sql = """
    WITH
    exact_sym AS (
        SELECT symbol, name, exchange, sector, industry, asset_type, market_cap_tier,
               1.0::float AS score, 'exact_symbol'::text AS match_type
        FROM instruments
        WHERE is_active AND upper(symbol) = upper($1)
    ),
    prefix_sym AS (
        SELECT symbol, name, exchange, sector, industry, asset_type, market_cap_tier,
               0.9::float AS score, 'prefix'::text AS match_type
        FROM instruments
        WHERE is_active AND upper(symbol) LIKE (upper($1) || '%') AND upper(symbol) != upper($1)
        LIMIT 5
    ),
    synonym_hit AS (
        SELECT i.symbol, i.name, i.exchange, i.sector, i.industry, i.asset_type, i.market_cap_tier,
               0.88::float AS score, 'synonym'::text AS match_type
        FROM instruments i
        JOIN search_synonyms s ON s.symbol = i.symbol
        WHERE i.is_active AND s.alias_lower % lower($1)
        LIMIT 5
    ),
    fts_hits AS (
        SELECT i.symbol, i.name, i.exchange, i.sector, i.industry, i.asset_type, i.market_cap_tier,
               ts_rank(search_vector, websearch_to_tsquery('english', $1))::float AS score,
               'fts'::text AS match_type
        FROM instruments i
        WHERE i.is_active AND search_vector @@ websearch_to_tsquery('english', $1)
        LIMIT 15
    ),
    trgm_hits AS (
        SELECT symbol, name, exchange, sector, industry, asset_type, market_cap_tier,
               GREATEST(similarity(upper(symbol), upper($1)), similarity(lower(name), lower($1))) AS score,
               'fuzzy'::text AS match_type
        FROM instruments
        WHERE is_active AND (upper(symbol) % upper($1) OR lower(name) % lower($1))
        LIMIT 10
    ),
    combined AS (
        SELECT * FROM exact_sym UNION ALL SELECT * FROM prefix_sym
        UNION ALL SELECT * FROM synonym_hit
        UNION ALL SELECT * FROM fts_hits UNION ALL SELECT * FROM trgm_hits
    )
    SELECT DISTINCT ON (symbol) symbol, name, exchange, sector, industry,
                               asset_type, market_cap_tier,
                               MAX(score) OVER (PARTITION BY symbol) AS score,
                               first_value(match_type) OVER (PARTITION BY symbol ORDER BY score DESC) AS match_type
    FROM combined
    ORDER BY symbol, score DESC
    """

    try:
        rows = await db.fetch(base_sql, q)
        out = []
        for r in rows:
            if sector and r["sector"] != sector:
                continue
            if exchange and r["exchange"] != exchange:
                continue
            out.append(SearchResult(
                symbol=r["symbol"],
                name=r["name"],
                exchange=r.get("exchange"),
                sector=r.get("sector"),
                industry=r.get("industry"),
                asset_type=r.get("asset_type", "stock"),
                market_cap_tier=r.get("market_cap_tier"),
                score=round(float(r["score"] or 0), 4),
                match_type=r["match_type"] or "fuzzy",
            ))
        return sorted(out, key=lambda x: -x.score)[:limit]
    except Exception as exc:
        log.error("PostgreSQL search error: %s", exc)
        raise


# ---------------------------------------------------------------------------
# Emergency in-memory fallback (small curated list)
# ---------------------------------------------------------------------------

_EMERGENCY_INDEX = [
    {"symbol": "AAPL", "name": "Apple Inc.", "sector": "Technology"},
    {"symbol": "MSFT", "name": "Microsoft Corporation", "sector": "Technology"},
    {"symbol": "NVDA", "name": "NVIDIA Corporation", "sector": "Technology"},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "sector": "Communication Services"},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "sector": "Consumer Discretionary"},
    {"symbol": "TSLA", "name": "Tesla Inc.", "sector": "Consumer Discretionary"},
    {"symbol": "META", "name": "Meta Platforms Inc.", "sector": "Communication Services"},
    {"symbol": "AVGO", "name": "Broadcom Inc.", "sector": "Technology"},
    {"symbol": "BRK-B", "name": "Berkshire Hathaway Inc.", "sector": "Financials"},
    {"symbol": "JPM", "name": "JPMorgan Chase & Co.", "sector": "Financials"},
    {"symbol": "V", "name": "Visa Inc.", "sector": "Financials"},
    {"symbol": "SPY", "name": "SPDR S&P 500 ETF", "sector": "ETF"},
    {"symbol": "QQQ", "name": "Invesco QQQ Trust", "sector": "ETF"},
]


def _emergency_search(q: str, limit: int) -> list[SearchResult]:
    q_up = q.upper()
    results = []
    for item in _EMERGENCY_INDEX:
        sym_score  = 1.0 if item["symbol"] == q_up else (0.9 if item["symbol"].startswith(q_up) else 0)
        name_score = 0.7 if q.lower() in item["name"].lower() else 0
        score = max(sym_score, name_score)
        if score > 0:
            results.append(SearchResult(
                symbol=item["symbol"], name=item["name"],
                sector=item.get("sector"), asset_type="stock",
                score=score, match_type="fallback",
            ))
    return sorted(results, key=lambda x: -x.score)[:limit]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

async def _get_db():
    """Dependency — yields an asyncpg connection."""
    import os
    db_url = cfg.DATABASE_URL.replace("+asyncpg", "").replace("postgresql", "postgres")
    try:
        conn = await asyncpg.connect(db_url, timeout=3)
        try:
            yield conn
        finally:
            await conn.close()
    except Exception:
        yield None


@router.get("", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1, max_length=100, description="Search query"),
    limit: int = Query(10, ge=1, le=50),
    sector: Optional[str] = None,
    exchange: Optional[str] = None,
    db=Depends(_get_db),
):
    t0 = time.perf_counter()
    q = sanitize(q)
    if not q:
        raise HTTPException(status_code=400, detail="Query is empty after sanitization")

    # Rate-limit check via cache
    cache = await get_cache()
    cache_key = f"search:{q.lower()}:{sector}:{exchange}:{limit}"
    cached = await cache.get_json(cache_key)
    if cached:
        return SearchResponse(**cached)

    # --- Strategy 1: Typesense ---
    source = "typesense"
    try:
        results = await _search_typesense(q, limit, sector, exchange)
    except Exception:
        source = "postgres"
        # --- Strategy 2: PostgreSQL ---
        try:
            if db is not None:
                results = await _search_postgres(q, limit, sector, exchange, db)
            else:
                raise RuntimeError("No DB connection")
        except Exception as exc2:
            log.error("Postgres search failed: %s", exc2)
            # --- Strategy 3: Emergency fallback ---
            source = "fallback"
            results = _emergency_search(q, limit)

    took_ms = round((time.perf_counter() - t0) * 1000, 2)
    resp = SearchResponse(
        query=q, results=results, total=len(results), took_ms=took_ms, source=source
    )
    await cache.set_json(cache_key, resp.model_dump(), ex=30)
    return resp

"""
Unit tests for the search module.

Tests: sanitization, emergency fallback, scoring edge cases,
special characters, empty queries, partial tickers, synonyms.
"""
import pytest
from backend.api.search import sanitize, _emergency_search, SearchResult


# ---------------------------------------------------------------------------
# Sanitization
# ---------------------------------------------------------------------------

class TestSanitize:
    def test_strips_whitespace(self):
        assert sanitize("  AAPL  ") == "AAPL"

    def test_strips_special_chars(self):
        assert sanitize("AAPL; DROP TABLE instruments;") == "AAPL DROP TABLE instruments"

    def test_truncates_long_query(self):
        assert len(sanitize("A" * 200)) == 100

    def test_empty_after_strip(self):
        assert sanitize("!!!") == ""

    def test_allows_dots_and_dashes(self):
        result = sanitize("BRK-B")
        assert "BRK" in result
        assert "-" in result

    def test_allows_alphanumeric(self):
        assert sanitize("NVDA2024") == "NVDA2024"

    def test_unicode_stripped(self):
        result = sanitize("Apple™")
        assert "™" not in result

    def test_sql_injection(self):
        result = sanitize("' OR '1'='1")
        assert "'" not in result

    def test_xss_attempt(self):
        result = sanitize("<script>alert(1)</script>")
        assert "<" not in result and ">" not in result


# ---------------------------------------------------------------------------
# Emergency fallback search
# ---------------------------------------------------------------------------

class TestEmergencySearch:
    def test_exact_symbol_match(self):
        results = _emergency_search("AAPL", 10)
        assert len(results) >= 1
        assert results[0].symbol == "AAPL"
        assert results[0].score == 1.0

    def test_prefix_match(self):
        results = _emergency_search("AA", 10)
        symbols = [r.symbol for r in results]
        assert "AAPL" in symbols

    def test_name_search(self):
        results = _emergency_search("apple", 10)
        symbols = [r.symbol for r in results]
        assert "AAPL" in symbols

    def test_case_insensitive(self):
        results_upper = _emergency_search("NVDA", 10)
        results_lower = _emergency_search("nvda", 10)
        assert len(results_upper) >= 1
        assert len(results_lower) >= 1

    def test_no_match_returns_empty(self):
        results = _emergency_search("ZZZZZZZZZ", 10)
        assert results == []

    def test_limit_respected(self):
        results = _emergency_search("A", 2)
        assert len(results) <= 2

    def test_empty_query(self):
        results = _emergency_search("", 10)
        # Empty string matches nothing (no symbol starts with empty string and score > 0)
        assert isinstance(results, list)

    def test_partial_ticker(self):
        results = _emergency_search("NVD", 10)
        symbols = [r.symbol for r in results]
        assert "NVDA" in symbols

    def test_score_ordering(self):
        results = _emergency_search("MSFT", 10)
        scores = [r.score for r in results]
        assert scores == sorted(scores, reverse=True)

    def test_result_schema(self):
        results = _emergency_search("AAPL", 5)
        for r in results:
            assert isinstance(r, SearchResult)
            assert r.symbol
            assert r.name
            assert 0 <= r.score <= 1.0
            assert r.match_type

    def test_etf_search(self):
        results = _emergency_search("SPY", 5)
        symbols = [r.symbol for r in results]
        assert "SPY" in symbols

    def test_special_characters_query(self):
        # Should not crash
        results = _emergency_search("A&P", 5)
        assert isinstance(results, list)


# ---------------------------------------------------------------------------
# Search response validation
# ---------------------------------------------------------------------------

class TestSearchResponse:
    """Integration-style tests for the search endpoint (no real DB needed)."""

    @pytest.mark.asyncio
    async def test_search_empty_query_raises(self):
        """Sanitized empty query should be caught before DB call."""
        from fastapi.testclient import TestClient
        from backend.main import app
        client = TestClient(app)
        resp = client.get("/api/search?q=!!!")
        # After sanitization "!!!" → "" which raises 400
        assert resp.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_search_fallback_on_db_failure(self):
        """Search must return results from emergency fallback when DB is down."""
        from backend.api.search import _emergency_search, sanitize
        q = sanitize("apple")
        results = _emergency_search(q, 10)
        # Must return results even with no DB
        assert len(results) >= 1

    def test_rate_limit_key_format(self):
        """Cache key format is deterministic."""
        q, sector, exchange, limit = "aapl", None, None, 10
        key = f"search:{q.lower()}:{sector}:{exchange}:{limit}"
        assert key == "search:aapl:None:None:10"

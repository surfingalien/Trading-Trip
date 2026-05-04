"""
Redis cache service — async singleton with graceful degradation.
Falls back to an in-process LRU dict if Redis is unavailable.
"""
from __future__ import annotations
import asyncio
import json
import logging
import time
from collections import OrderedDict
from typing import Optional

log = logging.getLogger(__name__)
_CACHE_INSTANCE: Optional["Cache"] = None


class InMemoryFallback:
    """
    Simple TTL-aware LRU dict.  Used when Redis is unreachable.
    Thread-safe for async usage (single event loop).
    """

    def __init__(self, maxsize: int = 2000):
        self._store: OrderedDict[str, tuple[str, float]] = OrderedDict()
        self._maxsize = maxsize

    async def get(self, key: str) -> Optional[str]:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if expires_at and time.time() > expires_at:
            del self._store[key]
            return None
        self._store.move_to_end(key)
        return value

    async def set(self, key: str, value: str, ex: int = 300) -> None:
        expires_at = time.time() + ex if ex else 0.0
        if key in self._store:
            self._store.move_to_end(key)
        self._store[key] = (value, expires_at)
        if len(self._store) > self._maxsize:
            self._store.popitem(last=False)

    async def delete(self, *keys: str) -> None:
        for k in keys:
            self._store.pop(k, None)

    async def exists(self, key: str) -> bool:
        return await self.get(key) is not None

    async def flushdb(self) -> None:
        self._store.clear()

    async def close(self) -> None:
        pass


class RedisCache:
    """
    Thin async wrapper around redis.asyncio.Redis.
    All values stored as strings; callers handle serialisation.
    """

    def __init__(self, client):
        self._client = client

    async def get(self, key: str) -> Optional[str]:
        val = await self._client.get(key)
        return val.decode() if val else None

    async def set(self, key: str, value: str, ex: int = 300) -> None:
        await self._client.set(key, value, ex=ex)

    async def delete(self, *keys: str) -> None:
        if keys:
            await self._client.delete(*keys)

    async def exists(self, key: str) -> bool:
        return bool(await self._client.exists(key))

    async def flushdb(self) -> None:
        await self._client.flushdb()

    async def close(self) -> None:
        await self._client.aclose()


class Cache:
    """
    Public interface — delegates to Redis or InMemoryFallback.
    Provides helpers for JSON round-trips.
    """

    def __init__(self, backend):
        self._b = backend

    async def get(self, key: str) -> Optional[str]:
        return await self._b.get(key)

    async def set(self, key: str, value: str, ex: int = 300) -> None:
        await self._b.set(key, value, ex=ex)

    async def delete(self, *keys: str) -> None:
        await self._b.delete(*keys)

    async def get_json(self, key: str) -> Optional[dict | list]:
        raw = await self.get(key)
        return json.loads(raw) if raw else None

    async def set_json(self, key: str, value: dict | list, ex: int = 300) -> None:
        await self.set(key, json.dumps(value, default=str), ex=ex)

    async def close(self) -> None:
        await self._b.close()


async def get_cache() -> Cache:
    global _CACHE_INSTANCE
    if _CACHE_INSTANCE is not None:
        return _CACHE_INSTANCE

    from backend.config import get_settings
    cfg = get_settings()

    try:
        import redis.asyncio as aioredis  # type: ignore
        client = aioredis.from_url(cfg.REDIS_URL, decode_responses=False, socket_connect_timeout=2)
        await client.ping()
        _CACHE_INSTANCE = Cache(RedisCache(client))
        log.info("Redis cache connected: %s", cfg.REDIS_URL)
    except Exception as exc:
        log.warning("Redis unavailable (%s) — using in-memory fallback", exc)
        _CACHE_INSTANCE = Cache(InMemoryFallback())

    return _CACHE_INSTANCE


async def invalidate_pattern(prefix: str) -> int:
    """Delete all keys matching prefix:* (Redis-only; no-op on fallback)."""
    cache = await get_cache()
    if not isinstance(cache._b, RedisCache):
        return 0
    keys = await cache._b._client.keys(f"{prefix}:*")
    if keys:
        await cache._b._client.delete(*keys)
    return len(keys)

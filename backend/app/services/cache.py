"""A tiny async cache with Redis backing and an in-memory fallback.

The app must run with zero infra, so when ``REDIS_URL`` is unset (or redis is
unreachable) we transparently use a process-local TTL dict.
"""
from __future__ import annotations

import json
import time
from typing import Any

from app.config import get_settings
from app.logging_config import get_logger

log = get_logger(__name__)


class Cache:
    def __init__(self) -> None:
        self._settings = get_settings()
        self._mem: dict[str, tuple[float, Any]] = {}
        self._redis = None
        if self._settings.redis_enabled:
            try:
                import redis.asyncio as aioredis

                self._redis = aioredis.from_url(
                    self._settings.redis_url, decode_responses=True
                )
                log.info("cache: using redis")
            except Exception as exc:  # pragma: no cover - infra optional
                log.warning("cache: redis unavailable (%s); using memory", exc)

    async def get(self, key: str) -> Any | None:
        if self._redis is not None:
            try:
                raw = await self._redis.get(key)
                return json.loads(raw) if raw else None
            except Exception:  # pragma: no cover
                pass
        item = self._mem.get(key)
        if not item:
            return None
        expires, value = item
        if expires and expires < time.time():
            self._mem.pop(key, None)
            return None
        return value

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        ttl = self._settings.cache_ttl_seconds if ttl is None else ttl
        if self._redis is not None:
            try:
                await self._redis.set(key, json.dumps(value), ex=ttl or None)
                return
            except Exception:  # pragma: no cover
                pass
        self._mem[key] = (time.time() + ttl if ttl else 0, value)


_cache: Cache | None = None


def get_cache() -> Cache:
    global _cache
    if _cache is None:
        _cache = Cache()
    return _cache

"""In-process result store + scan runner with caching.

Holds the latest scan output so API reads are instant, and coordinates a
single in-flight scan (no thundering herd when several requests arrive during a
cold cache). A watchlist is kept in-memory here for simplicity; swap for the DB
models in ``app.db`` for persistence.
"""
from __future__ import annotations

import asyncio
import time
from typing import Optional

from app.logging_config import get_logger
from app.models.schemas import StockResult, SwingType
from app.services.scanner import Scanner

log = get_logger(__name__)


class ResultStore:
    def __init__(self) -> None:
        self._buckets: dict[str, list[StockResult]] = {}
        self._last_scan: float = 0.0
        self._lock = asyncio.Lock()
        self._watchlist: set[str] = set()
        self._scanner: Optional[Scanner] = None

    @property
    def last_scan_ts(self) -> float:
        return self._last_scan

    async def ensure_scanned(self, max_age: float = 900.0, force: bool = False) -> None:
        if not force and self._buckets and (time.time() - self._last_scan) < max_age:
            return
        async with self._lock:
            if not force and self._buckets and (time.time() - self._last_scan) < max_age:
                return
            log.info("running full scan…")
            self._scanner = self._scanner or Scanner()
            self._buckets = await self._scanner.scan()
            self._last_scan = time.time()
            counts = {k: len(v) for k, v in self._buckets.items()}
            log.info("scan complete: %s", counts)

    def bucket(self, swing_type: SwingType) -> list[StockResult]:
        return list(self._buckets.get(swing_type.value, []))

    def all_results(self) -> list[StockResult]:
        seen: dict[str, StockResult] = {}
        for results in self._buckets.values():
            for r in results:
                # keep the highest-scoring instance per symbol
                if r.symbol not in seen or r.confidence_score > seen[r.symbol].confidence_score:
                    seen[r.symbol] = r
        return list(seen.values())

    # --- watchlist ---
    def add_watch(self, symbol: str) -> None:
        self._watchlist.add(symbol.upper())

    def remove_watch(self, symbol: str) -> None:
        self._watchlist.discard(symbol.upper())

    def watchlist_symbols(self) -> list[str]:
        return sorted(self._watchlist)


_store: ResultStore | None = None


def get_store() -> ResultStore:
    global _store
    if _store is None:
        _store = ResultStore()
    return _store

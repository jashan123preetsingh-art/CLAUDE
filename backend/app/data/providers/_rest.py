"""Shared async REST helper with retry/backoff for broker providers."""
from __future__ import annotations

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.logging_config import get_logger

log = get_logger(__name__)

_RETRYABLE = (httpx.TransportError, httpx.HTTPStatusError)


class RestClient:
    """Thin wrapper around httpx.AsyncClient with exponential-backoff retries."""

    def __init__(self, base_url: str, headers: dict | None = None, timeout: float = 15.0):
        self._client = httpx.AsyncClient(
            base_url=base_url, headers=headers or {}, timeout=timeout
        )

    @retry(
        retry=retry_if_exception_type(_RETRYABLE),
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=1, min=2, max=16),
        reraise=True,
    )
    async def get_json(self, path: str, params: dict | None = None) -> dict:
        resp = await self._client.get(path, params=params)
        resp.raise_for_status()
        return resp.json()

    @retry(
        retry=retry_if_exception_type(_RETRYABLE),
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=1, min=2, max=16),
        reraise=True,
    )
    async def post_json(self, path: str, json: dict | None = None, params: dict | None = None) -> dict:
        resp = await self._client.post(path, json=json, params=params)
        resp.raise_for_status()
        return resp.json()

    async def aclose(self) -> None:
        await self._client.aclose()

"""Upstox market-data provider (Upstox API v2).

Implements historical candles against the real Upstox endpoints. Requires a
valid ``UPSTOX_ACCESS_TOKEN`` (obtained via the OAuth login flow). The seed
universe is used for symbol metadata; a production deployment would download
the Upstox instrument master and map trading symbols to instrument keys.
"""
from __future__ import annotations

from datetime import date, timedelta

import pandas as pd

from app.config import Settings
from app.data.base import MarketDataProvider
from app.data.providers._rest import RestClient
from app.data.universe import seed_universe
from app.logging_config import get_logger
from app.models.schemas import StockMeta

log = get_logger(__name__)

_BASE = "https://api.upstox.com"
# NSE index instrument key for NIFTY 50
_NIFTY_KEY = "NSE_INDEX|Nifty 50"


class UpstoxProvider(MarketDataProvider):
    name = "upstox"

    def __init__(self, settings: Settings) -> None:
        if not settings.upstox_access_token:
            raise RuntimeError("UPSTOX_ACCESS_TOKEN is required for the upstox provider")
        self._client = RestClient(
            _BASE,
            headers={
                "Authorization": f"Bearer {settings.upstox_access_token}",
                "Accept": "application/json",
            },
        )
        self._universe = seed_universe()

    def _instrument_key(self, meta: StockMeta) -> str:
        # Equity instrument key format: EXCHANGE_EQ|ISIN. Here we use the
        # trading-symbol shorthand accepted by the historical endpoint.
        return f"NSE_EQ|{meta.symbol}"

    async def list_universe(self) -> list[StockMeta]:
        return self._universe

    async def get_history(self, meta: StockMeta, days: int) -> pd.DataFrame:
        to_date = date.today()
        from_date = to_date - timedelta(days=int(days * 1.6) + 10)
        key = self._instrument_key(meta)
        path = f"/v2/historical-candle/{key}/day/{to_date}/{from_date}"
        data = await self._client.get_json(path)
        candles = data.get("data", {}).get("candles", [])
        return self._to_frame(candles)

    async def get_benchmark(self, symbol: str, days: int) -> pd.DataFrame:
        to_date = date.today()
        from_date = to_date - timedelta(days=int(days * 1.6) + 10)
        path = f"/v2/historical-candle/{_NIFTY_KEY}/day/{to_date}/{from_date}"
        data = await self._client.get_json(path)
        return self._to_frame(data.get("data", {}).get("candles", []))

    @staticmethod
    def _to_frame(candles: list) -> pd.DataFrame:
        # Upstox candle: [timestamp, open, high, low, close, volume, oi]
        rows = []
        for c in candles:
            rows.append(
                {
                    "date": pd.to_datetime(c[0]).date(),
                    "open": float(c[1]),
                    "high": float(c[2]),
                    "low": float(c[3]),
                    "close": float(c[4]),
                    "volume": float(c[5]),
                }
            )
        df = pd.DataFrame(rows)
        if df.empty:
            return df
        return df.sort_values("date").reset_index(drop=True)

    async def aclose(self) -> None:
        await self._client.aclose()

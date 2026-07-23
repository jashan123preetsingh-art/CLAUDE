"""Dhan market-data provider (Dhan API v2).

Historical daily candles via the ``/v2/charts/historical`` endpoint. Requires
``DHAN_ACCESS_TOKEN`` and ``DHAN_CLIENT_ID``. Security IDs would come from the
Dhan instrument master in production; the seed universe supplies metadata.
"""
from __future__ import annotations

from datetime import date, timedelta

import pandas as pd

from app.config import Settings
from app.data.base import MarketDataProvider
from app.data.providers._rest import RestClient
from app.data.universe import seed_universe
from app.models.schemas import StockMeta

_BASE = "https://api.dhan.co"


class DhanProvider(MarketDataProvider):
    name = "dhan"

    def __init__(self, settings: Settings) -> None:
        if not settings.dhan_access_token:
            raise RuntimeError("DHAN_ACCESS_TOKEN is required for the dhan provider")
        self._client = RestClient(
            _BASE,
            headers={
                "access-token": settings.dhan_access_token,
                "client-id": settings.dhan_client_id,
                "Content-Type": "application/json",
            },
        )
        self._universe = seed_universe()
        # symbol -> Dhan securityId mapping is loaded from the instrument master
        self._security_ids: dict[str, str] = {}

    async def list_universe(self) -> list[StockMeta]:
        return self._universe

    async def _history(self, security_id: str, days: int) -> pd.DataFrame:
        to_date = date.today()
        from_date = to_date - timedelta(days=int(days * 1.6) + 10)
        payload = {
            "securityId": security_id,
            "exchangeSegment": "NSE_EQ",
            "instrument": "EQUITY",
            "fromDate": str(from_date),
            "toDate": str(to_date),
        }
        data = await self._client.post_json("/v2/charts/historical", json=payload)
        return self._to_frame(data)

    async def get_history(self, meta: StockMeta, days: int) -> pd.DataFrame:
        sid = self._security_ids.get(meta.symbol, meta.symbol)
        return await self._history(sid, days)

    async def get_benchmark(self, symbol: str, days: int) -> pd.DataFrame:
        # NIFTY 50 index security id in Dhan
        return await self._history("13", days)

    @staticmethod
    def _to_frame(data: dict) -> pd.DataFrame:
        # Dhan returns parallel arrays: timestamp/open/high/low/close/volume
        ts = data.get("timestamp", [])
        if not ts:
            return pd.DataFrame()
        df = pd.DataFrame(
            {
                "date": [pd.to_datetime(t, unit="s").date() for t in ts],
                "open": data["open"],
                "high": data["high"],
                "low": data["low"],
                "close": data["close"],
                "volume": data["volume"],
            }
        )
        return df.sort_values("date").reset_index(drop=True)

    async def aclose(self) -> None:
        await self._client.aclose()

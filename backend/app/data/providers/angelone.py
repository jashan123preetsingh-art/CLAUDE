"""Angel One SmartAPI market-data provider.

Historical candles via ``/rest/secure/angelbroking/historical/v1/getCandleData``.
Requires a SmartAPI JWT (``ANGELONE`` credentials + TOTP login handled by the
SmartConnect login flow, out of scope here). The seed universe supplies symbol
tokens in production via the OpenAPI ScripMaster.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

import pandas as pd

from app.config import Settings
from app.data.base import MarketDataProvider
from app.data.providers._rest import RestClient
from app.data.universe import seed_universe
from app.models.schemas import StockMeta

_BASE = "https://apiconnect.angelbroking.com"


class AngelOneProvider(MarketDataProvider):
    name = "angelone"

    def __init__(self, settings: Settings, jwt: str = "") -> None:
        token = jwt or settings.angelone_password  # JWT injected post-login
        if not settings.angelone_api_key:
            raise RuntimeError("ANGELONE_API_KEY is required for the angelone provider")
        self._client = RestClient(
            _BASE,
            headers={
                "Authorization": f"Bearer {token}",
                "X-PrivateKey": settings.angelone_api_key,
                "X-SourceID": "WEB",
                "X-UserType": "USER",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        self._universe = seed_universe()
        self._tokens: dict[str, str] = {}  # symbol -> symboltoken

    async def list_universe(self) -> list[StockMeta]:
        return self._universe

    async def _candles(self, symboltoken: str, days: int, exchange: str = "NSE") -> pd.DataFrame:
        to_dt = datetime.now()
        from_dt = to_dt - timedelta(days=int(days * 1.6) + 10)
        payload = {
            "exchange": exchange,
            "symboltoken": symboltoken,
            "interval": "ONE_DAY",
            "fromdate": from_dt.strftime("%Y-%m-%d %H:%M"),
            "todate": to_dt.strftime("%Y-%m-%d %H:%M"),
        }
        data = await self._client.post_json(
            "/rest/secure/angelbroking/historical/v1/getCandleData", json=payload
        )
        return self._to_frame(data.get("data", []))

    async def get_history(self, meta: StockMeta, days: int) -> pd.DataFrame:
        token = self._tokens.get(meta.symbol, meta.symbol)
        return await self._candles(token, days)

    async def get_benchmark(self, symbol: str, days: int) -> pd.DataFrame:
        return await self._candles("99926000", days)  # Nifty 50 token

    @staticmethod
    def _to_frame(rows: list) -> pd.DataFrame:
        # each row: [timestamp, open, high, low, close, volume]
        if not rows:
            return pd.DataFrame()
        df = pd.DataFrame(
            [
                {
                    "date": pd.to_datetime(r[0]).date(),
                    "open": float(r[1]),
                    "high": float(r[2]),
                    "low": float(r[3]),
                    "close": float(r[4]),
                    "volume": float(r[5]),
                }
                for r in rows
            ]
        )
        return df.sort_values("date").reset_index(drop=True)

    async def aclose(self) -> None:
        await self._client.aclose()

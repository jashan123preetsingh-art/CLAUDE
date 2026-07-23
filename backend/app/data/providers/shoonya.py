"""Shoonya (Finvasia) market-data provider.

Daily candles via the NorenWClientTP ``/NorenWClientTP/TPSeries`` endpoint.
Requires a Shoonya session token from the TOTP login flow. Token lookups use
the Shoonya symbol master in production; the seed universe supplies metadata.
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta

import pandas as pd

from app.config import Settings
from app.data.base import MarketDataProvider
from app.data.providers._rest import RestClient
from app.data.universe import seed_universe
from app.models.schemas import StockMeta

_BASE = "https://api.shoonya.com"


class ShoonyaProvider(MarketDataProvider):
    name = "shoonya"

    def __init__(self, settings: Settings, session_token: str = "") -> None:
        if not settings.shoonya_user_id:
            raise RuntimeError("SHOONYA_USER_ID is required for the shoonya provider")
        self._uid = settings.shoonya_user_id
        self._token = session_token
        self._client = RestClient(_BASE)
        self._universe = seed_universe()
        self._tokens: dict[str, str] = {}  # symbol -> exchange token

    async def list_universe(self) -> list[StockMeta]:
        return self._universe

    async def _tpseries(self, exch: str, token: str, days: int) -> pd.DataFrame:
        end = time.time()
        start = end - (int(days * 1.6) + 10) * 86400
        # Shoonya expects a jData=<json>&jKey=<token> form-style body.
        payload = {
            "uid": self._uid,
            "exch": exch,
            "token": token,
            "st": str(int(start)),
            "et": str(int(end)),
            "intrv": "day",
        }
        data = await self._client.post_json(
            "/NorenWClientTP/TPSeries", params={"jKey": self._token}, json=payload
        )
        return self._to_frame(data if isinstance(data, list) else data.get("data", []))

    async def get_history(self, meta: StockMeta, days: int) -> pd.DataFrame:
        token = self._tokens.get(meta.symbol, meta.symbol)
        return await self._tpseries("NSE", token, days)

    async def get_benchmark(self, symbol: str, days: int) -> pd.DataFrame:
        return await self._tpseries("NSE", "26000", days)  # Nifty 50 token

    @staticmethod
    def _to_frame(rows: list) -> pd.DataFrame:
        if not rows:
            return pd.DataFrame()
        parsed = []
        for r in rows:
            parsed.append(
                {
                    "date": datetime.strptime(r["time"], "%d-%m-%Y %H:%M:%S").date(),
                    "open": float(r["into"]),
                    "high": float(r["inth"]),
                    "low": float(r["intl"]),
                    "close": float(r["intc"]),
                    "volume": float(r.get("intv", 0)),
                }
            )
        df = pd.DataFrame(parsed)
        return df.sort_values("date").reset_index(drop=True)

    async def aclose(self) -> None:
        await self._client.aclose()

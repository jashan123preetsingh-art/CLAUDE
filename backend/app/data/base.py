"""Market-data provider abstraction.

Every concrete provider (Upstox, Dhan, Angel One, Shoonya, synthetic) implements
this async interface, so the rest of the system is completely decoupled from
which broker/API is in use. Swapping providers is a one-line config change.
"""
from __future__ import annotations

import abc

import pandas as pd

from app.models.schemas import FundamentalData, NewsData, StockMeta


class MarketDataProvider(abc.ABC):
    """Async interface all data sources must satisfy."""

    name: str = "base"

    @abc.abstractmethod
    async def list_universe(self) -> list[StockMeta]:
        """Return the tradable universe (NSE + BSE equity/F&O) with metadata."""

    @abc.abstractmethod
    async def get_history(self, meta: StockMeta, days: int) -> pd.DataFrame:
        """Return a daily OHLCV(+delivery) DataFrame, ascending by date.

        Columns: ``date, open, high, low, close, volume`` and optionally
        ``delivery_qty``. Index is a clean RangeIndex.
        """

    @abc.abstractmethod
    async def get_benchmark(self, symbol: str, days: int) -> pd.DataFrame:
        """Return daily history for an index benchmark (e.g. NIFTY 50)."""

    async def get_fundamentals(self, meta: StockMeta) -> FundamentalData:
        """Fundamentals for a symbol. Providers without this return empties."""
        return FundamentalData()

    async def get_news(self, meta: StockMeta) -> NewsData:
        """News/sentiment for a symbol. Default: neutral/empty."""
        return NewsData()

    async def get_fno_metrics(self, meta: StockMeta) -> dict:
        """F&O metrics (OI, OI change, futures price/basis). Default: empty."""
        return {}

    async def aclose(self) -> None:
        """Release any network resources. Safe no-op by default."""

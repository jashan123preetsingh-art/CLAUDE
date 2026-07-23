"""Synthetic market-data provider.

Generates deterministic, realistic OHLCV + delivery + fundamentals + news for
the seed universe so the *entire* screener runs end-to-end with zero external
credentials. Data is reproducible per symbol (seeded by symbol hash), and a
subset of names are shaped as clean uptrends so screeners return results.

This is what the app uses out of the box (`DATA_PROVIDER=synthetic`).
"""
from __future__ import annotations

import hashlib
from datetime import date, timedelta

import numpy as np
import pandas as pd

from app.data.base import MarketDataProvider
from app.data.universe import seed_universe
from app.models.schemas import FundamentalData, NewsData, StockMeta


def _seed_for(symbol: str) -> int:
    return int(hashlib.sha256(symbol.encode()).hexdigest(), 16) % (2**32)


def _business_days(n: int) -> list[date]:
    today = date(2026, 7, 22)
    days: list[date] = []
    d = today
    while len(days) < n:
        if d.weekday() < 5:
            days.append(d)
        d -= timedelta(days=1)
    return list(reversed(days))


def _regime_for(symbol: str) -> str:
    """Assign a deterministic market regime per symbol so the demo shows a
    realistic spread of setups across all screener tabs."""
    r = _seed_for(symbol) % 100
    if r < 46:
        return "breakout"    # clean uptrend into fresh highs -> weekly / F&O / long-term
    if r < 70:
        return "pullback"    # uptrend with a healthy recent dip -> monthly / delivery
    if r < 85:
        return "range"       # sideways / choppy -> mostly filtered out
    return "weak"            # downtrend / laggard -> filtered out


def _synthesize(symbol: str, days: int, regime: str, mcap: float) -> pd.DataFrame:
    rng = np.random.default_rng(_seed_for(symbol))
    dates = _business_days(days)

    base = 150 + (mcap % 4000) / 2.0  # keep prices comfortably above ₹100

    # Low noise so the trend (not day-to-day randomness) drives structure: this
    # gives clean, high-ADX uptrends that sit near their 52-week highs.
    if regime == "breakout":
        drift, vol = 0.0018, rng.uniform(0.007, 0.010)
    elif regime == "pullback":
        drift, vol = 0.0015, rng.uniform(0.008, 0.012)
    elif regime == "range":
        drift, vol = rng.uniform(-0.0003, 0.0004), rng.uniform(0.012, 0.020)
    else:  # weak
        drift, vol = rng.uniform(-0.0014, -0.0003), rng.uniform(0.012, 0.020)

    shocks = rng.normal(drift, vol, size=days)
    # A gentle breakout tail keeps price near its highs while holding RSI in the
    # 55-70 sweet-spot (avoids a parabolic, overbought finish).
    if regime == "breakout":
        shocks[-20:] += np.linspace(0.0, 0.0004, 20)
    elif regime == "pullback":
        shocks[-45:-6] += 0.0012            # prior leg up
        shocks[-6:] -= rng.uniform(0.0007, 0.0013)  # shallow, healthy pullback

    log_price = np.cumsum(shocks)
    close = base * np.exp(log_price)

    intraday = np.abs(rng.normal(0, vol, size=days)) + 0.004
    high = close * (1 + intraday)
    low = close * (1 - intraday)
    open_ = np.concatenate([[close[0]], close[:-1]]) * (1 + rng.normal(0, vol / 3, days))
    open_ = np.clip(open_, low, high)

    base_vol = max(5e5, mcap * 200)
    volume = rng.lognormal(mean=np.log(base_vol), sigma=0.35, size=days)
    if regime in ("breakout", "pullback"):
        # expand the most recent bars above the 20-day average so relative
        # volume (latest / 20d-avg) reads as a genuine, > 1.5x spike
        avg20 = float(np.mean(volume[-25:-5]))
        volume[-5:] = avg20 * rng.uniform(1.8, 2.8, size=5)
    delivery = volume * rng.uniform(0.45, 0.70, size=days)

    return pd.DataFrame(
        {
            "date": dates,
            "open": open_,
            "high": high,
            "low": low,
            "close": close,
            "volume": volume,
            "delivery_qty": delivery,
        }
    )


class SyntheticProvider(MarketDataProvider):
    name = "synthetic"

    def __init__(self) -> None:
        self._universe = seed_universe()

    async def list_universe(self) -> list[StockMeta]:
        return self._universe

    async def get_history(self, meta: StockMeta, days: int) -> pd.DataFrame:
        return _synthesize(meta.symbol, days, _regime_for(meta.symbol), meta.market_cap_cr)

    async def get_benchmark(self, symbol: str, days: int) -> pd.DataFrame:
        # a steady, unremarkable index so strong stocks show positive rel. strength
        return _synthesize(f"BENCH_{symbol}", days, "range", mcap=1000.0)

    async def get_fundamentals(self, meta: StockMeta) -> FundamentalData:
        rng = np.random.default_rng(_seed_for(meta.symbol) + 7)
        strong = _seed_for(meta.symbol) % 100 < 60
        return FundamentalData(
            roe=float(rng.uniform(16, 30) if strong else rng.uniform(5, 15)),
            roce=float(rng.uniform(19, 34) if strong else rng.uniform(8, 17)),
            debt_to_equity=float(rng.uniform(0.0, 0.45) if strong else rng.uniform(0.6, 2.0)),
            sales_growth=float(rng.uniform(16, 40) if strong else rng.uniform(2, 14)),
            profit_growth=float(rng.uniform(16, 45) if strong else rng.uniform(-5, 14)),
            sales_cagr=float(rng.uniform(15, 28) if strong else rng.uniform(4, 14)),
            profit_cagr=float(rng.uniform(15, 30) if strong else rng.uniform(2, 14)),
            promoter_holding=float(rng.uniform(51, 75) if strong else rng.uniform(30, 49)),
            operating_cash_flow=float(rng.uniform(500, 20000) if strong else rng.uniform(-500, 800)),
            eps=float(rng.uniform(10, 120) if strong else rng.uniform(-5, 12)),
            interest_coverage=float(rng.uniform(6, 25) if strong else rng.uniform(1, 4)),
            fii_change=float(rng.uniform(-0.5, 2.5)),
            dii_change=float(rng.uniform(-0.5, 2.5)),
            governance_flag=bool(_seed_for(meta.symbol) % 100 >= 95),
        )

    async def get_news(self, meta: StockMeta) -> NewsData:
        rng = np.random.default_rng(_seed_for(meta.symbol) + 13)
        score = float(rng.uniform(-0.2, 0.7))
        bad = _seed_for(meta.symbol) % 100 >= 92
        return NewsData(
            sentiment_score=score if not bad else -0.6,
            positive_count=int(rng.integers(2, 12)),
            negative_count=int(rng.integers(0, 3)) if not bad else 6,
            has_sebi_action=bad and _seed_for(meta.symbol) % 2 == 0,
            heavy_promoter_selling=bad and _seed_for(meta.symbol) % 3 == 0,
            headlines=[f"{meta.name} reports steady quarterly performance"],
        )

    async def get_fno_metrics(self, meta: StockMeta) -> dict:
        if not meta.is_fno:
            return {}
        rng = np.random.default_rng(_seed_for(meta.symbol) + 21)
        oi_change = float(rng.uniform(-8, 25))
        price_change = float(rng.uniform(-3, 5))
        return {
            "oi": float(rng.uniform(1e6, 5e7)),
            "oi_change_pct": oi_change,
            "price_change_pct": price_change,
            "futures_basis_pct": float(rng.uniform(-0.4, 0.6)),
        }

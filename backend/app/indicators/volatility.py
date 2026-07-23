"""Volatility / channel indicators: Bollinger, Keltner, Donchian, VCP width."""
from __future__ import annotations

import pandas as pd

from app.indicators.trend import atr, ema


def bollinger_bands(
    series: pd.Series, length: int = 20, mult: float = 2.0
) -> pd.DataFrame:
    mid = series.rolling(length).mean()
    std = series.rolling(length).std(ddof=0)
    upper = mid + mult * std
    lower = mid - mult * std
    width = (upper - lower) / mid.replace(0, pd.NA)
    return pd.DataFrame(
        {"bb_mid": mid, "bb_upper": upper, "bb_lower": lower, "bb_width": width},
        index=series.index,
    )


def keltner_channel(
    df: pd.DataFrame, length: int = 20, mult: float = 2.0
) -> pd.DataFrame:
    mid = ema(df["close"], length)
    rng = atr(df, length)
    return pd.DataFrame(
        {
            "kc_mid": mid,
            "kc_upper": mid + mult * rng,
            "kc_lower": mid - mult * rng,
        },
        index=df.index,
    )


def donchian_channel(df: pd.DataFrame, length: int = 20) -> pd.DataFrame:
    upper = df["high"].rolling(length).max()
    lower = df["low"].rolling(length).min()
    return pd.DataFrame(
        {"dc_upper": upper, "dc_lower": lower, "dc_mid": (upper + lower) / 2.0},
        index=df.index,
    )


def historical_volatility(series: pd.Series, length: int = 20) -> pd.Series:
    """Annualised close-to-close volatility (%)."""
    import numpy as np

    log_ret = np.log(series / series.shift(1))
    return log_ret.rolling(length).std() * np.sqrt(252) * 100

"""Trend indicators: EMA family, VWAP, ADX, Supertrend.

All functions are pure and operate on pandas Series/DataFrames so they compose
cleanly and stay unit-testable. No TA-Lib dependency — implementations are
native and match the standard textbook definitions.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def ema(series: pd.Series, length: int) -> pd.Series:
    """Exponential moving average."""
    return series.ewm(span=length, adjust=False).mean()


def rolling_vwap(df: pd.DataFrame, length: int | None = None) -> pd.Series:
    """Volume-weighted average price.

    With ``length`` it is a rolling VWAP over that many bars; without it, a
    cumulative anchored VWAP over the whole series.
    """
    typical = (df["high"] + df["low"] + df["close"]) / 3.0
    pv = typical * df["volume"]
    if length:
        num = pv.rolling(length).sum()
        den = df["volume"].rolling(length).sum()
    else:
        num = pv.cumsum()
        den = df["volume"].cumsum()
    return num / den.replace(0, np.nan)


def true_range(df: pd.DataFrame) -> pd.Series:
    prev_close = df["close"].shift(1)
    ranges = pd.concat(
        [
            df["high"] - df["low"],
            (df["high"] - prev_close).abs(),
            (df["low"] - prev_close).abs(),
        ],
        axis=1,
    )
    return ranges.max(axis=1)


def atr(df: pd.DataFrame, length: int = 14) -> pd.Series:
    """Average True Range using Wilder's smoothing."""
    tr = true_range(df)
    return tr.ewm(alpha=1 / length, adjust=False).mean()


def adx(df: pd.DataFrame, length: int = 14) -> pd.DataFrame:
    """Average Directional Index with +DI / -DI.

    Returns a DataFrame with columns ``adx``, ``plus_di``, ``minus_di``.
    """
    up = df["high"].diff()
    down = -df["low"].diff()
    plus_dm = np.where((up > down) & (up > 0), up, 0.0)
    minus_dm = np.where((down > up) & (down > 0), down, 0.0)

    tr = true_range(df)
    atr_ = tr.ewm(alpha=1 / length, adjust=False).mean()

    plus_di = 100 * pd.Series(plus_dm, index=df.index).ewm(
        alpha=1 / length, adjust=False
    ).mean() / atr_.replace(0, np.nan)
    minus_di = 100 * pd.Series(minus_dm, index=df.index).ewm(
        alpha=1 / length, adjust=False
    ).mean() / atr_.replace(0, np.nan)

    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    adx_ = dx.ewm(alpha=1 / length, adjust=False).mean()
    return pd.DataFrame(
        {"adx": adx_, "plus_di": plus_di, "minus_di": minus_di}, index=df.index
    )


def supertrend(df: pd.DataFrame, length: int = 10, multiplier: float = 3.0) -> pd.DataFrame:
    """Supertrend indicator.

    Returns a DataFrame with ``supertrend`` (the line) and ``direction``
    (+1 = bullish, -1 = bearish).
    """
    atr_ = atr(df, length)
    hl2 = (df["high"] + df["low"]) / 2.0
    upper = hl2 + multiplier * atr_
    lower = hl2 - multiplier * atr_

    n = len(df)
    final_upper = np.array(upper, dtype=float)  # writable copy
    final_lower = np.array(lower, dtype=float)
    close = df["close"].to_numpy()
    st = np.full(n, np.nan)
    direction = np.ones(n, dtype=int)

    for i in range(1, n):
        final_upper[i] = (
            upper.iloc[i]
            if (upper.iloc[i] < final_upper[i - 1] or close[i - 1] > final_upper[i - 1])
            else final_upper[i - 1]
        )
        final_lower[i] = (
            lower.iloc[i]
            if (lower.iloc[i] > final_lower[i - 1] or close[i - 1] < final_lower[i - 1])
            else final_lower[i - 1]
        )
        if close[i] > final_upper[i - 1]:
            direction[i] = 1
        elif close[i] < final_lower[i - 1]:
            direction[i] = -1
        else:
            direction[i] = direction[i - 1]
        st[i] = final_lower[i] if direction[i] == 1 else final_upper[i]

    return pd.DataFrame(
        {"supertrend": st, "direction": direction}, index=df.index
    )

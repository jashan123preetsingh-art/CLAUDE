"""Volume indicators: OBV, volume SMAs, relative volume, volume profile (POC)."""
from __future__ import annotations

import numpy as np
import pandas as pd


def obv(df: pd.DataFrame) -> pd.Series:
    """On-Balance Volume."""
    direction = np.sign(df["close"].diff().fillna(0.0))
    return (direction * df["volume"]).cumsum()


def volume_sma(df: pd.DataFrame, length: int = 20) -> pd.Series:
    return df["volume"].rolling(length).mean()


def relative_volume(df: pd.DataFrame, length: int = 20) -> pd.Series:
    """Latest volume relative to its rolling average (1.0 == average)."""
    avg = df["volume"].rolling(length).mean()
    return df["volume"] / avg.replace(0, np.nan)


def volume_profile(df: pd.DataFrame, bins: int = 24, lookback: int = 120) -> dict:
    """Approximate a volume profile over the recent window.

    Returns the Point of Control (POC — price of the highest-volume node) plus
    the high- and low-volume node price levels. Volume for each bar is spread
    uniformly across that bar's high-low range.
    """
    window = df.tail(lookback)
    lo, hi = window["low"].min(), window["high"].max()
    if not np.isfinite(lo) or not np.isfinite(hi) or hi <= lo:
        return {"poc": float(window["close"].iloc[-1]), "hvn": [], "lvn": []}

    edges = np.linspace(lo, hi, bins + 1)
    centers = (edges[:-1] + edges[1:]) / 2.0
    vol = np.zeros(bins)

    for _, row in window.iterrows():
        b_lo, b_hi = row["low"], row["high"]
        if b_hi <= b_lo:
            idx = min(int((b_lo - lo) / (hi - lo) * bins), bins - 1)
            vol[idx] += row["volume"]
            continue
        first = max(int((b_lo - lo) / (hi - lo) * bins), 0)
        last = min(int((b_hi - lo) / (hi - lo) * bins), bins - 1)
        share = row["volume"] / (last - first + 1)
        vol[first : last + 1] += share

    poc_idx = int(np.argmax(vol))
    thresh_hi = np.percentile(vol, 80)
    thresh_lo = np.percentile(vol, 20)
    hvn = [float(centers[i]) for i in range(bins) if vol[i] >= thresh_hi]
    lvn = [float(centers[i]) for i in range(bins) if vol[i] <= thresh_lo]
    return {"poc": float(centers[poc_idx]), "hvn": hvn, "lvn": lvn}

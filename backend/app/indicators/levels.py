"""Price levels: pivots, CPR, 52-week extremes, swing points, gap %."""
from __future__ import annotations

import numpy as np
import pandas as pd


def pivot_points(prev_high: float, prev_low: float, prev_close: float) -> dict:
    """Classic floor-trader pivots from the previous session."""
    pivot = (prev_high + prev_low + prev_close) / 3.0
    r1 = 2 * pivot - prev_low
    s1 = 2 * pivot - prev_high
    r2 = pivot + (prev_high - prev_low)
    s2 = pivot - (prev_high - prev_low)
    r3 = prev_high + 2 * (pivot - prev_low)
    s3 = prev_low - 2 * (prev_high - pivot)
    return {"pivot": pivot, "r1": r1, "r2": r2, "r3": r3, "s1": s1, "s2": s2, "s3": s3}


def central_pivot_range(prev_high: float, prev_low: float, prev_close: float) -> dict:
    """CPR: pivot, bottom-central (bc) and top-central (tc)."""
    pivot = (prev_high + prev_low + prev_close) / 3.0
    bc = (prev_high + prev_low) / 2.0
    tc = 2 * pivot - bc
    tc, bc = max(tc, bc), min(tc, bc)
    width = abs(tc - bc) / pivot if pivot else 0.0
    return {"cpr_pivot": pivot, "cpr_tc": tc, "cpr_bc": bc, "cpr_width": width}


def week52_extremes(df: pd.DataFrame) -> dict:
    window = df.tail(252)
    return {
        "high_52w": float(window["high"].max()),
        "low_52w": float(window["low"].min()),
    }


def swing_points(df: pd.DataFrame, left: int = 3, right: int = 3) -> dict:
    """Most-recent confirmed swing high / low using a fractal window."""
    highs, lows = df["high"].to_numpy(), df["low"].to_numpy()
    n = len(df)
    swing_high = swing_low = np.nan
    for i in range(n - right - 1, left - 1, -1):
        wnd_h = highs[i - left : i + right + 1]
        if np.isnan(swing_high) and highs[i] == wnd_h.max():
            swing_high = float(highs[i])
        wnd_l = lows[i - left : i + right + 1]
        if np.isnan(swing_low) and lows[i] == wnd_l.min():
            swing_low = float(lows[i])
        if not np.isnan(swing_high) and not np.isnan(swing_low):
            break
    return {"swing_high": swing_high, "swing_low": swing_low}


def gap_pct(df: pd.DataFrame) -> float:
    """Today's open vs. yesterday's close, in percent."""
    if len(df) < 2:
        return 0.0
    prev_close = df["close"].iloc[-2]
    today_open = df["open"].iloc[-1]
    if prev_close == 0:
        return 0.0
    return float((today_open - prev_close) / prev_close * 100)

"""Market-structure analysis: HH/HL/LH/LL, break of structure, trend strength."""
from __future__ import annotations

import numpy as np
import pandas as pd


def _fractal_pivots(series: pd.Series, left: int, right: int, kind: str) -> list[tuple[int, float]]:
    """Return (index, price) pivots. kind='high' -> local maxima, else minima."""
    vals = series.to_numpy()
    n = len(vals)
    out: list[tuple[int, float]] = []
    for i in range(left, n - right):
        window = vals[i - left : i + right + 1]
        if kind == "high" and vals[i] == window.max():
            out.append((i, float(vals[i])))
        elif kind == "low" and vals[i] == window.min():
            out.append((i, float(vals[i])))
    return out


def market_structure(df: pd.DataFrame, left: int = 3, right: int = 3) -> dict:
    """Classify the current swing structure and detect a break of structure.

    Returns flags for higher-high / higher-low / lower-high / lower-low, a
    ``structure`` label (uptrend / downtrend / range) and ``bos`` (break of
    structure) when the last close takes out the previous swing high/low.
    """
    highs = _fractal_pivots(df["high"], left, right, "high")
    lows = _fractal_pivots(df["low"], left, right, "low")

    result = {
        "higher_high": False,
        "higher_low": False,
        "lower_high": False,
        "lower_low": False,
        "structure": "range",
        "bos": None,  # 'bullish' | 'bearish' | None
    }

    if len(highs) >= 2:
        result["higher_high"] = highs[-1][1] > highs[-2][1]
        result["lower_high"] = highs[-1][1] < highs[-2][1]
    if len(lows) >= 2:
        result["higher_low"] = lows[-1][1] > lows[-2][1]
        result["lower_low"] = lows[-1][1] < lows[-2][1]

    if result["higher_high"] and result["higher_low"]:
        result["structure"] = "uptrend"
    elif result["lower_high"] and result["lower_low"]:
        result["structure"] = "downtrend"

    last_close = float(df["close"].iloc[-1])
    if highs and last_close > highs[-1][1]:
        result["bos"] = "bullish"
    elif lows and last_close < lows[-1][1]:
        result["bos"] = "bearish"
    return result


def trend_strength(df: pd.DataFrame, length: int = 50) -> float:
    """0..100 score from the R² of a linear fit of log-price (slope-adjusted).

    A strong, smooth up-move scores high; choppy or flat action scores low.
    """
    window = df["close"].tail(length)
    if len(window) < length:
        return 0.0
    y = np.log(window.to_numpy())
    x = np.arange(len(y))
    slope, intercept = np.polyfit(x, y, 1)
    fit = slope * x + intercept
    ss_res = float(np.sum((y - fit) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
    directional = r2 * (1 if slope > 0 else -1)
    return float(np.clip((directional + 1) / 2 * 100, 0, 100))


def relative_strength(stock_close: pd.Series, bench_close: pd.Series, length: int = 55) -> float:
    """Relative strength vs a benchmark: stock return minus benchmark return (%).

    Positive means the stock outperformed the benchmark over ``length`` bars.
    """
    if len(stock_close) < length + 1 or len(bench_close) < length + 1:
        return 0.0
    s_ret = stock_close.iloc[-1] / stock_close.iloc[-length - 1] - 1
    b_ret = bench_close.iloc[-1] / bench_close.iloc[-length - 1] - 1
    return float((s_ret - b_ret) * 100)

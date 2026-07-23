"""Chart-pattern detectors used to enrich and boost qualifying setups.

Each detector is a heuristic returning a bool; ``detect_patterns`` runs them
all and returns the list of matched pattern names. These favour precision on
the bullish continuation/breakout patterns most relevant to swing trading.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def _pct_range(window: pd.DataFrame) -> float:
    hi, lo = window["high"].max(), window["low"].min()
    return (hi - lo) / lo * 100 if lo else 0.0


def is_vcp(df: pd.DataFrame, feats: dict) -> bool:
    """Volatility Contraction Pattern: successive tighter pullbacks + dry-up.

    Approximated by a sequence of shrinking swing ranges over the last ~50 bars
    combined with current Bollinger width near its 20-bar minimum.
    """
    if len(df) < 60:
        return False
    seg = df.tail(50)
    thirds = np.array_split(seg, 3)
    ranges = [_pct_range(t) for t in thirds]
    contracting = ranges[0] > ranges[1] > ranges[2]
    tight_now = feats.get("bb_width", 1) <= feats.get("bb_width_min_20", 0) * 1.15
    above_ma = feats["price"] > feats["ema50"]
    return bool(contracting and tight_now and above_ma)


def is_darvas_box(df: pd.DataFrame, feats: dict) -> bool:
    """Darvas box: tight consolidation near highs then a top-of-box breakout."""
    if len(df) < 40:
        return False
    box = df.tail(20)
    box_high, box_low = box["high"].max(), box["low"].min()
    consolidation = (box_high - box_low) / box_low < 0.12 if box_low else False
    breakout = feats["price"] >= box_high * 0.995
    near_highs = feats["price"] > feats["ema50"]
    return bool(consolidation and breakout and near_highs)


def is_cup_and_handle(df: pd.DataFrame, feats: dict) -> bool:
    """Cup & handle: rounded recovery to prior highs with a small handle dip."""
    if len(df) < 90:
        return False
    seg = df.tail(90)
    left_peak = seg["high"].iloc[:15].max()
    bottom = seg["low"].iloc[25:65].min()
    right = seg["high"].iloc[-20:].max()
    depth = (left_peak - bottom) / left_peak if left_peak else 0
    recovered = right >= left_peak * 0.97
    handle = seg["close"].iloc[-1] < right and seg["close"].iloc[-1] > right * 0.9
    return bool(0.1 < depth < 0.5 and recovered and handle)


def is_bull_flag(df: pd.DataFrame, feats: dict) -> bool:
    """Bull flag: strong pole then a shallow, low-volume drift down."""
    if len(df) < 30:
        return False
    pole = df.iloc[-15:-5]
    flag = df.tail(5)
    pole_move = (pole["close"].iloc[-1] / pole["close"].iloc[0] - 1) if len(pole) else 0
    flag_move = (flag["close"].iloc[-1] / flag["close"].iloc[0] - 1) if len(flag) else 0
    return bool(pole_move > 0.12 and -0.06 < flag_move < 0.0 and feats["price"] > feats["ema20"])


def is_flat_base(df: pd.DataFrame, feats: dict) -> bool:
    """Flat base: ~5-7 week sideways range under 15% depth near highs."""
    if len(df) < 35:
        return False
    base = df.tail(30)
    depth = _pct_range(base)
    return bool(depth < 15 and feats["price"] > feats["ema50"] > feats["ema200"])


def is_ascending_triangle(df: pd.DataFrame, feats: dict) -> bool:
    """Ascending triangle: flat resistance with rising lows."""
    if len(df) < 40:
        return False
    seg = df.tail(30)
    highs = seg["high"]
    lows = seg["low"]
    flat_top = highs.max() - highs.nlargest(5).min() < highs.max() * 0.03
    x = np.arange(len(lows))
    slope = np.polyfit(x, lows.to_numpy(), 1)[0]
    return bool(flat_top and slope > 0)


def is_high_tight_flag(df: pd.DataFrame, feats: dict) -> bool:
    """High tight flag: ~100% run in ~8 weeks then a shallow, tight pause."""
    if len(df) < 45:
        return False
    run = df.tail(40)
    gain = run["close"].iloc[-1] / run["close"].iloc[0] - 1
    pause = df.tail(7)
    tight = _pct_range(pause) < 25
    return bool(gain > 0.8 and tight)


def is_gap_up_continuation(df: pd.DataFrame, feats: dict) -> bool:
    """Gap-up continuation: fresh gap up holding above VWAP with strong volume."""
    return bool(
        feats.get("gap_pct", 0) > 1.5
        and feats["price"] > feats.get("vwap", feats["price"])
        and feats.get("rel_volume", 0) > 1.3
    )


_DETECTORS = {
    "VCP": is_vcp,
    "Darvas Box": is_darvas_box,
    "Cup & Handle": is_cup_and_handle,
    "Bull Flag": is_bull_flag,
    "Flat Base": is_flat_base,
    "Ascending Triangle": is_ascending_triangle,
    "High Tight Flag": is_high_tight_flag,
    "Gap-Up Continuation": is_gap_up_continuation,
}


def detect_patterns(df: pd.DataFrame, feats: dict) -> list[str]:
    """Return the names of every pattern that currently matches."""
    found: list[str] = []
    for name, fn in _DETECTORS.items():
        try:
            if fn(df, feats):
                found.append(name)
        except Exception:  # a single detector must never break the scan
            continue
    return found

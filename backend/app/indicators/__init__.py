"""Indicator aggregation.

``compute_features`` turns a raw OHLCV DataFrame (plus an optional benchmark
close series for relative strength) into a flat dict of the latest indicator
values consumed by the filters, scoring engine and screeners.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.indicators import levels, structure, volatility, volume
from app.indicators.momentum import macd, rsi
from app.indicators.trend import adx, atr, ema, rolling_vwap, supertrend

REQUIRED_COLUMNS = ("open", "high", "low", "close", "volume")


def _last(series: pd.Series, default: float = np.nan) -> float:
    if series is None or len(series) == 0:
        return default
    val = series.iloc[-1]
    return float(val) if pd.notna(val) else default


def compute_features(
    df: pd.DataFrame, benchmark_close: pd.Series | None = None
) -> dict:
    """Compute the full indicator feature set for one symbol.

    Parameters
    ----------
    df:
        Daily OHLCV frame sorted ascending by date, indexed 0..n-1.
    benchmark_close:
        Nifty (or sector) close series aligned to the same dates, used for
        relative strength. Optional.
    """
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"missing OHLCV columns: {missing}")
    if len(df) < 60:
        raise ValueError("need >= 60 candles for a reliable feature set")

    close = df["close"]
    feats: dict[str, float] = {}

    feats["price"] = _last(close)
    for length in (10, 20, 50, 100, 200):
        feats[f"ema{length}"] = _last(ema(close, length))

    feats["vwap"] = _last(rolling_vwap(df))
    feats["rsi"] = _last(rsi(close, 14))

    macd_df = macd(close)
    feats["macd"] = _last(macd_df["macd"])
    feats["macd_signal"] = _last(macd_df["signal"])
    feats["macd_hist"] = _last(macd_df["hist"])

    adx_df = adx(df, 14)
    feats["adx"] = _last(adx_df["adx"])
    feats["plus_di"] = _last(adx_df["plus_di"])
    feats["minus_di"] = _last(adx_df["minus_di"])

    atr_series = atr(df, 14)
    feats["atr"] = _last(atr_series)
    feats["atr_pct"] = feats["atr"] / feats["price"] * 100 if feats["price"] else 0.0
    feats["atr_prev"] = _last(atr_series.shift(5))
    feats["atr_expanding"] = float(feats["atr"] > feats["atr_prev"]) if not np.isnan(feats["atr_prev"]) else 0.0

    st = supertrend(df)
    feats["supertrend"] = _last(st["supertrend"])
    feats["supertrend_dir"] = _last(st["direction"])

    bb = volatility.bollinger_bands(close)
    feats["bb_upper"] = _last(bb["bb_upper"])
    feats["bb_lower"] = _last(bb["bb_lower"])
    feats["bb_width"] = _last(bb["bb_width"])
    feats["bb_width_min_20"] = float(bb["bb_width"].tail(20).min())

    kc = volatility.keltner_channel(df)
    feats["kc_upper"] = _last(kc["kc_upper"])
    feats["kc_lower"] = _last(kc["kc_lower"])

    dc = volatility.donchian_channel(df, 20)
    feats["dc_upper"] = _last(dc["dc_upper"])
    feats["dc_lower"] = _last(dc["dc_lower"])
    feats["hist_vol"] = _last(volatility.historical_volatility(close))

    feats["obv"] = _last(volume.obv(df))
    feats["obv_slope"] = _last(volume.obv(df).diff(10))
    feats["vol_sma20"] = _last(volume.volume_sma(df, 20))
    feats["vol_sma50"] = _last(volume.volume_sma(df, 50))
    feats["rel_volume"] = _last(volume.relative_volume(df, 20))
    feats["volume"] = _last(df["volume"])

    vp = volume.volume_profile(df)
    feats["poc"] = vp["poc"]

    # previous-day levels + pivots + CPR
    prev = df.iloc[-2]
    feats["prev_high"] = float(prev["high"])
    feats["prev_low"] = float(prev["low"])
    feats["prev_close"] = float(prev["close"])
    feats.update(levels.pivot_points(prev["high"], prev["low"], prev["close"]))
    feats.update(levels.central_pivot_range(prev["high"], prev["low"], prev["close"]))
    feats.update(levels.week52_extremes(df))
    feats.update(levels.swing_points(df))
    feats["gap_pct"] = levels.gap_pct(df)
    feats["pct_from_52w_high"] = (
        (feats["price"] - feats["high_52w"]) / feats["high_52w"] * 100
        if feats["high_52w"]
        else 0.0
    )

    # structure
    ms = structure.market_structure(df)
    feats["higher_high"] = float(ms["higher_high"])
    feats["higher_low"] = float(ms["higher_low"])
    feats["lower_high"] = float(ms["lower_high"])
    feats["lower_low"] = float(ms["lower_low"])
    feats["structure"] = ms["structure"]
    feats["bos"] = ms["bos"]
    feats["trend_strength"] = structure.trend_strength(df)

    # relative strength vs benchmark
    if benchmark_close is not None and len(benchmark_close) >= 56:
        feats["rs_vs_nifty"] = structure.relative_strength(close, benchmark_close)
    else:
        feats["rs_vs_nifty"] = 0.0

    # delivery %
    if "delivery_qty" in df.columns and df["delivery_qty"].notna().any():
        recent = df.tail(20)
        dq = recent["delivery_qty"]
        vol_ = recent["volume"].replace(0, np.nan)
        feats["delivery_pct"] = float((dq / vol_ * 100).tail(1).iloc[0]) if dq.notna().iloc[-1] else np.nan
        feats["avg_delivery_pct"] = float((dq / vol_ * 100).mean())
        feats["delivery_rising"] = float(
            (dq / vol_).tail(5).mean() > (dq / vol_).tail(20).mean()
        )
    else:
        feats["delivery_pct"] = np.nan
        feats["avg_delivery_pct"] = np.nan
        feats["delivery_rising"] = 0.0

    feats["volume_spike_pct"] = (
        (feats["rel_volume"] - 1) * 100 if not np.isnan(feats["rel_volume"]) else 0.0
    )
    return feats

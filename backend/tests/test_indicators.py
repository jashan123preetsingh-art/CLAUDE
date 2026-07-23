"""Indicator correctness tests."""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.indicators import compute_features
from app.indicators.momentum import macd, rsi
from app.indicators.trend import atr, ema


def test_ema_matches_pandas():
    s = pd.Series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], dtype=float)
    assert np.isclose(ema(s, 3).iloc[-1], s.ewm(span=3, adjust=False).mean().iloc[-1])


def test_rsi_bounds():
    rng = np.random.default_rng(0)
    s = pd.Series(100 + np.cumsum(rng.normal(0, 1, 200)))
    r = rsi(s, 14).dropna()
    assert (r >= 0).all() and (r <= 100).all()


def test_rsi_all_up_is_high():
    s = pd.Series(np.arange(1, 100, dtype=float))
    assert rsi(s, 14).iloc[-1] > 95


def test_macd_hist_is_line_minus_signal():
    s = pd.Series(np.linspace(1, 100, 100) + np.sin(np.arange(100)))
    m = macd(s)
    assert np.allclose((m["macd"] - m["signal"]).dropna(), m["hist"].dropna())


def test_atr_positive(uptrend_df):
    a = atr(uptrend_df, 14).dropna()
    assert (a > 0).all()


def test_compute_features_shape(uptrend_df):
    feats = compute_features(uptrend_df)
    # sanity: an uptrend should have EMA stack aligned and price above EMA200
    assert feats["ema20"] > feats["ema200"]
    assert feats["price"] > feats["ema200"]
    assert 0 <= feats["rsi"] <= 100
    assert feats["atr"] > 0
    assert "poc" in feats
    assert feats["structure"] in {"uptrend", "downtrend", "range"}


def test_compute_features_requires_history():
    small = pd.DataFrame(
        {c: np.arange(10, dtype=float) + 1 for c in ["open", "high", "low", "close", "volume"]}
    )
    try:
        compute_features(small)
    except ValueError:
        return
    raise AssertionError("expected ValueError for insufficient history")

"""Shared test fixtures."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest


@pytest.fixture
def uptrend_df() -> pd.DataFrame:
    """A clean synthetic uptrend with volume expansion at the end."""
    n = 300
    rng = np.random.default_rng(42)
    shocks = rng.normal(0.001, 0.012, n)
    shocks[-20:] += 0.002
    close = 200 * np.exp(np.cumsum(shocks))
    intraday = np.abs(rng.normal(0, 0.01, n)) + 0.004
    high = close * (1 + intraday)
    low = close * (1 - intraday)
    open_ = np.clip(np.concatenate([[close[0]], close[:-1]]), low, high)
    volume = rng.lognormal(np.log(2e6), 0.3, n)
    volume[-10:] *= 1.8
    dates = pd.bdate_range(end="2026-07-22", periods=n)
    return pd.DataFrame(
        {
            "date": [d.date() for d in dates],
            "open": open_,
            "high": high,
            "low": low,
            "close": close,
            "volume": volume,
            "delivery_qty": volume * 0.55,
        }
    )

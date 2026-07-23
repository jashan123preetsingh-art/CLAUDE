"""Risk-management plan builder.

Given the computed features and the swing horizon, produce an actionable trade
plan: entry zone, ATR-based stop, three targets on an R-multiple ladder,
risk/reward, expected holding period and a volatility-aware position size.
"""
from __future__ import annotations

import numpy as np

from app.models.schemas import RiskPlan, SwingType

# ATR stop multiple and expected holding window per swing horizon
_HORIZON = {
    SwingType.WEEKLY: {"atr_mult": 1.5, "hold": 7, "targets": (2.0, 3.5, 5.0)},
    SwingType.MONTHLY: {"atr_mult": 2.0, "hold": 30, "targets": (2.5, 4.5, 7.0)},
    SwingType.LONG_TERM: {"atr_mult": 3.0, "hold": 180, "targets": (3.0, 6.0, 10.0)},
    SwingType.FNO: {"atr_mult": 1.2, "hold": 5, "targets": (1.5, 2.5, 4.0)},
}


def build_risk_plan(
    feats: dict,
    swing_type: SwingType,
    account_capital: float = 1_000_000.0,
    max_risk_pct: float = 1.0,
) -> RiskPlan:
    """Build a RiskPlan sized to risk ``max_risk_pct`` of ``account_capital``."""
    price = float(feats["price"])
    atr = float(feats.get("atr") or price * 0.02)
    cfg = _HORIZON[swing_type]

    # Entry zone: a small band around current price / nearest support
    entry_high = price
    entry_low = max(price - 0.4 * atr, price * 0.99)
    entry_mid = (entry_low + entry_high) / 2.0

    # Stop: the tighter-anchored of ATR stop and recent swing low
    atr_stop = entry_mid - cfg["atr_mult"] * atr
    swing_low = feats.get("swing_low")
    if swing_low and np.isfinite(swing_low) and swing_low < entry_mid:
        stop = min(atr_stop, swing_low * 0.997)
    else:
        stop = atr_stop
    stop = max(stop, 0.01)

    risk_per_share = max(entry_mid - stop, price * 0.005)
    t1, t2, t3 = (entry_mid + m * risk_per_share for m in cfg["targets"])
    risk_reward = (t2 - entry_mid) / risk_per_share if risk_per_share else 0.0

    # Position sizing: risk a fixed fraction of capital
    capital_at_risk = account_capital * (max_risk_pct / 100.0)
    shares = int(capital_at_risk / risk_per_share) if risk_per_share > 0 else 0

    return RiskPlan(
        entry_low=round(entry_low, 2),
        entry_high=round(entry_high, 2),
        stop_loss=round(stop, 2),
        target1=round(t1, 2),
        target2=round(t2, 2),
        target3=round(t3, 2),
        risk_reward=round(risk_reward, 2),
        atr_stop=round(atr_stop, 2),
        expected_holding_days=cfg["hold"],
        position_size_shares=shares,
        max_risk_pct=max_risk_pct,
        capital_at_risk=round(capital_at_risk, 2),
    )

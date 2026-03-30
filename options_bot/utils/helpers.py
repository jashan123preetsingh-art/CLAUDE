"""Utility helpers for the options trading bot."""

import math
from datetime import datetime, date, timedelta
from typing import Optional

import numpy as np
import pandas as pd


def round_to_strike(price: float, tick: float = 50.0) -> float:
    """Round price to nearest strike price."""
    return round(price / tick) * tick


def atm_strike(spot: float, tick: float = 50.0) -> float:
    """Get ATM strike for given spot price."""
    return round_to_strike(spot, tick)


def otm_strikes(spot: float, n: int, tick: float = 50.0,
                direction: str = "both") -> dict:
    """Get OTM strikes above and below spot.

    Returns dict with 'calls' (above) and 'puts' (below) strike lists.
    """
    atm = atm_strike(spot, tick)
    result = {"calls": [], "puts": []}

    for i in range(1, n + 1):
        if direction in ("both", "call"):
            result["calls"].append(atm + i * tick)
        if direction in ("both", "put"):
            result["puts"].append(atm - i * tick)

    return result


def annualized_days(days: int) -> float:
    """Convert calendar days to annualized time fraction."""
    return max(days, 0) / 365.0


def trading_days_to_annual(days: int) -> float:
    """Convert trading days to annualized time fraction."""
    return max(days, 0) / 252.0


def pct_change(old: float, new: float) -> float:
    """Calculate percentage change."""
    if old == 0:
        return 0.0
    return ((new - old) / abs(old)) * 100.0


def format_currency(amount: float, symbol: str = "₹") -> str:
    """Format amount as Indian currency."""
    if abs(amount) >= 1_00_00_000:  # 1 Crore
        return f"{symbol}{amount / 1_00_00_000:,.2f} Cr"
    elif abs(amount) >= 1_00_000:  # 1 Lakh
        return f"{symbol}{amount / 1_00_000:,.2f} L"
    else:
        return f"{symbol}{amount:,.2f}"


def format_greeks(value: float, greek: str) -> str:
    """Format Greek value for display."""
    if greek in ("delta", "gamma"):
        return f"{value:.4f}"
    elif greek == "theta":
        return f"{value:.2f}"
    elif greek == "vega":
        return f"{value:.2f}"
    elif greek == "rho":
        return f"{value:.4f}"
    return f"{value:.4f}"


def is_expiry_day(dt: Optional[date] = None) -> bool:
    """Check if given date is a Thursday (weekly expiry for NSE)."""
    if dt is None:
        dt = date.today()
    return dt.weekday() == 3  # Thursday


def next_expiry(from_date: Optional[date] = None) -> date:
    """Get next Thursday (weekly expiry)."""
    if from_date is None:
        from_date = date.today()

    days_ahead = 3 - from_date.weekday()  # Thursday = 3
    if days_ahead <= 0:
        days_ahead += 7
    return from_date + timedelta(days=days_ahead)


def moneyness(spot: float, strike: float, option_type: str) -> str:
    """Determine if option is ITM, ATM, or OTM."""
    pct_diff = abs(spot - strike) / spot * 100

    if pct_diff < 0.5:
        return "ATM"

    if option_type.upper() in ("CE", "CALL"):
        return "ITM" if spot > strike else "OTM"
    else:  # PE / PUT
        return "ITM" if spot < strike else "OTM"


def intrinsic_value(spot: float, strike: float, option_type: str) -> float:
    """Calculate intrinsic value of an option."""
    if option_type.upper() in ("CE", "CALL"):
        return max(0, spot - strike)
    else:
        return max(0, strike - spot)


def time_value(premium: float, spot: float, strike: float,
               option_type: str) -> float:
    """Calculate time value of an option."""
    return premium - intrinsic_value(spot, strike, option_type)


def lot_value(price: float, lot_size: int, quantity: int = 1) -> float:
    """Calculate total value for given lots."""
    return price * lot_size * quantity


def breakeven_straddle(atm_strike: float, total_premium: float) -> tuple:
    """Calculate breakeven points for a straddle."""
    return (atm_strike - total_premium, atm_strike + total_premium)


def breakeven_strangle(put_strike: float, call_strike: float,
                       total_premium: float) -> tuple:
    """Calculate breakeven points for a strangle."""
    return (put_strike - total_premium, call_strike + total_premium)


def max_profit_credit_spread(net_premium: float, lot_size: int) -> float:
    """Max profit for a credit spread = net premium received."""
    return net_premium * lot_size


def max_loss_credit_spread(width: float, net_premium: float,
                           lot_size: int) -> float:
    """Max loss for a credit spread = (width - premium) * lot_size."""
    return (width - net_premium) * lot_size


def reward_risk_ratio(max_profit: float, max_loss: float) -> float:
    """Calculate reward to risk ratio."""
    if max_loss == 0:
        return float('inf')
    return abs(max_profit / max_loss)


def sharpe_ratio(returns: pd.Series, risk_free_rate: float = 0.065) -> float:
    """Calculate annualized Sharpe ratio."""
    if returns.std() == 0:
        return 0.0
    excess_returns = returns - risk_free_rate / 252
    return np.sqrt(252) * excess_returns.mean() / returns.std()


def sortino_ratio(returns: pd.Series, risk_free_rate: float = 0.065) -> float:
    """Calculate annualized Sortino ratio."""
    excess_returns = returns - risk_free_rate / 252
    downside = returns[returns < 0]
    if len(downside) == 0 or downside.std() == 0:
        return 0.0
    return np.sqrt(252) * excess_returns.mean() / downside.std()


def max_drawdown(equity_curve: pd.Series) -> tuple:
    """Calculate maximum drawdown and its duration.

    Returns (max_dd_pct, max_dd_duration_days).
    """
    peak = equity_curve.expanding(min_periods=1).max()
    drawdown = (equity_curve - peak) / peak
    max_dd = drawdown.min()

    # Duration
    in_drawdown = drawdown < 0
    if not in_drawdown.any():
        return (0.0, 0)

    groups = (~in_drawdown).cumsum()
    dd_durations = in_drawdown.groupby(groups).sum()
    max_duration = int(dd_durations.max()) if len(dd_durations) > 0 else 0

    return (abs(max_dd), max_duration)


def calmar_ratio(cagr: float, max_dd: float) -> float:
    """Calculate Calmar ratio = CAGR / Max Drawdown."""
    if max_dd == 0:
        return 0.0
    return cagr / max_dd


def nse_symbol_format(symbol: str, strike: float, expiry: date,
                      option_type: str) -> str:
    """Format symbol in NSE convention.

    Example: NIFTY24MAR25000CE
    """
    expiry_str = expiry.strftime("%y%b").upper()
    strike_str = str(int(strike))
    opt = "CE" if option_type.upper() in ("CE", "CALL") else "PE"
    return f"{symbol}{expiry_str}{strike_str}{opt}"


def calculate_charges(turnover: float, buy_or_sell: str = "sell") -> dict:
    """Calculate trading charges for NSE F&O.

    Returns breakdown of all charges.
    """
    charges = {}

    # Brokerage (flat per order for discount brokers)
    charges["brokerage"] = 20.0

    # STT (on sell side for options, on both for futures)
    if buy_or_sell == "sell":
        charges["stt"] = turnover * 0.000625  # 0.0625% on sell
    else:
        charges["stt"] = 0.0

    # Exchange charges
    charges["exchange_txn"] = turnover * 0.000530  # NSE

    # GST on brokerage + exchange charges
    charges["gst"] = (charges["brokerage"] + charges["exchange_txn"]) * 0.18

    # SEBI charges
    charges["sebi"] = turnover * 0.000001  # ₹1 per crore

    # Stamp duty
    if buy_or_sell == "buy":
        charges["stamp_duty"] = turnover * 0.00003  # 0.003%
    else:
        charges["stamp_duty"] = 0.0

    charges["total"] = sum(charges.values())

    return charges

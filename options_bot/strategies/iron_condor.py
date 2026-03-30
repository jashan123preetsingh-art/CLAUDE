"""Iron Condor strategy for Indian options markets."""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any

from options_bot.core.models import (
    Greeks,
    MarketData,
    OptionChain,
    OptionContract,
    OptionQuote,
    OptionType,
    OrderSide,
    Position,
    Signal,
    SignalType,
    StrategyPosition,
    StrategyType,
)
from options_bot.strategies.base import BaseStrategy

logger = logging.getLogger(__name__)

# Indian market defaults
NIFTY_LOT = 25
BANKNIFTY_LOT = 15
DEFAULT_LOT_SIZE = {
    "NIFTY": NIFTY_LOT,
    "BANKNIFTY": BANKNIFTY_LOT,
    "FINNIFTY": 25,
    "MIDCPNIFTY": 50,
}


def _lot_size(symbol: str) -> int:
    return DEFAULT_LOT_SIZE.get(symbol.upper(), NIFTY_LOT)


def _find_strike_by_delta(
    quotes: list[OptionQuote],
    target_delta: float,
    side: str = "otm",
) -> OptionQuote | None:
    """Find the quote whose absolute delta is closest to *target_delta*."""
    if not quotes:
        return None
    return min(quotes, key=lambda q: abs(abs(q.greeks.delta) - target_delta))


class IronCondor(BaseStrategy):
    """Sell OTM put + OTM call, buy further-OTM wings for protection.

    Default parameters are tuned for weekly NIFTY / BANKNIFTY options.
    """

    def __init__(
        self,
        wing_width: float = 100.0,
        delta_target: float = 0.20,
        min_premium: float = 50.0,
        dte_range: tuple[int, int] = (3, 21),
        profit_target_pct: float = 0.50,
        stop_loss_pct: float = 1.50,
        iv_rank_threshold: float = 30.0,
    ) -> None:
        self.wing_width = wing_width
        self.delta_target = delta_target
        self.min_premium = min_premium
        self.dte_range = dte_range
        self.profit_target_pct = profit_target_pct
        self.stop_loss_pct = stop_loss_pct
        self.iv_rank_threshold = iv_rank_threshold

    # -- Properties ------------------------------------------------------

    @property
    def name(self) -> str:
        return "Iron Condor"

    @property
    def strategy_type(self) -> StrategyType:
        return StrategyType.IRON_CONDOR

    @property
    def description(self) -> str:
        return (
            "Sell OTM put and OTM call at target delta, buy protective wings. "
            "Profits from time decay in a range-bound market."
        )

    # -- Core logic ------------------------------------------------------

    def scan(
        self,
        option_chain: OptionChain,
        market_data: MarketData,
        signals: list[Signal],
    ) -> list[dict[str, Any]]:
        symbol = option_chain.symbol
        expiry = option_chain.expiry
        dte = (expiry - date.today()).days

        if not (self.dte_range[0] <= dte <= self.dte_range[1]):
            return []

        # Find short strikes by delta
        short_put = _find_strike_by_delta(option_chain.puts, self.delta_target)
        short_call = _find_strike_by_delta(option_chain.calls, self.delta_target)

        if short_put is None or short_call is None:
            return []

        # Determine wing strikes
        long_put_strike = short_put.strike - self.wing_width
        long_call_strike = short_call.strike + self.wing_width

        long_put = option_chain.get_put(long_put_strike)
        long_call = option_chain.get_call(long_call_strike)

        if long_put is None or long_call is None:
            return []

        # Net premium collected
        put_spread_credit = short_put.last_price - long_put.last_price
        call_spread_credit = short_call.last_price - long_call.last_price
        total_premium = put_spread_credit + call_spread_credit

        if total_premium < self.min_premium:
            return []

        setup: dict[str, Any] = {
            "symbol": symbol,
            "expiry": expiry,
            "dte": dte,
            "short_put_strike": short_put.strike,
            "long_put_strike": long_put_strike,
            "short_call_strike": short_call.strike,
            "long_call_strike": long_call_strike,
            "put_spread_credit": put_spread_credit,
            "call_spread_credit": call_spread_credit,
            "total_premium": total_premium,
            "max_loss": self.wing_width - total_premium,
            "upper_breakeven": short_call.strike + total_premium,
            "lower_breakeven": short_put.strike - total_premium,
            "short_put_delta": short_put.greeks.delta,
            "short_call_delta": short_call.greeks.delta,
            "short_put_iv": short_put.iv,
            "short_call_iv": short_call.iv,
            "underlying": market_data.last_price,
        }
        return [setup]

    def construct(
        self,
        option_chain: OptionChain,
        setup: dict[str, Any],
    ) -> StrategyPosition:
        symbol = setup["symbol"]
        expiry = setup["expiry"]
        lot = _lot_size(symbol)

        def _contract(strike: float, ot: OptionType) -> OptionContract:
            return OptionContract(
                symbol=symbol,
                strike=strike,
                option_type=ot,
                expiry=expiry,
                lot_size=lot,
            )

        def _quote(strike: float, ot: OptionType) -> OptionQuote | None:
            if ot == OptionType.CALL:
                return option_chain.get_call(strike)
            return option_chain.get_put(strike)

        legs: list[Position] = []
        for strike, ot, qty_sign in [
            (setup["short_put_strike"], OptionType.PUT, -1),
            (setup["long_put_strike"], OptionType.PUT, 1),
            (setup["short_call_strike"], OptionType.CALL, -1),
            (setup["long_call_strike"], OptionType.CALL, 1),
        ]:
            quote = _quote(strike, ot)
            price = quote.last_price if quote else 0.0
            greeks = quote.greeks if quote else Greeks()
            legs.append(
                Position(
                    contract=_contract(strike, ot),
                    quantity=qty_sign * lot,
                    entry_price=price,
                    current_price=price,
                    spot_price=option_chain.underlying_value,
                    greeks=greeks,
                )
            )

        total_premium = setup["total_premium"]
        return StrategyPosition(
            strategy_type=StrategyType.IRON_CONDOR,
            legs=legs,
            entry_time=datetime.now(),
            symbol=symbol,
            expiry=expiry,
            net_premium=total_premium,
            max_profit=total_premium * lot,
            max_loss=(self.wing_width - total_premium) * lot,
            upper_breakeven=setup["upper_breakeven"],
            lower_breakeven=setup["lower_breakeven"],
            status="active",
            tag=f"IC-{symbol}-{expiry}",
        )

    def should_enter(
        self,
        signals: list[Signal],
        risk_check: dict[str, Any],
    ) -> bool:
        if not risk_check.get("approved", False):
            return False

        # Need at least one neutral signal
        has_neutral = any(
            s.signal_type == SignalType.NEUTRAL and s.strength >= 0.5
            for s in signals
        )
        # Need IV rank above threshold
        has_high_iv = any(
            s.signal_type == SignalType.HIGH_IV
            and s.metadata.get("iv_rank", 0) >= self.iv_rank_threshold
            for s in signals
        )
        return has_neutral and has_high_iv

    def should_exit(
        self,
        position: StrategyPosition,
        market_data: MarketData,
    ) -> tuple[bool, str]:
        spot = market_data.last_price
        pnl = position.total_pnl
        premium = position.net_premium
        lot = _lot_size(position.symbol)

        # Profit target
        if premium > 0 and pnl >= premium * lot * self.profit_target_pct:
            return True, f"profit_target_reached ({self.profit_target_pct:.0%})"

        # Stop loss
        if premium > 0 and pnl <= -(premium * lot * self.stop_loss_pct):
            return True, f"stop_loss_hit ({self.stop_loss_pct:.0%} of premium)"

        # Tested: spot within 1% of a short strike
        short_strikes = [
            leg.contract.strike
            for leg in position.legs
            if leg.quantity < 0
        ]
        for strike in short_strikes:
            if abs(spot - strike) / strike < 0.01:
                return True, f"short_strike_tested (strike={strike})"

        # DTE guard
        if position.expiry:
            dte = (position.expiry - date.today()).days
            if dte <= 1:
                return True, "expiry_approaching (DTE<=1)"

        return False, ""

    def adjust(
        self,
        position: StrategyPosition,
        market_data: MarketData,
    ) -> list[dict[str, Any]]:
        actions: list[dict[str, Any]] = []
        spot = market_data.last_price

        short_put_legs = [
            l for l in position.legs
            if l.quantity < 0 and l.contract.option_type == OptionType.PUT
        ]
        short_call_legs = [
            l for l in position.legs
            if l.quantity < 0 and l.contract.option_type == OptionType.CALL
        ]

        # Roll tested put side down
        for leg in short_put_legs:
            distance_pct = (leg.contract.strike - spot) / spot
            if distance_pct > -0.005:  # within 0.5% or breached
                actions.append({
                    "action": "roll",
                    "leg": "short_put",
                    "current_strike": leg.contract.strike,
                    "new_strike": leg.contract.strike - self.wing_width,
                    "reason": "put side tested, rolling down",
                })

        # Roll tested call side up
        for leg in short_call_legs:
            distance_pct = (spot - leg.contract.strike) / spot
            if distance_pct > -0.005:
                actions.append({
                    "action": "roll",
                    "leg": "short_call",
                    "current_strike": leg.contract.strike,
                    "new_strike": leg.contract.strike + self.wing_width,
                    "reason": "call side tested, rolling up",
                })

        # Convert to iron butterfly when both sides pressured
        if len(actions) >= 2:
            atm = round(spot)
            actions = [{
                "action": "convert",
                "to": "iron_butterfly",
                "atm_strike": atm,
                "wing_width": self.wing_width,
                "reason": "both sides tested, converting to iron butterfly",
            }]

        return actions

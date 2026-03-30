"""Jade Lizard strategy for Indian options markets."""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any

from options_bot.core.models import (
    Greeks,
    MarketData,
    OptionChain,
    OptionContract,
    OptionType,
    Position,
    Signal,
    SignalType,
    StrategyPosition,
    StrategyType,
)
from options_bot.strategies.base import BaseStrategy

logger = logging.getLogger(__name__)

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


class JadeLizard(BaseStrategy):
    """Short put + short call spread (bull call spread sold).

    The key constraint is that the total credit collected must exceed the
    width of the call spread so that there is **no risk to the upside**.
    Downside risk is that of a naked short put.

    Legs:
        1. Sell OTM Put
        2. Sell OTM Call  (higher strike)
        3. Buy further-OTM Call (even higher strike)
    """

    def __init__(
        self,
        put_delta: float = 0.20,
        call_delta: float = 0.20,
        call_spread_width: float = 100.0,
        profit_target_pct: float = 0.50,
        stop_loss_pct: float = 1.50,
        iv_rank_threshold: float = 30.0,
        dte_range: tuple[int, int] = (5, 21),
    ) -> None:
        self.put_delta = put_delta
        self.call_delta = call_delta
        self.call_spread_width = call_spread_width
        self.profit_target_pct = profit_target_pct
        self.stop_loss_pct = stop_loss_pct
        self.iv_rank_threshold = iv_rank_threshold
        self.dte_range = dte_range

    @property
    def name(self) -> str:
        return "Jade Lizard"

    @property
    def strategy_type(self) -> StrategyType:
        return StrategyType.JADE_LIZARD

    @property
    def description(self) -> str:
        return (
            "Short put + short call spread. Total credit exceeds the call "
            "spread width, eliminating upside risk."
        )

    @staticmethod
    def _find_by_delta(
        quotes: list, target_delta: float,
    ):
        if not quotes:
            return None
        return min(quotes, key=lambda q: abs(abs(q.greeks.delta) - target_delta))

    def scan(
        self,
        option_chain: OptionChain,
        market_data: MarketData,
        signals: list[Signal],
    ) -> list[dict[str, Any]]:
        expiry = option_chain.expiry
        dte = (expiry - date.today()).days
        if not (self.dte_range[0] <= dte <= self.dte_range[1]):
            return []

        # Find short put by delta
        short_put = self._find_by_delta(option_chain.puts, self.put_delta)
        if short_put is None:
            return []

        # Find short call by delta
        short_call = self._find_by_delta(option_chain.calls, self.call_delta)
        if short_call is None:
            return []

        # Long call = short call strike + spread width
        long_call_strike = short_call.strike + self.call_spread_width
        long_call = option_chain.get_call(long_call_strike)
        if long_call is None:
            return []

        put_credit = short_put.last_price
        call_spread_credit = short_call.last_price - long_call.last_price
        total_credit = put_credit + call_spread_credit

        # Jade lizard requirement: total credit > call spread width
        # This eliminates upside risk entirely
        upside_risk_free = total_credit >= self.call_spread_width
        if not upside_risk_free:
            # Still viable but log a warning; some traders accept partial coverage
            logger.info(
                "Jade Lizard credit (%.2f) < call spread width (%.2f). "
                "Upside risk not fully eliminated.",
                total_credit,
                self.call_spread_width,
            )

        lower_breakeven = short_put.strike - total_credit

        return [{
            "symbol": option_chain.symbol,
            "expiry": expiry,
            "dte": dte,
            "short_put_strike": short_put.strike,
            "short_call_strike": short_call.strike,
            "long_call_strike": long_call_strike,
            "put_credit": put_credit,
            "call_spread_credit": call_spread_credit,
            "total_credit": total_credit,
            "call_spread_width": self.call_spread_width,
            "upside_risk_free": upside_risk_free,
            "lower_breakeven": lower_breakeven,
            "short_put_delta": short_put.greeks.delta,
            "short_call_delta": short_call.greeks.delta,
            "short_put_iv": short_put.iv,
            "short_call_iv": short_call.iv,
            "underlying": market_data.last_price,
        }]

    def construct(
        self,
        option_chain: OptionChain,
        setup: dict[str, Any],
    ) -> StrategyPosition:
        symbol = setup["symbol"]
        expiry = setup["expiry"]
        lot = _lot_size(symbol)

        leg_specs: list[tuple[float, OptionType, int, str]] = [
            (setup["short_put_strike"], OptionType.PUT, -1, "put_credit"),
            (setup["short_call_strike"], OptionType.CALL, -1, None),
            (setup["long_call_strike"], OptionType.CALL, 1, None),
        ]

        legs: list[Position] = []
        for strike, ot, qty_sign, price_key in leg_specs:
            quote = (
                option_chain.get_call(strike)
                if ot == OptionType.CALL
                else option_chain.get_put(strike)
            )
            if price_key:
                price = setup[price_key]
            else:
                price = quote.last_price if quote else 0.0
            greeks = quote.greeks if quote else Greeks()
            legs.append(
                Position(
                    contract=OptionContract(
                        symbol=symbol, strike=strike, option_type=ot,
                        expiry=expiry, lot_size=lot,
                    ),
                    quantity=qty_sign * lot,
                    entry_price=price,
                    current_price=price,
                    spot_price=setup["underlying"],
                    greeks=greeks,
                )
            )

        total_credit = setup["total_credit"]
        # Max loss is on the downside (naked put): unlimited in theory,
        # but practically bounded by the underlying going to zero.
        max_loss_downside = (setup["short_put_strike"] - total_credit) * lot
        # Upside max loss (if credit < call spread width)
        max_loss_upside = max(0, (self.call_spread_width - total_credit)) * lot

        return StrategyPosition(
            strategy_type=StrategyType.JADE_LIZARD,
            legs=legs,
            entry_time=datetime.now(),
            symbol=symbol,
            expiry=expiry,
            net_premium=total_credit,
            max_profit=total_credit * lot,
            max_loss=max(max_loss_downside, max_loss_upside),
            upper_breakeven=0.0 if setup["upside_risk_free"] else setup["short_call_strike"] + total_credit,
            lower_breakeven=setup["lower_breakeven"],
            status="active",
            tag=f"JL-{symbol}-{expiry}",
            metadata={"upside_risk_free": setup["upside_risk_free"]},
        )

    def should_enter(
        self,
        signals: list[Signal],
        risk_check: dict[str, Any],
    ) -> bool:
        if not risk_check.get("approved", False):
            return False

        # Jade lizard suits a neutral-to-bullish outlook
        has_suitable_bias = any(
            s.signal_type in (SignalType.NEUTRAL, SignalType.BULLISH)
            and s.strength >= 0.4
            for s in signals
        )
        has_high_iv = any(
            s.signal_type == SignalType.HIGH_IV
            and s.metadata.get("iv_rank", 0) >= self.iv_rank_threshold
            for s in signals
        )
        return has_suitable_bias and has_high_iv

    def should_exit(
        self,
        position: StrategyPosition,
        market_data: MarketData,
    ) -> tuple[bool, str]:
        pnl = position.total_pnl
        lot = _lot_size(position.symbol)
        premium = position.net_premium

        if premium > 0 and pnl >= premium * lot * self.profit_target_pct:
            return True, f"profit_target ({self.profit_target_pct:.0%})"

        if premium > 0 and pnl <= -(premium * lot * self.stop_loss_pct):
            return True, f"stop_loss ({self.stop_loss_pct:.0%})"

        # Short put tested
        spot = market_data.last_price
        short_put_legs = [
            l for l in position.legs
            if l.quantity < 0 and l.contract.option_type == OptionType.PUT
        ]
        for leg in short_put_legs:
            if spot <= leg.contract.strike * 1.005:
                return True, f"short_put_tested (strike={leg.contract.strike})"

        if position.expiry:
            dte = (position.expiry - date.today()).days
            if dte <= 1:
                return True, "expiry_approaching"

        return False, ""

    def adjust(
        self,
        position: StrategyPosition,
        market_data: MarketData,
    ) -> list[dict[str, Any]]:
        actions: list[dict[str, Any]] = []
        spot = market_data.last_price

        # If the put is being tested, roll it down or add a put spread hedge
        short_put_legs = [
            l for l in position.legs
            if l.quantity < 0 and l.contract.option_type == OptionType.PUT
        ]
        for leg in short_put_legs:
            distance_pct = (leg.contract.strike - spot) / spot
            if distance_pct > -0.01:
                actions.append({
                    "action": "roll",
                    "leg": "short_put",
                    "current_strike": leg.contract.strike,
                    "new_strike": leg.contract.strike - 100,
                    "reason": "put tested, rolling down for defence",
                })

        # If spot rallies hard into the call spread (shouldn't lose if
        # upside risk free, but might want to close for profit)
        short_call_legs = [
            l for l in position.legs
            if l.quantity < 0 and l.contract.option_type == OptionType.CALL
        ]
        for leg in short_call_legs:
            if spot >= leg.contract.strike:
                actions.append({
                    "action": "close_call_spread",
                    "reason": "spot above short call, close call spread to lock profit",
                })

        return actions

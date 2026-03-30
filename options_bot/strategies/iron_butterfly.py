"""Iron Butterfly strategy for Indian options markets."""

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


class IronButterfly(BaseStrategy):
    """Sell ATM CE + ATM PE, buy OTM wings for protection.

    Higher premium collected than an iron condor but a much tighter
    profit zone.  Best deployed when IV is elevated and the underlying
    is expected to pin near the ATM strike.
    """

    def __init__(
        self,
        wing_width: float = 200.0,
        profit_target_pct: float = 0.40,
        stop_loss_pct: float = 1.25,
        iv_rank_threshold: float = 45.0,
        dte_range: tuple[int, int] = (3, 14),
    ) -> None:
        self.wing_width = wing_width
        self.profit_target_pct = profit_target_pct
        self.stop_loss_pct = stop_loss_pct
        self.iv_rank_threshold = iv_rank_threshold
        self.dte_range = dte_range

    @property
    def name(self) -> str:
        return "Iron Butterfly"

    @property
    def strategy_type(self) -> StrategyType:
        return StrategyType.IRON_BUTTERFLY

    @property
    def description(self) -> str:
        return (
            "Sell ATM CE + ATM PE, buy OTM wings. Higher premium than a "
            "condor with a tighter profit zone."
        )

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

        atm = option_chain.atm_strike
        atm_call = option_chain.get_call(atm)
        atm_put = option_chain.get_put(atm)
        if atm_call is None or atm_put is None:
            return []

        long_call_strike = atm + self.wing_width
        long_put_strike = atm - self.wing_width
        long_call = option_chain.get_call(long_call_strike)
        long_put = option_chain.get_put(long_put_strike)
        if long_call is None or long_put is None:
            return []

        call_spread_credit = atm_call.last_price - long_call.last_price
        put_spread_credit = atm_put.last_price - long_put.last_price
        total_premium = call_spread_credit + put_spread_credit
        max_loss = self.wing_width - total_premium

        if total_premium <= 0 or max_loss <= 0:
            return []

        return [{
            "symbol": option_chain.symbol,
            "expiry": expiry,
            "dte": dte,
            "atm_strike": atm,
            "long_call_strike": long_call_strike,
            "long_put_strike": long_put_strike,
            "atm_call_premium": atm_call.last_price,
            "atm_put_premium": atm_put.last_price,
            "long_call_premium": long_call.last_price,
            "long_put_premium": long_put.last_price,
            "call_spread_credit": call_spread_credit,
            "put_spread_credit": put_spread_credit,
            "total_premium": total_premium,
            "max_loss": max_loss,
            "upper_breakeven": atm + total_premium,
            "lower_breakeven": atm - total_premium,
            "atm_call_iv": atm_call.iv,
            "atm_put_iv": atm_put.iv,
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
        atm = setup["atm_strike"]

        leg_specs: list[tuple[float, OptionType, int, str]] = [
            (atm, OptionType.CALL, -1, "atm_call_premium"),
            (atm, OptionType.PUT, -1, "atm_put_premium"),
            (setup["long_call_strike"], OptionType.CALL, 1, "long_call_premium"),
            (setup["long_put_strike"], OptionType.PUT, 1, "long_put_premium"),
        ]

        legs: list[Position] = []
        for strike, ot, qty_sign, price_key in leg_specs:
            quote = (
                option_chain.get_call(strike)
                if ot == OptionType.CALL
                else option_chain.get_put(strike)
            )
            greeks = quote.greeks if quote else Greeks()
            legs.append(
                Position(
                    contract=OptionContract(
                        symbol=symbol, strike=strike, option_type=ot,
                        expiry=expiry, lot_size=lot,
                    ),
                    quantity=qty_sign * lot,
                    entry_price=setup[price_key],
                    current_price=setup[price_key],
                    spot_price=setup["underlying"],
                    greeks=greeks,
                )
            )

        total_premium = setup["total_premium"]
        return StrategyPosition(
            strategy_type=StrategyType.IRON_BUTTERFLY,
            legs=legs,
            entry_time=datetime.now(),
            symbol=symbol,
            expiry=expiry,
            net_premium=total_premium,
            max_profit=total_premium * lot,
            max_loss=setup["max_loss"] * lot,
            upper_breakeven=setup["upper_breakeven"],
            lower_breakeven=setup["lower_breakeven"],
            status="active",
            tag=f"IBF-{symbol}-{expiry}",
        )

    def should_enter(
        self,
        signals: list[Signal],
        risk_check: dict[str, Any],
    ) -> bool:
        if not risk_check.get("approved", False):
            return False
        has_neutral = any(
            s.signal_type == SignalType.NEUTRAL and s.strength >= 0.6
            for s in signals
        )
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
        pnl = position.total_pnl
        lot = _lot_size(position.symbol)
        premium = position.net_premium

        if premium > 0 and pnl >= premium * lot * self.profit_target_pct:
            return True, f"profit_target ({self.profit_target_pct:.0%})"

        if premium > 0 and pnl <= -(premium * lot * self.stop_loss_pct):
            return True, f"stop_loss ({self.stop_loss_pct:.0%})"

        if position.expiry:
            dte = (position.expiry - date.today()).days
            if dte <= 1:
                return True, "expiry_approaching"

        # Spot beyond breakevens
        spot = market_data.last_price
        if spot > position.upper_breakeven or spot < position.lower_breakeven:
            return True, f"breakeven_breached (spot={spot})"

        return False, ""

    def adjust(
        self,
        position: StrategyPosition,
        market_data: MarketData,
    ) -> list[dict[str, Any]]:
        """If one wing is breached, roll the untested wing closer to collect
        more premium (convert to a broken-wing butterfly)."""
        actions: list[dict[str, Any]] = []
        spot = market_data.last_price

        if position.upper_breakeven and spot > position.upper_breakeven * 0.995:
            # Call side tested - roll put wing up
            actions.append({
                "action": "roll",
                "leg": "long_put_wing",
                "direction": "up",
                "reason": "call side tested, tightening put wing for extra credit",
            })
        elif position.lower_breakeven and spot < position.lower_breakeven * 1.005:
            # Put side tested - roll call wing down
            actions.append({
                "action": "roll",
                "leg": "long_call_wing",
                "direction": "down",
                "reason": "put side tested, tightening call wing for extra credit",
            })

        return actions

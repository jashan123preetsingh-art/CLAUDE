"""Short Straddle and Short Strangle strategies for Indian options."""

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


# ---------------------------------------------------------------------------
# Short Straddle
# ---------------------------------------------------------------------------

class ShortStraddle(BaseStrategy):
    """Sell ATM Call + ATM Put.

    Collects maximum premium when IV is high and expects the underlying to
    stay near the current price.
    """

    def __init__(
        self,
        profit_target_pct: float = 0.50,
        stop_loss_pct: float = 1.50,
        adjustment_sd: float = 1.0,
        iv_rank_threshold: float = 40.0,
        dte_range: tuple[int, int] = (3, 14),
        max_dte_hold: int = 1,
    ) -> None:
        self.profit_target_pct = profit_target_pct
        self.stop_loss_pct = stop_loss_pct
        self.adjustment_sd = adjustment_sd
        self.iv_rank_threshold = iv_rank_threshold
        self.dte_range = dte_range
        self.max_dte_hold = max_dte_hold

    @property
    def name(self) -> str:
        return "Short Straddle"

    @property
    def strategy_type(self) -> StrategyType:
        return StrategyType.SHORT_STRADDLE

    @property
    def description(self) -> str:
        return (
            "Sell ATM CE + ATM PE. Profits from time decay and IV crush in "
            "a range-bound market."
        )

    # -- helpers ---------------------------------------------------------

    @staticmethod
    def _implied_1sd_range(
        spot: float, iv: float, dte: int,
    ) -> tuple[float, float]:
        """Return (lower, upper) 1-SD range implied by IV and DTE."""
        annual_factor = (dte / 365) ** 0.5
        move = spot * iv * annual_factor
        return spot - move, spot + move

    # -- core ------------------------------------------------------------

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
        call = option_chain.get_call(atm)
        put = option_chain.get_put(atm)
        if call is None or put is None:
            return []

        total_premium = call.last_price + put.last_price
        avg_iv = (call.iv + put.iv) / 2
        lower_be, upper_be = self._implied_1sd_range(
            market_data.last_price, avg_iv, dte,
        )

        return [{
            "symbol": option_chain.symbol,
            "expiry": expiry,
            "dte": dte,
            "atm_strike": atm,
            "call_premium": call.last_price,
            "put_premium": put.last_price,
            "total_premium": total_premium,
            "avg_iv": avg_iv,
            "call_delta": call.greeks.delta,
            "put_delta": put.greeks.delta,
            "upper_breakeven": atm + total_premium,
            "lower_breakeven": atm - total_premium,
            "sd1_lower": lower_be,
            "sd1_upper": upper_be,
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

        legs: list[Position] = []
        for ot, price_key in [
            (OptionType.CALL, "call_premium"),
            (OptionType.PUT, "put_premium"),
        ]:
            quote = (
                option_chain.get_call(atm)
                if ot == OptionType.CALL
                else option_chain.get_put(atm)
            )
            greeks = quote.greeks if quote else Greeks()
            legs.append(
                Position(
                    contract=OptionContract(
                        symbol=symbol,
                        strike=atm,
                        option_type=ot,
                        expiry=expiry,
                        lot_size=lot,
                    ),
                    quantity=-lot,
                    entry_price=setup[price_key],
                    current_price=setup[price_key],
                    spot_price=setup["underlying"],
                    greeks=greeks,
                )
            )

        total = setup["total_premium"]
        return StrategyPosition(
            strategy_type=StrategyType.SHORT_STRADDLE,
            legs=legs,
            entry_time=datetime.now(),
            symbol=symbol,
            expiry=expiry,
            net_premium=total,
            max_profit=total * lot,
            max_loss=float("inf"),  # theoretically unlimited
            upper_breakeven=setup["upper_breakeven"],
            lower_breakeven=setup["lower_breakeven"],
            status="active",
            tag=f"SS-{symbol}-{expiry}",
        )

    def should_enter(
        self,
        signals: list[Signal],
        risk_check: dict[str, Any],
    ) -> bool:
        if not risk_check.get("approved", False):
            return False
        has_neutral = any(
            s.signal_type == SignalType.NEUTRAL and s.strength >= 0.5
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

        # Profit target: 50-65% of collected premium
        if premium > 0 and pnl >= premium * lot * self.profit_target_pct:
            return True, f"profit_target ({self.profit_target_pct:.0%})"

        # Stop loss
        if premium > 0 and pnl <= -(premium * lot * self.stop_loss_pct):
            return True, f"stop_loss ({self.stop_loss_pct:.0%} of premium)"

        # DTE guard
        if position.expiry:
            dte = (position.expiry - date.today()).days
            if dte <= self.max_dte_hold:
                return True, f"expiry_approaching (DTE<={self.max_dte_hold})"

        return False, ""

    def adjust(
        self,
        position: StrategyPosition,
        market_data: MarketData,
    ) -> list[dict[str, Any]]:
        actions: list[dict[str, Any]] = []
        spot = market_data.last_price

        if not position.legs:
            return actions

        atm = position.legs[0].contract.strike
        avg_iv = sum(l.greeks.iv for l in position.legs) / max(len(position.legs), 1)
        dte = (position.expiry - date.today()).days if position.expiry else 7
        lower_sd, upper_sd = self._implied_1sd_range(atm, avg_iv, dte)

        # If spot breaches 1 SD, hedge with a spread
        if spot <= lower_sd:
            actions.append({
                "action": "add_hedge",
                "side": "put",
                "reason": f"spot ({spot}) breached 1-SD lower ({lower_sd:.0f})",
                "hedge_type": "buy_put_spread",
            })
        elif spot >= upper_sd:
            actions.append({
                "action": "add_hedge",
                "side": "call",
                "reason": f"spot ({spot}) breached 1-SD upper ({upper_sd:.0f})",
                "hedge_type": "buy_call_spread",
            })

        return actions


# ---------------------------------------------------------------------------
# Short Strangle
# ---------------------------------------------------------------------------

class ShortStrangle(BaseStrategy):
    """Sell OTM Call + OTM Put at target delta.

    Wider breakevens than a straddle but lower premium collected.
    """

    def __init__(
        self,
        delta_target: float = 0.20,
        profit_target_pct: float = 0.50,
        stop_loss_pct: float = 1.50,
        adjustment_sd: float = 1.0,
        iv_rank_threshold: float = 35.0,
        dte_range: tuple[int, int] = (3, 21),
        max_dte_hold: int = 1,
    ) -> None:
        self.delta_target = delta_target
        self.profit_target_pct = profit_target_pct
        self.stop_loss_pct = stop_loss_pct
        self.adjustment_sd = adjustment_sd
        self.iv_rank_threshold = iv_rank_threshold
        self.dte_range = dte_range
        self.max_dte_hold = max_dte_hold

    @property
    def name(self) -> str:
        return "Short Strangle"

    @property
    def strategy_type(self) -> StrategyType:
        return StrategyType.SHORT_STRANGLE

    @property
    def description(self) -> str:
        return (
            "Sell OTM CE + OTM PE at target delta. Wider breakevens, "
            "profits from time decay and IV contraction."
        )

    @staticmethod
    def _implied_1sd_range(
        spot: float, iv: float, dte: int,
    ) -> tuple[float, float]:
        annual_factor = (dte / 365) ** 0.5
        move = spot * iv * annual_factor
        return spot - move, spot + move

    @staticmethod
    def _find_by_delta(
        quotes: list[OptionQuote], target: float,
    ) -> OptionQuote | None:
        if not quotes:
            return None
        return min(quotes, key=lambda q: abs(abs(q.greeks.delta) - target))

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

        short_call = self._find_by_delta(option_chain.calls, self.delta_target)
        short_put = self._find_by_delta(option_chain.puts, self.delta_target)
        if short_call is None or short_put is None:
            return []

        total_premium = short_call.last_price + short_put.last_price
        avg_iv = (short_call.iv + short_put.iv) / 2

        return [{
            "symbol": option_chain.symbol,
            "expiry": expiry,
            "dte": dte,
            "call_strike": short_call.strike,
            "put_strike": short_put.strike,
            "call_premium": short_call.last_price,
            "put_premium": short_put.last_price,
            "total_premium": total_premium,
            "avg_iv": avg_iv,
            "call_delta": short_call.greeks.delta,
            "put_delta": short_put.greeks.delta,
            "upper_breakeven": short_call.strike + total_premium,
            "lower_breakeven": short_put.strike - total_premium,
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

        legs: list[Position] = []
        for ot, strike_key, price_key in [
            (OptionType.CALL, "call_strike", "call_premium"),
            (OptionType.PUT, "put_strike", "put_premium"),
        ]:
            quote = (
                option_chain.get_call(setup[strike_key])
                if ot == OptionType.CALL
                else option_chain.get_put(setup[strike_key])
            )
            greeks = quote.greeks if quote else Greeks()
            legs.append(
                Position(
                    contract=OptionContract(
                        symbol=symbol,
                        strike=setup[strike_key],
                        option_type=ot,
                        expiry=expiry,
                        lot_size=lot,
                    ),
                    quantity=-lot,
                    entry_price=setup[price_key],
                    current_price=setup[price_key],
                    spot_price=setup["underlying"],
                    greeks=greeks,
                )
            )

        total = setup["total_premium"]
        return StrategyPosition(
            strategy_type=StrategyType.SHORT_STRANGLE,
            legs=legs,
            entry_time=datetime.now(),
            symbol=symbol,
            expiry=expiry,
            net_premium=total,
            max_profit=total * lot,
            max_loss=float("inf"),
            upper_breakeven=setup["upper_breakeven"],
            lower_breakeven=setup["lower_breakeven"],
            status="active",
            tag=f"SG-{symbol}-{expiry}",
        )

    def should_enter(
        self,
        signals: list[Signal],
        risk_check: dict[str, Any],
    ) -> bool:
        if not risk_check.get("approved", False):
            return False
        has_neutral = any(
            s.signal_type == SignalType.NEUTRAL and s.strength >= 0.5
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
            return True, f"stop_loss ({self.stop_loss_pct:.0%} of premium)"

        if position.expiry:
            dte = (position.expiry - date.today()).days
            if dte <= self.max_dte_hold:
                return True, f"expiry_approaching (DTE<={self.max_dte_hold})"

        # Check if one side is being tested
        spot = market_data.last_price
        for leg in position.legs:
            if leg.quantity < 0:
                distance_pct = abs(spot - leg.contract.strike) / leg.contract.strike
                if distance_pct < 0.005:
                    return True, f"strike_tested ({leg.contract.strike})"

        return False, ""

    def adjust(
        self,
        position: StrategyPosition,
        market_data: MarketData,
    ) -> list[dict[str, Any]]:
        actions: list[dict[str, Any]] = []
        spot = market_data.last_price

        for leg in position.legs:
            if leg.quantity >= 0:
                continue

            strike = leg.contract.strike
            ot = leg.contract.option_type
            dte = (position.expiry - date.today()).days if position.expiry else 7
            avg_iv = leg.greeks.iv if leg.greeks.iv > 0 else 0.15
            lower_sd, upper_sd = self._implied_1sd_range(strike, avg_iv, dte)

            if ot == OptionType.PUT and spot <= strike * 1.005:
                actions.append({
                    "action": "roll",
                    "leg": "short_put",
                    "current_strike": strike,
                    "new_strike": strike - 100,
                    "reason": "put tested, rolling down",
                })
            elif ot == OptionType.CALL and spot >= strike * 0.995:
                actions.append({
                    "action": "roll",
                    "leg": "short_call",
                    "current_strike": strike,
                    "new_strike": strike + 100,
                    "reason": "call tested, rolling up",
                })

        return actions

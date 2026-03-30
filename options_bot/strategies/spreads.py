"""Spread strategies for Indian options markets.

Contains: BullCallSpread, BearPutSpread, CalendarSpread, RatioSpread.
"""

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


# ---------------------------------------------------------------------------
# Bull Call Spread
# ---------------------------------------------------------------------------

class BullCallSpread(BaseStrategy):
    """Buy lower-strike CE, sell higher-strike CE.

    Debit strategy with defined risk, bullish bias.
    """

    def __init__(
        self,
        spread_width: float = 100.0,
        delta_long: float = 0.55,
        profit_target_pct: float = 0.60,
        stop_loss_pct: float = 0.50,
        dte_range: tuple[int, int] = (5, 30),
    ) -> None:
        self.spread_width = spread_width
        self.delta_long = delta_long
        self.profit_target_pct = profit_target_pct
        self.stop_loss_pct = stop_loss_pct
        self.dte_range = dte_range

    @property
    def name(self) -> str:
        return "Bull Call Spread"

    @property
    def strategy_type(self) -> StrategyType:
        return StrategyType.BULL_CALL_SPREAD

    @property
    def description(self) -> str:
        return "Buy lower-strike CE, sell higher-strike CE. Defined-risk bullish trade."

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

        # Find long strike by delta
        long_call = None
        if option_chain.calls:
            long_call = min(
                option_chain.calls,
                key=lambda q: abs(abs(q.greeks.delta) - self.delta_long),
            )
        if long_call is None:
            return []

        short_strike = long_call.strike + self.spread_width
        short_call = option_chain.get_call(short_strike)
        if short_call is None:
            return []

        net_debit = long_call.last_price - short_call.last_price
        max_profit = self.spread_width - net_debit
        if net_debit <= 0 or max_profit <= 0:
            return []

        return [{
            "symbol": option_chain.symbol,
            "expiry": expiry,
            "dte": dte,
            "long_strike": long_call.strike,
            "short_strike": short_strike,
            "long_premium": long_call.last_price,
            "short_premium": short_call.last_price,
            "net_debit": net_debit,
            "max_profit": max_profit,
            "max_loss": net_debit,
            "breakeven": long_call.strike + net_debit,
            "long_delta": long_call.greeks.delta,
            "short_delta": short_call.greeks.delta,
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
        for strike_key, price_key, qty_sign in [
            ("long_strike", "long_premium", 1),
            ("short_strike", "short_premium", -1),
        ]:
            quote = option_chain.get_call(setup[strike_key])
            greeks = quote.greeks if quote else Greeks()
            legs.append(
                Position(
                    contract=OptionContract(
                        symbol=symbol,
                        strike=setup[strike_key],
                        option_type=OptionType.CALL,
                        expiry=expiry,
                        lot_size=lot,
                    ),
                    quantity=qty_sign * lot,
                    entry_price=setup[price_key],
                    current_price=setup[price_key],
                    spot_price=setup["underlying"],
                    greeks=greeks,
                )
            )

        return StrategyPosition(
            strategy_type=StrategyType.BULL_CALL_SPREAD,
            legs=legs,
            entry_time=datetime.now(),
            symbol=symbol,
            expiry=expiry,
            net_premium=-setup["net_debit"],  # negative = debit
            max_profit=setup["max_profit"] * lot,
            max_loss=setup["net_debit"] * lot,
            upper_breakeven=setup["breakeven"],
            lower_breakeven=0.0,
            status="active",
            tag=f"BCS-{symbol}-{expiry}",
        )

    def should_enter(
        self,
        signals: list[Signal],
        risk_check: dict[str, Any],
    ) -> bool:
        if not risk_check.get("approved", False):
            return False
        return any(
            s.signal_type == SignalType.BULLISH and s.strength >= 0.6
            for s in signals
        )

    def should_exit(
        self,
        position: StrategyPosition,
        market_data: MarketData,
    ) -> tuple[bool, str]:
        pnl = position.total_pnl
        max_profit = position.max_profit
        max_loss = position.max_loss

        if max_profit > 0 and pnl >= max_profit * self.profit_target_pct:
            return True, f"profit_target ({self.profit_target_pct:.0%})"
        if max_loss > 0 and pnl <= -max_loss * self.stop_loss_pct:
            return True, f"stop_loss ({self.stop_loss_pct:.0%})"
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
        # Vertical spreads: limited adjustment, mostly close or hold
        return []


# ---------------------------------------------------------------------------
# Bear Put Spread
# ---------------------------------------------------------------------------

class BearPutSpread(BaseStrategy):
    """Buy higher-strike PE, sell lower-strike PE.

    Debit strategy with defined risk, bearish bias.
    """

    def __init__(
        self,
        spread_width: float = 100.0,
        delta_long: float = 0.55,
        profit_target_pct: float = 0.60,
        stop_loss_pct: float = 0.50,
        dte_range: tuple[int, int] = (5, 30),
    ) -> None:
        self.spread_width = spread_width
        self.delta_long = delta_long
        self.profit_target_pct = profit_target_pct
        self.stop_loss_pct = stop_loss_pct
        self.dte_range = dte_range

    @property
    def name(self) -> str:
        return "Bear Put Spread"

    @property
    def strategy_type(self) -> StrategyType:
        return StrategyType.BEAR_PUT_SPREAD

    @property
    def description(self) -> str:
        return "Buy higher-strike PE, sell lower-strike PE. Defined-risk bearish trade."

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

        long_put = None
        if option_chain.puts:
            long_put = min(
                option_chain.puts,
                key=lambda q: abs(abs(q.greeks.delta) - self.delta_long),
            )
        if long_put is None:
            return []

        short_strike = long_put.strike - self.spread_width
        short_put = option_chain.get_put(short_strike)
        if short_put is None:
            return []

        net_debit = long_put.last_price - short_put.last_price
        max_profit = self.spread_width - net_debit
        if net_debit <= 0 or max_profit <= 0:
            return []

        return [{
            "symbol": option_chain.symbol,
            "expiry": expiry,
            "dte": dte,
            "long_strike": long_put.strike,
            "short_strike": short_strike,
            "long_premium": long_put.last_price,
            "short_premium": short_put.last_price,
            "net_debit": net_debit,
            "max_profit": max_profit,
            "max_loss": net_debit,
            "breakeven": long_put.strike - net_debit,
            "long_delta": long_put.greeks.delta,
            "short_delta": short_put.greeks.delta,
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
        for strike_key, price_key, qty_sign in [
            ("long_strike", "long_premium", 1),
            ("short_strike", "short_premium", -1),
        ]:
            quote = option_chain.get_put(setup[strike_key])
            greeks = quote.greeks if quote else Greeks()
            legs.append(
                Position(
                    contract=OptionContract(
                        symbol=symbol,
                        strike=setup[strike_key],
                        option_type=OptionType.PUT,
                        expiry=expiry,
                        lot_size=lot,
                    ),
                    quantity=qty_sign * lot,
                    entry_price=setup[price_key],
                    current_price=setup[price_key],
                    spot_price=setup["underlying"],
                    greeks=greeks,
                )
            )

        return StrategyPosition(
            strategy_type=StrategyType.BEAR_PUT_SPREAD,
            legs=legs,
            entry_time=datetime.now(),
            symbol=symbol,
            expiry=expiry,
            net_premium=-setup["net_debit"],
            max_profit=setup["max_profit"] * lot,
            max_loss=setup["net_debit"] * lot,
            upper_breakeven=0.0,
            lower_breakeven=setup["breakeven"],
            status="active",
            tag=f"BPS-{symbol}-{expiry}",
        )

    def should_enter(
        self,
        signals: list[Signal],
        risk_check: dict[str, Any],
    ) -> bool:
        if not risk_check.get("approved", False):
            return False
        return any(
            s.signal_type == SignalType.BEARISH and s.strength >= 0.6
            for s in signals
        )

    def should_exit(
        self,
        position: StrategyPosition,
        market_data: MarketData,
    ) -> tuple[bool, str]:
        pnl = position.total_pnl
        max_profit = position.max_profit
        max_loss = position.max_loss

        if max_profit > 0 and pnl >= max_profit * self.profit_target_pct:
            return True, f"profit_target ({self.profit_target_pct:.0%})"
        if max_loss > 0 and pnl <= -max_loss * self.stop_loss_pct:
            return True, f"stop_loss ({self.stop_loss_pct:.0%})"
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
        return []


# ---------------------------------------------------------------------------
# Calendar Spread
# ---------------------------------------------------------------------------

class CalendarSpread(BaseStrategy):
    """Sell near-expiry option, buy far-expiry option at the same strike.

    Profits from accelerated time decay of the near-month option and/or
    an increase in IV of the far-month.
    """

    def __init__(
        self,
        option_type: OptionType = OptionType.CALL,
        profit_target_pct: float = 0.30,
        stop_loss_pct: float = 0.50,
        near_dte_range: tuple[int, int] = (3, 14),
    ) -> None:
        self.option_type = option_type
        self.profit_target_pct = profit_target_pct
        self.stop_loss_pct = stop_loss_pct
        self.near_dte_range = near_dte_range

    @property
    def name(self) -> str:
        return "Calendar Spread"

    @property
    def strategy_type(self) -> StrategyType:
        return StrategyType.CALENDAR_SPREAD

    @property
    def description(self) -> str:
        return (
            "Sell near-expiry, buy far-expiry at same strike. Profits from "
            "differential time decay."
        )

    def scan(
        self,
        option_chain: OptionChain,
        market_data: MarketData,
        signals: list[Signal],
    ) -> list[dict[str, Any]]:
        """Scan requires two option chains (near and far).

        The caller should provide a near-expiry chain via *option_chain* and
        encode the far-expiry data in ``signals`` metadata or pass a combined
        chain.  This implementation outlines the structure; real usage needs
        the far-expiry chain injected via ``setup`` metadata.
        """
        expiry = option_chain.expiry
        dte = (expiry - date.today()).days
        if not (self.near_dte_range[0] <= dte <= self.near_dte_range[1]):
            return []

        atm = option_chain.atm_strike
        near_quote = (
            option_chain.get_call(atm)
            if self.option_type == OptionType.CALL
            else option_chain.get_put(atm)
        )
        if near_quote is None:
            return []

        return [{
            "symbol": option_chain.symbol,
            "near_expiry": expiry,
            "dte_near": dte,
            "strike": atm,
            "near_premium": near_quote.last_price,
            "near_iv": near_quote.iv,
            "near_delta": near_quote.greeks.delta,
            "option_type": self.option_type.value,
            "underlying": market_data.last_price,
            # Far-expiry fields to be filled by the caller
            "far_expiry": None,
            "far_premium": None,
        }]

    def construct(
        self,
        option_chain: OptionChain,
        setup: dict[str, Any],
    ) -> StrategyPosition:
        symbol = setup["symbol"]
        lot = _lot_size(symbol)
        strike = setup["strike"]
        ot = OptionType(setup["option_type"]) if isinstance(setup["option_type"], str) else setup["option_type"]
        near_expiry = setup["near_expiry"]
        far_expiry = setup.get("far_expiry", near_expiry)
        near_premium = setup["near_premium"]
        far_premium = setup.get("far_premium", near_premium * 1.5)

        legs = [
            Position(
                contract=OptionContract(
                    symbol=symbol, strike=strike, option_type=ot,
                    expiry=near_expiry, lot_size=lot,
                ),
                quantity=-lot,
                entry_price=near_premium,
                current_price=near_premium,
                spot_price=setup["underlying"],
            ),
            Position(
                contract=OptionContract(
                    symbol=symbol, strike=strike, option_type=ot,
                    expiry=far_expiry, lot_size=lot,
                ),
                quantity=lot,
                entry_price=far_premium,
                current_price=far_premium,
                spot_price=setup["underlying"],
            ),
        ]

        net_debit = far_premium - near_premium
        return StrategyPosition(
            strategy_type=StrategyType.CALENDAR_SPREAD,
            legs=legs,
            entry_time=datetime.now(),
            symbol=symbol,
            expiry=near_expiry,
            net_premium=-net_debit,
            max_profit=0.0,  # depends on IV; not easily pre-computed
            max_loss=net_debit * lot,
            upper_breakeven=0.0,
            lower_breakeven=0.0,
            status="active",
            tag=f"CAL-{symbol}-{near_expiry}",
        )

    def should_enter(
        self,
        signals: list[Signal],
        risk_check: dict[str, Any],
    ) -> bool:
        if not risk_check.get("approved", False):
            return False
        return any(
            s.signal_type == SignalType.NEUTRAL and s.strength >= 0.4
            for s in signals
        )

    def should_exit(
        self,
        position: StrategyPosition,
        market_data: MarketData,
    ) -> tuple[bool, str]:
        pnl = position.total_pnl
        max_loss = position.max_loss

        if max_loss > 0 and pnl >= max_loss * self.profit_target_pct:
            return True, "profit_target"
        if max_loss > 0 and pnl <= -max_loss * self.stop_loss_pct:
            return True, "stop_loss"

        # Close near-month leg before expiry
        if position.expiry:
            dte = (position.expiry - date.today()).days
            if dte <= 1:
                return True, "near_expiry_approaching"
        return False, ""

    def adjust(
        self,
        position: StrategyPosition,
        market_data: MarketData,
    ) -> list[dict[str, Any]]:
        # Could roll the near leg to the next weekly, but keep it simple
        return []


# ---------------------------------------------------------------------------
# Ratio Spread
# ---------------------------------------------------------------------------

class RatioSpread(BaseStrategy):
    """Buy 1 option, sell N options at a different strike (typically 1:2).

    Can be established for a small debit or even a credit. The extra short
    leg introduces unlimited risk on one side.
    """

    def __init__(
        self,
        option_type: OptionType = OptionType.CALL,
        ratio: int = 2,
        spread_width: float = 100.0,
        profit_target_pct: float = 0.50,
        stop_loss_pct: float = 1.00,
        dte_range: tuple[int, int] = (5, 21),
    ) -> None:
        self.option_type = option_type
        self.ratio = ratio  # sell this many per 1 bought
        self.spread_width = spread_width
        self.profit_target_pct = profit_target_pct
        self.stop_loss_pct = stop_loss_pct
        self.dte_range = dte_range

    @property
    def name(self) -> str:
        return "Ratio Spread"

    @property
    def strategy_type(self) -> StrategyType:
        return StrategyType.RATIO_SPREAD

    @property
    def description(self) -> str:
        return (
            f"Buy 1, sell {self.ratio} at a further strike. Partially funded "
            "directional trade with risk on the far side."
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
        if self.option_type == OptionType.CALL:
            long_quote = option_chain.get_call(atm)
            short_strike = atm + self.spread_width
            short_quote = option_chain.get_call(short_strike)
        else:
            long_quote = option_chain.get_put(atm)
            short_strike = atm - self.spread_width
            short_quote = option_chain.get_put(short_strike)

        if long_quote is None or short_quote is None:
            return []

        net_debit = long_quote.last_price - self.ratio * short_quote.last_price

        return [{
            "symbol": option_chain.symbol,
            "expiry": expiry,
            "dte": dte,
            "long_strike": atm,
            "short_strike": short_strike,
            "long_premium": long_quote.last_price,
            "short_premium": short_quote.last_price,
            "ratio": self.ratio,
            "net_debit": net_debit,  # negative means credit
            "option_type": self.option_type.value,
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
        ot = OptionType(setup["option_type"]) if isinstance(setup["option_type"], str) else setup["option_type"]

        getter = option_chain.get_call if ot == OptionType.CALL else option_chain.get_put

        long_q = getter(setup["long_strike"])
        short_q = getter(setup["short_strike"])

        legs = [
            Position(
                contract=OptionContract(
                    symbol=symbol, strike=setup["long_strike"],
                    option_type=ot, expiry=expiry, lot_size=lot,
                ),
                quantity=lot,
                entry_price=setup["long_premium"],
                current_price=setup["long_premium"],
                spot_price=setup["underlying"],
                greeks=long_q.greeks if long_q else Greeks(),
            ),
            Position(
                contract=OptionContract(
                    symbol=symbol, strike=setup["short_strike"],
                    option_type=ot, expiry=expiry, lot_size=lot,
                ),
                quantity=-self.ratio * lot,
                entry_price=setup["short_premium"],
                current_price=setup["short_premium"],
                spot_price=setup["underlying"],
                greeks=short_q.greeks if short_q else Greeks(),
            ),
        ]

        net_debit = setup["net_debit"]
        return StrategyPosition(
            strategy_type=StrategyType.RATIO_SPREAD,
            legs=legs,
            entry_time=datetime.now(),
            symbol=symbol,
            expiry=expiry,
            net_premium=-net_debit,
            max_profit=self.spread_width * lot + min(0, -net_debit * lot),
            max_loss=float("inf"),  # unlimited on the extra short leg side
            status="active",
            tag=f"RAT-{symbol}-{expiry}",
        )

    def should_enter(
        self,
        signals: list[Signal],
        risk_check: dict[str, Any],
    ) -> bool:
        if not risk_check.get("approved", False):
            return False
        # Ratio call spread: mildly bullish; ratio put spread: mildly bearish
        if self.option_type == OptionType.CALL:
            return any(
                s.signal_type == SignalType.BULLISH and 0.3 <= s.strength <= 0.7
                for s in signals
            )
        return any(
            s.signal_type == SignalType.BEARISH and 0.3 <= s.strength <= 0.7
            for s in signals
        )

    def should_exit(
        self,
        position: StrategyPosition,
        market_data: MarketData,
    ) -> tuple[bool, str]:
        pnl = position.total_pnl
        max_profit = position.max_profit

        if max_profit > 0 and pnl >= max_profit * self.profit_target_pct:
            return True, "profit_target"

        # For naked ratio risk, use absolute stop
        lot = _lot_size(position.symbol)
        premium_at_risk = abs(position.net_premium) * lot if position.net_premium != 0 else max_profit
        if premium_at_risk > 0 and pnl <= -premium_at_risk * self.stop_loss_pct:
            return True, "stop_loss"

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
        """If spot moves toward the extra short strikes, buy protection."""
        actions: list[dict[str, Any]] = []
        spot = market_data.last_price

        for leg in position.legs:
            if leg.quantity >= 0:
                continue
            distance_pct = abs(spot - leg.contract.strike) / leg.contract.strike
            if distance_pct < 0.01:
                actions.append({
                    "action": "buy_protection",
                    "strike": leg.contract.strike,
                    "option_type": leg.contract.option_type.value,
                    "reason": f"spot approaching naked short at {leg.contract.strike}",
                })
        return actions

"""SPAN-like margin calculation for Indian options markets.

Provides approximate margin estimates for NIFTY, BANKNIFTY, FINNIFTY
and other NSE index-option products.  The calculations follow the
broad structure of NSE SPAN margining but are *approximations* -- for
exact figures use the broker's margin API or NSE SPAN calculator.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

from options_bot.core.models import (
    OptionContract,
    OptionType,
    OrderSide,
    Position,
)

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# NSE margin rate parameters (approximate, updated periodically)
# ------------------------------------------------------------------

@dataclass(frozen=True)
class MarginRates:
    """Margin rates for a single underlying."""
    symbol: str
    span_pct: float        # SPAN margin as % of contract value
    exposure_pct: float    # Exposure margin as % of contract value
    lot_size: int
    tick_size: float = 0.05
    # Price scan range (% of underlying) used in SPAN-like scan
    price_scan_range_pct: float = 0.0


NSE_MARGIN_RATES: dict[str, MarginRates] = {
    "NIFTY": MarginRates(
        symbol="NIFTY",
        span_pct=0.09,       # ~9%
        exposure_pct=0.03,   # ~3%
        lot_size=25,
        price_scan_range_pct=0.06,
    ),
    "BANKNIFTY": MarginRates(
        symbol="BANKNIFTY",
        span_pct=0.10,
        exposure_pct=0.05,
        lot_size=15,
        price_scan_range_pct=0.07,
    ),
    "FINNIFTY": MarginRates(
        symbol="FINNIFTY",
        span_pct=0.09,
        exposure_pct=0.04,
        lot_size=25,
        price_scan_range_pct=0.06,
    ),
    "MIDCPNIFTY": MarginRates(
        symbol="MIDCPNIFTY",
        span_pct=0.11,
        exposure_pct=0.05,
        lot_size=50,
        price_scan_range_pct=0.08,
    ),
    "SENSEX": MarginRates(
        symbol="SENSEX",
        span_pct=0.09,
        exposure_pct=0.03,
        lot_size=10,
        price_scan_range_pct=0.06,
    ),
    "BANKEX": MarginRates(
        symbol="BANKEX",
        span_pct=0.10,
        exposure_pct=0.05,
        lot_size=15,
        price_scan_range_pct=0.07,
    ),
}


class MarginCalculator:
    """Approximate SPAN + Exposure margin calculator for NSE F&O.

    This is intentionally conservative -- real SPAN margining considers
    16 risk scenarios and cross-margin offsets that are hard to replicate
    without the full SPAN engine.
    """

    def __init__(
        self,
        margin_rates: Optional[dict[str, MarginRates]] = None,
    ) -> None:
        self.rates = margin_rates or dict(NSE_MARGIN_RATES)

    def _get_rates(self, symbol: str) -> MarginRates:
        """Look up margin rates, falling back to NIFTY defaults."""
        rates = self.rates.get(symbol)
        if rates is None:
            logger.warning(
                "No margin rates for %s; using NIFTY defaults", symbol,
            )
            rates = self.rates["NIFTY"]
        return rates

    # ------------------------------------------------------------------
    # Core margin methods
    # ------------------------------------------------------------------

    def span_margin(self, position: Position) -> float:
        """Approximate SPAN margin for a single position.

        For **option sellers** the margin is roughly:
            SPAN% * underlying_value * lot_size * abs(quantity)
        minus the out-of-the-money amount (floored at a minimum).

        For **option buyers** the margin is simply the premium paid
        (no span margin required beyond that).

        Parameters
        ----------
        position : Position
            Must have ``spot_price``, ``entry_price``, ``contract`` populated.

        Returns
        -------
        float
            Approximate SPAN margin in INR.
        """
        contract = position.contract
        rates = self._get_rates(contract.symbol)
        lot_size = contract.lot_size or rates.lot_size
        abs_qty = abs(position.quantity)
        spot = position.spot_price if position.spot_price > 0 else 1.0

        # Buyers: margin = premium paid
        if position.quantity > 0:
            return position.entry_price * lot_size * abs_qty

        # Sellers: SPAN-like calculation
        contract_value = spot * lot_size * abs_qty

        # OTM amount
        if contract.option_type == OptionType.CALL:
            otm = max(contract.strike - spot, 0.0) * lot_size * abs_qty
        else:
            otm = max(spot - contract.strike, 0.0) * lot_size * abs_qty

        span = contract_value * rates.span_pct - otm
        # Floor: at least premium received + a fraction of contract value
        premium_received = position.entry_price * lot_size * abs_qty
        minimum = premium_received + contract_value * 0.03
        span = max(span, minimum)

        return round(span, 2)

    def exposure_margin(self, position: Position) -> float:
        """Approximate exposure margin for a single position.

        For buyers this is 0 (premium already paid).
        For sellers it is Exposure% * contract_value.
        """
        if position.quantity > 0:
            return 0.0

        contract = position.contract
        rates = self._get_rates(contract.symbol)
        lot_size = contract.lot_size or rates.lot_size
        abs_qty = abs(position.quantity)
        spot = position.spot_price if position.spot_price > 0 else 1.0

        contract_value = spot * lot_size * abs_qty
        return round(contract_value * rates.exposure_pct, 2)

    def total_margin(self, position: Position) -> float:
        """Total margin = SPAN + Exposure."""
        return self.span_margin(position) + self.exposure_margin(position)

    # ------------------------------------------------------------------
    # Portfolio-level margin
    # ------------------------------------------------------------------

    def portfolio_margin(self, positions: list[Position]) -> float:
        """Total margin for a portfolio of positions.

        Applies a simple cross-margin benefit: if the portfolio contains
        both long and short positions on the *same* underlying + expiry,
        the hedged portion receives a margin offset.

        Parameters
        ----------
        positions : list[Position]

        Returns
        -------
        float
            Net margin required in INR.
        """
        if not positions:
            return 0.0

        # First compute raw sum
        raw_total = sum(self.total_margin(p) for p in positions)

        # Group by (symbol, expiry) to find hedged combos
        groups: dict[tuple, list[Position]] = {}
        for pos in positions:
            key = (pos.contract.symbol, pos.contract.expiry)
            groups.setdefault(key, []).append(pos)

        offset = 0.0
        for key, group in groups.items():
            longs = [p for p in group if p.quantity > 0]
            shorts = [p for p in group if p.quantity < 0]
            if longs and shorts:
                # Simple spread margin offset: ~30% reduction on the
                # smaller side of the spread
                long_margin = sum(self.total_margin(p) for p in longs)
                short_margin = sum(self.total_margin(p) for p in shorts)
                smaller = min(long_margin, short_margin)
                offset += smaller * 0.30

        net_margin = raw_total - offset
        logger.debug(
            "Portfolio margin: raw=%.0f offset=%.0f net=%.0f",
            raw_total, offset, net_margin,
        )
        return round(max(net_margin, 0.0), 2)

    # ------------------------------------------------------------------
    # Utilization
    # ------------------------------------------------------------------

    @staticmethod
    def margin_utilization(total_margin: float, available_capital: float) -> float:
        """Margin utilisation ratio.

        Returns a value in [0, inf).  Values > 1.0 mean the capital is
        insufficient.
        """
        if available_capital <= 0:
            return float("inf")
        return round(total_margin / available_capital, 4)

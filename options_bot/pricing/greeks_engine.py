"""Greeks management engine for position-level and portfolio-level analysis.

Aggregates Greeks across multiple positions, computes dollar-weighted
exposures, and decomposes P&L by Greek contribution.
"""

from __future__ import annotations

from datetime import date
from typing import Sequence

import numpy as np

from options_bot.core.models import Greeks, OptionType, Position
from options_bot.pricing.black_scholes import BlackScholes


class GreeksEngine:
    """Calculate and manage Greeks at position and portfolio level."""

    def __init__(self, risk_free_rate: float = 0.07) -> None:
        self._bs = BlackScholes()
        self.r = risk_free_rate

    # ------------------------------------------------------------------
    # Single position Greeks
    # ------------------------------------------------------------------

    def position_greeks(self, position: Position) -> Greeks:
        """Compute Greeks for a single option position.

        Uses the contract details + current spot price and the stored IV.
        The result is scaled by quantity and lot size.
        """
        contract = position.contract
        spot = position.spot_price
        strike = contract.strike
        T = self._time_to_expiry(contract.expiry)
        sigma = position.greeks.iv if position.greeks.iv > 0 else 0.20
        option_type = contract.option_type
        qty = position.quantity
        lot = contract.lot_size

        raw = self._bs.all_greeks(spot, strike, T, self.r, sigma, option_type)

        return Greeks(
            delta=raw.delta * qty * lot,
            gamma=raw.gamma * qty * lot,
            theta=raw.theta * qty * lot,
            vega=raw.vega * qty * lot,
            rho=raw.rho * qty * lot,
            iv=sigma,
        )

    # ------------------------------------------------------------------
    # Portfolio-level Greeks (sum across positions)
    # ------------------------------------------------------------------

    def portfolio_greeks(self, positions: Sequence[Position]) -> Greeks:
        """Aggregate Greeks across all positions in a portfolio."""
        total_delta = 0.0
        total_gamma = 0.0
        total_theta = 0.0
        total_vega = 0.0
        total_rho = 0.0

        for pos in positions:
            g = self.position_greeks(pos)
            total_delta += g.delta
            total_gamma += g.gamma
            total_theta += g.theta
            total_vega += g.vega
            total_rho += g.rho

        return Greeks(
            delta=total_delta,
            gamma=total_gamma,
            theta=total_theta,
            vega=total_vega,
            rho=total_rho,
            iv=0.0,
        )

    # ------------------------------------------------------------------
    # Detailed exposure
    # ------------------------------------------------------------------

    def greeks_exposure(self, positions: Sequence[Position]) -> dict:
        """Return detailed Greeks exposure breakdown.

        Returns
        -------
        dict with keys:
            net       -- aggregated Greeks
            by_expiry -- dict[date, Greeks]
            by_type   -- dict[str, Greeks]  ('CE' / 'PE')
            long      -- Greeks from long positions
            short     -- Greeks from short positions
        """
        by_expiry: dict[date, list[float]] = {}
        by_type: dict[str, list[float]] = {"CE": [], "PE": []}
        long_greeks: list[Greeks] = []
        short_greeks: list[Greeks] = []

        expiry_greeks: dict[date, Greeks] = {}
        type_agg: dict[str, list[Greeks]] = {"CE": [], "PE": []}

        for pos in positions:
            g = self.position_greeks(pos)
            exp = pos.contract.expiry
            ot = pos.contract.option_type.value

            # By expiry
            if exp not in expiry_greeks:
                expiry_greeks[exp] = Greeks()
            prev = expiry_greeks[exp]
            expiry_greeks[exp] = Greeks(
                delta=prev.delta + g.delta,
                gamma=prev.gamma + g.gamma,
                theta=prev.theta + g.theta,
                vega=prev.vega + g.vega,
                rho=prev.rho + g.rho,
            )

            # By type
            type_agg[ot].append(g)

            # Long / short
            if pos.quantity > 0:
                long_greeks.append(g)
            else:
                short_greeks.append(g)

        def _sum(gs: list[Greeks]) -> Greeks:
            return Greeks(
                delta=sum(g.delta for g in gs),
                gamma=sum(g.gamma for g in gs),
                theta=sum(g.theta for g in gs),
                vega=sum(g.vega for g in gs),
                rho=sum(g.rho for g in gs),
            )

        return {
            "net": self.portfolio_greeks(positions),
            "by_expiry": expiry_greeks,
            "by_type": {k: _sum(v) for k, v in type_agg.items()},
            "long": _sum(long_greeks),
            "short": _sum(short_greeks),
        }

    # ------------------------------------------------------------------
    # Dollar Greeks
    # ------------------------------------------------------------------

    def delta_dollars(self, position: Position, spot: float) -> float:
        """Dollar delta: delta * spot * quantity * lot_size.

        Represents the equivalent underlying exposure in currency terms.
        """
        g = self.position_greeks(position)
        # g.delta is already scaled by qty*lot
        return g.delta * spot

    def gamma_dollars(self, position: Position, spot: float) -> float:
        """Dollar gamma: 0.5 * gamma * spot^2 * 0.01.

        Approximate P&L from a 1% spot move due to gamma.
        """
        g = self.position_greeks(position)
        return 0.5 * g.gamma * spot * spot * 0.01

    # ------------------------------------------------------------------
    # Theta decay projection
    # ------------------------------------------------------------------

    def theta_decay_curve(
        self, position: Position, days: int = 30
    ) -> list[dict]:
        """Project theta decay over the next *days* calendar days.

        Returns a list of dicts with keys: day, theta, cumulative_decay, option_value.
        """
        contract = position.contract
        spot = position.spot_price
        strike = contract.strike
        T_initial = self._time_to_expiry(contract.expiry)
        sigma = position.greeks.iv if position.greeks.iv > 0 else 0.20
        option_type = contract.option_type
        qty = position.quantity
        lot = contract.lot_size

        curve: list[dict] = []
        cumulative = 0.0

        for day in range(days + 1):
            T = max(T_initial - day / 365.0, 0.0)
            price = self._bs.price(spot, strike, T, self.r, sigma, option_type)
            theta = self._bs.theta(spot, strike, T, self.r, sigma, option_type)

            scaled_theta = theta * qty * lot
            if day > 0:
                cumulative += scaled_theta

            curve.append({
                "day": day,
                "theta": scaled_theta,
                "cumulative_decay": cumulative,
                "option_value": price * qty * lot,
            })

        return curve

    # ------------------------------------------------------------------
    # P&L decomposition by Greeks
    # ------------------------------------------------------------------

    def pnl_by_greeks(
        self,
        position: Position,
        spot_change: float,
        vol_change: float,
        time_change: float,
    ) -> dict:
        """Decompose expected P&L into Greek contributions.

        Parameters
        ----------
        spot_change : Absolute change in spot price (e.g. +50).
        vol_change  : Change in IV in decimal (e.g. +0.02 for +2%).
        time_change : Change in time in years (e.g. 1/365 for one day).

        Returns
        -------
        dict with keys: delta_pnl, gamma_pnl, theta_pnl, vega_pnl,
                        total_greeks_pnl, higher_order_pnl.
        """
        g = self.position_greeks(position)

        delta_pnl = g.delta * spot_change
        gamma_pnl = 0.5 * g.gamma * spot_change ** 2
        # theta is per day, time_change in years
        theta_pnl = g.theta * (time_change * 365.0)
        # vega is per 1 pct-pt; vol_change is decimal
        vega_pnl = g.vega * (vol_change * 100.0)

        total_greeks = delta_pnl + gamma_pnl + theta_pnl + vega_pnl

        # Actual P&L via full repricing
        contract = position.contract
        spot = position.spot_price
        strike = contract.strike
        T = self._time_to_expiry(contract.expiry)
        sigma = position.greeks.iv if position.greeks.iv > 0 else 0.20
        option_type = contract.option_type
        qty = position.quantity
        lot = contract.lot_size

        price_before = self._bs.price(spot, strike, T, self.r, sigma, option_type)
        price_after = self._bs.price(
            spot + spot_change,
            strike,
            max(T - time_change, 0.0),
            self.r,
            sigma + vol_change,
            option_type,
        )
        actual_pnl = (price_after - price_before) * qty * lot
        higher_order = actual_pnl - total_greeks

        return {
            "delta_pnl": delta_pnl,
            "gamma_pnl": gamma_pnl,
            "theta_pnl": theta_pnl,
            "vega_pnl": vega_pnl,
            "total_greeks_pnl": total_greeks,
            "actual_pnl": actual_pnl,
            "higher_order_pnl": higher_order,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _time_to_expiry(expiry: date) -> float:
        """Years to expiry from today. Minimum 0."""
        today = date.today()
        days = (expiry - today).days
        return max(days / 365.0, 0.0)

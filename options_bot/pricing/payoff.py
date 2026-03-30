"""Payoff calculator for single options and multi-leg strategies.

Supports payoff-at-expiry analysis, breakeven calculation, max profit/loss
determination, and probability-of-profit estimation via Black-Scholes.
"""

from __future__ import annotations

from typing import Sequence, Tuple

import numpy as np
from scipy.stats import norm

from options_bot.core.models import OptionType

# A leg is (strike, premium, option_type, side, quantity)
# side: 'buy' or 'sell'
Leg = Tuple[float, float, OptionType, str, int]


class PayoffCalculator:
    """Calculate option payoffs at expiry for single legs and strategies."""

    # ------------------------------------------------------------------
    # Single option payoff
    # ------------------------------------------------------------------

    @staticmethod
    def option_payoff(
        strike: float,
        premium: float,
        option_type: OptionType,
        side: str,
        spot_range: np.ndarray,
    ) -> np.ndarray:
        """Payoff at expiry for a single option leg across a spot range.

        Parameters
        ----------
        strike     : Strike price.
        premium    : Premium paid (buy) or received (sell).
        option_type: CALL or PUT.
        side       : 'buy' or 'sell'.
        spot_range : 1-D array of spot prices.

        Returns
        -------
        1-D numpy array of P&L values (per unit quantity).
        """
        spot = np.asarray(spot_range, dtype=np.float64)

        if option_type == OptionType.CALL:
            intrinsic = np.maximum(spot - strike, 0.0)
        else:
            intrinsic = np.maximum(strike - spot, 0.0)

        if side.lower() == "buy":
            return intrinsic - premium
        else:  # sell
            return premium - intrinsic

    # ------------------------------------------------------------------
    # Strategy (multi-leg) payoff
    # ------------------------------------------------------------------

    def strategy_payoff(
        self,
        legs: Sequence[Leg],
        spot_range: np.ndarray,
    ) -> np.ndarray:
        """Combined payoff for a multi-leg strategy.

        Parameters
        ----------
        legs       : Sequence of (strike, premium, option_type, side, quantity).
        spot_range : 1-D array of spot prices.
        """
        spot = np.asarray(spot_range, dtype=np.float64)
        total = np.zeros_like(spot)

        for strike, premium, option_type, side, quantity in legs:
            leg_payoff = self.option_payoff(strike, premium, option_type, side, spot)
            total += leg_payoff * quantity

        return total

    # ------------------------------------------------------------------
    # Max profit / max loss
    # ------------------------------------------------------------------

    def max_profit(self, legs: Sequence[Leg], num_points: int = 10000) -> float:
        """Estimate maximum profit of a strategy at expiry.

        Uses a fine grid of spot prices around the strikes.
        Returns np.inf if profit is unbounded.
        """
        spot_range = self._build_spot_range(legs, num_points)
        payoff = self.strategy_payoff(legs, spot_range)

        # Check edges -- if payoff is increasing at upper end, profit is unbounded
        if payoff[-1] > payoff[-2] and payoff[-1] > payoff[-3]:
            # Could be unbounded upside (e.g. naked long call)
            return float("inf")

        return float(np.max(payoff))

    def max_loss(self, legs: Sequence[Leg], num_points: int = 10000) -> float:
        """Estimate maximum loss of a strategy at expiry.

        Returns -np.inf if loss is unbounded (e.g. naked short call).
        Convention: loss is returned as a negative number.
        """
        spot_range = self._build_spot_range(legs, num_points)
        payoff = self.strategy_payoff(legs, spot_range)

        # Check edges for unbounded loss
        if payoff[-1] < payoff[-2] and payoff[-1] < payoff[-3]:
            return float("-inf")
        if payoff[0] < payoff[1] and payoff[0] < payoff[2]:
            # Might be unbounded on downside (unlikely for equity, but handle)
            return float("-inf")

        return float(np.min(payoff))

    # ------------------------------------------------------------------
    # Breakeven points
    # ------------------------------------------------------------------

    def breakeven_points(
        self, legs: Sequence[Leg], num_points: int = 10000
    ) -> list[float]:
        """Find breakeven spot prices where strategy P&L crosses zero.

        Returns sorted list of breakeven prices.
        """
        spot_range = self._build_spot_range(legs, num_points)
        payoff = self.strategy_payoff(legs, spot_range)

        # Find zero crossings
        sign_changes = np.where(np.diff(np.sign(payoff)))[0]
        breakevens: list[float] = []

        for idx in sign_changes:
            # Linear interpolation between grid points
            s1, s2 = spot_range[idx], spot_range[idx + 1]
            p1, p2 = payoff[idx], payoff[idx + 1]

            if abs(p2 - p1) < 1e-12:
                breakevens.append(float(s1))
            else:
                s_zero = s1 - p1 * (s2 - s1) / (p2 - p1)
                breakevens.append(float(s_zero))

        return sorted(breakevens)

    # ------------------------------------------------------------------
    # Payoff at a specific spot
    # ------------------------------------------------------------------

    def payoff_at_expiry(self, legs: Sequence[Leg], spot: float) -> float:
        """Calculate exact strategy payoff at a single expiry spot price."""
        total = 0.0
        for strike, premium, option_type, side, quantity in legs:
            if option_type == OptionType.CALL:
                intrinsic = max(spot - strike, 0.0)
            else:
                intrinsic = max(strike - spot, 0.0)

            if side.lower() == "buy":
                pnl = intrinsic - premium
            else:
                pnl = premium - intrinsic

            total += pnl * quantity

        return total

    # ------------------------------------------------------------------
    # Probability of profit
    # ------------------------------------------------------------------

    def probability_of_profit(
        self,
        legs: Sequence[Leg],
        spot: float,
        iv: float,
        dte: float,
        r: float = 0.07,
    ) -> float:
        """Probability of profit at expiry using Black-Scholes lognormal assumption.

        Parameters
        ----------
        legs : Strategy legs.
        spot : Current spot price.
        iv   : Implied volatility (annualised decimal).
        dte  : Days to expiry.
        r    : Risk-free rate.

        Returns
        -------
        Probability in [0, 1].
        """
        if dte <= 0 or iv <= 0:
            # At expiry just check if current spot is profitable
            return 1.0 if self.payoff_at_expiry(legs, spot) > 0 else 0.0

        T = dte / 365.0
        breakevens = self.breakeven_points(legs)

        if not breakevens:
            # No zero crossings -- either always profit or always loss
            mid_payoff = self.payoff_at_expiry(legs, spot)
            return 1.0 if mid_payoff > 0 else 0.0

        # For each interval between breakevens, check if profitable
        # Build intervals: [0, be1], [be1, be2], ..., [beN, inf)
        test_points = [0.0] + breakevens + [spot * 3.0]
        profit_ranges: list[tuple[float, float]] = []

        for i in range(len(test_points) - 1):
            mid = (test_points[i] + test_points[i + 1]) / 2.0
            if mid <= 0:
                mid = 0.01
            if self.payoff_at_expiry(legs, mid) > 0:
                lo = test_points[i]
                hi = test_points[i + 1]
                profit_ranges.append((lo, hi))

        # Sum probability of spot falling in profitable ranges
        # Using lognormal distribution: ln(S_T) ~ N(ln(S) + (r - 0.5*sigma^2)*T, sigma^2*T)
        mu = np.log(spot) + (r - 0.5 * iv ** 2) * T
        std = iv * np.sqrt(T)

        total_prob = 0.0
        for lo, hi in profit_ranges:
            if lo <= 0:
                p_lo = 0.0
            else:
                p_lo = norm.cdf((np.log(lo) - mu) / std)

            if hi >= spot * 2.5:
                # Treat as upper tail to infinity
                p_hi = 1.0
            else:
                p_hi = norm.cdf((np.log(hi) - mu) / std)

            total_prob += p_hi - p_lo

        return float(np.clip(total_prob, 0.0, 1.0))

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_spot_range(
        legs: Sequence[Leg], num_points: int = 10000
    ) -> np.ndarray:
        """Build a spot range centred on the strategy's strikes."""
        strikes = [leg[0] for leg in legs]
        if not strikes:
            return np.linspace(1.0, 100.0, num_points)

        min_strike = min(strikes)
        max_strike = max(strikes)
        spread = max_strike - min_strike if max_strike > min_strike else min_strike * 0.1
        margin = max(spread * 1.5, min_strike * 0.3)

        lo = max(min_strike - margin, 0.01)
        hi = max_strike + margin

        return np.linspace(lo, hi, num_points)

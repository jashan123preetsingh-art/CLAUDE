"""Monte Carlo simulation for trade-sequence risk analysis."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

import numpy as np
import pandas as pd

from options_bot.core.models import Trade


@dataclass
class MonteCarloResult:
    """Container for Monte Carlo simulation output."""
    simulated_equities: np.ndarray  # shape (n_simulations, n_periods+1)
    final_equities: np.ndarray  # shape (n_simulations,)
    max_drawdowns: np.ndarray  # shape (n_simulations,)
    mean_final_equity: float = 0.0
    median_final_equity: float = 0.0
    std_final_equity: float = 0.0
    confidence_intervals: dict = field(default_factory=dict)


class MonteCarloSimulator:
    """Run Monte Carlo simulations by bootstrapping historical trade PnLs.

    This reshuffles the *sequence* of trade returns to explore how path
    dependency affects outcomes such as drawdowns and terminal wealth.

    Parameters
    ----------
    initial_capital : float
        Starting equity for each simulated path.
    """

    def __init__(self, initial_capital: float = 1_000_000.0):
        self.initial_capital = initial_capital

    # ------------------------------------------------------------------
    # Core simulation
    # ------------------------------------------------------------------

    def simulate(
        self,
        trades: Sequence[Trade],
        n_simulations: int = 10_000,
        n_periods: int = 252,
    ) -> MonteCarloResult:
        """Run *n_simulations* bootstrapped equity paths.

        Each path consists of *n_periods* trades sampled uniformly at random
        (with replacement) from *trades*.

        Parameters
        ----------
        trades : list[Trade]
            Historical trades to resample from.
        n_simulations : int
            Number of equity paths.
        n_periods : int
            Number of trades per path.

        Returns
        -------
        MonteCarloResult
        """
        pnl_array = np.array([t.net_pnl for t in trades], dtype=np.float64)
        if len(pnl_array) == 0:
            empty = np.full((n_simulations, n_periods + 1), self.initial_capital)
            return MonteCarloResult(
                simulated_equities=empty,
                final_equities=np.full(n_simulations, self.initial_capital),
                max_drawdowns=np.zeros(n_simulations),
                mean_final_equity=self.initial_capital,
                median_final_equity=self.initial_capital,
            )

        # Bootstrap: sample trade PnLs with replacement
        # Shape: (n_simulations, n_periods)
        sampled = np.random.choice(pnl_array, size=(n_simulations, n_periods), replace=True)

        # Build equity curves: cumulative sum of PnLs + initial capital
        equity = np.zeros((n_simulations, n_periods + 1), dtype=np.float64)
        equity[:, 0] = self.initial_capital
        equity[:, 1:] = self.initial_capital + np.cumsum(sampled, axis=1)

        final = equity[:, -1]

        # Max drawdowns per path
        max_dds = self._compute_max_drawdowns(equity)

        return MonteCarloResult(
            simulated_equities=equity,
            final_equities=final,
            max_drawdowns=max_dds,
            mean_final_equity=float(np.mean(final)),
            median_final_equity=float(np.median(final)),
            std_final_equity=float(np.std(final, ddof=1)),
        )

    # ------------------------------------------------------------------
    # Bootstrap helper
    # ------------------------------------------------------------------

    @staticmethod
    def bootstrap_trades(
        trades: Sequence[Trade],
        n_trades: int,
    ) -> list[Trade]:
        """Random sampling with replacement from *trades*.

        Returns a list of *n_trades* :class:`Trade` objects.
        """
        if not trades:
            return []
        indices = np.random.randint(0, len(trades), size=n_trades)
        return [trades[i] for i in indices]

    # ------------------------------------------------------------------
    # Confidence intervals
    # ------------------------------------------------------------------

    @staticmethod
    def confidence_intervals(
        results: MonteCarloResult,
        levels: list[float] | None = None,
    ) -> dict:
        """Compute confidence intervals on terminal equity.

        Parameters
        ----------
        results : MonteCarloResult
        levels : list[float]
            E.g. ``[0.90, 0.95, 0.99]``.

        Returns
        -------
        dict
            ``{level: {"lower": float, "upper": float}}``
        """
        if levels is None:
            levels = [0.90, 0.95, 0.99]

        ci: dict = {}
        for level in levels:
            alpha = 1.0 - level
            lower = float(np.percentile(results.final_equities, alpha / 2 * 100))
            upper = float(np.percentile(results.final_equities, (1 - alpha / 2) * 100))
            ci[level] = {"lower": round(lower, 2), "upper": round(upper, 2)}
        return ci

    # ------------------------------------------------------------------
    # Probability of ruin
    # ------------------------------------------------------------------

    @staticmethod
    def probability_of_ruin(
        results: MonteCarloResult,
        ruin_level: float,
    ) -> float:
        """Fraction of simulations where equity dropped to or below *ruin_level*
        at any point during the path.

        Parameters
        ----------
        results : MonteCarloResult
        ruin_level : float
            Absolute equity threshold (e.g. 500_000).
        """
        # Check if minimum equity along each path hit ruin
        min_equity = results.simulated_equities.min(axis=1)
        n_ruined = int(np.sum(min_equity <= ruin_level))
        return n_ruined / len(min_equity)

    # ------------------------------------------------------------------
    # Expected max drawdown
    # ------------------------------------------------------------------

    @staticmethod
    def expected_max_drawdown(
        results: MonteCarloResult,
    ) -> dict:
        """Percentile statistics on max drawdown across all paths.

        Returns
        -------
        dict
            ``{"mean": float, "median": float, "p5": float, "p25": float,
              "p75": float, "p95": float}``
            All values as positive fractions (e.g. 0.15 = 15 %).
        """
        dds = results.max_drawdowns
        return {
            "mean": round(float(np.mean(dds)), 6),
            "median": round(float(np.median(dds)), 6),
            "p5": round(float(np.percentile(dds, 5)), 6),
            "p25": round(float(np.percentile(dds, 25)), 6),
            "p75": round(float(np.percentile(dds, 75)), 6),
            "p95": round(float(np.percentile(dds, 95)), 6),
        }

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    @staticmethod
    def _compute_max_drawdowns(equity: np.ndarray) -> np.ndarray:
        """Vectorised max-drawdown computation over rows of *equity*.

        Parameters
        ----------
        equity : np.ndarray
            Shape ``(n_simulations, n_periods+1)``.

        Returns
        -------
        np.ndarray
            Shape ``(n_simulations,)`` -- max DD as a positive fraction.
        """
        running_max = np.maximum.accumulate(equity, axis=1)
        # Avoid division by zero
        safe_max = np.where(running_max == 0, 1.0, running_max)
        drawdowns = (running_max - equity) / safe_max
        return drawdowns.max(axis=1)

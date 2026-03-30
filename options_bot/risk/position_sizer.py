"""Position sizing algorithms for options trading.

Provides Kelly Criterion variants, fixed-fractional, and optimal-f
sizing methods tailored for Indian options markets.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class SizingResult:
    """Result of a position sizing calculation."""
    lots: int
    method: str
    fraction: float       # fraction of capital risked
    capital_at_risk: float
    reason: str = ""


class PositionSizer:
    """Compute how many lots to trade based on various sizing models.

    Parameters
    ----------
    default_lot_sizes : dict
        Mapping of symbol -> lot size.  For example:
        {"NIFTY": 25, "BANKNIFTY": 15, "FINNIFTY": 25}
    max_position_lots : int
        Hard cap on lots regardless of sizing model.
    min_lots : int
        Minimum lots to trade (1 by default).
    """

    DEFAULT_LOT_SIZES: dict[str, int] = {
        "NIFTY": 25,
        "BANKNIFTY": 15,
        "FINNIFTY": 25,
        "MIDCPNIFTY": 50,
        "SENSEX": 10,
        "BANKEX": 15,
    }

    def __init__(
        self,
        default_lot_sizes: Optional[dict[str, int]] = None,
        max_position_lots: int = 50,
        min_lots: int = 1,
    ) -> None:
        self.lot_sizes = default_lot_sizes or dict(self.DEFAULT_LOT_SIZES)
        self.max_position_lots = max_position_lots
        self.min_lots = min_lots

    # ------------------------------------------------------------------
    # Kelly Criterion family
    # ------------------------------------------------------------------

    @staticmethod
    def kelly_criterion(win_rate: float, avg_win: float, avg_loss: float) -> float:
        """Full Kelly fraction: f* = (p * b - q) / b

        Parameters
        ----------
        win_rate : float
            Probability of a winning trade (0-1).
        avg_win : float
            Average profit on a winning trade (positive).
        avg_loss : float
            Average loss on a losing trade (positive magnitude).

        Returns
        -------
        float
            Optimal fraction of capital to risk (can be negative,
            meaning don't trade).
        """
        if avg_loss <= 0:
            logger.warning("avg_loss must be positive; returning 0.0")
            return 0.0
        if not 0.0 <= win_rate <= 1.0:
            logger.warning("win_rate %.4f out of [0,1]; clamping", win_rate)
            win_rate = max(0.0, min(1.0, win_rate))

        b = avg_win / avg_loss  # win/loss ratio
        q = 1.0 - win_rate
        kelly = (win_rate * b - q) / b
        return kelly

    @staticmethod
    def half_kelly(win_rate: float, avg_win: float, avg_loss: float) -> float:
        """Half-Kelly for a more conservative approach."""
        return PositionSizer.kelly_criterion(win_rate, avg_win, avg_loss) * 0.5

    @staticmethod
    def quarter_kelly(win_rate: float, avg_win: float, avg_loss: float) -> float:
        """Quarter-Kelly for highly conservative sizing."""
        return PositionSizer.kelly_criterion(win_rate, avg_win, avg_loss) * 0.25

    # ------------------------------------------------------------------
    # Fixed sizing methods
    # ------------------------------------------------------------------

    @staticmethod
    def fixed_fractional(
        capital: float,
        risk_pct: float,
        max_loss_per_lot: float,
    ) -> int:
        """Number of lots risking a fixed percentage of capital.

        Parameters
        ----------
        capital : float
            Total trading capital.
        risk_pct : float
            Fraction of capital to risk (e.g. 0.02 for 2%).
        max_loss_per_lot : float
            Maximum possible loss per single lot.

        Returns
        -------
        int
            Number of lots (floored, at least 0).
        """
        if max_loss_per_lot <= 0:
            logger.warning("max_loss_per_lot must be > 0; returning 0")
            return 0
        risk_amount = capital * risk_pct
        lots = int(risk_amount / max_loss_per_lot)
        return max(lots, 0)

    @staticmethod
    def fixed_amount(capital: float, amount: float, lot_size: int) -> int:
        """Lots affordable when investing a fixed rupee amount.

        Parameters
        ----------
        capital : float
            Total capital (used only to cap lots).
        amount : float
            Fixed rupee amount to deploy.
        lot_size : int
            Number of units per lot.

        Returns
        -------
        int
            Number of lots.
        """
        if lot_size <= 0 or amount <= 0:
            return 0
        lots = int(amount / lot_size)
        return max(lots, 0)

    # ------------------------------------------------------------------
    # Optimal f
    # ------------------------------------------------------------------

    @staticmethod
    def optimal_f(trades_history: list[float]) -> float:
        """Ralph Vince's Optimal f.

        Finds the fraction that maximises the terminal wealth relative
        (TWR) over the historical trade series.

        Parameters
        ----------
        trades_history : list[float]
            List of trade P&Ls (positive = profit, negative = loss).

        Returns
        -------
        float
            Optimal fraction (0..1).  Returns 0.0 if no losing trades
            exist or the history is empty.
        """
        if not trades_history:
            return 0.0

        losses = [t for t in trades_history if t < 0]
        if not losses:
            return 0.0  # no losses -> undefined

        worst_loss = abs(min(trades_history))
        if worst_loss == 0:
            return 0.0

        best_twr = 0.0
        best_f = 0.0

        # Search from 0.01 to 1.0 in 0.01 increments
        for f_int in range(1, 101):
            f = f_int / 100.0
            twr = 1.0
            for trade in trades_history:
                hpr = 1.0 + f * (-trade / worst_loss)
                if hpr <= 0:
                    twr = 0.0
                    break
                twr *= hpr
            if twr > best_twr:
                best_twr = twr
                best_f = f

        return best_f

    # ------------------------------------------------------------------
    # Unified sizing entry point
    # ------------------------------------------------------------------

    def size_position(
        self,
        capital: float,
        strategy: dict,
        method: str = "half_kelly",
    ) -> int:
        """Compute number of lots for a strategy.

        Parameters
        ----------
        capital : float
            Available trading capital.
        strategy : dict
            Must contain keys depending on method:
            - 'win_rate', 'avg_win', 'avg_loss' for kelly variants
            - 'risk_pct', 'max_loss_per_lot' for fixed_fractional
            - 'amount', 'lot_size' for fixed_amount
            - 'trades_history', 'max_loss_per_lot' for optimal_f
            Optional:
            - 'symbol' for looking up lot size
        method : str
            One of: 'kelly', 'half_kelly', 'quarter_kelly',
            'fixed_fractional', 'fixed_amount', 'optimal_f'.

        Returns
        -------
        int
            Number of lots, clamped between min_lots and max_position_lots.
        """
        symbol = strategy.get("symbol", "NIFTY")
        lot_size = self.lot_sizes.get(symbol, 25)

        fraction = 0.0

        if method in ("kelly", "half_kelly", "quarter_kelly"):
            win_rate = strategy.get("win_rate", 0.5)
            avg_win = strategy.get("avg_win", 1.0)
            avg_loss = strategy.get("avg_loss", 1.0)

            if method == "kelly":
                fraction = self.kelly_criterion(win_rate, avg_win, avg_loss)
            elif method == "half_kelly":
                fraction = self.half_kelly(win_rate, avg_win, avg_loss)
            else:
                fraction = self.quarter_kelly(win_rate, avg_win, avg_loss)

            if fraction <= 0:
                logger.info("Kelly fraction <= 0 (%.4f); no trade", fraction)
                return 0

            max_loss_per_lot = strategy.get("max_loss_per_lot", 0.0)
            if max_loss_per_lot <= 0:
                # Estimate from avg_loss and lot_size
                max_loss_per_lot = avg_loss * lot_size
            risk_amount = capital * fraction
            lots = int(risk_amount / max_loss_per_lot)

        elif method == "fixed_fractional":
            risk_pct = strategy.get("risk_pct", 0.02)
            max_loss_per_lot = strategy.get("max_loss_per_lot", 0.0)
            if max_loss_per_lot <= 0:
                logger.warning("max_loss_per_lot required for fixed_fractional")
                return 0
            lots = self.fixed_fractional(capital, risk_pct, max_loss_per_lot)

        elif method == "fixed_amount":
            amount = strategy.get("amount", 0.0)
            lots = self.fixed_amount(capital, amount, lot_size)

        elif method == "optimal_f":
            trades = strategy.get("trades_history", [])
            opt_f = self.optimal_f(trades)
            max_loss_per_lot = strategy.get("max_loss_per_lot", 0.0)
            if max_loss_per_lot <= 0 or opt_f <= 0:
                return 0
            risk_amount = capital * opt_f
            lots = int(risk_amount / max_loss_per_lot)
        else:
            logger.error("Unknown sizing method: %s", method)
            return 0

        # Clamp to limits
        lots = max(self.min_lots, min(lots, self.max_position_lots))
        logger.info(
            "Position size: %d lots (method=%s, fraction=%.4f, capital=%.0f)",
            lots, method, fraction, capital,
        )
        return lots

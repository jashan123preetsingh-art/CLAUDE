"""Portfolio-level risk management for Indian options trading.

Provides pre-trade checks, portfolio greek limits, drawdown monitoring,
VaR / CVaR computation, stress testing, and circuit-breaker logic.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from datetime import datetime, time
from typing import Optional

import numpy as np

from options_bot.core.exceptions import RiskLimitExceeded
from options_bot.core.models import Greeks, Order, OrderSide, Position

logger = logging.getLogger(__name__)


@dataclass
class RiskConfig:
    """All configurable risk limits in one place."""

    # Daily loss limits
    max_daily_loss_pct: float = 0.03       # 3% of capital
    max_daily_loss_abs: float = 50_000.0   # hard rupee cap

    # Drawdown
    max_drawdown_pct: float = 0.10         # 10%

    # Position limits
    max_open_positions: int = 10
    max_lots_per_symbol: int = 50
    max_lots_total: int = 200

    # Portfolio greek limits (absolute values, per lot-size-adjusted unit)
    max_portfolio_delta: float = 500.0
    max_portfolio_gamma: float = 100.0
    max_portfolio_vega: float = 5000.0
    min_portfolio_theta: float = -5000.0   # theta is usually negative

    # Margin
    max_margin_utilization: float = 0.80   # 80%

    # Circuit breaker
    max_consecutive_losses: int = 5
    cooldown_minutes: int = 30

    # VaR
    var_confidence: float = 0.95
    max_var_pct: float = 0.05              # 5% of capital


class RiskManager:
    """Centralised risk gate-keeper.

    Every order should pass through ``check_trade`` before execution.
    The trading loop should periodically call ``check_portfolio_greeks``,
    ``check_daily_loss``, ``check_max_drawdown``, and ``should_stop_trading``.
    """

    def __init__(self, config: Optional[RiskConfig] = None) -> None:
        self.config = config or RiskConfig()
        self._consecutive_losses: int = 0
        self._last_loss_time: Optional[datetime] = None
        self._cooldown_until: Optional[datetime] = None
        self._trade_count: int = 0
        self._daily_pnl: float = 0.0

    # ------------------------------------------------------------------
    # Pre-trade checks
    # ------------------------------------------------------------------

    def check_trade(
        self,
        order: Order,
        open_positions: list[Position],
    ) -> tuple[bool, str]:
        """Run all pre-trade validations.

        Returns (True, '') if the trade is acceptable, else (False, reason).
        """
        # 1. Circuit breaker
        stop, reason = self.should_stop_trading()
        if stop:
            return False, reason

        # 2. Max open positions
        if len(open_positions) >= self.config.max_open_positions:
            return False, (
                f"Max open positions reached ({self.config.max_open_positions})"
            )

        # 3. Per-symbol lot limit
        symbol = order.contract.symbol
        symbol_lots = sum(
            abs(p.quantity) for p in open_positions
            if p.contract.symbol == symbol
        )
        if symbol_lots + abs(order.quantity) > self.config.max_lots_per_symbol:
            return False, (
                f"Symbol lot limit: {symbol} would have "
                f"{symbol_lots + abs(order.quantity)} lots "
                f"(max {self.config.max_lots_per_symbol})"
            )

        # 4. Total lot limit
        total_lots = sum(abs(p.quantity) for p in open_positions)
        if total_lots + abs(order.quantity) > self.config.max_lots_total:
            return False, (
                f"Total lot limit: would have {total_lots + abs(order.quantity)} "
                f"(max {self.config.max_lots_total})"
            )

        return True, ""

    # ------------------------------------------------------------------
    # Portfolio Greeks
    # ------------------------------------------------------------------

    def check_portfolio_greeks(
        self, portfolio_greeks: Greeks,
    ) -> tuple[bool, list[str]]:
        """Check whether portfolio greeks are within limits.

        Returns (True, []) when everything is fine, else (False, [violations]).
        """
        violations: list[str] = []

        if abs(portfolio_greeks.delta) > self.config.max_portfolio_delta:
            violations.append(
                f"Delta {portfolio_greeks.delta:.1f} exceeds "
                f"+/-{self.config.max_portfolio_delta:.1f}"
            )
        if abs(portfolio_greeks.gamma) > self.config.max_portfolio_gamma:
            violations.append(
                f"Gamma {portfolio_greeks.gamma:.2f} exceeds "
                f"+/-{self.config.max_portfolio_gamma:.2f}"
            )
        if abs(portfolio_greeks.vega) > self.config.max_portfolio_vega:
            violations.append(
                f"Vega {portfolio_greeks.vega:.1f} exceeds "
                f"+/-{self.config.max_portfolio_vega:.1f}"
            )
        if portfolio_greeks.theta < self.config.min_portfolio_theta:
            violations.append(
                f"Theta {portfolio_greeks.theta:.1f} below "
                f"min {self.config.min_portfolio_theta:.1f}"
            )

        ok = len(violations) == 0
        return ok, violations

    # ------------------------------------------------------------------
    # Daily P&L
    # ------------------------------------------------------------------

    def check_daily_loss(
        self, daily_pnl: float, capital: float,
    ) -> tuple[bool, str]:
        """Check if the daily loss exceeds limits.

        Returns (True, '') if within limits.
        """
        self._daily_pnl = daily_pnl

        if daily_pnl >= 0:
            return True, ""

        loss = abs(daily_pnl)
        pct = loss / capital if capital > 0 else 0.0

        if loss >= self.config.max_daily_loss_abs:
            return False, (
                f"Daily loss INR {loss:,.0f} exceeds absolute limit "
                f"INR {self.config.max_daily_loss_abs:,.0f}"
            )
        if pct >= self.config.max_daily_loss_pct:
            return False, (
                f"Daily loss {pct:.2%} exceeds limit "
                f"{self.config.max_daily_loss_pct:.2%}"
            )
        return True, ""

    # ------------------------------------------------------------------
    # Drawdown
    # ------------------------------------------------------------------

    def check_max_drawdown(
        self, peak_capital: float, current_capital: float,
    ) -> tuple[bool, str]:
        """Check if drawdown from peak exceeds the limit."""
        if peak_capital <= 0:
            return True, ""

        drawdown = (peak_capital - current_capital) / peak_capital
        if drawdown >= self.config.max_drawdown_pct:
            return False, (
                f"Drawdown {drawdown:.2%} exceeds max "
                f"{self.config.max_drawdown_pct:.2%} "
                f"(peak={peak_capital:,.0f}, current={current_capital:,.0f})"
            )
        return True, ""

    # ------------------------------------------------------------------
    # Margin
    # ------------------------------------------------------------------

    def check_margin_requirement(
        self,
        required_margin: float,
        available_margin: float,
    ) -> tuple[bool, float]:
        """Check if there is enough margin.

        Returns (True, required_margin) if OK.
        """
        if required_margin > available_margin:
            return False, required_margin
        return True, required_margin

    # ------------------------------------------------------------------
    # VaR & CVaR
    # ------------------------------------------------------------------

    @staticmethod
    def var_parametric(
        positions: list[Position],
        confidence: float = 0.95,
        horizon: int = 1,
    ) -> float:
        """Parametric (variance-covariance) Value at Risk.

        Uses delta-normal approximation:
            VaR = |portfolio_delta| * spot * z_score * vol * sqrt(horizon)

        Parameters
        ----------
        positions : list[Position]
            Current option positions with greeks and spot_price populated.
        confidence : float
            Confidence level (e.g. 0.95).
        horizon : int
            Holding period in days.

        Returns
        -------
        float
            Estimated VaR in rupees (positive number = potential loss).
        """
        from scipy.stats import norm  # lazy import

        if not positions:
            return 0.0

        z = norm.ppf(confidence)

        # Group by underlying
        underlying_exposure: dict[str, dict] = {}
        for pos in positions:
            sym = pos.contract.symbol
            if sym not in underlying_exposure:
                underlying_exposure[sym] = {"delta": 0.0, "spot": pos.spot_price}
            underlying_exposure[sym]["delta"] += (
                pos.greeks.delta * pos.quantity * pos.contract.lot_size
            )

        total_var = 0.0
        # Assume ~1.2% daily vol for NIFTY / BANKNIFTY as a default
        default_daily_vol = 0.012

        for sym, data in underlying_exposure.items():
            spot = data["spot"] if data["spot"] > 0 else 1.0
            portfolio_delta = data["delta"]
            daily_vol = default_daily_vol
            var_component = abs(portfolio_delta) * spot * z * daily_vol * math.sqrt(horizon)
            total_var += var_component

        return total_var

    @staticmethod
    def var_historical(
        returns: list[float] | np.ndarray,
        confidence: float = 0.95,
    ) -> float:
        """Historical VaR.

        Parameters
        ----------
        returns : array-like
            Historical daily returns (e.g. percentage P&L series).
        confidence : float
            Confidence level.

        Returns
        -------
        float
            VaR as a positive number (loss magnitude at the given percentile).
        """
        if len(returns) == 0:
            return 0.0
        arr = np.asarray(returns)
        percentile = (1.0 - confidence) * 100.0
        var = -float(np.percentile(arr, percentile))
        return max(var, 0.0)

    @staticmethod
    def expected_shortfall(
        returns: list[float] | np.ndarray,
        confidence: float = 0.95,
    ) -> float:
        """Conditional VaR (Expected Shortfall / CVaR).

        Average loss beyond the VaR threshold.
        """
        if len(returns) == 0:
            return 0.0
        arr = np.asarray(returns)
        percentile = (1.0 - confidence) * 100.0
        threshold = np.percentile(arr, percentile)
        tail = arr[arr <= threshold]
        if len(tail) == 0:
            return 0.0
        return -float(np.mean(tail))

    # ------------------------------------------------------------------
    # Stress testing
    # ------------------------------------------------------------------

    @staticmethod
    def stress_test(
        positions: list[Position],
        scenarios: Optional[dict[str, float]] = None,
    ) -> dict[str, float]:
        """Estimate portfolio P&L under spot-price shock scenarios.

        Uses a first-order (delta) + second-order (gamma) Taylor expansion.

        Parameters
        ----------
        positions : list[Position]
            Positions with greeks populated.
        scenarios : dict
            Mapping of scenario name -> percentage move
            e.g. {"crash_5pct": -0.05, "rally_5pct": 0.05}

        Returns
        -------
        dict
            scenario_name -> estimated P&L in rupees.
        """
        if scenarios is None:
            scenarios = {
                "crash_10pct": -0.10,
                "crash_5pct": -0.05,
                "crash_3pct": -0.03,
                "flat": 0.0,
                "rally_3pct": 0.03,
                "rally_5pct": 0.05,
                "rally_10pct": 0.10,
            }

        results: dict[str, float] = {}

        for name, pct_move in scenarios.items():
            total_pnl = 0.0
            for pos in positions:
                spot = pos.spot_price if pos.spot_price > 0 else 1.0
                move_pts = spot * pct_move
                lot_mult = pos.quantity * pos.contract.lot_size
                # Taylor: P&L ~ delta * dS + 0.5 * gamma * dS^2
                delta_pnl = pos.greeks.delta * move_pts * lot_mult
                gamma_pnl = 0.5 * pos.greeks.gamma * (move_pts ** 2) * lot_mult
                total_pnl += delta_pnl + gamma_pnl
            results[name] = round(total_pnl, 2)

        return results

    # ------------------------------------------------------------------
    # Circuit breaker
    # ------------------------------------------------------------------

    def record_trade_result(self, pnl: float) -> None:
        """Record a closed trade result for circuit-breaker tracking."""
        self._trade_count += 1
        if pnl < 0:
            self._consecutive_losses += 1
            self._last_loss_time = datetime.now()
        else:
            self._consecutive_losses = 0

    def should_stop_trading(self) -> tuple[bool, str]:
        """Determine if trading should be halted.

        Returns (True, reason) if the circuit breaker is active.
        """
        # Cooldown check
        if self._cooldown_until is not None:
            if datetime.now() < self._cooldown_until:
                remaining = (self._cooldown_until - datetime.now()).seconds // 60
                return True, (
                    f"Cooldown active: {remaining} minutes remaining"
                )
            else:
                # Cooldown expired - reset
                self._cooldown_until = None
                self._consecutive_losses = 0

        # Consecutive loss check
        if self._consecutive_losses >= self.config.max_consecutive_losses:
            from datetime import timedelta
            self._cooldown_until = datetime.now() + timedelta(
                minutes=self.config.cooldown_minutes
            )
            return True, (
                f"{self._consecutive_losses} consecutive losses; "
                f"cooldown for {self.config.cooldown_minutes} min"
            )

        return False, ""

    def reset_daily(self) -> None:
        """Reset daily counters (call at start of each trading day)."""
        self._daily_pnl = 0.0
        self._trade_count = 0
        self._consecutive_losses = 0
        self._cooldown_until = None
        logger.info("Risk manager daily counters reset")

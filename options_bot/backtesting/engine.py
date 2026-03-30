"""Backtesting engine for options strategies."""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Protocol

import numpy as np
import pandas as pd

from options_bot.core.exceptions import BacktestError
from options_bot.core.models import (
    OrderSide,
    StrategyPosition,
    Trade,
)


# ---------------------------------------------------------------------------
# Strategy protocol -- any strategy passed to the engine must satisfy this.
# ---------------------------------------------------------------------------

class StrategyProtocol(Protocol):
    """Minimal interface a strategy must implement for backtesting."""

    def on_data(self, date: date, data: dict) -> list[dict]:
        """Return a list of order dicts for the day.

        Each dict should contain at minimum:
            ``contract``, ``side``, ``quantity``, ``price``
        """
        ...

    def on_fill(self, trade: Trade) -> None:
        """Callback when a trade is filled."""
        ...


# ---------------------------------------------------------------------------
# Result container
# ---------------------------------------------------------------------------

@dataclass
class BacktestResult:
    """Holds the complete result of a backtest run."""
    equity_curve: pd.Series
    trades: list[Trade]
    positions: list[StrategyPosition]
    metrics: dict = field(default_factory=dict)
    daily_pnl: pd.Series = field(default_factory=lambda: pd.Series(dtype=float))
    start_date: date | None = None
    end_date: date | None = None
    initial_capital: float = 0.0


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

class BacktestEngine:
    """Event-driven backtesting engine.

    Parameters
    ----------
    initial_capital : float
        Starting cash balance.
    commission : float
        Per-lot commission (INR).  Default 20 per order (typical NSE broker).
    slippage : float
        Slippage as a fraction of the price.  E.g. 0.001 = 0.1 %.
    start_date : date | None
        Inclusive start.
    end_date : date | None
        Inclusive end.
    """

    def __init__(
        self,
        initial_capital: float = 1_000_000.0,
        commission: float = 20.0,
        slippage: float = 0.001,
        start_date: date | None = None,
        end_date: date | None = None,
    ):
        self.initial_capital = initial_capital
        self.commission = commission
        self.slippage = slippage
        self.start_date = start_date
        self.end_date = end_date

        # Internal state
        self._cash: float = initial_capital
        self._positions: list[dict] = []  # open positions
        self._trades: list[Trade] = []
        self._equity_curve: dict[date, float] = {}
        self._margin_used: float = 0.0
        self._max_margin: float = initial_capital  # margin cannot exceed capital

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run(
        self,
        strategy: Any,
        historical_data: dict[date, dict],
    ) -> BacktestResult:
        """Run the backtest over *historical_data*.

        Parameters
        ----------
        strategy
            An object satisfying :class:`StrategyProtocol`.
        historical_data : dict[date, dict]
            Mapping of date -> data payload.  The payload is passed to
            ``strategy.on_data`` as-is.

        Returns
        -------
        BacktestResult
        """
        sorted_dates = sorted(historical_data.keys())
        if not sorted_dates:
            raise BacktestError("historical_data is empty")

        effective_start = self.start_date or sorted_dates[0]
        effective_end = self.end_date or sorted_dates[-1]

        # Reset state
        self._cash = self.initial_capital
        self._positions = []
        self._trades = []
        self._equity_curve = {}
        self._margin_used = 0.0

        for d in sorted_dates:
            if d < effective_start or d > effective_end:
                continue

            day_data = historical_data[d]
            day_trades = self._simulate_day(d, strategy, day_data)

            # Mark-to-market open positions
            portfolio_value = self._cash + self._mark_to_market(day_data)
            self._equity_curve[d] = portfolio_value

        # Convert to Series
        eq_series = pd.Series(self._equity_curve, name="equity")
        eq_series.index = pd.DatetimeIndex(eq_series.index)
        eq_series = eq_series.sort_index()

        daily_pnl = eq_series.diff().fillna(0.0)

        return BacktestResult(
            equity_curve=eq_series,
            trades=self._trades,
            positions=[],
            daily_pnl=daily_pnl,
            start_date=effective_start,
            end_date=effective_end,
            initial_capital=self.initial_capital,
        )

    # ------------------------------------------------------------------
    # Day simulation
    # ------------------------------------------------------------------

    def _simulate_day(
        self,
        dt: date,
        strategy: Any,
        data: dict,
    ) -> list[Trade]:
        """Process one trading day.

        1. Pass data to strategy to get orders.
        2. Apply slippage & commission.
        3. Check risk limits.
        4. Record trades.
        """
        orders = strategy.on_data(dt, data)
        if not orders:
            return []

        day_trades: list[Trade] = []

        for order in orders:
            contract = order["contract"]
            side = order["side"]
            qty = order["quantity"]
            raw_price = order["price"]
            lot_size = getattr(contract, "lot_size", 1)

            # Apply slippage
            fill_price = self._apply_slippage(raw_price, side)

            # Commission
            comm = self._apply_commission_for_order(qty)

            # Margin check for sell-side
            if side == OrderSide.SELL:
                margin_req = self._calculate_margin_for_order(fill_price, qty, lot_size)
                if not self._check_risk_limits_for_order(margin_req):
                    continue  # skip -- insufficient margin
                self._margin_used += margin_req

            # Cost / credit
            notional = fill_price * qty * lot_size
            if side == OrderSide.BUY:
                self._cash -= notional + comm
            else:
                self._cash += notional - comm

            trade = Trade(
                entry_date=datetime.combine(dt, datetime.min.time()),
                exit_date=None,
                contract=contract,
                side=side,
                quantity=qty,
                entry_price=fill_price,
                exit_price=0.0,
                pnl=0.0,
                commission=comm,
                slippage_cost=abs(fill_price - raw_price) * qty * lot_size,
            )
            day_trades.append(trade)
            self._trades.append(trade)

            # Notify strategy
            if hasattr(strategy, "on_fill"):
                strategy.on_fill(trade)

            # Track open position
            self._positions.append({
                "contract": contract,
                "side": side,
                "quantity": qty,
                "entry_price": fill_price,
                "date": dt,
            })

        return day_trades

    # ------------------------------------------------------------------
    # Slippage & commission
    # ------------------------------------------------------------------

    def _apply_slippage(self, price: float, side: OrderSide) -> float:
        """Adjust price for slippage.

        Buys fill slightly higher; sells fill slightly lower.
        """
        if side == OrderSide.BUY:
            return price * (1.0 + self.slippage)
        else:
            return price * (1.0 - self.slippage)

    def _apply_commission_for_order(self, quantity: int) -> float:
        """Total commission for an order (per-lot flat fee model)."""
        return self.commission * quantity

    # Alias used by external callers expecting the spec name
    def _apply_commission(self, trade: Trade) -> float:
        return self.commission * trade.quantity

    # ------------------------------------------------------------------
    # Margin
    # ------------------------------------------------------------------

    def _calculate_margin(self, position: dict) -> float:
        """Estimate margin for an open position (simplified SPAN-like).

        For short options, margin ~ premium + % of underlying.
        """
        price = position.get("entry_price", 0.0)
        qty = position.get("quantity", 1)
        lot_size = getattr(position.get("contract"), "lot_size", 1)
        # Simplified: margin = notional * 15% (typical NSE option writing margin)
        return price * qty * lot_size * 0.15

    def _calculate_margin_for_order(
        self, price: float, quantity: int, lot_size: int
    ) -> float:
        return price * quantity * lot_size * 0.15

    # ------------------------------------------------------------------
    # Risk limits
    # ------------------------------------------------------------------

    def _check_risk_limits(self, position: dict) -> bool:
        """Check whether accepting *position* stays within risk limits."""
        margin_req = self._calculate_margin(position)
        return (self._margin_used + margin_req) <= self._max_margin

    def _check_risk_limits_for_order(self, margin_req: float) -> bool:
        return (self._margin_used + margin_req) <= self._max_margin

    # ------------------------------------------------------------------
    # Mark-to-market
    # ------------------------------------------------------------------

    def _mark_to_market(self, data: dict) -> float:
        """Compute unrealised PnL of all open positions from *data*.

        *data* should contain a ``"prices"`` key mapping trading symbols
        to current prices.
        """
        prices = data.get("prices", {})
        total = 0.0
        for pos in self._positions:
            contract = pos["contract"]
            symbol = getattr(contract, "trading_symbol", "")
            current_price = prices.get(symbol, pos["entry_price"])
            lot_size = getattr(contract, "lot_size", 1)
            qty = pos["quantity"]
            if pos["side"] == OrderSide.BUY:
                total += (current_price - pos["entry_price"]) * qty * lot_size
            else:
                total += (pos["entry_price"] - current_price) * qty * lot_size
        return total

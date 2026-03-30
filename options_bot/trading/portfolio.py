"""Portfolio tracker for managing positions and P&L."""

from datetime import datetime
from typing import Optional

import pandas as pd

from options_bot.core.models import (
    Position, PositionStatus, StrategyPosition, Greeks, MarketData
)
from options_bot.core.logger import get_logger

logger = get_logger(__name__)


class Portfolio:
    """Tracks all positions, P&L, and portfolio-level Greeks."""

    def __init__(self, initial_capital: float = 1_000_000):
        self._initial_capital = initial_capital
        self._cash = initial_capital
        self._positions: dict[str, StrategyPosition] = {}
        self._closed_positions: list[StrategyPosition] = []
        self._daily_pnl_start: float = initial_capital
        self._peak_capital: float = initial_capital
        self._trade_log: list[dict] = []

    @property
    def initial_capital(self) -> float:
        return self._initial_capital

    @property
    def cash(self) -> float:
        return self._cash

    def add_position(self, position: StrategyPosition):
        """Add a new strategy position to the portfolio."""
        self._positions[position.id] = position
        # Debit/credit premium
        if position.net_premium:
            self._cash += position.net_premium  # Credit for sells
        logger.info(
            f"Position added: {position.name} ({position.strategy_type.value})"
            f" | Premium: ₹{position.net_premium:,.2f}"
        )

    def remove_position(self, position_id: str):
        """Close and remove a position."""
        if position_id not in self._positions:
            logger.warning(f"Position not found: {position_id}")
            return

        pos = self._positions.pop(position_id)
        pos.status = PositionStatus.CLOSED
        pos.exit_time = datetime.now()
        self._closed_positions.append(pos)

        # Calculate realized P&L
        realized = sum(
            leg.pnl for leg in pos.legs if leg.pnl is not None
        )
        self._cash += realized

        self._trade_log.append({
            "position_id": position_id,
            "strategy": pos.strategy_type.value,
            "name": pos.name,
            "entry_time": pos.entry_time,
            "exit_time": pos.exit_time,
            "pnl": realized,
        })

        logger.info(
            f"Position closed: {pos.name} | P&L: ₹{realized:,.2f}"
        )

    def get_open_positions(self) -> list[StrategyPosition]:
        """Get all open positions."""
        return list(self._positions.values())

    def get_closed_positions(self) -> list[StrategyPosition]:
        """Get all closed positions."""
        return list(self._closed_positions)

    def get_position(self, position_id: str) -> Optional[StrategyPosition]:
        """Get a specific position."""
        return self._positions.get(position_id)

    def total_pnl(self) -> float:
        """Total P&L (realized + unrealized)."""
        realized = sum(
            t["pnl"] for t in self._trade_log
        )
        unrealized = self._unrealized_pnl()
        return realized + unrealized

    def realized_pnl(self) -> float:
        """Total realized P&L from closed positions."""
        return sum(t["pnl"] for t in self._trade_log)

    def _unrealized_pnl(self) -> float:
        """Total unrealized P&L from open positions."""
        total = 0.0
        for pos in self._positions.values():
            for leg in pos.legs:
                if leg.unrealized_pnl is not None:
                    total += leg.unrealized_pnl
        return total

    def unrealized_pnl(self) -> float:
        """Public accessor for unrealized P&L."""
        return self._unrealized_pnl()

    def daily_pnl(self) -> float:
        """P&L since start of day."""
        current_value = self.current_capital()
        return current_value - self._daily_pnl_start

    def current_capital(self) -> float:
        """Current total capital (cash + unrealized)."""
        return self._cash + self._unrealized_pnl()

    def portfolio_greeks(self) -> Greeks:
        """Aggregate Greeks across all open positions."""
        total_delta = 0.0
        total_gamma = 0.0
        total_theta = 0.0
        total_vega = 0.0
        total_rho = 0.0

        for pos in self._positions.values():
            if pos.portfolio_greeks:
                total_delta += pos.portfolio_greeks.delta
                total_gamma += pos.portfolio_greeks.gamma
                total_theta += pos.portfolio_greeks.theta
                total_vega += pos.portfolio_greeks.vega
                total_rho += pos.portfolio_greeks.rho

        return Greeks(
            delta=total_delta,
            gamma=total_gamma,
            theta=total_theta,
            vega=total_vega,
            rho=total_rho,
        )

    def margin_used(self) -> float:
        """Estimated total margin used by open positions."""
        total = 0.0
        for pos in self._positions.values():
            if pos.max_loss:
                total += abs(pos.max_loss)
        return total

    def available_capital(self) -> float:
        """Capital available for new positions."""
        return self._cash - self.margin_used()

    def margin_utilization(self) -> float:
        """Margin utilization as percentage."""
        if self._cash <= 0:
            return 100.0
        return (self.margin_used() / self._cash) * 100.0

    def position_count(self) -> int:
        """Number of open positions."""
        return len(self._positions)

    def drawdown(self) -> float:
        """Current drawdown from peak capital."""
        current = self.current_capital()
        if current > self._peak_capital:
            self._peak_capital = current
        if self._peak_capital == 0:
            return 0.0
        return (self._peak_capital - current) / self._peak_capital * 100.0

    def update_prices(self, market_data: dict[str, float]):
        """Update positions with latest market prices.

        market_data: dict mapping symbol -> current price
        """
        for pos in self._positions.values():
            for leg in pos.legs:
                symbol = getattr(leg.contract, 'symbol', None) if hasattr(
                    leg, 'contract') else None
                if symbol and symbol in market_data:
                    old_price = leg.current_price
                    leg.current_price = market_data[symbol]

                    if leg.entry_price is not None:
                        if leg.side.value == "BUY":
                            leg.unrealized_pnl = (
                                (leg.current_price - leg.entry_price)
                                * leg.quantity
                                * (leg.contract.lot_size
                                   if hasattr(leg.contract, 'lot_size')
                                   else 1)
                            )
                        else:
                            leg.unrealized_pnl = (
                                (leg.entry_price - leg.current_price)
                                * leg.quantity
                                * (leg.contract.lot_size
                                   if hasattr(leg.contract, 'lot_size')
                                   else 1)
                            )

        # Update peak capital
        current = self.current_capital()
        if current > self._peak_capital:
            self._peak_capital = current

    def reset_daily(self):
        """Reset daily P&L tracking (call at start of day)."""
        self._daily_pnl_start = self.current_capital()
        logger.info(
            f"Daily P&L reset. Starting capital: "
            f"₹{self._daily_pnl_start:,.2f}"
        )

    def to_dataframe(self) -> pd.DataFrame:
        """Convert open positions to DataFrame for display."""
        rows = []
        for pos in self._positions.values():
            for i, leg in enumerate(pos.legs):
                rows.append({
                    "Position": pos.name,
                    "Strategy": pos.strategy_type.value,
                    "Leg": i + 1,
                    "Symbol": getattr(leg.contract, 'symbol', 'N/A')
                    if hasattr(leg, 'contract') else 'N/A',
                    "Side": leg.side.value if hasattr(leg.side, 'value')
                    else str(leg.side),
                    "Qty": leg.quantity,
                    "Entry": leg.entry_price,
                    "Current": leg.current_price,
                    "P&L": leg.unrealized_pnl or 0,
                    "Delta": leg.greeks.delta
                    if leg.greeks else 0,
                    "Theta": leg.greeks.theta
                    if leg.greeks else 0,
                })

        if not rows:
            return pd.DataFrame()

        return pd.DataFrame(rows)

    def summary(self) -> dict:
        """Get portfolio summary."""
        greeks = self.portfolio_greeks()
        return {
            "initial_capital": self._initial_capital,
            "current_capital": self.current_capital(),
            "cash": self._cash,
            "total_pnl": self.total_pnl(),
            "realized_pnl": self.realized_pnl(),
            "unrealized_pnl": self.unrealized_pnl(),
            "daily_pnl": self.daily_pnl(),
            "drawdown_pct": self.drawdown(),
            "open_positions": self.position_count(),
            "closed_trades": len(self._closed_positions),
            "margin_used": self.margin_used(),
            "margin_utilization_pct": self.margin_utilization(),
            "portfolio_delta": greeks.delta,
            "portfolio_gamma": greeks.gamma,
            "portfolio_theta": greeks.theta,
            "portfolio_vega": greeks.vega,
        }

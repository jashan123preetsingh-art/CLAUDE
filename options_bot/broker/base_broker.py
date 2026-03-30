"""Abstract base class for broker integrations.

Every concrete broker (Zerodha, Angel One, paper) inherits from
``BaseBroker`` and implements the full interface so that the rest of
the trading system is broker-agnostic.
"""

from __future__ import annotations

import abc
from typing import Any, Callable, Optional

from options_bot.core.models import (
    OptionChain,
    Order,
    OrderStatus,
    Position,
)


class BaseBroker(abc.ABC):
    """Broker-agnostic interface for order management and market data."""

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    @abc.abstractmethod
    def connect(self) -> None:
        """Establish connection / authenticate with the broker."""

    @abc.abstractmethod
    def disconnect(self) -> None:
        """Cleanly close the broker connection."""

    # ------------------------------------------------------------------
    # Order management
    # ------------------------------------------------------------------

    @abc.abstractmethod
    def place_order(self, order: Order) -> str:
        """Place an order and return the broker-assigned order ID.

        Raises
        ------
        OrderExecutionError
            If the broker rejects the order.
        InsufficientMarginError
            If the broker reports insufficient margin/funds.
        """

    @abc.abstractmethod
    def modify_order(
        self,
        broker_order_id: str,
        new_price: Optional[float] = None,
        new_quantity: Optional[int] = None,
    ) -> None:
        """Modify an open/pending order's price or quantity."""

    @abc.abstractmethod
    def cancel_order(self, broker_order_id: str) -> None:
        """Cancel an open order."""

    @abc.abstractmethod
    def get_order_status(self, broker_order_id: str) -> OrderStatus:
        """Return the current status of an order."""

    @abc.abstractmethod
    def get_order_history(self, broker_order_id: str) -> list[dict[str, Any]]:
        """Return the full state-transition history for an order."""

    # ------------------------------------------------------------------
    # Portfolio queries
    # ------------------------------------------------------------------

    @abc.abstractmethod
    def get_positions(self) -> list[Position]:
        """Return all open positions (day + overnight)."""

    @abc.abstractmethod
    def get_holdings(self) -> list[dict[str, Any]]:
        """Return equity delivery holdings (CNC)."""

    @abc.abstractmethod
    def get_margins(self) -> dict[str, float]:
        """Return margin information.

        Expected keys: ``available``, ``used``, ``total``.
        """

    # ------------------------------------------------------------------
    # Market data
    # ------------------------------------------------------------------

    @abc.abstractmethod
    def get_ltp(self, symbol: str) -> float:
        """Return the last traded price for a trading symbol."""

    @abc.abstractmethod
    def get_option_chain(self, symbol: str, expiry: Any = None) -> OptionChain:
        """Return the option chain for the given underlying + expiry."""

    @abc.abstractmethod
    def subscribe_ticks(
        self,
        symbols: list[str],
        callback: Callable[[dict[str, Any]], None],
    ) -> None:
        """Subscribe to live tick data via WebSocket.

        ``callback`` will be invoked with each tick payload.
        """

    # ------------------------------------------------------------------
    # Convenience helpers (non-abstract, can be overridden)
    # ------------------------------------------------------------------

    def is_connected(self) -> bool:
        """Override to report connection health."""
        return False

"""Order management for the Indian options trading bot.

Handles order placement, modification, cancellation, partial fills, and
retries against the broker API.  All public methods are thread-safe.
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

from options_bot.core.exceptions import BrokerError
from options_bot.core.models import (
    OrderSide,
    OrderStatus,
    OrderType,
    Position,
    ProductType,
    StrategyPosition,
)

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Lightweight order wrapper used internally
# ------------------------------------------------------------------

@dataclass
class Order:
    """Internal order representation."""

    order_id: str = ""
    broker_order_id: str = ""
    trading_symbol: str = ""
    exchange: str = "NFO"
    side: OrderSide = OrderSide.BUY
    order_type: OrderType = OrderType.LIMIT
    product: ProductType = ProductType.NRML
    quantity: int = 0
    price: float = 0.0
    trigger_price: float = 0.0
    status: OrderStatus = OrderStatus.PENDING
    filled_quantity: int = 0
    average_price: float = 0.0
    tag: str = ""
    strategy_id: str = ""
    placed_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    retries: int = 0
    metadata: dict = field(default_factory=dict)


class OrderManager:
    """Manages the full lifecycle of orders sent to the broker.

    Parameters
    ----------
    broker
        Broker gateway exposing ``place_order``, ``modify_order``,
        ``cancel_order``, and ``order_status`` methods.
    risk_manager
        Risk manager used for pre-order validation.
    """

    def __init__(self, broker: Any, risk_manager: Any) -> None:
        self.broker = broker
        self.risk_manager = risk_manager

        self._orders: dict[str, Order] = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def place_strategy_order(self, strategy_position: StrategyPosition) -> list[str]:
        """Place orders for every leg of a strategy position.

        Returns a list of internal order IDs.  If any leg fails the
        pre-order checks the entire batch is skipped.
        """
        order_ids: list[str] = []

        # Build orders for each leg
        leg_orders: list[Order] = []
        for leg in strategy_position.legs:
            order = self._position_to_order(leg, strategy_position.tag)
            ok, reason = self._pre_order_checks(order)
            if not ok:
                logger.warning(
                    "Pre-order check failed for %s: %s",
                    order.trading_symbol,
                    reason,
                )
                return []
            leg_orders.append(order)

        # Place each leg
        for order in leg_orders:
            oid = self.place_single_order(order)
            if oid:
                order_ids.append(oid)
            else:
                logger.error(
                    "Failed to place leg %s – cancelling already-placed legs",
                    order.trading_symbol,
                )
                for placed_id in order_ids:
                    self.cancel_order(placed_id)
                return []

        return order_ids

    def place_single_order(self, order: Order) -> str:
        """Place a single order with the broker.

        Returns the internal order_id on success, empty string on failure.
        """
        ok, reason = self._pre_order_checks(order)
        if not ok:
            logger.warning("Pre-order check failed: %s", reason)
            return ""

        if not order.order_id:
            order.order_id = self._generate_order_id()

        try:
            broker_id = self.broker.place_order(
                trading_symbol=order.trading_symbol,
                exchange=order.exchange,
                transaction_type=order.side.value,
                order_type=order.order_type.value,
                quantity=order.quantity,
                price=order.price,
                trigger_price=order.trigger_price,
                product=order.product.value,
                tag=order.tag,
            )
            order.broker_order_id = str(broker_id)
            order.status = OrderStatus.OPEN
            order.placed_at = datetime.now()
            order.updated_at = datetime.now()

            with self._lock:
                self._orders[order.order_id] = order

            logger.info(
                "Order placed: %s %s %s qty=%d @ %.2f [broker_id=%s]",
                order.side.value,
                order.trading_symbol,
                order.order_type.value,
                order.quantity,
                order.price,
                order.broker_order_id,
            )
            return order.order_id

        except Exception as exc:
            logger.error("Broker place_order failed: %s", exc)
            order.status = OrderStatus.REJECTED
            order.updated_at = datetime.now()
            with self._lock:
                self._orders[order.order_id] = order
            return ""

    def modify_order(self, order_id: str, new_price: float) -> bool:
        """Modify the price of an open order.  Returns True on success."""
        with self._lock:
            order = self._orders.get(order_id)
        if order is None:
            logger.warning("modify_order: unknown order_id %s", order_id)
            return False
        if order.status not in (OrderStatus.OPEN, OrderStatus.TRIGGER_PENDING):
            logger.warning(
                "modify_order: order %s is %s – cannot modify",
                order_id,
                order.status.value,
            )
            return False

        try:
            self.broker.modify_order(
                order_id=order.broker_order_id,
                price=new_price,
                order_type=order.order_type.value,
                quantity=order.quantity,
                trigger_price=order.trigger_price,
            )
            order.price = new_price
            order.updated_at = datetime.now()
            logger.info(
                "Order modified: %s new_price=%.2f", order_id, new_price
            )
            return True
        except Exception as exc:
            logger.error("modify_order failed for %s: %s", order_id, exc)
            return False

    def cancel_order(self, order_id: str) -> bool:
        """Cancel an open order.  Returns True on success."""
        with self._lock:
            order = self._orders.get(order_id)
        if order is None:
            logger.warning("cancel_order: unknown order_id %s", order_id)
            return False
        if order.status not in (
            OrderStatus.OPEN,
            OrderStatus.PENDING,
            OrderStatus.TRIGGER_PENDING,
        ):
            return False

        try:
            self.broker.cancel_order(order_id=order.broker_order_id)
            order.status = OrderStatus.CANCELLED
            order.updated_at = datetime.now()
            logger.info("Order cancelled: %s", order_id)
            return True
        except Exception as exc:
            logger.error("cancel_order failed for %s: %s", order_id, exc)
            return False

    def cancel_all_orders(self) -> int:
        """Cancel every open / pending order.  Returns the count cancelled."""
        cancelled = 0
        with self._lock:
            ids = list(self._orders.keys())
        for oid in ids:
            if self.cancel_order(oid):
                cancelled += 1
        return cancelled

    def get_pending_orders(self) -> list[Order]:
        """Return orders that are not yet filled or terminal."""
        with self._lock:
            return [
                o
                for o in self._orders.values()
                if o.status
                in (OrderStatus.PENDING, OrderStatus.OPEN, OrderStatus.TRIGGER_PENDING)
            ]

    def get_filled_orders(self) -> list[Order]:
        """Return all completed orders."""
        with self._lock:
            return [
                o for o in self._orders.values() if o.status == OrderStatus.COMPLETE
            ]

    def handle_partial_fill(self, order: Order) -> str:
        """Decide what to do with a partially-filled order.

        Returns one of ``"wait"``, ``"cancel_remaining"``, or
        ``"modify_to_market"``.
        """
        fill_ratio = order.filled_quantity / max(order.quantity, 1)

        if fill_ratio >= 0.8:
            # Nearly filled – convert remainder to market
            remaining = order.quantity - order.filled_quantity
            logger.info(
                "Partial fill %.0f%% for %s – converting %d remaining to MARKET",
                fill_ratio * 100,
                order.order_id,
                remaining,
            )
            try:
                self.broker.modify_order(
                    order_id=order.broker_order_id,
                    order_type="MARKET",
                    quantity=remaining,
                    price=0,
                    trigger_price=0,
                )
            except Exception as exc:
                logger.error("Failed to convert to market: %s", exc)
            return "modify_to_market"

        if fill_ratio < 0.2:
            # Barely filled – cancel and retry
            logger.info(
                "Partial fill %.0f%% for %s – cancelling remaining",
                fill_ratio * 100,
                order.order_id,
            )
            self.cancel_order(order.order_id)
            return "cancel_remaining"

        # In between – just wait
        return "wait"

    def retry_failed_order(self, order: Order, max_retries: int = 3) -> bool:
        """Re-attempt a failed/rejected order up to *max_retries* times."""
        for attempt in range(1, max_retries + 1):
            logger.info(
                "Retrying order %s attempt %d/%d",
                order.order_id,
                attempt,
                max_retries,
            )
            order.order_id = self._generate_order_id()
            order.status = OrderStatus.PENDING
            order.retries = attempt

            oid = self.place_single_order(order)
            if oid:
                return True

            # Exponential back-off capped at 5 s
            time.sleep(min(2 ** attempt, 5))

        logger.error(
            "Order %s exhausted %d retries", order.trading_symbol, max_retries
        )
        return False

    def sync_order_status(self) -> None:
        """Refresh status of all open orders from the broker."""
        with self._lock:
            open_orders = [
                o
                for o in self._orders.values()
                if o.status
                in (OrderStatus.OPEN, OrderStatus.PENDING, OrderStatus.TRIGGER_PENDING)
            ]

        for order in open_orders:
            try:
                status_info = self.broker.order_status(order.broker_order_id)
                new_status = status_info.get("status", order.status.value)
                order.status = OrderStatus(new_status)
                order.filled_quantity = status_info.get(
                    "filled_quantity", order.filled_quantity
                )
                order.average_price = status_info.get(
                    "average_price", order.average_price
                )
                order.updated_at = datetime.now()
            except Exception as exc:
                logger.error(
                    "Failed to sync status for %s: %s", order.order_id, exc
                )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _pre_order_checks(self, order: Order) -> tuple[bool, str]:
        """Validate an order before sending to the broker.

        Returns ``(True, "")`` when checks pass, else ``(False, reason)``.
        """
        if order.quantity <= 0:
            return False, "Quantity must be positive"

        if order.order_type == OrderType.LIMIT and order.price <= 0:
            return False, "Limit order requires a positive price"

        if not order.trading_symbol:
            return False, "Trading symbol is required"

        # Ask risk manager (if it exposes a pre-order hook)
        if hasattr(self.risk_manager, "pre_order_check"):
            try:
                result = self.risk_manager.pre_order_check(order)
                if not result.get("approved", True):
                    return False, result.get("reason", "Risk check failed")
            except Exception as exc:
                logger.error("Risk manager pre_order_check error: %s", exc)
                return False, f"Risk check error: {exc}"

        return True, ""

    @staticmethod
    def _generate_order_id() -> str:
        return f"OB-{uuid.uuid4().hex[:12].upper()}"

    @staticmethod
    def _position_to_order(position: Position, tag: str = "") -> Order:
        """Convert a ``Position`` (leg) into an ``Order``."""
        side = OrderSide.BUY if position.quantity > 0 else OrderSide.SELL
        return Order(
            trading_symbol=position.contract.trading_symbol,
            exchange=position.contract.exchange,
            side=side,
            order_type=OrderType.LIMIT,
            product=ProductType.NRML,
            quantity=abs(position.quantity) * position.contract.lot_size,
            price=position.entry_price,
            tag=tag,
        )

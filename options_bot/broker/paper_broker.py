"""Paper trading broker for strategy testing without real money.

Simulates realistic order execution including slippage, maintains a
virtual portfolio with margin tracking, and persists state to disk
so that a session can be resumed.

Usage::

    broker = PaperBroker(initial_capital=500_000)
    broker.connect()
    broker.place_order(order)   # fills at simulated price
    broker.get_positions()      # virtual portfolio
"""

from __future__ import annotations

import json
import logging
import os
import random
import uuid
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any, Callable, Optional

from options_bot.broker.base_broker import BaseBroker
from options_bot.core.exceptions import (
    BrokerConnectionError,
    InsufficientMarginError,
    OrderExecutionError,
)
from options_bot.core.models import (
    Greeks,
    OptionChain,
    OptionContract,
    OptionQuote,
    OptionType,
    Order,
    OrderSide,
    OrderStatus,
    OrderType,
    Position,
    ProductType,
)

logger = logging.getLogger(__name__)


@dataclass
class PaperOrder:
    """Internal order record for the paper broker."""
    broker_order_id: str
    trading_symbol: str
    side: str            # BUY / SELL
    quantity: int        # absolute, in units (lots * lot_size)
    lots: int
    lot_size: int
    order_type: str
    limit_price: float
    trigger_price: float
    product: str
    status: str          # PENDING, OPEN, COMPLETE, CANCELLED, REJECTED
    filled_quantity: int = 0
    average_price: float = 0.0
    placed_at: str = ""
    updated_at: str = ""
    tag: str = ""
    history: list[dict[str, Any]] = field(default_factory=list)

    def snapshot(self) -> dict[str, Any]:
        return {
            "broker_order_id": self.broker_order_id,
            "trading_symbol": self.trading_symbol,
            "side": self.side,
            "quantity": self.quantity,
            "lots": self.lots,
            "status": self.status,
            "filled_quantity": self.filled_quantity,
            "average_price": self.average_price,
            "timestamp": datetime.now().isoformat(),
        }


@dataclass
class PaperPosition:
    """Internal position record."""
    trading_symbol: str
    symbol: str
    strike: float
    option_type: str  # CE / PE
    expiry: str
    lot_size: int
    quantity: int    # in lots; positive = long, negative = short
    avg_price: float
    current_price: float = 0.0


class PaperBroker(BaseBroker):
    """Simulated broker for paper trading.

    Parameters
    ----------
    initial_capital : float
        Starting capital in INR.
    slippage_pct : float
        Simulated slippage as a fraction of price (e.g. 0.001 = 0.1%).
    state_file : str or Path
        Path to persist broker state between sessions.
    fill_probability : float
        Probability a limit order is filled immediately (0-1).
        Set to 1.0 for deterministic testing.
    """

    def __init__(
        self,
        initial_capital: float = 500_000.0,
        slippage_pct: float = 0.001,
        state_file: str | Path = "paper_broker_state.json",
        fill_probability: float = 0.95,
    ) -> None:
        self._initial_capital = initial_capital
        self._slippage_pct = slippage_pct
        self._state_file = Path(state_file)
        self._fill_probability = fill_probability

        # State
        self._capital: float = initial_capital
        self._used_margin: float = 0.0
        self._orders: dict[str, PaperOrder] = {}
        self._positions: dict[str, PaperPosition] = {}
        self._holdings: list[dict[str, Any]] = []
        self._ltp_cache: dict[str, float] = {}
        self._tick_callbacks: list[Callable] = []
        self._connected: bool = False
        self._trade_log: list[dict[str, Any]] = []

    # ------------------------------------------------------------------
    # Connection
    # ------------------------------------------------------------------

    def connect(self) -> None:
        self._connected = True
        self._load_state()
        logger.info(
            "Paper broker connected. Capital: INR %.0f", self._capital,
        )

    def disconnect(self) -> None:
        self._save_state()
        self._connected = False
        logger.info("Paper broker disconnected. State saved.")

    def is_connected(self) -> bool:
        return self._connected

    # ------------------------------------------------------------------
    # Orders
    # ------------------------------------------------------------------

    def place_order(self, order: Order) -> str:
        self._ensure_connected()

        broker_id = f"PAPER-{uuid.uuid4().hex[:12].upper()}"
        ts = order.contract.trading_symbol
        lot_size = order.contract.lot_size or 1
        abs_qty_units = abs(order.quantity) * lot_size

        paper = PaperOrder(
            broker_order_id=broker_id,
            trading_symbol=ts,
            side=order.side.value,
            quantity=abs_qty_units,
            lots=abs(order.quantity),
            lot_size=lot_size,
            order_type=order.order_type.value,
            limit_price=order.limit_price,
            trigger_price=order.trigger_price,
            product=order.product.value,
            status="PENDING",
            placed_at=datetime.now().isoformat(),
            tag=order.tag,
        )
        paper.history.append(paper.snapshot())

        # Determine fill price
        base_price = self._get_fill_base_price(order)
        if base_price <= 0:
            paper.status = "REJECTED"
            paper.history.append(paper.snapshot())
            self._orders[broker_id] = paper
            raise OrderExecutionError(
                f"No price available for {ts}; set LTP first via set_ltp()"
            )

        fill_price = self._apply_slippage(base_price, order.side)

        # Check margin for short positions
        if order.side == OrderSide.SELL:
            required = self._estimate_margin(order, fill_price)
            if required > (self._capital - self._used_margin):
                paper.status = "REJECTED"
                paper.history.append(paper.snapshot())
                self._orders[broker_id] = paper
                raise InsufficientMarginError(
                    f"Required margin INR {required:,.0f} exceeds "
                    f"available INR {self._capital - self._used_margin:,.0f}"
                )
            self._used_margin += required

        # For market orders or high fill-probability, fill immediately
        should_fill = (
            order.order_type == OrderType.MARKET
            or random.random() < self._fill_probability
        )

        if should_fill:
            paper.status = "COMPLETE"
            paper.filled_quantity = abs_qty_units
            paper.average_price = fill_price
            paper.updated_at = datetime.now().isoformat()
            paper.history.append(paper.snapshot())
            self._update_position(order, fill_price)
            # Debit premium for buys
            if order.side == OrderSide.BUY:
                cost = fill_price * abs_qty_units
                self._capital -= cost
            else:
                # Credit premium for sells
                credit = fill_price * abs_qty_units
                self._capital += credit
            logger.info(
                "Paper order filled: %s %s %d lots @ %.2f [%s]",
                order.side.value, ts, abs(order.quantity), fill_price, broker_id,
            )
        else:
            paper.status = "OPEN"
            paper.updated_at = datetime.now().isoformat()
            paper.history.append(paper.snapshot())
            logger.info("Paper order open (unfilled): %s", broker_id)

        self._orders[broker_id] = paper
        self._trade_log.append({
            "broker_order_id": broker_id,
            "symbol": ts,
            "side": order.side.value,
            "lots": abs(order.quantity),
            "price": fill_price,
            "status": paper.status,
            "timestamp": datetime.now().isoformat(),
        })
        return broker_id

    def modify_order(
        self,
        broker_order_id: str,
        new_price: Optional[float] = None,
        new_quantity: Optional[int] = None,
    ) -> None:
        self._ensure_connected()
        paper = self._orders.get(broker_order_id)
        if paper is None:
            raise OrderExecutionError(f"Order {broker_order_id} not found")
        if paper.status not in ("OPEN", "PENDING", "TRIGGER_PENDING"):
            raise OrderExecutionError(
                f"Cannot modify order in status {paper.status}"
            )
        if new_price is not None:
            paper.limit_price = new_price
        if new_quantity is not None:
            paper.quantity = new_quantity
        paper.updated_at = datetime.now().isoformat()
        paper.history.append(paper.snapshot())
        logger.info("Paper order %s modified", broker_order_id)

    def cancel_order(self, broker_order_id: str) -> None:
        self._ensure_connected()
        paper = self._orders.get(broker_order_id)
        if paper is None:
            raise OrderExecutionError(f"Order {broker_order_id} not found")
        if paper.status in ("COMPLETE", "CANCELLED", "REJECTED"):
            raise OrderExecutionError(
                f"Cannot cancel order in status {paper.status}"
            )
        paper.status = "CANCELLED"
        paper.updated_at = datetime.now().isoformat()
        paper.history.append(paper.snapshot())
        logger.info("Paper order %s cancelled", broker_order_id)

    def get_order_status(self, broker_order_id: str) -> OrderStatus:
        paper = self._orders.get(broker_order_id)
        if paper is None:
            return OrderStatus.PENDING
        status_map = {
            "PENDING": OrderStatus.PENDING,
            "OPEN": OrderStatus.OPEN,
            "COMPLETE": OrderStatus.COMPLETE,
            "CANCELLED": OrderStatus.CANCELLED,
            "REJECTED": OrderStatus.REJECTED,
            "TRIGGER_PENDING": OrderStatus.TRIGGER_PENDING,
        }
        return status_map.get(paper.status, OrderStatus.PENDING)

    def get_order_history(self, broker_order_id: str) -> list[dict[str, Any]]:
        paper = self._orders.get(broker_order_id)
        if paper is None:
            return []
        return list(paper.history)

    # ------------------------------------------------------------------
    # Portfolio
    # ------------------------------------------------------------------

    def get_positions(self) -> list[Position]:
        self._ensure_connected()
        positions: list[Position] = []
        for key, pp in self._positions.items():
            if pp.quantity == 0:
                continue
            contract = OptionContract(
                symbol=pp.symbol,
                strike=pp.strike,
                option_type=OptionType.CALL if pp.option_type == "CE" else OptionType.PUT,
                expiry=date.fromisoformat(pp.expiry) if pp.expiry else date.today(),
                lot_size=pp.lot_size,
                exchange="NSE",
            )
            ltp = self._ltp_cache.get(pp.trading_symbol, pp.current_price)
            positions.append(Position(
                contract=contract,
                quantity=pp.quantity,
                entry_price=pp.avg_price,
                current_price=ltp,
            ))
        return positions

    def get_holdings(self) -> list[dict[str, Any]]:
        return list(self._holdings)

    def get_margins(self) -> dict[str, float]:
        available = self._capital - self._used_margin
        return {
            "available": max(available, 0.0),
            "used": self._used_margin,
            "total": self._capital,
        }

    # ------------------------------------------------------------------
    # Market data
    # ------------------------------------------------------------------

    def set_ltp(self, symbol: str, price: float) -> None:
        """Manually set the last traded price for a symbol (test helper)."""
        self._ltp_cache[symbol] = price

    def get_ltp(self, symbol: str) -> float:
        return self._ltp_cache.get(symbol, 0.0)

    def get_option_chain(
        self, symbol: str, expiry: Any = None,
    ) -> OptionChain:
        """Return a minimal option chain from cached prices.

        For richer chains, populate via ``set_ltp`` or feed data in.
        """
        calls: list[OptionQuote] = []
        puts: list[OptionQuote] = []
        strikes: set[float] = set()
        underlying = self._ltp_cache.get(symbol, 0.0)

        for pp in self._positions.values():
            if pp.symbol != symbol:
                continue
            if expiry is not None and pp.expiry != str(expiry):
                continue
            strikes.add(pp.strike)
            ltp = self._ltp_cache.get(pp.trading_symbol, pp.current_price)
            try:
                exp_date = date.fromisoformat(pp.expiry) if pp.expiry else date.today()
            except ValueError:
                exp_date = date.today()
            quote = OptionQuote(
                strike=pp.strike,
                option_type=OptionType.CALL if pp.option_type == "CE" else OptionType.PUT,
                expiry=exp_date,
                last_price=ltp,
                bid=ltp * 0.99, ask=ltp * 1.01,
                bid_qty=100, ask_qty=100,
                volume=0, oi=0, change_in_oi=0,
                iv=0.0,
                underlying_value=underlying,
            )
            if pp.option_type == "CE":
                calls.append(quote)
            else:
                puts.append(quote)

        return OptionChain(
            symbol=symbol,
            underlying_value=underlying,
            expiry=expiry or date.today(),
            timestamp=datetime.now(),
            calls=sorted(calls, key=lambda q: q.strike),
            puts=sorted(puts, key=lambda q: q.strike),
            strikes=sorted(strikes),
        )

    def subscribe_ticks(
        self,
        symbols: list[str],
        callback: Callable[[dict[str, Any]], None],
    ) -> None:
        """Register a tick callback (will be invoked when feed_tick is called)."""
        self._tick_callbacks.append(callback)
        logger.info("Paper broker: subscribed %d symbols", len(symbols))

    def feed_tick(self, symbol: str, price: float) -> None:
        """Inject a simulated tick (test helper).

        Updates the LTP cache and notifies all subscribed callbacks.
        """
        self._ltp_cache[symbol] = price
        tick = {
            "tradingsymbol": symbol,
            "last_price": price,
            "timestamp": datetime.now().isoformat(),
        }
        for cb in self._tick_callbacks:
            try:
                cb(tick)
            except Exception as exc:
                logger.error("Tick callback error: %s", exc)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _ensure_connected(self) -> None:
        if not self._connected:
            raise BrokerConnectionError("Paper broker not connected")

    def _get_fill_base_price(self, order: Order) -> float:
        """Determine the base price for filling an order."""
        ts = order.contract.trading_symbol
        if order.order_type == OrderType.LIMIT:
            return order.limit_price
        if order.order_type in (OrderType.SL, OrderType.SL_M):
            return order.trigger_price if order.trigger_price > 0 else order.limit_price
        # Market order - use cached LTP
        return self._ltp_cache.get(ts, 0.0)

    def _apply_slippage(self, price: float, side: OrderSide) -> float:
        """Add realistic slippage to a fill price."""
        slip = price * self._slippage_pct * random.uniform(0.5, 1.5)
        if side == OrderSide.BUY:
            return round(price + slip, 2)  # buy higher
        return round(price - slip, 2)      # sell lower

    def _estimate_margin(self, order: Order, fill_price: float) -> float:
        """Rough margin estimate for short option positions."""
        lot_size = order.contract.lot_size or 1
        abs_qty = abs(order.quantity)
        # Use ~12% of notional as a rough SPAN approximation
        spot = self._ltp_cache.get(order.contract.symbol, 0.0)
        if spot <= 0:
            spot = order.contract.strike  # fallback
        notional = spot * lot_size * abs_qty
        return notional * 0.12

    def _update_position(self, order: Order, fill_price: float) -> None:
        """Update the virtual position book after a fill."""
        ts = order.contract.trading_symbol
        lot_size = order.contract.lot_size or 1
        lots = abs(order.quantity)
        signed_lots = lots if order.side == OrderSide.BUY else -lots

        if ts in self._positions:
            pp = self._positions[ts]
            old_qty = pp.quantity
            new_qty = old_qty + signed_lots

            if new_qty == 0:
                # Position closed
                pp.quantity = 0
                pp.avg_price = 0.0
            elif (old_qty > 0 and signed_lots > 0) or (old_qty < 0 and signed_lots < 0):
                # Adding to same direction - weighted average
                total = abs(old_qty) + abs(signed_lots)
                pp.avg_price = (
                    pp.avg_price * abs(old_qty) + fill_price * abs(signed_lots)
                ) / total
                pp.quantity = new_qty
            else:
                # Partial close or reversal
                pp.quantity = new_qty
                if (old_qty > 0 and new_qty < 0) or (old_qty < 0 and new_qty > 0):
                    # Reversal: new avg is fill price for the new direction
                    pp.avg_price = fill_price

            pp.current_price = fill_price
        else:
            self._positions[ts] = PaperPosition(
                trading_symbol=ts,
                symbol=order.contract.symbol,
                strike=order.contract.strike,
                option_type=order.contract.option_type.value,
                expiry=str(order.contract.expiry),
                lot_size=lot_size,
                quantity=signed_lots,
                avg_price=fill_price,
                current_price=fill_price,
            )

    # ------------------------------------------------------------------
    # State persistence
    # ------------------------------------------------------------------

    def _save_state(self) -> None:
        """Persist broker state to a JSON file."""
        state = {
            "capital": self._capital,
            "used_margin": self._used_margin,
            "initial_capital": self._initial_capital,
            "positions": {
                k: {
                    "trading_symbol": v.trading_symbol,
                    "symbol": v.symbol,
                    "strike": v.strike,
                    "option_type": v.option_type,
                    "expiry": v.expiry,
                    "lot_size": v.lot_size,
                    "quantity": v.quantity,
                    "avg_price": v.avg_price,
                    "current_price": v.current_price,
                }
                for k, v in self._positions.items()
                if v.quantity != 0
            },
            "orders": {
                k: {
                    "broker_order_id": v.broker_order_id,
                    "trading_symbol": v.trading_symbol,
                    "side": v.side,
                    "quantity": v.quantity,
                    "lots": v.lots,
                    "lot_size": v.lot_size,
                    "order_type": v.order_type,
                    "limit_price": v.limit_price,
                    "trigger_price": v.trigger_price,
                    "product": v.product,
                    "status": v.status,
                    "filled_quantity": v.filled_quantity,
                    "average_price": v.average_price,
                    "placed_at": v.placed_at,
                    "updated_at": v.updated_at,
                    "tag": v.tag,
                }
                for k, v in self._orders.items()
            },
            "ltp_cache": self._ltp_cache,
            "trade_log": self._trade_log[-500:],  # keep last 500
            "saved_at": datetime.now().isoformat(),
        }
        try:
            self._state_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self._state_file, "w") as f:
                json.dump(state, f, indent=2)
            logger.info("Paper broker state saved to %s", self._state_file)
        except Exception as exc:
            logger.error("Failed to save state: %s", exc)

    def _load_state(self) -> None:
        """Restore broker state from a previously saved JSON file."""
        if not self._state_file.exists():
            logger.info("No previous state file; starting fresh")
            return
        try:
            with open(self._state_file) as f:
                state = json.load(f)

            self._capital = state.get("capital", self._initial_capital)
            self._used_margin = state.get("used_margin", 0.0)
            self._ltp_cache = state.get("ltp_cache", {})
            self._trade_log = state.get("trade_log", [])

            # Restore positions
            for k, v in state.get("positions", {}).items():
                self._positions[k] = PaperPosition(**v)

            # Restore orders
            for k, v in state.get("orders", {}).items():
                self._orders[k] = PaperOrder(**v)

            logger.info(
                "Restored paper state: capital=%.0f, %d positions, %d orders",
                self._capital, len(self._positions), len(self._orders),
            )
        except Exception as exc:
            logger.warning("Failed to load state, starting fresh: %s", exc)

    # ------------------------------------------------------------------
    # Reporting helpers
    # ------------------------------------------------------------------

    def get_trade_log(self) -> list[dict[str, Any]]:
        """Return the full trade log."""
        return list(self._trade_log)

    def get_pnl_summary(self) -> dict[str, float]:
        """Quick P&L summary."""
        realised = self._capital - self._initial_capital
        unrealised = 0.0
        for pp in self._positions.values():
            if pp.quantity == 0:
                continue
            ltp = self._ltp_cache.get(pp.trading_symbol, pp.current_price)
            unrealised += (ltp - pp.avg_price) * pp.quantity * pp.lot_size
        return {
            "initial_capital": self._initial_capital,
            "current_capital": self._capital,
            "realised_pnl": round(realised, 2),
            "unrealised_pnl": round(unrealised, 2),
            "total_pnl": round(realised + unrealised, 2),
            "used_margin": self._used_margin,
        }

    def reset(self) -> None:
        """Reset the paper broker to initial state."""
        self._capital = self._initial_capital
        self._used_margin = 0.0
        self._orders.clear()
        self._positions.clear()
        self._holdings.clear()
        self._ltp_cache.clear()
        self._trade_log.clear()
        if self._state_file.exists():
            self._state_file.unlink()
        logger.info("Paper broker reset to initial state")

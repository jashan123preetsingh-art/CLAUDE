"""Live trading engine for the Indian options trading bot.

Orchestrates the full intraday lifecycle: pre-market setup, signal
generation, order execution, position monitoring, and post-market
reconciliation.  Designed to run in its own thread with graceful
shutdown on SIGINT / SIGTERM.
"""

from __future__ import annotations

import logging
import signal
import threading
import time
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional

from options_bot.core.exceptions import BrokerError, MarketClosedError
from options_bot.core.models import (
    Greeks,
    OptionChain,
    OrderStatus,
    StrategyPosition,
)
from options_bot.trading.order_manager import OrderManager
from options_bot.trading.portfolio import Portfolio

logger = logging.getLogger(__name__)


class EngineState(Enum):
    IDLE = "idle"
    PRE_MARKET = "pre_market"
    RUNNING = "running"
    POST_MARKET = "post_market"
    STOPPED = "stopped"
    EMERGENCY = "emergency"


# Indian market hours (IST)
_MARKET_OPEN_HOUR = 9
_MARKET_OPEN_MINUTE = 15
_MARKET_CLOSE_HOUR = 15
_MARKET_CLOSE_MINUTE = 30


def _ist_now() -> datetime:
    """Return current IST time (UTC+5:30)."""
    from datetime import timezone, timedelta as _td

    ist = timezone(_td(hours=5, minutes=30))
    return datetime.now(ist).replace(tzinfo=None)


def _market_open_time(now: datetime) -> datetime:
    return now.replace(
        hour=_MARKET_OPEN_HOUR, minute=_MARKET_OPEN_MINUTE, second=0, microsecond=0
    )


def _market_close_time(now: datetime) -> datetime:
    return now.replace(
        hour=_MARKET_CLOSE_HOUR, minute=_MARKET_CLOSE_MINUTE, second=0, microsecond=0
    )


class LiveTradingEngine:
    """Main live-trading orchestrator.

    Parameters
    ----------
    config : dict
        Bot configuration (symbol, lot_size, capital, mode, etc.).
    broker
        Broker gateway instance.
    strategy_manager
        Object with ``get_active_strategies()`` returning a list of
        strategy objects that conform to ``BaseStrategy``.
    risk_manager
        Risk manager instance.
    signal_aggregator
        Signal aggregator that exposes ``generate(market_data, option_chain)``.
    """

    def __init__(
        self,
        config: dict[str, Any],
        broker: Any,
        strategy_manager: Any,
        risk_manager: Any,
        signal_aggregator: Any,
    ) -> None:
        self.config = config
        self.broker = broker
        self.strategy_manager = strategy_manager
        self.risk_manager = risk_manager
        self.signal_aggregator = signal_aggregator

        self.order_manager = OrderManager(broker, risk_manager)
        self.portfolio = Portfolio(
            initial_capital=config.get("capital", 500_000.0)
        )

        self._state = EngineState.IDLE
        self._state_lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._start_time: Optional[datetime] = None
        self._last_tick: Optional[datetime] = None
        self._error_log: list[dict] = []

        # Configurable knobs
        self._symbol: str = config.get("symbol", "NIFTY")
        self._loop_interval: float = config.get("loop_interval_sec", 5.0)
        self._auto_square_off_minutes: int = config.get(
            "auto_square_off_minutes", 5
        )
        self._mode: str = config.get("mode", "paper")  # "paper" or "live"
        self._max_positions: int = config.get("max_positions", 5)

        # Signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Start the trading engine in a background thread."""
        if self._state not in (EngineState.IDLE, EngineState.STOPPED):
            logger.warning("Engine already running (state=%s)", self._state.value)
            return

        self._stop_event.clear()
        self._start_time = datetime.now()

        self._thread = threading.Thread(
            target=self._run, name="LiveEngine", daemon=True
        )
        self._thread.start()
        logger.info("Live trading engine started (mode=%s)", self._mode)

    def stop(self) -> None:
        """Signal the engine to stop gracefully."""
        logger.info("Stop requested – shutting down engine")
        self._stop_event.set()

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=30)

        with self._state_lock:
            self._state = EngineState.STOPPED
        logger.info("Engine stopped")

    # ------------------------------------------------------------------
    # Main run loop
    # ------------------------------------------------------------------

    def _run(self) -> None:
        """Entry point for the engine thread."""
        try:
            self._pre_market_routine()

            # Wait for market open
            now = _ist_now()
            market_open = _market_open_time(now)
            if now < market_open:
                wait_sec = (market_open - now).total_seconds()
                logger.info("Waiting %.0f s for market open", wait_sec)
                if self._stop_event.wait(timeout=wait_sec):
                    return

            with self._state_lock:
                self._state = EngineState.RUNNING

            self._trading_loop()

        except Exception as exc:
            logger.exception("Unhandled exception in engine thread")
            self._handle_emergency(exc)
        finally:
            try:
                self._post_market_routine()
            except Exception:
                logger.exception("Error in post-market routine")
            with self._state_lock:
                self._state = EngineState.STOPPED

    def _pre_market_routine(self) -> None:
        """Load data, reconcile positions, prepare for the day."""
        with self._state_lock:
            self._state = EngineState.PRE_MARKET

        logger.info("=== PRE-MARKET ROUTINE ===")

        # Sync any overnight positions from the broker
        try:
            broker_positions = self.broker.get_positions() if hasattr(self.broker, "get_positions") else []
            logger.info("Broker reports %d existing positions", len(broker_positions))
        except Exception as exc:
            logger.error("Could not fetch broker positions: %s", exc)

        # Sync pending order statuses
        self.order_manager.sync_order_status()
        logger.info("Pre-market routine complete")

    def _trading_loop(self) -> None:
        """Core loop that runs while the market is open."""
        logger.info("=== ENTERING TRADING LOOP ===")

        while not self._stop_event.is_set():
            now = _ist_now()
            market_close = _market_close_time(now)

            # Check if market is closed
            if now >= market_close:
                logger.info("Market closed – exiting trading loop")
                break

            # Auto square-off near close
            minutes_to_close = (market_close - now).total_seconds() / 60.0
            if minutes_to_close <= self._auto_square_off_minutes:
                self._auto_square_off(self._auto_square_off_minutes)
                break

            try:
                self._tick()
            except Exception as exc:
                logger.exception("Error in tick")
                self._error_log.append(
                    {"time": datetime.now().isoformat(), "error": str(exc)}
                )
                # If too many errors in a row, trigger emergency
                recent_errors = [
                    e
                    for e in self._error_log
                    if datetime.fromisoformat(e["time"])
                    > datetime.now() - timedelta(minutes=5)
                ]
                if len(recent_errors) >= 10:
                    self._handle_emergency(
                        RuntimeError("Too many consecutive errors")
                    )
                    return

            self._stop_event.wait(timeout=self._loop_interval)

    def _tick(self) -> None:
        """Single iteration of the trading loop."""
        self._last_tick = datetime.now()

        # 1. Fetch market data and option chain
        market_data = self.broker.get_market_data(self._symbol)
        option_chain = self.broker.get_option_chain(self._symbol)

        # 2. Update portfolio prices
        self.portfolio.update_prices(market_data)

        # 3. Sync order statuses
        self.order_manager.sync_order_status()

        # 4. Generate signals
        signals = self.signal_aggregator.generate(market_data, option_chain)

        # 5. Check existing positions for exits / adjustments
        self._monitor_positions(market_data, option_chain)

        # 6. Look for new entries (if capacity allows)
        if self.portfolio.position_count() < self._max_positions:
            self._scan_for_entries(option_chain, market_data, signals)

    def _scan_for_entries(
        self, option_chain: Any, market_data: Any, signals: list
    ) -> None:
        """Ask each active strategy to scan for setups and enter if approved."""
        strategies = self.strategy_manager.get_active_strategies()

        for strategy in strategies:
            try:
                setups = strategy.scan(option_chain, market_data, signals)
                if not setups:
                    continue

                for setup in setups:
                    position = strategy.construct(option_chain, setup)

                    # Risk gate
                    risk_check = (
                        self.risk_manager.check_position(position)
                        if hasattr(self.risk_manager, "check_position")
                        else {"approved": True}
                    )
                    if not strategy.should_enter(signals, risk_check):
                        continue

                    # Place orders
                    order_ids = self.order_manager.place_strategy_order(position)
                    if order_ids:
                        position.status = "active"
                        position.entry_time = datetime.now()
                        self.portfolio.add_position(position)
                        logger.info(
                            "Entered %s with %d legs",
                            strategy.name,
                            len(position.legs),
                        )
                        # Only one entry per strategy per tick
                        break

            except Exception as exc:
                logger.error("Error scanning %s: %s", strategy.name, exc)

    def _monitor_positions(self, market_data: Any, option_chain: Any) -> None:
        """Check every open position for exit or adjustment signals."""
        strategies = self.strategy_manager.get_active_strategies()
        strategy_map = {s.strategy_type: s for s in strategies}

        for position in self.portfolio.get_open_positions():
            strategy = strategy_map.get(position.strategy_type)
            if strategy is None:
                continue

            try:
                should_exit, reason = strategy.should_exit(position, market_data)
                if should_exit:
                    self._close_position(position, reason)
                    continue

                adjustments = strategy.adjust(position, market_data)
                for adj in adjustments:
                    logger.info(
                        "Adjustment for %s: %s", position.tag, adj.get("action")
                    )
                    # Adjustments handled via order_manager in future expansion
            except Exception as exc:
                logger.error(
                    "Error monitoring position %s: %s", position.tag, exc
                )

    def _close_position(self, position: StrategyPosition, reason: str) -> None:
        """Close all legs of a position."""
        logger.info("Closing position %s – reason: %s", position.tag, reason)
        from options_bot.core.models import OrderSide, Position as Pos

        for leg in position.legs:
            close_side = (
                OrderSide.SELL if leg.quantity > 0 else OrderSide.BUY
            )
            from options_bot.trading.order_manager import Order

            order = Order(
                trading_symbol=leg.contract.trading_symbol,
                exchange=leg.contract.exchange,
                side=close_side,
                order_type=_market_order_type(),
                quantity=abs(leg.quantity) * leg.contract.lot_size,
                price=0,
                tag=f"close-{position.tag}",
            )
            self.order_manager.place_single_order(order)

        position.status = "closed"
        self.portfolio.remove_position(id(position))

    def _auto_square_off(self, minutes_before_close: int = 5) -> None:
        """Square off all open positions near market close."""
        logger.info(
            "Auto square-off triggered (%d min before close)",
            minutes_before_close,
        )
        self.order_manager.cancel_all_orders()

        for position in self.portfolio.get_open_positions():
            self._close_position(position, "auto_square_off")

    def _post_market_routine(self) -> None:
        """End-of-day reconciliation and logging."""
        with self._state_lock:
            self._state = EngineState.POST_MARKET

        logger.info("=== POST-MARKET ROUTINE ===")

        # Sync final order statuses
        self.order_manager.sync_order_status()

        # Log summary
        pnl = self.portfolio.daily_pnl()
        total = self.portfolio.total_pnl()
        filled = self.order_manager.get_filled_orders()
        logger.info(
            "Day summary: daily_pnl=%.2f  total_pnl=%.2f  orders_filled=%d",
            pnl,
            total,
            len(filled),
        )

    def _handle_emergency(self, error: Exception) -> None:
        """Enter emergency mode – cancel orders, optionally close positions."""
        with self._state_lock:
            self._state = EngineState.EMERGENCY

        logger.critical("EMERGENCY: %s", error)

        # Cancel all pending orders
        cancelled = self.order_manager.cancel_all_orders()
        logger.info("Emergency: cancelled %d orders", cancelled)

        # Close open positions if configured
        if self.config.get("emergency_close_positions", True):
            for pos in self.portfolio.get_open_positions():
                try:
                    self._close_position(pos, "emergency")
                except Exception:
                    logger.exception("Failed to close position during emergency")

        self._stop_event.set()

    def _signal_handler(self, signum: int, frame: Any) -> None:
        """Handle SIGINT / SIGTERM for graceful shutdown."""
        logger.info("Received signal %d – initiating shutdown", signum)
        self.stop()

    # ------------------------------------------------------------------
    # Status / Queries
    # ------------------------------------------------------------------

    def get_status(self) -> dict[str, Any]:
        """Return a snapshot of the engine status."""
        with self._state_lock:
            state = self._state.value

        uptime = (
            (datetime.now() - self._start_time).total_seconds()
            if self._start_time
            else 0
        )

        return {
            "state": state,
            "mode": self._mode,
            "symbol": self._symbol,
            "uptime_seconds": uptime,
            "start_time": (
                self._start_time.isoformat() if self._start_time else None
            ),
            "last_tick": (
                self._last_tick.isoformat() if self._last_tick else None
            ),
            "open_positions": self.portfolio.position_count(),
            "pending_orders": len(self.order_manager.get_pending_orders()),
            "errors_last_5m": len(
                [
                    e
                    for e in self._error_log
                    if datetime.fromisoformat(e["time"])
                    > datetime.now() - timedelta(minutes=5)
                ]
            ),
        }

    def get_live_pnl(self) -> dict[str, Any]:
        """Return real-time P&L information."""
        return {
            "total_pnl": self.portfolio.total_pnl(),
            "daily_pnl": self.portfolio.daily_pnl(),
            "margin_used": self.portfolio.margin_used(),
            "available_capital": self.portfolio.available_capital(),
            "open_positions": self.portfolio.position_count(),
            "portfolio_greeks": {
                "delta": self.portfolio.portfolio_greeks().delta,
                "gamma": self.portfolio.portfolio_greeks().gamma,
                "theta": self.portfolio.portfolio_greeks().theta,
                "vega": self.portfolio.portfolio_greeks().vega,
            },
            "timestamp": datetime.now().isoformat(),
        }


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _market_order_type():
    """Return MARKET OrderType for square-off orders."""
    from options_bot.core.models import OrderType

    return OrderType.MARKET

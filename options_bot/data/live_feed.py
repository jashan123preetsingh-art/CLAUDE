"""Live market data feed with WebSocket support."""

import time
import logging
import threading
from abc import ABC, abstractmethod
from typing import Callable, Optional

from options_bot.core.logger import get_logger

logger = get_logger(__name__)


class LiveFeed(ABC):
    """Abstract base class for live market data feeds."""

    @abstractmethod
    def connect(self):
        """Connect to the data feed."""
        ...

    @abstractmethod
    def disconnect(self):
        """Disconnect from the data feed."""
        ...

    @abstractmethod
    def subscribe(self, symbols: list[str]):
        """Subscribe to symbols for live data."""
        ...

    @abstractmethod
    def unsubscribe(self, symbols: list[str]):
        """Unsubscribe from symbols."""
        ...

    @abstractmethod
    def on_tick(self, callback: Callable):
        """Register tick data callback."""
        ...

    @abstractmethod
    def on_order_update(self, callback: Callable):
        """Register order update callback."""
        ...

    @abstractmethod
    def is_connected(self) -> bool:
        """Check if feed is connected."""
        ...


class WebSocketFeed(LiveFeed):
    """WebSocket-based live data feed for Indian broker APIs.

    Supports Zerodha KiteTicker, Angel One WebSocket, etc.
    Falls back to polling when WebSocket is unavailable.
    """

    def __init__(self, broker_ws=None, reconnect_interval: int = 5,
                 max_reconnects: int = 50):
        self._broker_ws = broker_ws
        self._reconnect_interval = reconnect_interval
        self._max_reconnects = max_reconnects
        self._connected = False
        self._subscribed_symbols: set[str] = set()
        self._tick_callbacks: list[Callable] = []
        self._order_callbacks: list[Callable] = []
        self._reconnect_count = 0
        self._lock = threading.Lock()
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._running = False
        self._last_tick_time: float = 0

    def connect(self):
        """Connect to the WebSocket feed."""
        try:
            if self._broker_ws:
                self._broker_ws.on_ticks = self._handle_ticks
                self._broker_ws.on_connect = self._on_connect
                self._broker_ws.on_close = self._on_close
                self._broker_ws.on_error = self._on_error
                self._broker_ws.on_order_update = self._handle_order_update
                self._broker_ws.connect(threaded=True)

            self._connected = True
            self._running = True
            self._reconnect_count = 0

            # Start heartbeat monitor
            self._heartbeat_thread = threading.Thread(
                target=self._heartbeat_monitor, daemon=True
            )
            self._heartbeat_thread.start()

            logger.info("Live feed connected")

        except Exception as e:
            logger.error(f"Failed to connect live feed: {e}")
            self._attempt_reconnect()

    def disconnect(self):
        """Disconnect from the WebSocket feed."""
        self._running = False
        self._connected = False

        if self._broker_ws:
            try:
                self._broker_ws.close()
            except Exception:
                pass

        logger.info("Live feed disconnected")

    def subscribe(self, symbols: list[str]):
        """Subscribe to symbols for live data."""
        with self._lock:
            new_symbols = set(symbols) - self._subscribed_symbols
            if not new_symbols:
                return

            self._subscribed_symbols.update(new_symbols)

            if self._broker_ws and self._connected:
                try:
                    tokens = list(new_symbols)
                    self._broker_ws.subscribe(tokens)
                    self._broker_ws.set_mode(
                        self._broker_ws.MODE_FULL, tokens
                    )
                    logger.info(
                        f"Subscribed to {len(new_symbols)} symbols")
                except Exception as e:
                    logger.error(f"Subscribe failed: {e}")

    def unsubscribe(self, symbols: list[str]):
        """Unsubscribe from symbols."""
        with self._lock:
            remove_symbols = set(symbols) & self._subscribed_symbols
            if not remove_symbols:
                return

            self._subscribed_symbols -= remove_symbols

            if self._broker_ws and self._connected:
                try:
                    self._broker_ws.unsubscribe(list(remove_symbols))
                    logger.info(
                        f"Unsubscribed from {len(remove_symbols)} symbols")
                except Exception as e:
                    logger.error(f"Unsubscribe failed: {e}")

    def on_tick(self, callback: Callable):
        """Register tick callback. callback(ticks: list[dict])"""
        self._tick_callbacks.append(callback)

    def on_order_update(self, callback: Callable):
        """Register order update callback. callback(order: dict)"""
        self._order_callbacks.append(callback)

    def is_connected(self) -> bool:
        """Check if feed is connected."""
        return self._connected

    def _handle_ticks(self, ws, ticks):
        """Process incoming tick data."""
        self._last_tick_time = time.time()
        for callback in self._tick_callbacks:
            try:
                callback(ticks)
            except Exception as e:
                logger.error(f"Tick callback error: {e}")

    def _handle_order_update(self, ws, data):
        """Process order update."""
        for callback in self._order_callbacks:
            try:
                callback(data)
            except Exception as e:
                logger.error(f"Order callback error: {e}")

    def _on_connect(self, ws, response):
        """Handle successful connection."""
        self._connected = True
        self._reconnect_count = 0
        logger.info("WebSocket connected")

        # Re-subscribe to symbols
        if self._subscribed_symbols:
            tokens = list(self._subscribed_symbols)
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_FULL, tokens)

    def _on_close(self, ws, code, reason):
        """Handle connection close."""
        self._connected = False
        logger.warning(f"WebSocket closed: {code} - {reason}")
        if self._running:
            self._attempt_reconnect()

    def _on_error(self, ws, code, reason):
        """Handle connection error."""
        logger.error(f"WebSocket error: {code} - {reason}")

    def _attempt_reconnect(self):
        """Attempt to reconnect with exponential backoff."""
        if not self._running:
            return

        if self._reconnect_count >= self._max_reconnects:
            logger.critical(
                f"Max reconnect attempts ({self._max_reconnects}) reached. "
                "Stopping feed."
            )
            self._running = False
            return

        self._reconnect_count += 1
        wait_time = min(
            self._reconnect_interval * (2 ** (self._reconnect_count - 1)),
            60  # Max 60 seconds
        )

        logger.info(
            f"Reconnecting in {wait_time}s "
            f"(attempt {self._reconnect_count}/{self._max_reconnects})"
        )
        time.sleep(wait_time)

        try:
            self.connect()
        except Exception as e:
            logger.error(f"Reconnect failed: {e}")
            self._attempt_reconnect()

    def _heartbeat_monitor(self):
        """Monitor connection health via heartbeat."""
        while self._running:
            time.sleep(30)  # Check every 30 seconds

            if not self._connected:
                continue

            # If no tick received in 60 seconds during market hours,
            # connection might be stale
            if (self._last_tick_time > 0 and
                    time.time() - self._last_tick_time > 60):
                logger.warning(
                    "No ticks received for 60s, connection may be stale"
                )

    @property
    def subscribed_count(self) -> int:
        """Number of subscribed symbols."""
        return len(self._subscribed_symbols)


class PollingFeed(LiveFeed):
    """Polling-based feed that periodically fetches data from NSE.

    Useful when WebSocket is not available (e.g., without broker API).
    """

    def __init__(self, fetcher, interval: float = 3.0):
        self._fetcher = fetcher
        self._interval = interval
        self._running = False
        self._connected = False
        self._subscribed_symbols: set[str] = set()
        self._tick_callbacks: list[Callable] = []
        self._order_callbacks: list[Callable] = []
        self._poll_thread: Optional[threading.Thread] = None

    def connect(self):
        self._connected = True
        self._running = True
        self._poll_thread = threading.Thread(
            target=self._poll_loop, daemon=True
        )
        self._poll_thread.start()
        logger.info(f"Polling feed started (interval: {self._interval}s)")

    def disconnect(self):
        self._running = False
        self._connected = False
        logger.info("Polling feed stopped")

    def subscribe(self, symbols: list[str]):
        self._subscribed_symbols.update(symbols)

    def unsubscribe(self, symbols: list[str]):
        self._subscribed_symbols -= set(symbols)

    def on_tick(self, callback: Callable):
        self._tick_callbacks.append(callback)

    def on_order_update(self, callback: Callable):
        self._order_callbacks.append(callback)

    def is_connected(self) -> bool:
        return self._connected

    def _poll_loop(self):
        """Main polling loop."""
        while self._running:
            for symbol in list(self._subscribed_symbols):
                try:
                    quote = self._fetcher.get_indices_quote(symbol)
                    if quote:
                        tick = {
                            "symbol": symbol,
                            "ltp": quote.ltp,
                            "high": quote.high,
                            "low": quote.low,
                            "volume": quote.volume,
                            "timestamp": quote.timestamp,
                        }
                        for callback in self._tick_callbacks:
                            try:
                                callback([tick])
                            except Exception as e:
                                logger.error(
                                    f"Tick callback error: {e}")
                except Exception as e:
                    logger.error(f"Poll error for {symbol}: {e}")

            time.sleep(self._interval)

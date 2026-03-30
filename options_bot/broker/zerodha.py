"""Zerodha Kite Connect broker integration.

Wraps the ``kiteconnect`` Python SDK to implement the ``BaseBroker``
interface.  Requires ``pip install kiteconnect``.

Typical usage::

    broker = ZerodhaBroker(api_key="xxx", access_token="yyy")
    broker.connect()
    broker.place_order(order)
"""

from __future__ import annotations

import logging
import time
from datetime import date, datetime
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

# Mapping from internal enums to Kite constants
_ORDER_TYPE_MAP = {
    OrderType.MARKET: "MARKET",
    OrderType.LIMIT: "LIMIT",
    OrderType.SL: "SL",
    OrderType.SL_M: "SL-M",
}

_SIDE_MAP = {
    OrderSide.BUY: "BUY",
    OrderSide.SELL: "SELL",
}

_PRODUCT_MAP = {
    ProductType.NRML: "NRML",
    ProductType.MIS: "MIS",
    ProductType.CNC: "CNC",
}

_STATUS_MAP = {
    "COMPLETE": OrderStatus.COMPLETE,
    "REJECTED": OrderStatus.REJECTED,
    "CANCELLED": OrderStatus.CANCELLED,
    "OPEN": OrderStatus.OPEN,
    "TRIGGER PENDING": OrderStatus.TRIGGER_PENDING,
    "PENDING": OrderStatus.PENDING,
}


class ZerodhaBroker(BaseBroker):
    """Zerodha Kite Connect implementation of ``BaseBroker``.

    Parameters
    ----------
    api_key : str
        Kite Connect API key.
    access_token : str
        Session access token obtained after the login flow.
    api_secret : str, optional
        API secret (needed only for token generation).
    max_retries : int
        Number of retries for transient errors.
    retry_delay : float
        Seconds between retries.
    """

    EXCHANGE = "NFO"

    def __init__(
        self,
        api_key: str,
        access_token: str,
        api_secret: str = "",
        max_retries: int = 3,
        retry_delay: float = 0.5,
    ) -> None:
        self._api_key = api_key
        self._access_token = access_token
        self._api_secret = api_secret
        self._max_retries = max_retries
        self._retry_delay = retry_delay

        self._kite: Any = None           # KiteConnect instance
        self._ticker: Any = None         # KiteTicker instance
        self._instruments: dict[str, dict] = {}
        self._connected = False

    # ------------------------------------------------------------------
    # Connection
    # ------------------------------------------------------------------

    def connect(self) -> None:
        try:
            from kiteconnect import KiteConnect
        except ImportError as exc:
            raise BrokerConnectionError(
                "kiteconnect package not installed. "
                "Run: pip install kiteconnect"
            ) from exc

        try:
            self._kite = KiteConnect(api_key=self._api_key)
            self._kite.set_access_token(self._access_token)
            # Validate the session by fetching profile
            profile = self._kite.profile()
            logger.info(
                "Connected to Zerodha as %s", profile.get("user_name", "")
            )
            self._connected = True
            self._load_instruments()
        except Exception as exc:
            self._connected = False
            raise BrokerConnectionError(
                f"Zerodha connection failed: {exc}"
            ) from exc

    def disconnect(self) -> None:
        if self._ticker is not None:
            try:
                self._ticker.close()
            except Exception:
                pass
        self._connected = False
        logger.info("Disconnected from Zerodha")

    def is_connected(self) -> bool:
        return self._connected

    # ------------------------------------------------------------------
    # Instrument helpers
    # ------------------------------------------------------------------

    def _load_instruments(self) -> None:
        """Cache NFO instruments for fast token lookup."""
        try:
            instruments = self._kite.instruments(self.EXCHANGE)
            for inst in instruments:
                self._instruments[inst["tradingsymbol"]] = inst
            logger.info("Loaded %d NFO instruments", len(self._instruments))
        except Exception as exc:
            logger.warning("Failed to load instruments: %s", exc)

    def _get_instrument_token(self, trading_symbol: str) -> int:
        """Look up the numeric instrument token for a trading symbol."""
        inst = self._instruments.get(trading_symbol)
        if inst is None:
            raise OrderExecutionError(
                f"Unknown trading symbol: {trading_symbol}"
            )
        return inst["instrument_token"]

    def _trading_symbol(self, contract: OptionContract) -> str:
        """Build a Kite-compatible trading symbol from an OptionContract."""
        return contract.trading_symbol

    # ------------------------------------------------------------------
    # Retry helper
    # ------------------------------------------------------------------

    def _retry(self, func: Callable, *args: Any, **kwargs: Any) -> Any:
        """Execute *func* with retries on transient errors."""
        last_exc: Exception = Exception("Unknown")
        for attempt in range(1, self._max_retries + 1):
            try:
                return func(*args, **kwargs)
            except Exception as exc:
                last_exc = exc
                err_str = str(exc).lower()
                # Retry on network / rate-limit errors only
                if any(kw in err_str for kw in ("timeout", "network", "too many")):
                    logger.warning(
                        "Retry %d/%d for %s: %s",
                        attempt, self._max_retries, func.__name__, exc,
                    )
                    time.sleep(self._retry_delay * attempt)
                else:
                    raise
        raise last_exc

    # ------------------------------------------------------------------
    # Orders
    # ------------------------------------------------------------------

    def place_order(self, order: Order) -> str:
        self._ensure_connected()
        ts = self._trading_symbol(order.contract)
        params: dict[str, Any] = {
            "exchange": self.EXCHANGE,
            "tradingsymbol": ts,
            "transaction_type": _SIDE_MAP[order.side],
            "quantity": abs(order.quantity) * (order.contract.lot_size or 1),
            "order_type": _ORDER_TYPE_MAP[order.order_type],
            "product": _PRODUCT_MAP[order.product],
            "validity": "DAY",
            "tag": order.tag[:20] if order.tag else "",
        }
        if order.order_type == OrderType.LIMIT:
            params["price"] = order.limit_price
        if order.order_type in (OrderType.SL, OrderType.SL_M):
            params["trigger_price"] = order.trigger_price
            if order.order_type == OrderType.SL:
                params["price"] = order.limit_price

        try:
            order_id = self._retry(
                self._kite.place_order, variety="regular", **params,
            )
            logger.info("Order placed: %s -> %s", ts, order_id)
            return str(order_id)
        except Exception as exc:
            msg = str(exc).lower()
            if "margin" in msg or "insufficient" in msg:
                raise InsufficientMarginError(str(exc)) from exc
            raise OrderExecutionError(str(exc)) from exc

    def modify_order(
        self,
        broker_order_id: str,
        new_price: Optional[float] = None,
        new_quantity: Optional[int] = None,
    ) -> None:
        self._ensure_connected()
        params: dict[str, Any] = {"order_id": broker_order_id}
        if new_price is not None:
            params["price"] = new_price
        if new_quantity is not None:
            params["quantity"] = new_quantity
        try:
            self._retry(
                self._kite.modify_order, variety="regular", **params,
            )
            logger.info("Order %s modified", broker_order_id)
        except Exception as exc:
            raise OrderExecutionError(
                f"Modify failed for {broker_order_id}: {exc}"
            ) from exc

    def cancel_order(self, broker_order_id: str) -> None:
        self._ensure_connected()
        try:
            self._retry(
                self._kite.cancel_order,
                variety="regular",
                order_id=broker_order_id,
            )
            logger.info("Order %s cancelled", broker_order_id)
        except Exception as exc:
            raise OrderExecutionError(
                f"Cancel failed for {broker_order_id}: {exc}"
            ) from exc

    def get_order_status(self, broker_order_id: str) -> OrderStatus:
        self._ensure_connected()
        try:
            history = self._kite.order_history(order_id=broker_order_id)
            if not history:
                return OrderStatus.PENDING
            last = history[-1]
            return _STATUS_MAP.get(last.get("status", ""), OrderStatus.PENDING)
        except Exception as exc:
            logger.error("Failed to get order status: %s", exc)
            return OrderStatus.PENDING

    def get_order_history(self, broker_order_id: str) -> list[dict[str, Any]]:
        self._ensure_connected()
        try:
            return self._kite.order_history(order_id=broker_order_id)
        except Exception as exc:
            logger.error("Failed to get order history: %s", exc)
            return []

    # ------------------------------------------------------------------
    # Portfolio
    # ------------------------------------------------------------------

    def get_positions(self) -> list[Position]:
        self._ensure_connected()
        try:
            raw = self._kite.positions()
            positions: list[Position] = []
            for p in raw.get("net", []):
                if p.get("quantity", 0) == 0:
                    continue
                try:
                    pos = self._parse_position(p)
                    positions.append(pos)
                except Exception as exc:
                    logger.warning("Skipping position parse: %s", exc)
            return positions
        except Exception as exc:
            logger.error("Failed to get positions: %s", exc)
            return []

    def get_holdings(self) -> list[dict[str, Any]]:
        self._ensure_connected()
        try:
            return self._kite.holdings()
        except Exception as exc:
            logger.error("Failed to get holdings: %s", exc)
            return []

    def get_margins(self) -> dict[str, float]:
        self._ensure_connected()
        try:
            margins = self._kite.margins(segment="equity")
            available = float(margins.get("available", {}).get("live_balance", 0))
            used = float(margins.get("utilised", {}).get("span", 0))
            used += float(margins.get("utilised", {}).get("exposure", 0))
            return {
                "available": available,
                "used": used,
                "total": available + used,
            }
        except Exception as exc:
            logger.error("Failed to get margins: %s", exc)
            return {"available": 0.0, "used": 0.0, "total": 0.0}

    # ------------------------------------------------------------------
    # Market data
    # ------------------------------------------------------------------

    def get_ltp(self, symbol: str) -> float:
        self._ensure_connected()
        try:
            key = f"{self.EXCHANGE}:{symbol}"
            data = self._kite.ltp(key)
            return float(data[key]["last_price"])
        except Exception as exc:
            logger.error("Failed to get LTP for %s: %s", symbol, exc)
            return 0.0

    def get_option_chain(
        self, symbol: str, expiry: Any = None,
    ) -> OptionChain:
        """Build an option chain from cached instruments + LTP calls.

        Note: Kite Connect does not have a dedicated option-chain API;
        this reconstructs one from instruments and quote calls.
        """
        self._ensure_connected()
        calls: list[OptionQuote] = []
        puts: list[OptionQuote] = []
        strikes: set[float] = set()

        # Filter instruments
        matching = [
            inst for inst in self._instruments.values()
            if inst.get("name") == symbol
            and inst.get("instrument_type") in ("CE", "PE")
            and (expiry is None or inst.get("expiry") == expiry)
        ]

        # Batch LTP fetch (Kite allows up to ~500 per call)
        ts_list = [f"{self.EXCHANGE}:{inst['tradingsymbol']}" for inst in matching]
        ltp_map: dict[str, float] = {}
        try:
            for i in range(0, len(ts_list), 200):
                batch = ts_list[i : i + 200]
                data = self._kite.ltp(batch)
                for k, v in data.items():
                    ltp_map[k] = float(v.get("last_price", 0))
        except Exception as exc:
            logger.warning("LTP batch fetch failed: %s", exc)

        # Get underlying LTP
        underlying_ltp = self.get_ltp(symbol)

        for inst in matching:
            strike = float(inst.get("strike", 0))
            strikes.add(strike)
            ts = inst["tradingsymbol"]
            key = f"{self.EXCHANGE}:{ts}"
            ltp = ltp_map.get(key, 0.0)
            exp = inst.get("expiry", date.today())

            quote = OptionQuote(
                strike=strike,
                option_type=OptionType.CALL if inst["instrument_type"] == "CE" else OptionType.PUT,
                expiry=exp,
                last_price=ltp,
                bid=0.0, ask=0.0,
                bid_qty=0, ask_qty=0,
                volume=0, oi=0, change_in_oi=0,
                iv=0.0,
                underlying_value=underlying_ltp,
                timestamp=datetime.now(),
            )
            if inst["instrument_type"] == "CE":
                calls.append(quote)
            else:
                puts.append(quote)

        sorted_strikes = sorted(strikes)
        return OptionChain(
            symbol=symbol,
            underlying_value=underlying_ltp,
            expiry=expiry or date.today(),
            timestamp=datetime.now(),
            calls=sorted(calls, key=lambda q: q.strike),
            puts=sorted(puts, key=lambda q: q.strike),
            strikes=sorted_strikes,
        )

    # ------------------------------------------------------------------
    # WebSocket ticks
    # ------------------------------------------------------------------

    def subscribe_ticks(
        self,
        symbols: list[str],
        callback: Callable[[dict[str, Any]], None],
    ) -> None:
        """Subscribe to live ticks via KiteTicker WebSocket."""
        try:
            from kiteconnect import KiteTicker
        except ImportError as exc:
            raise BrokerConnectionError(
                "kiteconnect not installed"
            ) from exc

        tokens = []
        for sym in symbols:
            inst = self._instruments.get(sym)
            if inst:
                tokens.append(inst["instrument_token"])
            else:
                logger.warning("No instrument token for %s", sym)

        if not tokens:
            logger.warning("No valid tokens to subscribe")
            return

        self._ticker = KiteTicker(self._api_key, self._access_token)

        def on_ticks(ws: Any, ticks: list) -> None:
            for tick in ticks:
                try:
                    callback(tick)
                except Exception as exc:
                    logger.error("Tick callback error: %s", exc)

        def on_connect(ws: Any, response: Any) -> None:
            ws.subscribe(tokens)
            ws.set_mode(ws.MODE_FULL, tokens)
            logger.info("Subscribed to %d tokens", len(tokens))

        def on_close(ws: Any, code: int, reason: str) -> None:
            logger.warning("Ticker closed: %s %s", code, reason)

        def on_error(ws: Any, code: int, reason: str) -> None:
            logger.error("Ticker error: %s %s", code, reason)

        self._ticker.on_ticks = on_ticks
        self._ticker.on_connect = on_connect
        self._ticker.on_close = on_close
        self._ticker.on_error = on_error

        # connect runs in a background thread
        self._ticker.connect(threaded=True)
        logger.info("KiteTicker started for %d instruments", len(tokens))

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _ensure_connected(self) -> None:
        if not self._connected or self._kite is None:
            raise BrokerConnectionError("Not connected to Zerodha")

    def _parse_position(self, raw: dict) -> Position:
        """Convert a Kite position dict to our Position model."""
        ts = raw.get("tradingsymbol", "")
        symbol = raw.get("instrument_name", raw.get("tradingsymbol", ""))
        qty = int(raw.get("quantity", 0))
        avg_price = float(raw.get("average_price", 0))
        ltp = float(raw.get("last_price", 0))

        # Parse option details from instrument info
        inst = self._instruments.get(ts, {})
        strike = float(inst.get("strike", 0))
        expiry = inst.get("expiry", date.today())
        opt_type_str = inst.get("instrument_type", "CE")
        lot_size = int(inst.get("lot_size", 1))

        contract = OptionContract(
            symbol=symbol,
            strike=strike,
            option_type=OptionType.CALL if opt_type_str == "CE" else OptionType.PUT,
            expiry=expiry,
            lot_size=lot_size,
            exchange="NSE",
        )
        return Position(
            contract=contract,
            quantity=qty // lot_size if lot_size else qty,
            entry_price=avg_price,
            current_price=ltp,
        )

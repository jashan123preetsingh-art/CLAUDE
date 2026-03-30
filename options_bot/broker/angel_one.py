"""Angel One (SmartAPI) broker integration.

Wraps the ``SmartApi`` Python SDK to implement the ``BaseBroker``
interface.  Requires ``pip install smartapi-python``.

Usage::

    broker = AngelOneBroker(
        api_key="xxx",
        client_id="D12345",
        password="pin",
        totp_secret="BASE32SECRET",
    )
    broker.connect()
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

# Internal enum -> Angel API string mappings
_ORDER_TYPE_MAP = {
    OrderType.MARKET: "MARKET",
    OrderType.LIMIT: "LIMIT",
    OrderType.SL: "STOPLOSS_LIMIT",
    OrderType.SL_M: "STOPLOSS_MARKET",
}

_SIDE_MAP = {
    OrderSide.BUY: "BUY",
    OrderSide.SELL: "SELL",
}

_PRODUCT_MAP = {
    ProductType.NRML: "CARRYFORWARD",
    ProductType.MIS: "INTRADAY",
    ProductType.CNC: "DELIVERY",
}

_STATUS_MAP = {
    "complete": OrderStatus.COMPLETE,
    "rejected": OrderStatus.REJECTED,
    "cancelled": OrderStatus.CANCELLED,
    "open": OrderStatus.OPEN,
    "trigger pending": OrderStatus.TRIGGER_PENDING,
    "pending": OrderStatus.PENDING,
}


class AngelOneBroker(BaseBroker):
    """Angel One (SmartAPI) implementation of ``BaseBroker``.

    Parameters
    ----------
    api_key : str
        SmartAPI key.
    client_id : str
        Angel One client ID (e.g. "D12345").
    password : str
        Trading PIN.
    totp_secret : str
        Base-32 TOTP secret for 2FA.
    max_retries : int
        Retries for transient failures.
    retry_delay : float
        Seconds between retries.
    """

    EXCHANGE = "NFO"

    def __init__(
        self,
        api_key: str,
        client_id: str,
        password: str,
        totp_secret: str = "",
        max_retries: int = 3,
        retry_delay: float = 0.5,
    ) -> None:
        self._api_key = api_key
        self._client_id = client_id
        self._password = password
        self._totp_secret = totp_secret
        self._max_retries = max_retries
        self._retry_delay = retry_delay

        self._smart_api: Any = None
        self._auth_token: str = ""
        self._feed_token: str = ""
        self._connected = False
        self._instruments: dict[str, dict] = {}

    # ------------------------------------------------------------------
    # Connection
    # ------------------------------------------------------------------

    def connect(self) -> None:
        try:
            from SmartApi import SmartConnect
        except ImportError as exc:
            raise BrokerConnectionError(
                "SmartApi not installed. Run: pip install smartapi-python"
            ) from exc

        try:
            self._smart_api = SmartConnect(api_key=self._api_key)

            # Generate TOTP
            totp = self._generate_totp()

            data = self._smart_api.generateSession(
                self._client_id, self._password, totp,
            )
            if not data or data.get("status") is False:
                raise BrokerConnectionError(
                    f"Angel One login failed: {data.get('message', 'unknown')}"
                )

            self._auth_token = data["data"]["jwtToken"]
            self._feed_token = self._smart_api.getfeedToken()
            self._connected = True
            logger.info("Connected to Angel One as %s", self._client_id)
            self._load_instruments()

        except BrokerConnectionError:
            raise
        except Exception as exc:
            self._connected = False
            raise BrokerConnectionError(
                f"Angel One connection failed: {exc}"
            ) from exc

    def disconnect(self) -> None:
        if self._smart_api is not None:
            try:
                self._smart_api.terminateSession(self._client_id)
            except Exception:
                pass
        self._connected = False
        logger.info("Disconnected from Angel One")

    def is_connected(self) -> bool:
        return self._connected

    # ------------------------------------------------------------------
    # TOTP generation
    # ------------------------------------------------------------------

    def _generate_totp(self) -> str:
        """Generate a TOTP code from the stored secret."""
        if not self._totp_secret:
            raise BrokerConnectionError(
                "TOTP secret not configured; required for Angel One login"
            )
        try:
            import pyotp
            totp = pyotp.TOTP(self._totp_secret)
            return totp.now()
        except ImportError as exc:
            raise BrokerConnectionError(
                "pyotp not installed. Run: pip install pyotp"
            ) from exc

    # ------------------------------------------------------------------
    # Instruments
    # ------------------------------------------------------------------

    def _load_instruments(self) -> None:
        """Load and cache instrument master."""
        try:
            url = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
            import urllib.request
            import json
            with urllib.request.urlopen(url, timeout=30) as resp:
                data = json.loads(resp.read())
            for inst in data:
                if inst.get("exch_seg") == self.EXCHANGE:
                    self._instruments[inst.get("symbol", "")] = inst
            logger.info("Loaded %d NFO instruments", len(self._instruments))
        except Exception as exc:
            logger.warning("Failed to load Angel instruments: %s", exc)

    def _get_symbol_token(self, trading_symbol: str) -> str:
        """Look up the symbol token string."""
        inst = self._instruments.get(trading_symbol)
        if inst is None:
            raise OrderExecutionError(
                f"Unknown trading symbol: {trading_symbol}"
            )
        return inst.get("token", "")

    # ------------------------------------------------------------------
    # Retry helper
    # ------------------------------------------------------------------

    def _retry(self, func: Callable, *args: Any, **kwargs: Any) -> Any:
        last_exc: Exception = Exception("Unknown")
        for attempt in range(1, self._max_retries + 1):
            try:
                return func(*args, **kwargs)
            except Exception as exc:
                last_exc = exc
                err_str = str(exc).lower()
                if any(kw in err_str for kw in ("timeout", "network", "too many", "retry")):
                    logger.warning(
                        "Retry %d/%d: %s", attempt, self._max_retries, exc,
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
        ts = order.contract.trading_symbol
        token = self._get_symbol_token(ts)

        params: dict[str, Any] = {
            "variety": "NORMAL",
            "tradingsymbol": ts,
            "symboltoken": token,
            "transactiontype": _SIDE_MAP[order.side],
            "exchange": self.EXCHANGE,
            "ordertype": _ORDER_TYPE_MAP[order.order_type],
            "producttype": _PRODUCT_MAP[order.product],
            "duration": "DAY",
            "quantity": str(abs(order.quantity) * (order.contract.lot_size or 1)),
        }
        if order.order_type == OrderType.LIMIT:
            params["price"] = str(order.limit_price)
        else:
            params["price"] = "0"

        if order.order_type in (OrderType.SL, OrderType.SL_M):
            params["triggerprice"] = str(order.trigger_price)
        else:
            params["triggerprice"] = "0"

        try:
            resp = self._retry(self._smart_api.placeOrder, params)
            if resp is None:
                raise OrderExecutionError("Angel One returned None for placeOrder")
            order_id = str(resp)
            logger.info("Order placed: %s -> %s", ts, order_id)
            return order_id
        except OrderExecutionError:
            raise
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
        params: dict[str, Any] = {
            "variety": "NORMAL",
            "orderid": broker_order_id,
        }
        if new_price is not None:
            params["price"] = str(new_price)
        if new_quantity is not None:
            params["quantity"] = str(new_quantity)

        try:
            self._retry(self._smart_api.modifyOrder, params)
            logger.info("Order %s modified", broker_order_id)
        except Exception as exc:
            raise OrderExecutionError(
                f"Modify failed for {broker_order_id}: {exc}"
            ) from exc

    def cancel_order(self, broker_order_id: str) -> None:
        self._ensure_connected()
        try:
            self._retry(
                self._smart_api.cancelOrder,
                broker_order_id, "NORMAL",
            )
            logger.info("Order %s cancelled", broker_order_id)
        except Exception as exc:
            raise OrderExecutionError(
                f"Cancel failed for {broker_order_id}: {exc}"
            ) from exc

    def get_order_status(self, broker_order_id: str) -> OrderStatus:
        self._ensure_connected()
        try:
            book = self._smart_api.orderBook()
            if not book or not book.get("data"):
                return OrderStatus.PENDING
            for o in book["data"]:
                if str(o.get("orderid")) == broker_order_id:
                    status_str = o.get("status", "").lower()
                    return _STATUS_MAP.get(status_str, OrderStatus.PENDING)
            return OrderStatus.PENDING
        except Exception as exc:
            logger.error("Failed to get order status: %s", exc)
            return OrderStatus.PENDING

    def get_order_history(self, broker_order_id: str) -> list[dict[str, Any]]:
        self._ensure_connected()
        try:
            resp = self._smart_api.individualOrderDetails(broker_order_id)
            if resp and resp.get("data"):
                return resp["data"] if isinstance(resp["data"], list) else [resp["data"]]
            return []
        except Exception as exc:
            logger.error("Failed to get order history: %s", exc)
            return []

    # ------------------------------------------------------------------
    # Portfolio
    # ------------------------------------------------------------------

    def get_positions(self) -> list[Position]:
        self._ensure_connected()
        try:
            resp = self._smart_api.position()
            if not resp or not resp.get("data"):
                return []
            positions: list[Position] = []
            for p in resp["data"]:
                qty = int(p.get("netqty", 0))
                if qty == 0:
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
            resp = self._smart_api.holding()
            if resp and resp.get("data"):
                return resp["data"]
            return []
        except Exception as exc:
            logger.error("Failed to get holdings: %s", exc)
            return []

    def get_margins(self) -> dict[str, float]:
        self._ensure_connected()
        try:
            resp = self._smart_api.rmsLimit()
            if not resp or not resp.get("data"):
                return {"available": 0.0, "used": 0.0, "total": 0.0}
            data = resp["data"]
            available = float(data.get("availablecash", 0))
            used = float(data.get("utiliseddebits", 0))
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
            inst = self._instruments.get(symbol, {})
            token = inst.get("token", "")
            if not token:
                logger.error("No token for %s", symbol)
                return 0.0
            resp = self._smart_api.ltpData(self.EXCHANGE, symbol, token)
            if resp and resp.get("data"):
                return float(resp["data"].get("ltp", 0))
            return 0.0
        except Exception as exc:
            logger.error("Failed to get LTP for %s: %s", symbol, exc)
            return 0.0

    def get_option_chain(
        self, symbol: str, expiry: Any = None,
    ) -> OptionChain:
        """Build option chain from instrument master and LTP data."""
        self._ensure_connected()
        calls: list[OptionQuote] = []
        puts: list[OptionQuote] = []
        strikes: set[float] = set()

        matching = [
            inst for inst in self._instruments.values()
            if inst.get("name") == symbol
            and inst.get("instrumenttype") in ("CE", "PE")
            and (expiry is None or inst.get("expiry") == expiry)
        ]

        underlying_ltp = self.get_ltp(symbol)

        for inst in matching:
            strike = float(inst.get("strike", 0)) / 100.0  # Angel stores strike * 100
            strikes.add(strike)
            exp_str = inst.get("expiry", "")
            try:
                exp_date = datetime.strptime(exp_str, "%d%b%Y").date() if exp_str else date.today()
            except ValueError:
                exp_date = date.today()

            opt_type = OptionType.CALL if inst["instrumenttype"] == "CE" else OptionType.PUT
            quote = OptionQuote(
                strike=strike,
                option_type=opt_type,
                expiry=exp_date,
                last_price=0.0,
                bid=0.0, ask=0.0,
                bid_qty=0, ask_qty=0,
                volume=0, oi=0, change_in_oi=0,
                iv=0.0,
                underlying_value=underlying_ltp,
                timestamp=datetime.now(),
            )
            if opt_type == OptionType.CALL:
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

    def subscribe_ticks(
        self,
        symbols: list[str],
        callback: Callable[[dict[str, Any]], None],
    ) -> None:
        """Subscribe to live WebSocket feed via SmartAPI."""
        try:
            from SmartApi.smartWebSocketV2 import SmartWebSocketV2
        except ImportError as exc:
            raise BrokerConnectionError(
                "SmartApi WebSocket not available"
            ) from exc

        tokens = []
        for sym in symbols:
            inst = self._instruments.get(sym)
            if inst:
                tokens.append({
                    "exchangeType": 2,  # NFO
                    "tokens": [inst.get("token", "")],
                })

        if not tokens:
            logger.warning("No valid tokens for subscription")
            return

        sws = SmartWebSocketV2(
            self._auth_token, self._api_key,
            self._client_id, self._feed_token,
        )

        def on_data(wsapp: Any, message: Any) -> None:
            try:
                callback(message)
            except Exception as exc:
                logger.error("Tick callback error: %s", exc)

        def on_open(wsapp: Any) -> None:
            sws.subscribe("abc123", 3, tokens)  # mode 3 = snap quote
            logger.info("Angel WS subscribed to %d tokens", len(tokens))

        def on_error(wsapp: Any, error: Any) -> None:
            logger.error("Angel WS error: %s", error)

        def on_close(wsapp: Any) -> None:
            logger.warning("Angel WS closed")

        sws.on_data = on_data
        sws.on_open = on_open
        sws.on_error = on_error
        sws.on_close = on_close
        sws.connect()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _ensure_connected(self) -> None:
        if not self._connected or self._smart_api is None:
            raise BrokerConnectionError("Not connected to Angel One")

    def _parse_position(self, raw: dict) -> Position:
        ts = raw.get("tradingsymbol", "")
        symbol = raw.get("symbolname", ts)
        qty = int(raw.get("netqty", 0))
        avg_price = float(raw.get("avgnetprice", 0))
        ltp = float(raw.get("ltp", 0))

        inst = self._instruments.get(ts, {})
        strike = float(inst.get("strike", 0)) / 100.0
        lot_size = int(inst.get("lotsize", 1))
        exp_str = inst.get("expiry", "")
        try:
            expiry = datetime.strptime(exp_str, "%d%b%Y").date() if exp_str else date.today()
        except ValueError:
            expiry = date.today()
        opt_type_str = inst.get("instrumenttype", "CE")

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

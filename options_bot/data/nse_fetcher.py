"""NSE India data fetcher with session management, caching, and rate limiting.

Fetches option chains, quotes, historical data, and FII/DII participation
from the NSE India website (https://www.nseindia.com).
"""

from __future__ import annotations

import logging
import time
from datetime import date, datetime, timedelta
from functools import wraps
from threading import Lock
from typing import Any, Callable, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from options_bot.core.exceptions import DataFetchError, RateLimitError
from options_bot.core.models import (
    Greeks,
    MarketData,
    OHLCV,
    OptionChain,
    OptionQuote,
    OptionType,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
NSE_BASE_URL = "https://www.nseindia.com"
NSE_API_URL = "https://www.nseindia.com/api"

NSE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.nseindia.com/",
    "Connection": "keep-alive",
}

# Minimum seconds between consecutive HTTP requests.
DEFAULT_RATE_LIMIT_INTERVAL = 0.35

# Default cache TTL in seconds.
DEFAULT_CACHE_TTL = 30

# Index symbols that use the indices API endpoint.
INDEX_SYMBOLS = {"NIFTY", "NIFTY 50", "BANKNIFTY", "NIFTY BANK", "FINNIFTY",
                 "NIFTY FIN SERVICE", "MIDCPNIFTY", "NIFTY MID SELECT"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class _CacheEntry:
    """Simple TTL cache entry."""

    __slots__ = ("value", "expires_at")

    def __init__(self, value: Any, ttl: float) -> None:
        self.value = value
        self.expires_at = time.monotonic() + ttl

    @property
    def expired(self) -> bool:
        return time.monotonic() >= self.expires_at


def _cached(ttl_attr: str = "_cache_ttl"):
    """Decorator that caches method results with a configurable TTL.

    The cache key is built from the method name and all positional /
    keyword arguments.  TTL is read from *self.<ttl_attr>*.
    """

    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(self: "NSEFetcher", *args: Any, **kwargs: Any) -> Any:
            cache_key = (fn.__name__, args, tuple(sorted(kwargs.items())))
            entry = self._cache.get(cache_key)
            if entry is not None and not entry.expired:
                logger.debug("Cache hit for %s", cache_key)
                return entry.value

            result = fn(self, *args, **kwargs)
            ttl = getattr(self, ttl_attr, DEFAULT_CACHE_TTL)
            self._cache[cache_key] = _CacheEntry(result, ttl)
            return result

        return wrapper

    return decorator


# ---------------------------------------------------------------------------
# NSEFetcher
# ---------------------------------------------------------------------------

class NSEFetcher:
    """Fetches market data from the NSE India website.

    Features
    --------
    * Automatic session / cookie management.
    * Per-request rate limiting so we don't hammer NSE.
    * In-memory TTL cache for repeated calls.
    * Transparent retries with exponential back-off.

    Parameters
    ----------
    rate_limit_interval:
        Minimum seconds between consecutive requests.  Defaults to 0.35 s.
    cache_ttl:
        How many seconds a cached response stays valid.  Defaults to 30.
    max_retries:
        Number of retries on transient HTTP errors (5xx, 429).
    timeout:
        HTTP request timeout in seconds.
    """

    def __init__(
        self,
        rate_limit_interval: float = DEFAULT_RATE_LIMIT_INTERVAL,
        cache_ttl: float = DEFAULT_CACHE_TTL,
        max_retries: int = 3,
        timeout: float = 15.0,
    ) -> None:
        self._rate_limit_interval = rate_limit_interval
        self._cache_ttl = cache_ttl
        self._max_retries = max_retries
        self._timeout = timeout

        # Threading lock for rate-limiting.
        self._lock = Lock()
        self._last_request_time: float = 0.0

        # In-memory cache: key -> _CacheEntry
        self._cache: dict[tuple, _CacheEntry] = {}

        # Requests session (lazily initialised).
        self._session: Optional[requests.Session] = None
        self._session_expiry: float = 0.0

    # ------------------------------------------------------------------
    # Session management
    # ------------------------------------------------------------------

    def _get_session(self) -> requests.Session:
        """Return a requests.Session with valid NSE cookies.

        NSE requires a browser-like initial GET to ``/`` so that cookies
        (``nsit``, ``nseappid``, ``bm_*``) are set before the API will
        respond with data.  The session is refreshed every 4 minutes.
        """
        now = time.monotonic()
        if self._session is not None and now < self._session_expiry:
            return self._session

        session = requests.Session()
        session.headers.update(NSE_HEADERS)

        retry_strategy = Retry(
            total=self._max_retries,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("https://", adapter)
        session.mount("http://", adapter)

        # Warm up cookies.
        try:
            resp = session.get(
                NSE_BASE_URL,
                timeout=self._timeout,
            )
            resp.raise_for_status()
        except requests.RequestException as exc:
            raise DataFetchError(
                f"Failed to initialise NSE session: {exc}",
                source="NSE",
            ) from exc

        self._session = session
        # Refresh session every 4 minutes (cookies may expire ~5 min).
        self._session_expiry = now + 240
        logger.info("NSE session initialised / refreshed.")
        return session

    def close(self) -> None:
        """Close the underlying HTTP session."""
        if self._session is not None:
            self._session.close()
            self._session = None
        self._cache.clear()

    # ------------------------------------------------------------------
    # Internal HTTP helper
    # ------------------------------------------------------------------

    def _get(self, url: str, params: Optional[dict] = None) -> dict:
        """Rate-limited GET that returns parsed JSON.

        Raises
        ------
        DataFetchError
            On non-recoverable HTTP errors.
        RateLimitError
            When NSE returns HTTP 429.
        """
        with self._lock:
            elapsed = time.monotonic() - self._last_request_time
            if elapsed < self._rate_limit_interval:
                time.sleep(self._rate_limit_interval - elapsed)
            self._last_request_time = time.monotonic()

        session = self._get_session()

        try:
            resp = session.get(url, params=params, timeout=self._timeout)
        except requests.RequestException as exc:
            raise DataFetchError(
                f"HTTP request failed for {url}: {exc}",
                source="NSE",
            ) from exc

        if resp.status_code == 429:
            raise RateLimitError(
                "NSE rate limit hit. Back off.",
                source="NSE",
                status_code=429,
            )

        if resp.status_code == 401:
            # Session cookies likely expired; force refresh.
            logger.warning("NSE returned 401 — resetting session.")
            self._session = None
            raise DataFetchError(
                "NSE session expired (401). Retry after session refresh.",
                source="NSE",
                status_code=401,
            )

        if resp.status_code != 200:
            raise DataFetchError(
                f"NSE returned HTTP {resp.status_code} for {url}",
                source="NSE",
                status_code=resp.status_code,
            )

        try:
            return resp.json()
        except ValueError as exc:
            raise DataFetchError(
                f"Invalid JSON from NSE for {url}",
                source="NSE",
            ) from exc

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @_cached()
    def get_option_chain(
        self,
        symbol: str,
        expiry: Optional[date] = None,
    ) -> OptionChain:
        """Fetch the option chain for *symbol* from NSE.

        Parameters
        ----------
        symbol:
            Underlying symbol, e.g. ``"NIFTY"``, ``"BANKNIFTY"``,
            ``"RELIANCE"``.
        expiry:
            Restrict to a specific expiry date.  If *None*, NSE returns
            the nearest expiry by default.

        Returns
        -------
        OptionChain
        """
        symbol_upper = symbol.upper().strip()
        if symbol_upper in INDEX_SYMBOLS or symbol_upper in ("NIFTY 50", "NIFTY BANK", "NIFTY FIN SERVICE", "NIFTY MID SELECT"):
            url = f"{NSE_API_URL}/option-chain-indices"
            params = {"symbol": self._canonical_index_symbol(symbol_upper)}
        else:
            url = f"{NSE_API_URL}/option-chain-equities"
            params = {"symbol": symbol_upper}

        data = self._get(url, params=params)

        records = data.get("records", {})
        underlying = data.get("records", {}).get("underlyingValue", 0.0)
        timestamp_str = records.get("timestamp", "")
        try:
            timestamp = datetime.strptime(timestamp_str, "%d-%b-%Y %H:%M:%S")
        except (ValueError, TypeError):
            timestamp = datetime.now()

        # Determine desired expiry.
        expiry_dates = [
            datetime.strptime(d, "%d-%b-%Y").date()
            for d in records.get("expiryDates", [])
        ]
        target_expiry = expiry if expiry else (expiry_dates[0] if expiry_dates else date.today())

        calls: list[OptionQuote] = []
        puts: list[OptionQuote] = []
        strikes: set[float] = set()

        for row in records.get("data", []):
            row_expiry_str = row.get("expiryDate", "")
            try:
                row_expiry = datetime.strptime(row_expiry_str, "%d-%b-%Y").date()
            except (ValueError, TypeError):
                continue

            if row_expiry != target_expiry:
                continue

            strike = float(row.get("strikePrice", 0))
            strikes.add(strike)

            ce = row.get("CE")
            if ce:
                calls.append(self._parse_option_quote(ce, strike, OptionType.CALL, row_expiry, underlying))

            pe = row.get("PE")
            if pe:
                puts.append(self._parse_option_quote(pe, strike, OptionType.PUT, row_expiry, underlying))

        sorted_strikes = sorted(strikes)
        logger.info(
            "Fetched option chain for %s expiry=%s (%d strikes)",
            symbol_upper, target_expiry, len(sorted_strikes),
        )

        return OptionChain(
            symbol=symbol_upper,
            underlying_value=underlying,
            expiry=target_expiry,
            timestamp=timestamp,
            calls=calls,
            puts=puts,
            strikes=sorted_strikes,
        )

    @_cached()
    def get_indices_quote(self, symbol: str) -> MarketData:
        """Fetch a live quote for an index (NIFTY / BANKNIFTY / FINNIFTY)."""
        canonical = self._canonical_index_symbol(symbol.upper().strip())
        url = f"{NSE_API_URL}/allIndices"
        data = self._get(url)

        for idx in data.get("data", []):
            if idx.get("index", "").upper() == canonical.upper():
                return MarketData(
                    symbol=canonical,
                    last_price=float(idx.get("last", 0)),
                    open=float(idx.get("open", 0)),
                    high=float(idx.get("high", 0)),
                    low=float(idx.get("low", 0)),
                    close=float(idx.get("previousClose", 0)),
                    change=float(idx.get("variation", 0)),
                    pct_change=float(idx.get("percentChange", 0)),
                    volume=0,
                    timestamp=datetime.now(),
                )

        raise DataFetchError(
            f"Index symbol '{canonical}' not found in NSE response.",
            source="NSE",
        )

    @_cached()
    def get_stock_quote(self, symbol: str) -> MarketData:
        """Fetch a live equity quote from NSE."""
        symbol_upper = symbol.upper().strip()
        url = f"{NSE_API_URL}/quote-equity"
        data = self._get(url, params={"symbol": symbol_upper})

        price_info = data.get("priceInfo", {})
        info = data.get("info", {})

        return MarketData(
            symbol=symbol_upper,
            last_price=float(price_info.get("lastPrice", 0)),
            open=float(price_info.get("open", 0)),
            high=float(price_info.get("intraDayHighLow", {}).get("max", 0)),
            low=float(price_info.get("intraDayHighLow", {}).get("min", 0)),
            close=float(price_info.get("previousClose", 0)),
            change=float(price_info.get("change", 0)),
            pct_change=float(price_info.get("pChange", 0)),
            volume=int(data.get("securityWiseDP", {}).get("quantityTraded", 0) or 0),
            timestamp=datetime.now(),
        )

    @_cached()
    def get_expiry_dates(self, symbol: str) -> list[date]:
        """Return available expiry dates for *symbol* sorted ascending."""
        symbol_upper = symbol.upper().strip()
        if symbol_upper in INDEX_SYMBOLS:
            url = f"{NSE_API_URL}/option-chain-indices"
            params = {"symbol": self._canonical_index_symbol(symbol_upper)}
        else:
            url = f"{NSE_API_URL}/option-chain-equities"
            params = {"symbol": symbol_upper}

        data = self._get(url, params=params)
        raw_dates = data.get("records", {}).get("expiryDates", [])

        expiries: list[date] = []
        for d in raw_dates:
            try:
                expiries.append(datetime.strptime(d, "%d-%b-%Y").date())
            except (ValueError, TypeError):
                continue

        expiries.sort()
        return expiries

    def get_historical_data(
        self,
        symbol: str,
        from_date: date,
        to_date: date,
        interval: str = "1D",
    ) -> list[OHLCV]:
        """Fetch historical OHLCV data from NSE.

        Parameters
        ----------
        symbol:
            Equity or index symbol.
        from_date / to_date:
            Date range (inclusive).
        interval:
            Currently only ``"1D"`` (daily) is reliably available from NSE.

        Returns
        -------
        list[OHLCV]
            Chronologically sorted bars.
        """
        symbol_upper = symbol.upper().strip()

        # NSE limits date ranges to ~2 years per request; split if needed.
        all_bars: list[OHLCV] = []
        chunk_start = from_date
        while chunk_start <= to_date:
            chunk_end = min(chunk_start + timedelta(days=365), to_date)
            bars = self._fetch_historical_chunk(symbol_upper, chunk_start, chunk_end)
            all_bars.extend(bars)
            chunk_start = chunk_end + timedelta(days=1)

        all_bars.sort(key=lambda b: b.timestamp)
        logger.info(
            "Fetched %d historical bars for %s (%s to %s)",
            len(all_bars), symbol_upper, from_date, to_date,
        )
        return all_bars

    def _fetch_historical_chunk(
        self,
        symbol: str,
        from_date: date,
        to_date: date,
    ) -> list[OHLCV]:
        """Fetch a single chunk of historical data (max ~1 year)."""
        from_str = from_date.strftime("%d-%m-%Y")
        to_str = to_date.strftime("%d-%m-%Y")

        if symbol in INDEX_SYMBOLS:
            canonical = self._canonical_index_symbol(symbol)
            url = f"{NSE_API_URL}/historical/indicesHistory"
            params = {
                "indexType": canonical,
                "from": from_str,
                "to": to_str,
            }
        else:
            url = f"{NSE_API_URL}/historical/securityArchives"
            params = {
                "from": from_str,
                "to": to_str,
                "symbol": symbol,
                "dataType": "priceVolumeDeliverable",
            }

        data = self._get(url, params=params)
        bars: list[OHLCV] = []

        for row in data.get("data", []):
            try:
                ts_str = row.get("CH_TIMESTAMP") or row.get("TIMESTAMP") or row.get("Date", "")
                if not ts_str:
                    continue
                # NSE uses several date formats; try the most common ones.
                for fmt in ("%Y-%m-%d", "%d-%b-%Y", "%d %b %Y"):
                    try:
                        ts = datetime.strptime(ts_str.strip(), fmt)
                        break
                    except ValueError:
                        continue
                else:
                    continue

                bar = OHLCV(
                    timestamp=ts,
                    open=float(row.get("CH_OPENING_PRICE") or row.get("OPEN") or row.get("Open", 0)),
                    high=float(row.get("CH_TRADE_HIGH_PRICE") or row.get("HIGH") or row.get("High", 0)),
                    low=float(row.get("CH_TRADE_LOW_PRICE") or row.get("LOW") or row.get("Low", 0)),
                    close=float(row.get("CH_CLOSING_PRICE") or row.get("CLOSE") or row.get("Close", 0)),
                    volume=int(float(row.get("CH_TOT_TRADED_QTY") or row.get("VOLUME") or row.get("Volume", 0))),
                    oi=int(float(row.get("COP_DELIV_QTY", 0) or 0)),
                )
                if bar.validate():
                    bars.append(bar)
            except (ValueError, TypeError, KeyError) as exc:
                logger.debug("Skipping malformed historical row: %s", exc)
                continue

        return bars

    @_cached(ttl_attr="_cache_ttl")
    def get_fii_dii_data(self) -> dict[str, Any]:
        """Fetch FII/DII cash-market participation data for today."""
        url = f"{NSE_API_URL}/fiidiiActivity/WEB_FII_ACTIVITY"
        return self._get(url)

    @_cached(ttl_attr="_cache_ttl")
    def get_market_status(self) -> dict[str, Any]:
        """Return current market status (open / closed / pre-open etc.)."""
        url = f"{NSE_API_URL}/marketStatus"
        return self._get(url)

    # ------------------------------------------------------------------
    # Cache management
    # ------------------------------------------------------------------

    def clear_cache(self) -> None:
        """Drop all cached responses."""
        self._cache.clear()

    def invalidate(self, method_name: str) -> None:
        """Remove cached entries for a specific method."""
        keys_to_drop = [k for k in self._cache if k[0] == method_name]
        for k in keys_to_drop:
            del self._cache[k]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _canonical_index_symbol(symbol: str) -> str:
        """Map user-friendly names to the canonical NSE identifier."""
        mapping = {
            "NIFTY": "NIFTY 50",
            "NIFTY50": "NIFTY 50",
            "BANKNIFTY": "NIFTY BANK",
            "NIFTYBANK": "NIFTY BANK",
            "FINNIFTY": "NIFTY FIN SERVICE",
            "MIDCPNIFTY": "NIFTY MID SELECT",
        }
        return mapping.get(symbol.upper().replace(" ", ""), symbol)

    @staticmethod
    def _parse_option_quote(
        raw: dict,
        strike: float,
        option_type: OptionType,
        expiry: date,
        underlying: float,
    ) -> OptionQuote:
        """Parse a single CE/PE dict from the NSE option-chain response."""
        return OptionQuote(
            strike=strike,
            option_type=option_type,
            expiry=expiry,
            last_price=float(raw.get("lastPrice", 0)),
            bid=float(raw.get("bidprice", 0)),
            ask=float(raw.get("askPrice", 0)),
            bid_qty=int(raw.get("bidQty", 0)),
            ask_qty=int(raw.get("askQty", 0)),
            volume=int(raw.get("totalTradedVolume", 0)),
            oi=int(raw.get("openInterest", 0)),
            change_in_oi=int(raw.get("changeinOpenInterest", 0)),
            iv=float(raw.get("impliedVolatility", 0)),
            greeks=Greeks(iv=float(raw.get("impliedVolatility", 0))),
            underlying_value=underlying,
        )

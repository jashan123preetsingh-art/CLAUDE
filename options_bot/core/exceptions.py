"""Custom exceptions for the options trading bot."""


class OptionsBotError(Exception):
    """Base exception for the options bot."""


class DataFetchError(OptionsBotError):
    """Raised when data fetching from an external source fails."""

    def __init__(self, message: str, source: str = "", status_code: int | None = None):
        self.source = source
        self.status_code = status_code
        super().__init__(message)


class DataValidationError(OptionsBotError):
    """Raised when fetched data fails validation."""


class MarketClosedError(OptionsBotError):
    """Raised when an operation requires an open market but the market is closed."""


class RateLimitError(DataFetchError):
    """Raised when the data source rate-limits our requests."""


class ConnectionError(OptionsBotError):
    """Raised on WebSocket / network connectivity issues."""


class BrokerError(OptionsBotError):
    """Raised on broker API errors."""


class BacktestError(OptionsBotError):
    """Raised when backtesting encounters an error."""


class BrokerConnectionError(BrokerError):
    """Raised when connection to the broker fails or drops."""


class OrderExecutionError(BrokerError):
    """Raised when an order placement / modification / cancellation fails."""


class InsufficientMarginError(BrokerError):
    """Raised when available margin is insufficient for the trade."""


class RiskLimitExceeded(OptionsBotError):
    """Raised when a trade violates a risk-management limit."""

"""Core data models for the Indian options trading bot."""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional


class OptionType(enum.Enum):
    """Option contract type."""
    CALL = "CE"
    PUT = "PE"


class OrderSide(enum.Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderType(enum.Enum):
    """Order type."""
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    SL = "SL"          # Stop-loss limit
    SL_M = "SL-M"      # Stop-loss market


class OrderStatus(enum.Enum):
    """Lifecycle status of an order."""
    PENDING = "PENDING"
    OPEN = "OPEN"
    COMPLETE = "COMPLETE"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"
    TRIGGER_PENDING = "TRIGGER_PENDING"


class ProductType(enum.Enum):
    """Product / margin type."""
    NRML = "NRML"       # Overnight / carryforward
    MIS = "MIS"         # Intraday
    CNC = "CNC"         # Delivery (equity)


class PositionStatus(enum.Enum):
    """Status of a position."""
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    PARTIAL = "PARTIAL"


@dataclass(frozen=True)
class Greeks:
    """Option Greeks."""
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0
    rho: float = 0.0
    iv: float = 0.0


@dataclass
class OHLCV:
    """Single OHLCV bar."""
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int
    oi: int = 0

    def validate(self) -> bool:
        """Basic sanity checks on the bar."""
        if self.high < self.low:
            return False
        if self.open < 0 or self.close < 0 or self.volume < 0:
            return False
        return True


@dataclass
class MarketData:
    """Current market quote for an underlying."""
    symbol: str
    last_price: float
    open: float
    high: float
    low: float
    close: float  # previous close
    change: float
    pct_change: float
    volume: int
    timestamp: datetime
    oi: int = 0


@dataclass
class OptionQuote:
    """Live quote for a single option strike/type."""
    strike: float
    option_type: OptionType
    expiry: date
    last_price: float
    bid: float
    ask: float
    bid_qty: int
    ask_qty: int
    volume: int
    oi: int
    change_in_oi: int
    iv: float
    greeks: Greeks = field(default_factory=Greeks)
    underlying_value: float = 0.0
    timestamp: Optional[datetime] = None


@dataclass
class OptionContract:
    """Identifies a specific option contract."""
    symbol: str
    strike: float
    option_type: OptionType
    expiry: date
    lot_size: int = 1
    exchange: str = "NSE"

    @property
    def trading_symbol(self) -> str:
        """NSE-style trading symbol, e.g. NIFTY24MAR25000CE."""
        exp_str = self.expiry.strftime("%d%b%y").upper()
        ot = self.option_type.value
        strike_str = str(int(self.strike)) if self.strike == int(self.strike) else str(self.strike)
        return f"{self.symbol}{exp_str}{strike_str}{ot}"


@dataclass
class OptionChain:
    """Full option chain for a symbol + expiry."""
    symbol: str
    underlying_value: float
    expiry: date
    timestamp: datetime
    calls: list[OptionQuote] = field(default_factory=list)
    puts: list[OptionQuote] = field(default_factory=list)
    strikes: list[float] = field(default_factory=list)

    @property
    def atm_strike(self) -> float:
        """Return the strike closest to the underlying value."""
        if not self.strikes:
            return 0.0
        return min(self.strikes, key=lambda s: abs(s - self.underlying_value))

    def get_call(self, strike: float) -> Optional[OptionQuote]:
        for q in self.calls:
            if q.strike == strike:
                return q
        return None

    def get_put(self, strike: float) -> Optional[OptionQuote]:
        for q in self.puts:
            if q.strike == strike:
                return q
        return None


@dataclass
class Position:
    """A single options or underlying position."""
    contract: OptionContract
    quantity: int  # positive = long, negative = short
    entry_price: float
    current_price: float = 0.0
    spot_price: float = 0.0
    greeks: Greeks = field(default_factory=Greeks)

    @property
    def side(self) -> OrderSide:
        return OrderSide.BUY if self.quantity > 0 else OrderSide.SELL

    @property
    def pnl(self) -> float:
        return (self.current_price - self.entry_price) * self.quantity * self.contract.lot_size


@dataclass
class Order:
    """An order to be placed or already placed with a broker."""
    contract: OptionContract
    side: OrderSide
    quantity: int               # in lots
    order_type: OrderType = OrderType.MARKET
    limit_price: float = 0.0
    trigger_price: float = 0.0
    product: ProductType = ProductType.NRML
    broker_order_id: Optional[str] = None
    status: OrderStatus = OrderStatus.PENDING
    filled_quantity: int = 0
    average_price: float = 0.0
    placed_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    tag: str = ""
    metadata: dict = field(default_factory=dict)


class StrategyType(enum.Enum):
    """Supported option strategy types."""
    IRON_CONDOR = "iron_condor"
    IRON_BUTTERFLY = "iron_butterfly"
    SHORT_STRADDLE = "short_straddle"
    SHORT_STRANGLE = "short_strangle"
    BULL_CALL_SPREAD = "bull_call_spread"
    BEAR_PUT_SPREAD = "bear_put_spread"
    CALENDAR_SPREAD = "calendar_spread"
    RATIO_SPREAD = "ratio_spread"
    JADE_LIZARD = "jade_lizard"
    CUSTOM = "custom"


class SignalType(enum.Enum):
    """Type of trading signal."""
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"
    HIGH_IV = "high_iv"
    LOW_IV = "low_iv"
    TREND = "trend"
    MEAN_REVERSION = "mean_reversion"


@dataclass
class Signal:
    """A trading signal produced by a signal generator."""
    signal_type: SignalType
    strength: float  # 0.0 to 1.0
    source: str  # e.g. "rsi", "iv_rank", "supertrend"
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: dict = field(default_factory=dict)


@dataclass
class StrategyPosition:
    """A multi-leg strategy position."""
    strategy_type: StrategyType
    legs: list[Position] = field(default_factory=list)
    entry_time: Optional[datetime] = None
    symbol: str = ""
    expiry: Optional[date] = None
    net_premium: float = 0.0  # positive = credit, negative = debit
    max_profit: float = 0.0
    max_loss: float = 0.0
    upper_breakeven: float = 0.0
    lower_breakeven: float = 0.0
    status: str = "pending"  # pending, active, closed
    tag: str = ""
    metadata: dict = field(default_factory=dict)

    @property
    def total_pnl(self) -> float:
        return sum(leg.pnl for leg in self.legs)

    @property
    def net_greeks(self) -> Greeks:
        d = sum(leg.greeks.delta * leg.quantity for leg in self.legs)
        g = sum(leg.greeks.gamma * leg.quantity for leg in self.legs)
        t = sum(leg.greeks.theta * leg.quantity for leg in self.legs)
        v = sum(leg.greeks.vega * leg.quantity for leg in self.legs)
        return Greeks(delta=d, gamma=g, theta=t, vega=v)

    @property
    def is_credit(self) -> bool:
        return self.net_premium > 0


@dataclass
class Trade:
    """A completed trade record."""
    entry_date: datetime
    exit_date: Optional[datetime]
    contract: OptionContract
    side: OrderSide
    quantity: int
    entry_price: float
    exit_price: float = 0.0
    pnl: float = 0.0
    commission: float = 0.0
    slippage_cost: float = 0.0

    @property
    def net_pnl(self) -> float:
        return self.pnl - self.commission - self.slippage_cost

    @property
    def duration_days(self) -> Optional[float]:
        if self.exit_date is None:
            return None
        return (self.exit_date - self.entry_date).total_seconds() / 86400.0

    @property
    def is_winner(self) -> bool:
        return self.net_pnl > 0

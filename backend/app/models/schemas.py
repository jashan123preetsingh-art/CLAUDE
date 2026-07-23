"""Pydantic models describing every object that crosses a module boundary.

Keeping these in one place gives us a single source of truth for the API
response contract and lets the screeners, scoring engine and risk manager
speak the same language.
"""
from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class SwingType(str, Enum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    LONG_TERM = "long_term"
    FNO = "fno"


class Exchange(str, Enum):
    NSE = "NSE"
    BSE = "BSE"


class Candle(BaseModel):
    """A single OHLCV(+delivery) bar."""

    date: date
    open: float
    high: float
    low: float
    close: float
    volume: float
    delivery_qty: Optional[float] = None  # NSE delivery quantity, when known


class StockMeta(BaseModel):
    """Static/reference information about a symbol."""

    symbol: str
    name: str
    exchange: Exchange = Exchange.NSE
    sector: str = "Unknown"
    market_cap_cr: float = 0.0            # market cap in ₹ crore
    is_fno: bool = False
    listed_days: int = 1000
    in_asm: bool = False
    in_gsm: bool = False
    is_suspended: bool = False


class FundamentalData(BaseModel):
    roe: Optional[float] = None            # %
    roce: Optional[float] = None           # %
    debt_to_equity: Optional[float] = None
    sales_growth: Optional[float] = None   # % YoY
    profit_growth: Optional[float] = None  # % YoY
    sales_cagr: Optional[float] = None     # % 3y
    profit_cagr: Optional[float] = None    # % 3y
    promoter_holding: Optional[float] = None  # %
    operating_cash_flow: Optional[float] = None  # ₹ cr
    eps: Optional[float] = None
    interest_coverage: Optional[float] = None
    fii_change: Optional[float] = None     # % change in FII holding
    dii_change: Optional[float] = None
    governance_flag: bool = False          # True => known governance issue


class NewsData(BaseModel):
    sentiment_score: float = 0.0           # -1..+1
    positive_count: int = 0
    negative_count: int = 0
    has_lawsuit: bool = False
    has_fraud: bool = False
    has_sebi_action: bool = False
    has_bankruptcy_risk: bool = False
    heavy_promoter_selling: bool = False
    negative_guidance: bool = False
    headlines: list[str] = Field(default_factory=list)


class ScoreBreakdown(BaseModel):
    technical: float = 0.0     # 0..100 sub-scores
    volume: float = 0.0
    trend: float = 0.0
    momentum: float = 0.0
    fundamental: float = 0.0
    news: float = 0.0
    final: float = 0.0         # weighted 0..100


class RiskPlan(BaseModel):
    entry_low: float
    entry_high: float
    stop_loss: float
    target1: float
    target2: float
    target3: float
    risk_reward: float
    atr_stop: float
    expected_holding_days: int
    position_size_shares: int
    max_risk_pct: float
    capital_at_risk: float


class StockResult(BaseModel):
    """The full institutional-quality output card for one opportunity."""

    symbol: str
    name: str
    sector: str
    exchange: Exchange
    swing_type: SwingType
    current_price: float
    market_cap_cr: float

    confidence_score: float
    scores: ScoreBreakdown

    risk: RiskPlan

    # headline technicals surfaced on the card
    delivery_pct: Optional[float] = None
    volume_spike_pct: Optional[float] = None
    atr: Optional[float] = None
    rsi: Optional[float] = None
    macd_hist: Optional[float] = None
    adx: Optional[float] = None
    relative_strength: Optional[float] = None

    patterns: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)
    risk_factors: list[str] = Field(default_factory=list)

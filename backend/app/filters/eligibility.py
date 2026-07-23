"""Eligibility, fundamental, news and delivery filters.

Thresholds mirror the screener spec. Each function is pure and returns a
``FilterResult(passed, reasons)`` so exclusions are explainable.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from app.models.schemas import FundamentalData, NewsData, StockMeta

# --- liquidity / exclusion thresholds ---
MIN_PRICE = 100.0             # ₹ — drop penny stocks
MIN_MARKET_CAP_CR = 500.0     # ₹ crore
MIN_ADV_CR = 10.0             # ₹ crore average daily value traded
MIN_LISTED_DAYS = 120         # newly listed cut-off
MAX_ATR_PCT = 12.0            # abnormal volatility cut-off (daily ATR % of price)


@dataclass
class FilterResult:
    passed: bool
    reasons: list[str] = field(default_factory=list)  # why it FAILED

    def __bool__(self) -> bool:  # allow `if result:`
        return self.passed


def _adv_cr(feats: dict) -> float:
    """Average daily value traded (₹ crore) from 20-day avg volume × price."""
    avg_vol = feats.get("vol_sma20", np.nan)
    price = feats.get("price", np.nan)
    if not np.isfinite(avg_vol) or not np.isfinite(price):
        return 0.0
    return avg_vol * price / 1e7  # ₹ → crore


def passes_eligibility(meta: StockMeta, feats: dict) -> FilterResult:
    """Hard liquidity/quality gate — everything the spec says to remove."""
    fails: list[str] = []

    if feats.get("price", 0) < MIN_PRICE:
        fails.append(f"price < ₹{MIN_PRICE:.0f} (penny stock)")
    if meta.market_cap_cr < MIN_MARKET_CAP_CR:
        fails.append(f"market cap < ₹{MIN_MARKET_CAP_CR:.0f} Cr")
    if _adv_cr(feats) < MIN_ADV_CR:
        fails.append(f"avg daily value < ₹{MIN_ADV_CR:.0f} Cr (illiquid)")
    if meta.listed_days < MIN_LISTED_DAYS:
        fails.append(f"newly listed (<{MIN_LISTED_DAYS} trading days)")
    if meta.in_asm:
        fails.append("ASM list")
    if meta.in_gsm:
        fails.append("GSM list")
    if meta.is_suspended:
        fails.append("suspended")
    if feats.get("atr_pct", 0) > MAX_ATR_PCT:
        fails.append("abnormal volatility (ATR% too high)")

    # circuit-locked proxy: no intraday range on the latest bar
    if feats.get("prev_high") is not None:
        if feats.get("price") and feats.get("high_52w"):
            pass  # placeholder for exchange band data in production

    return FilterResult(passed=not fails, reasons=fails)


def passes_fundamentals(f: FundamentalData, *, strict: bool = False) -> FilterResult:
    """Fundamental quality gate. ``strict`` raises bars for long-term picks."""
    fails: list[str] = []

    def bad(val, threshold, cmp, label):
        if val is None:
            fails.append(f"{label} unknown")
            return
        if not cmp(val, threshold):
            fails.append(f"{label} fails ({val:.1f})")

    roe_min = 18 if strict else 15
    roce_min = 20 if strict else 18
    bad(f.roe, roe_min, lambda a, b: a > b, f"ROE>{roe_min}")
    bad(f.roce, roce_min, lambda a, b: a > b, f"ROCE>{roce_min}")
    bad(f.debt_to_equity, 0.50, lambda a, b: a < b, "D/E<0.5")
    bad(f.sales_growth, 15, lambda a, b: a > b, "sales growth>15")
    bad(f.profit_growth, 15, lambda a, b: a > b, "profit growth>15")
    bad(f.promoter_holding, 50, lambda a, b: a > b, "promoter>50")
    bad(f.operating_cash_flow, 0, lambda a, b: a > b, "positive OCF")
    bad(f.eps, 0, lambda a, b: a > b, "positive EPS")
    bad(f.interest_coverage, 3, lambda a, b: a > b, "interest coverage")
    if f.governance_flag:
        fails.append("governance issue")

    return FilterResult(passed=not fails, reasons=fails)


def passes_news(n: NewsData) -> FilterResult:
    """Reject on hard negative-news red flags."""
    fails: list[str] = []
    if n.has_lawsuit:
        fails.append("major lawsuit")
    if n.has_fraud:
        fails.append("accounting fraud")
    if n.has_sebi_action:
        fails.append("SEBI action")
    if n.has_bankruptcy_risk:
        fails.append("bankruptcy risk")
    if n.heavy_promoter_selling:
        fails.append("heavy promoter selling")
    if n.negative_guidance:
        fails.append("negative guidance")
    return FilterResult(passed=not fails, reasons=fails)


def delivery_signal(feats: dict) -> dict:
    """Delivery-based quality signals (preferred, not hard filters)."""
    dp = feats.get("delivery_pct")
    return {
        "high_delivery": bool(dp is not None and np.isfinite(dp) and dp > 40),
        "delivery_rising": bool(feats.get("delivery_rising", 0)),
        "volume_surge": bool(feats.get("rel_volume", 0) > 1.5),
    }

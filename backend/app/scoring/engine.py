"""Weighted AI scoring engine.

Six sub-scores (each 0..100) are combined into a final 0..100 confidence:

    Technical 40% · Volume 20% · Trend 15% · Momentum 10% · Fundamental 10% · News 5%

Each sub-score is a transparent, bounded aggregation of the computed features
so the number is explainable rather than a black box.
"""
from __future__ import annotations

import numpy as np

from app.models.schemas import FundamentalData, NewsData, ScoreBreakdown

WEIGHTS = {
    "technical": 0.40,
    "volume": 0.20,
    "trend": 0.15,
    "momentum": 0.10,
    "fundamental": 0.10,
    "news": 0.05,
}


def _clip(x: float) -> float:
    return float(np.clip(x, 0.0, 100.0))


def _f(feats: dict, key: str, default: float = 0.0) -> float:
    v = feats.get(key, default)
    return float(v) if v is not None and np.isfinite(v) else default


def technical_score(feats: dict) -> float:
    """Structure, EMA stack, price vs VWAP, Supertrend, breakout proximity."""
    s = 0.0
    price = _f(feats, "price")
    # EMA stack alignment (max 30)
    if feats.get("ema20", 0) > feats.get("ema50", 0):
        s += 10
    if feats.get("ema50", 0) > feats.get("ema200", 0):
        s += 12
    if price > _f(feats, "ema20"):
        s += 8
    # price above VWAP (10)
    if price > _f(feats, "vwap", price):
        s += 10
    # Supertrend bullish (10)
    if feats.get("supertrend_dir", 0) > 0:
        s += 10
    # market structure (15)
    if feats.get("structure") == "uptrend":
        s += 15
    elif feats.get("higher_high") and feats.get("higher_low"):
        s += 10
    # breakout proximity to 52w high (15)
    pct_from_high = _f(feats, "pct_from_52w_high", -100)
    if pct_from_high > -3:
        s += 15
    elif pct_from_high > -8:
        s += 9
    elif pct_from_high > -15:
        s += 4
    # break of structure bonus (10)
    if feats.get("bos") == "bullish":
        s += 10
    return _clip(s)


def volume_score(feats: dict) -> float:
    """Relative volume, delivery %, OBV trend."""
    s = 0.0
    rel = _f(feats, "rel_volume", 1.0)
    s += _clip((rel - 1.0) * 60)  # 1.5x → 30, 2x → 60
    dp = feats.get("delivery_pct")
    if dp is not None and np.isfinite(dp):
        if dp > 60:
            s += 25
        elif dp > 40:
            s += 18
        elif dp > 25:
            s += 8
    if feats.get("delivery_rising", 0):
        s += 5
    if _f(feats, "obv_slope") > 0:
        s += 10
    return _clip(s)


def trend_score(feats: dict) -> float:
    """ADX strength + linear-fit trend strength + RS vs benchmark."""
    s = 0.0
    adx = _f(feats, "adx")
    if adx > 40:
        s += 40
    elif adx > 25:
        s += 30
    elif adx > 20:
        s += 18
    s += _f(feats, "trend_strength") * 0.4  # up to 40
    rs = _f(feats, "rs_vs_nifty")
    if rs > 10:
        s += 20
    elif rs > 0:
        s += 12
    return _clip(s)


def momentum_score(feats: dict) -> float:
    """RSI sweet-spot + MACD + ATR expansion."""
    s = 0.0
    rsi = _f(feats, "rsi", 50)
    if 55 <= rsi <= 70:
        s += 40
    elif 50 <= rsi < 55 or 70 < rsi <= 75:
        s += 25
    elif 45 <= rsi < 50:
        s += 12
    if feats.get("macd", 0) > feats.get("macd_signal", 0) and feats.get("macd_hist", 0) > 0:
        s += 35
    elif feats.get("macd_hist", 0) > 0:
        s += 18
    if feats.get("atr_expanding", 0):
        s += 25
    return _clip(s)


def fundamental_score(f: FundamentalData) -> float:
    """Quality of the business (used at 10% weight)."""
    if f.roe is None and f.roce is None:
        return 50.0  # unknown → neutral
    s = 0.0
    if f.roe and f.roe > 15:
        s += 18
    if f.roce and f.roce > 18:
        s += 18
    if f.debt_to_equity is not None and f.debt_to_equity < 0.5:
        s += 15
    if f.sales_growth and f.sales_growth > 15:
        s += 12
    if f.profit_growth and f.profit_growth > 15:
        s += 12
    if f.promoter_holding and f.promoter_holding > 50:
        s += 10
    if f.operating_cash_flow and f.operating_cash_flow > 0:
        s += 8
    if f.eps and f.eps > 0:
        s += 7
    return _clip(s)


def news_score(n: NewsData) -> float:
    """Map sentiment (-1..1) to 0..100, penalising red flags."""
    base = (n.sentiment_score + 1) / 2 * 100
    if any(
        [n.has_lawsuit, n.has_fraud, n.has_sebi_action, n.has_bankruptcy_risk,
         n.heavy_promoter_selling, n.negative_guidance]
    ):
        base *= 0.3
    return _clip(base)


def score_stock(
    feats: dict, fundamentals: FundamentalData, news: NewsData
) -> ScoreBreakdown:
    tech = technical_score(feats)
    vol = volume_score(feats)
    trend = trend_score(feats)
    mom = momentum_score(feats)
    fund = fundamental_score(fundamentals)
    nws = news_score(news)
    final = (
        tech * WEIGHTS["technical"]
        + vol * WEIGHTS["volume"]
        + trend * WEIGHTS["trend"]
        + mom * WEIGHTS["momentum"]
        + fund * WEIGHTS["fundamental"]
        + nws * WEIGHTS["news"]
    )
    return ScoreBreakdown(
        technical=round(tech, 1),
        volume=round(vol, 1),
        trend=round(trend, 1),
        momentum=round(mom, 1),
        fundamental=round(fund, 1),
        news=round(nws, 1),
        final=round(_clip(final), 1),
    )

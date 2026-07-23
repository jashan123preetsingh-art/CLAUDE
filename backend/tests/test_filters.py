"""Filter tests."""
from __future__ import annotations

from app.filters import passes_eligibility, passes_fundamentals, passes_news
from app.models.schemas import Exchange, FundamentalData, NewsData, StockMeta


def _meta(**kw) -> StockMeta:
    base = dict(symbol="TEST", name="Test", exchange=Exchange.NSE, sector="IT",
                market_cap_cr=5000, listed_days=1000)
    base.update(kw)
    return StockMeta(**base)


def test_penny_stock_rejected():
    feats = {"price": 50, "vol_sma20": 1e6, "atr_pct": 2}
    res = passes_eligibility(_meta(), feats)
    assert not res.passed and any("penny" in r for r in res.reasons)


def test_small_cap_rejected():
    feats = {"price": 500, "vol_sma20": 1e6, "atr_pct": 2}
    res = passes_eligibility(_meta(market_cap_cr=100), feats)
    assert not res.passed


def test_asm_gsm_rejected():
    feats = {"price": 500, "vol_sma20": 1e7, "atr_pct": 2}
    assert not passes_eligibility(_meta(in_asm=True), feats).passed
    assert not passes_eligibility(_meta(in_gsm=True), feats).passed


def test_eligible_passes():
    feats = {"price": 500, "vol_sma20": 5e6, "atr_pct": 2}  # ADV = 5e6*500/1e7 = 250 Cr
    assert passes_eligibility(_meta(), feats).passed


def test_fundamentals_gate():
    good = FundamentalData(roe=20, roce=22, debt_to_equity=0.2, sales_growth=18,
                           profit_growth=20, promoter_holding=55, operating_cash_flow=100,
                           eps=10, interest_coverage=8)
    assert passes_fundamentals(good).passed
    bad = FundamentalData(roe=5, roce=6, debt_to_equity=2.0, sales_growth=1,
                          profit_growth=1, promoter_holding=20, operating_cash_flow=-10,
                          eps=-1, interest_coverage=1)
    assert not passes_fundamentals(bad).passed


def test_news_red_flags():
    assert passes_news(NewsData(sentiment_score=0.3)).passed
    assert not passes_news(NewsData(has_fraud=True)).passed

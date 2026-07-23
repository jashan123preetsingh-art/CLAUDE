"""Scoring engine + risk manager tests."""
from __future__ import annotations

from app.indicators import compute_features
from app.models.schemas import FundamentalData, NewsData, SwingType
from app.risk import build_risk_plan
from app.scoring import WEIGHTS, score_stock
from app.scoring.engine import news_score


def test_weights_sum_to_one():
    assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-9


def test_score_bounds(uptrend_df):
    feats = compute_features(uptrend_df)
    fd = FundamentalData(roe=25, roce=24, debt_to_equity=0.2, sales_growth=20,
                         profit_growth=22, promoter_holding=60, operating_cash_flow=1000,
                         eps=40, interest_coverage=10)
    sb = score_stock(feats, fd, NewsData(sentiment_score=0.5))
    for v in (sb.technical, sb.volume, sb.trend, sb.momentum, sb.fundamental, sb.news, sb.final):
        assert 0 <= v <= 100


def test_uptrend_scores_well(uptrend_df):
    feats = compute_features(uptrend_df)
    fd = FundamentalData(roe=25, roce=24, debt_to_equity=0.2, sales_growth=20,
                         profit_growth=22, promoter_holding=60, operating_cash_flow=1000,
                         eps=40, interest_coverage=10)
    sb = score_stock(feats, fd, NewsData(sentiment_score=0.6))
    assert sb.technical > 50
    assert sb.final > 50


def test_news_red_flag_penalised():
    good = news_score(NewsData(sentiment_score=0.8))
    bad = news_score(NewsData(sentiment_score=0.8, has_sebi_action=True))
    assert bad < good


def test_risk_plan_consistency(uptrend_df):
    feats = compute_features(uptrend_df)
    plan = build_risk_plan(feats, SwingType.WEEKLY, account_capital=1_000_000, max_risk_pct=1.0)
    assert plan.stop_loss < plan.entry_low <= plan.entry_high
    assert plan.target1 < plan.target2 < plan.target3
    assert plan.entry_high < plan.target1
    assert plan.risk_reward > 0
    assert plan.position_size_shares >= 0
    # capital at risk should be ~1% of capital
    assert abs(plan.capital_at_risk - 10_000) < 1e-6

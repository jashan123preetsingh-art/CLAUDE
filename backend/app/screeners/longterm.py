"""Long-term delivery / investment screener (3–12 months). Score gate: > 90."""
from __future__ import annotations

from app.screeners.base import ScreenContext, Screener, ScreenVerdict
from app.models.schemas import SwingType


class LongTermScreener(Screener):
    swing_type = SwingType.LONG_TERM
    min_score = 90.0
    min_conditions = 8

    def evaluate(self, ctx: ScreenContext) -> ScreenVerdict:
        f, fd = ctx.feats, ctx.fundamentals
        price = f.get("price", 0)

        conditions = {
            "Market leader (large cap)": ctx.meta.market_cap_cr > 20000,
            "ROE > 18": (fd.roe or 0) > 18,
            "ROCE > 20": (fd.roce or 0) > 20,
            "Low/again debt (D/E < 0.5)": (fd.debt_to_equity if fd.debt_to_equity is not None else 1) < 0.5,
            "Sales CAGR > 15": (fd.sales_cagr or 0) > 15,
            "Profit CAGR > 15": (fd.profit_cagr or 0) > 15,
            "Above 200 EMA": price > f.get("ema200", price + 1),
            "Above 52w breakout zone": f.get("pct_from_52w_high", -100) > -8,
            "FII buying": (fd.fii_change or 0) > 0,
            "DII buying": (fd.dii_change or 0) > 0,
            "Positive OCF & EPS": (fd.operating_cash_flow or 0) > 0 and (fd.eps or 0) > 0,
        }
        n_pass, passed = self._count_true(conditions)

        risk_factors: list[str] = []
        if (fd.debt_to_equity or 0) >= 0.5:
            risk_factors.append("elevated leverage")
        if (fd.promoter_holding or 0) < 50:
            risk_factors.append("promoter holding below 50%")

        qualifies = n_pass >= self.min_conditions and ctx.scores.final > self.min_score
        return ScreenVerdict(qualifies=qualifies, reasons=passed, risk_factors=risk_factors)

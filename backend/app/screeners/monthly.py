"""Monthly swing screener (2–8 week horizon). Score gate: > 85."""
from __future__ import annotations

from app.screeners.base import ScreenContext, Screener, ScreenVerdict
from app.models.schemas import SwingType


class MonthlySwingScreener(Screener):
    swing_type = SwingType.MONTHLY
    min_score = 85.0
    min_conditions = 8

    def evaluate(self, ctx: ScreenContext) -> ScreenVerdict:
        f = ctx.feats
        price = f.get("price", 0)

        # healthy pullback into a demand zone: price above EMA50 but not extended
        pullback = f.get("ema50", 0) < price < f.get("ema20", price) * 1.05
        near_vwap = abs(price - f.get("vwap", price)) / price < 0.04 if price else False

        conditions = {
            "EMA50 > EMA200 (uptrend)": f.get("ema50", 0) > f.get("ema200", 0),
            "Strong uptrend structure": f.get("structure") == "uptrend",
            "Healthy pullback / demand zone": pullback,
            "VWAP support": near_vwap or price > f.get("vwap", price),
            "RSI 55-68": 55 <= f.get("rsi", 0) <= 68,
            "MACD bullish": f.get("macd_hist", 0) > 0,
            "OBV rising": f.get("obv_slope", 0) > 0,
            "ADX > 25": f.get("adx", 0) > 25,
            "Institutional/delivery buying": (f.get("delivery_pct") or 0) > 40,
            "Volume expansion": f.get("rel_volume", 0) > 1.3,
            "Near base breakout": f.get("pct_from_52w_high", -100) > -12,
        }
        n_pass, passed = self._count_true(conditions)

        risk_factors: list[str] = []
        if f.get("adx", 0) < 25:
            risk_factors.append("trend still developing (ADX < 25)")
        if not pullback and f.get("pct_from_52w_high", -100) > -2:
            risk_factors.append("chasing — no healthy pullback yet")

        qualifies = n_pass >= self.min_conditions and ctx.scores.final > self.min_score
        return ScreenVerdict(qualifies=qualifies, reasons=passed, risk_factors=risk_factors)

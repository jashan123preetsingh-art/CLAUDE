"""F&O swing screener — only scans F&O-enabled names. Score gate: > 80.

Combines price/technical momentum with derivatives positioning (OI build-up)
to classify long build-up / short covering and confirm trend continuation.
"""
from __future__ import annotations

from app.screeners.base import ScreenContext, Screener, ScreenVerdict
from app.models.schemas import SwingType


class FnoScreener(Screener):
    swing_type = SwingType.FNO
    min_score = 80.0
    min_conditions = 6

    def evaluate(self, ctx: ScreenContext) -> ScreenVerdict:
        if not ctx.meta.is_fno:
            return ScreenVerdict(qualifies=False, reasons=[], risk_factors=["not an F&O stock"])

        f, m = ctx.feats, ctx.fno_metrics
        price = f.get("price", 0)
        oi_chg = m.get("oi_change_pct", 0.0)
        px_chg = m.get("price_change_pct", 0.0)

        long_buildup = oi_chg > 3 and px_chg > 0
        short_covering = oi_chg < -3 and px_chg > 0

        conditions = {
            "Long build-up (OI↑ & price↑)": long_buildup,
            "Short covering (OI↓ & price↑)": short_covering,
            "OI increase": oi_chg > 0,
            "Price increase": px_chg > 0,
            "VWAP support": price > f.get("vwap", price),
            "Breakout of structure": f.get("bos") == "bullish",
            "Strong volume": f.get("rel_volume", 0) > 1.4,
            "Momentum (MACD+RSI)": f.get("macd_hist", 0) > 0 and f.get("rsi", 0) > 52,
            "Trend continuation (ADX>25)": f.get("adx", 0) > 25,
        }
        n_pass, passed = self._count_true(conditions)

        risk_factors: list[str] = []
        if m.get("futures_basis_pct", 0) < -0.2:
            risk_factors.append("futures in discount (bearish basis)")
        if not (long_buildup or short_covering):
            risk_factors.append("no clean OI build-up signal")

        qualifies = n_pass >= self.min_conditions and ctx.scores.final > self.min_score
        return ScreenVerdict(qualifies=qualifies, reasons=passed, risk_factors=risk_factors)

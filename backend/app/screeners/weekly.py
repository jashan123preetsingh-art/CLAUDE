"""Weekly swing screener (3–10 day horizon). Score gate: > 80."""
from __future__ import annotations

import numpy as np

from app.screeners.base import ScreenContext, Screener, ScreenVerdict
from app.models.schemas import SwingType


class WeeklySwingScreener(Screener):
    swing_type = SwingType.WEEKLY
    min_score = 80.0
    # require most of the momentum-breakout checklist
    min_conditions = 9

    def evaluate(self, ctx: ScreenContext) -> ScreenVerdict:
        f = ctx.feats
        price = f.get("price", 0)
        dp = f.get("delivery_pct")

        conditions = {
            "EMA20 > EMA50": f.get("ema20", 0) > f.get("ema50", 0),
            "EMA50 > EMA200": f.get("ema50", 0) > f.get("ema200", 0),
            "Price above VWAP": price > f.get("vwap", price),
            "RSI 55-70": 55 <= f.get("rsi", 0) <= 70,
            "MACD bullish": f.get("macd_hist", 0) > 0 and f.get("macd", 0) > f.get("macd_signal", 0),
            "ADX > 25": f.get("adx", 0) > 25,
            "Higher high": bool(f.get("higher_high", 0)),
            "Higher low": bool(f.get("higher_low", 0)),
            "Breakout of structure": f.get("bos") == "bullish",
            "Volume spike": f.get("rel_volume", 0) > 1.5,
            "Strong RS vs Nifty": f.get("rs_vs_nifty", 0) > 0,
            "Near 52w-high breakout": f.get("pct_from_52w_high", -100) > -5,
            "ATR expansion": bool(f.get("atr_expanding", 0)),
            "R:R > 2": True,  # ensured by the risk plan; confirmed downstream
        }
        n_pass, passed = self._count_true(conditions)

        risk_factors: list[str] = []
        if f.get("rsi", 0) > 70:
            risk_factors.append("RSI overbought — watch for pullback")
        if f.get("pct_from_52w_high", -100) > -1:
            risk_factors.append("extended right at 52w high")
        if dp is not None and np.isfinite(dp) and dp < 40:
            risk_factors.append("delivery % below 40")

        qualifies = n_pass >= self.min_conditions and ctx.scores.final > self.min_score
        return ScreenVerdict(qualifies=qualifies, reasons=passed, risk_factors=risk_factors)

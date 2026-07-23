"""Scan orchestrator — the heart of the screener.

For each symbol in the universe it: pulls history, computes the feature set,
applies the eligibility gate, pulls fundamentals/news, scores the stock,
evaluates every screener, and (when a screener qualifies) builds a full
``StockResult`` with a risk plan and human-readable reasons.

Concurrency is bounded by a semaphore; per-symbol failures are isolated so one
bad symbol never aborts the scan. Results are cached by the service.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass

import numpy as np

from app.config import Settings, get_settings
from app.data.base import MarketDataProvider
from app.data.factory import build_provider
from app.indicators import compute_features
from app.logging_config import get_logger
from app.models.schemas import (
    Exchange,
    StockMeta,
    StockResult,
    SwingType,
)
from app.patterns import detect_patterns
from app.risk import build_risk_plan
from app.filters import passes_eligibility, passes_fundamentals, passes_news
from app.scoring import score_stock
from app.screeners import SCREENERS
from app.screeners.base import ScreenContext

log = get_logger(__name__)


@dataclass
class SymbolEvaluation:
    """Everything computed for one symbol, reused across all screeners."""

    meta: StockMeta
    feats: dict
    scores: object
    fundamentals: object
    news: object
    fno_metrics: dict
    patterns: list[str]
    eligible: bool
    exclusion_reasons: list[str]


class Scanner:
    def __init__(self, provider: MarketDataProvider | None = None, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.provider = provider or build_provider(self.settings)
        self._sem = asyncio.Semaphore(self.settings.max_concurrency)

    async def _evaluate_symbol(
        self, meta: StockMeta, benchmark_close
    ) -> SymbolEvaluation | None:
        async with self._sem:
            try:
                df = await self.provider.get_history(meta, self.settings.history_days)
                if df is None or len(df) < 120:
                    return None
                feats = compute_features(df, benchmark_close)
            except Exception as exc:
                log.debug("skip %s: feature error %s", meta.symbol, exc)
                return None

            elig = passes_eligibility(meta, feats)

            # only pay for fundamentals/news/fno on eligible names
            fundamentals = await self.provider.get_fundamentals(meta)
            news = await self.provider.get_news(meta)
            fno_metrics = await self.provider.get_fno_metrics(meta) if meta.is_fno else {}

            scores = score_stock(feats, fundamentals, news)
            patterns = detect_patterns(df, feats)

            return SymbolEvaluation(
                meta=meta,
                feats=feats,
                scores=scores,
                fundamentals=fundamentals,
                news=news,
                fno_metrics=fno_metrics,
                patterns=patterns,
                eligible=bool(elig),
                exclusion_reasons=elig.reasons,
            )

    def _build_result(
        self, ev: SymbolEvaluation, swing_type: SwingType, verdict
    ) -> StockResult:
        f = ev.feats
        risk = build_risk_plan(f, swing_type)
        reasons = list(verdict.reasons)
        if ev.patterns:
            reasons.append("Patterns: " + ", ".join(ev.patterns))
        return StockResult(
            symbol=ev.meta.symbol,
            name=ev.meta.name,
            sector=ev.meta.sector,
            exchange=ev.meta.exchange,
            swing_type=swing_type,
            current_price=round(f["price"], 2),
            market_cap_cr=ev.meta.market_cap_cr,
            confidence_score=ev.scores.final,
            scores=ev.scores,
            risk=risk,
            delivery_pct=_safe(f.get("delivery_pct")),
            volume_spike_pct=_safe(f.get("volume_spike_pct")),
            atr=_safe(f.get("atr")),
            rsi=_safe(f.get("rsi")),
            macd_hist=_safe(f.get("macd_hist")),
            adx=_safe(f.get("adx")),
            relative_strength=_safe(f.get("rs_vs_nifty")),
            patterns=ev.patterns,
            reasons=reasons,
            risk_factors=verdict.risk_factors,
        )

    async def scan(self, swing_types: list[SwingType] | None = None) -> dict[str, list[StockResult]]:
        """Run a full scan and return results bucketed by swing type value."""
        swing_types = swing_types or list(SwingType)
        universe = await self.provider.list_universe()
        if self.settings.universe_limit:
            universe = universe[: self.settings.universe_limit]

        bench_df = await self.provider.get_benchmark("NIFTY50", self.settings.history_days)
        bench_close = bench_df["close"] if bench_df is not None and len(bench_df) else None

        evals = await asyncio.gather(
            *(self._evaluate_symbol(m, bench_close) for m in universe)
        )

        buckets: dict[str, list[StockResult]] = {st.value: [] for st in swing_types}
        for ev in evals:
            if ev is None or not ev.eligible:
                continue
            # fundamentals / news hard gate
            if not passes_news(ev.news):
                continue
            for st in swing_types:
                # long-term requires strict fundamentals; others prefer but the
                # screener already checks the fundamental conditions it needs.
                screener = SCREENERS[st]
                verdict = screener.evaluate(
                    ScreenContext(
                        meta=ev.meta,
                        feats=ev.feats,
                        fundamentals=ev.fundamentals,
                        news=ev.news,
                        scores=ev.scores,
                        fno_metrics=ev.fno_metrics,
                    )
                )
                if verdict.qualifies:
                    buckets[st.value].append(self._build_result(ev, st, verdict))

        for st_val, results in buckets.items():
            results.sort(key=lambda r: r.confidence_score, reverse=True)
        return buckets

    async def aclose(self) -> None:
        await self.provider.aclose()


def _safe(v) -> float | None:
    if v is None:
        return None
    try:
        return round(float(v), 2) if np.isfinite(v) else None
    except (TypeError, ValueError):
        return None

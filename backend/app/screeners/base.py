"""Screener interface.

A screener inspects the computed features (plus fundamentals/news/F&O metrics
and the AI score) for one symbol and decides whether it qualifies for its swing
category, returning the reasons it qualified and any residual risk factors.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass, field

from app.models.schemas import (
    FundamentalData,
    NewsData,
    ScoreBreakdown,
    StockMeta,
    SwingType,
)


@dataclass
class ScreenVerdict:
    qualifies: bool
    reasons: list[str] = field(default_factory=list)
    risk_factors: list[str] = field(default_factory=list)


@dataclass
class ScreenContext:
    meta: StockMeta
    feats: dict
    fundamentals: FundamentalData
    news: NewsData
    scores: ScoreBreakdown
    fno_metrics: dict = field(default_factory=dict)


class Screener(abc.ABC):
    swing_type: SwingType
    min_score: float

    @abc.abstractmethod
    def evaluate(self, ctx: ScreenContext) -> ScreenVerdict:
        """Return the qualification verdict for one symbol."""

    @staticmethod
    def _count_true(conditions: dict[str, bool]) -> tuple[int, list[str]]:
        passed = [name for name, ok in conditions.items() if ok]
        return len(passed), passed

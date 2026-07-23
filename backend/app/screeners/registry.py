"""Screener registry — maps swing type to its screener instance."""
from __future__ import annotations

from app.models.schemas import SwingType
from app.screeners.base import Screener
from app.screeners.fno import FnoScreener
from app.screeners.longterm import LongTermScreener
from app.screeners.monthly import MonthlySwingScreener
from app.screeners.weekly import WeeklySwingScreener

SCREENERS: dict[SwingType, Screener] = {
    SwingType.WEEKLY: WeeklySwingScreener(),
    SwingType.MONTHLY: MonthlySwingScreener(),
    SwingType.LONG_TERM: LongTermScreener(),
    SwingType.FNO: FnoScreener(),
}


def get_screener(swing_type: SwingType) -> Screener:
    return SCREENERS[swing_type]

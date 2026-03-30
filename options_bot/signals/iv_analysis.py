"""Implied Volatility analysis for signal generation."""

from __future__ import annotations

from datetime import datetime
from typing import Sequence

import numpy as np

from options_bot.core.models import Signal, SignalType


class IVAnalyzer:
    """Analyse implied-volatility surfaces and generate trading signals."""

    # ------------------------------------------------------------------
    # Core IV metrics
    # ------------------------------------------------------------------

    @staticmethod
    def iv_rank(current_iv: float, iv_history: Sequence[float]) -> float:
        """IV Rank: where *current_iv* sits in the 52-week high-low range.

        Formula:  (current - min) / (max - min) * 100
        Returns a float in [0, 100].
        """
        if len(iv_history) == 0:
            return 50.0
        iv_min = float(np.min(iv_history))
        iv_max = float(np.max(iv_history))
        if iv_max == iv_min:
            return 50.0
        rank = (current_iv - iv_min) / (iv_max - iv_min) * 100.0
        return float(np.clip(rank, 0.0, 100.0))

    @staticmethod
    def iv_percentile(current_iv: float, iv_history: Sequence[float]) -> float:
        """IV Percentile: percentage of *historical* days IV was below *current_iv*.

        Returns a float in [0, 100].
        """
        if len(iv_history) == 0:
            return 50.0
        arr = np.asarray(iv_history, dtype=np.float64)
        pct = float(np.sum(arr < current_iv) / len(arr) * 100.0)
        return float(np.clip(pct, 0.0, 100.0))

    @staticmethod
    def iv_regime(iv_rank: float) -> str:
        """Classify IV environment.

        Returns
        -------
        str
            ``"LOW"``  if iv_rank < 30
            ``"MEDIUM"`` if 30 <= iv_rank <= 60
            ``"HIGH"`` if iv_rank > 60
        """
        if iv_rank < 30.0:
            return "LOW"
        elif iv_rank > 60.0:
            return "HIGH"
        return "MEDIUM"

    # ------------------------------------------------------------------
    # Signals
    # ------------------------------------------------------------------

    @staticmethod
    def iv_mean_reversion_signal(
        iv_rank: float,
        threshold_high: float = 50.0,
        threshold_low: float = 30.0,
    ) -> Signal:
        """Generate a mean-reversion signal based on IV rank.

        * High IV rank (>= *threshold_high*) -> expect IV to fall -> sell
          premium (NEUTRAL / premium-selling bias).
        * Low IV rank (<= *threshold_low*) -> expect IV to rise -> buy
          premium / directional plays (BULLISH lean, since low-vol
          environments often precede breakouts).
        * In between -> NEUTRAL with low strength.

        Parameters
        ----------
        iv_rank : float
            Current IV rank (0-100).
        threshold_high : float
            IV rank above which we consider IV elevated.
        threshold_low : float
            IV rank below which we consider IV depressed.

        Returns
        -------
        Signal
        """
        if iv_rank >= threshold_high:
            # High IV -- favour selling premium
            strength = min((iv_rank - threshold_high) / (100.0 - threshold_high), 1.0)
            return Signal(
                signal_type=SignalType.HIGH_IV,
                strength=strength,
                source="iv_mean_reversion",
                timestamp=datetime.now(),
                metadata={
                    "iv_rank": iv_rank,
                    "regime": "HIGH",
                    "recommendation": "sell_premium",
                },
            )
        elif iv_rank <= threshold_low:
            # Low IV -- favour buying premium / directional
            strength = min((threshold_low - iv_rank) / threshold_low, 1.0) if threshold_low > 0 else 0.5
            return Signal(
                signal_type=SignalType.LOW_IV,
                strength=strength,
                source="iv_mean_reversion",
                timestamp=datetime.now(),
                metadata={
                    "iv_rank": iv_rank,
                    "regime": "LOW",
                    "recommendation": "buy_premium",
                },
            )
        else:
            # Neutral zone
            strength = 0.2
            return Signal(
                signal_type=SignalType.NEUTRAL,
                strength=strength,
                source="iv_mean_reversion",
                timestamp=datetime.now(),
                metadata={
                    "iv_rank": iv_rank,
                    "regime": "MEDIUM",
                    "recommendation": "no_edge",
                },
            )

    @staticmethod
    def term_structure_signal(near_iv: float, far_iv: float) -> Signal:
        """Signal from the IV term structure (near-term vs far-term expiry).

        * **Contango** (near < far): Normal structure, slight bullish /
          neutral lean -- sell near-term premium.
        * **Backwardation** (near > far): Event / fear driven -- bearish
          lean, expect large move.

        Parameters
        ----------
        near_iv : float
            IV of the near-term expiry.
        far_iv : float
            IV of the far-term expiry.

        Returns
        -------
        Signal
        """
        if far_iv == 0.0:
            return Signal(
                signal_type=SignalType.NEUTRAL,
                strength=0.0,
                source="iv_term_structure",
                timestamp=datetime.now(),
                metadata={"near_iv": near_iv, "far_iv": far_iv, "structure": "unknown"},
            )

        ratio = near_iv / far_iv

        if ratio < 1.0:
            # Contango -- normal
            diff_pct = (far_iv - near_iv) / far_iv
            strength = min(diff_pct * 2.0, 1.0)  # scale up
            return Signal(
                signal_type=SignalType.NEUTRAL,
                strength=strength,
                source="iv_term_structure",
                timestamp=datetime.now(),
                metadata={
                    "near_iv": near_iv,
                    "far_iv": far_iv,
                    "ratio": round(ratio, 4),
                    "structure": "contango",
                    "recommendation": "sell_near_term_premium",
                },
            )
        else:
            # Backwardation -- fear / event
            diff_pct = (near_iv - far_iv) / far_iv
            strength = min(diff_pct * 2.0, 1.0)
            return Signal(
                signal_type=SignalType.BEARISH,
                strength=strength,
                source="iv_term_structure",
                timestamp=datetime.now(),
                metadata={
                    "near_iv": near_iv,
                    "far_iv": far_iv,
                    "ratio": round(ratio, 4),
                    "structure": "backwardation",
                    "recommendation": "hedge_or_buy_protection",
                },
            )

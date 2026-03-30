"""Aggregate multiple trading signals into a unified market view."""

from __future__ import annotations

from datetime import datetime
from typing import Sequence

from options_bot.core.models import Signal, SignalType, StrategyType


# Default weights by signal source.  Higher weight = more influence.
_DEFAULT_WEIGHTS: dict[str, float] = {
    "rsi": 1.0,
    "macd": 1.0,
    "bollinger": 0.8,
    "supertrend": 1.2,
    "ma_alignment": 1.0,
    "iv_mean_reversion": 1.5,
    "iv_term_structure": 0.8,
    "pcr": 1.0,
    "oi_change": 1.2,
}


class SignalAggregator:
    """Collect signals from various analyzers and produce a combined view."""

    def __init__(self, weights: dict[str, float] | None = None):
        self._signals: list[Signal] = []
        self._weights = weights or _DEFAULT_WEIGHTS

    # ------------------------------------------------------------------
    # Signal management
    # ------------------------------------------------------------------

    def add_signal(self, signal: Signal) -> None:
        """Add a signal to the pool."""
        self._signals.append(signal)

    def clear(self) -> None:
        """Remove all collected signals."""
        self._signals.clear()

    @property
    def signals(self) -> list[Signal]:
        return list(self._signals)

    # ------------------------------------------------------------------
    # Aggregation
    # ------------------------------------------------------------------

    def aggregate(self) -> Signal:
        """Produce a single weighted-average signal from all collected signals.

        Each signal's contribution is:
            direction_score * strength * weight

        where *direction_score* is +1 for BULLISH, -1 for BEARISH, and 0 for
        NEUTRAL (non-directional signals like HIGH_IV / LOW_IV are treated
        as 0 for the directional score but still contribute to metadata).
        """
        if not self._signals:
            return Signal(
                signal_type=SignalType.NEUTRAL,
                strength=0.0,
                source="aggregator",
                timestamp=datetime.now(),
            )

        total_weight = 0.0
        weighted_score = 0.0

        for sig in self._signals:
            w = self._weights.get(sig.source, 1.0)
            direction = self._direction_value(sig.signal_type)
            weighted_score += direction * sig.strength * w
            total_weight += w

        if total_weight == 0:
            net_score = 0.0
        else:
            net_score = weighted_score / total_weight  # in [-1, 1]

        # Convert back to Signal
        if net_score > 0.05:
            sig_type = SignalType.BULLISH
        elif net_score < -0.05:
            sig_type = SignalType.BEARISH
        else:
            sig_type = SignalType.NEUTRAL

        strength = min(abs(net_score), 1.0)

        return Signal(
            signal_type=sig_type,
            strength=strength,
            source="aggregator",
            timestamp=datetime.now(),
            metadata={
                "net_score": round(net_score, 4),
                "n_signals": len(self._signals),
                "total_weight": round(total_weight, 2),
            },
        )

    # ------------------------------------------------------------------
    # Market view
    # ------------------------------------------------------------------

    def get_market_view(self) -> dict:
        """Overall market assessment with confidence.

        Returns
        -------
        dict
            ``{"direction": str, "confidence": float, "signals_bullish": int,
              "signals_bearish": int, "signals_neutral": int,
              "iv_regime": str | None, "sources": list}``
        """
        agg = self.aggregate()

        n_bull = sum(
            1 for s in self._signals
            if s.signal_type == SignalType.BULLISH
        )
        n_bear = sum(
            1 for s in self._signals
            if s.signal_type == SignalType.BEARISH
        )
        n_neut = len(self._signals) - n_bull - n_bear

        # Determine IV regime from any IV-related signal
        iv_regime = None
        for s in self._signals:
            if s.source in ("iv_mean_reversion",):
                iv_regime = s.metadata.get("regime")
                break

        return {
            "direction": agg.signal_type.value,
            "confidence": round(agg.strength, 4),
            "signals_bullish": n_bull,
            "signals_bearish": n_bear,
            "signals_neutral": n_neut,
            "iv_regime": iv_regime,
            "sources": [s.source for s in self._signals],
        }

    # ------------------------------------------------------------------
    # Strategy recommendation
    # ------------------------------------------------------------------

    def strategy_recommendation(
        self,
        signals: Sequence[Signal] | None = None,
        strategies: Sequence[StrategyType] | None = None,
    ) -> list[dict]:
        """Suggest strategies that fit the current signal profile.

        Parameters
        ----------
        signals : list of Signal, optional
            If *None*, uses the signals already added via :meth:`add_signal`.
        strategies : list of StrategyType, optional
            Candidate strategies to consider.  Default is the full enum.

        Returns
        -------
        list of dict
            Each dict: ``{"strategy": StrategyType, "score": float, "reason": str}``
            sorted best-first.
        """
        if signals is not None:
            old = self._signals
            self._signals = list(signals)
            agg = self.aggregate()
            view = self.get_market_view()
            self._signals = old
        else:
            agg = self.aggregate()
            view = self.get_market_view()

        if strategies is None:
            strategies = list(StrategyType)

        iv_high = view.get("iv_regime") == "HIGH"
        iv_low = view.get("iv_regime") == "LOW"
        direction = agg.signal_type
        strength = agg.strength

        scored: list[dict] = []

        for strat in strategies:
            score, reason = self._score_strategy(strat, direction, strength, iv_high, iv_low)
            if score > 0:
                scored.append({"strategy": strat, "score": round(score, 4), "reason": reason})

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _direction_value(sig_type: SignalType) -> float:
        if sig_type == SignalType.BULLISH:
            return 1.0
        elif sig_type == SignalType.BEARISH:
            return -1.0
        return 0.0

    @staticmethod
    def _score_strategy(
        strat: StrategyType,
        direction: SignalType,
        strength: float,
        iv_high: bool,
        iv_low: bool,
    ) -> tuple[float, str]:
        """Heuristic scoring for a strategy given market conditions."""

        # Premium-selling strategies: best in high IV, neutral outlook
        if strat == StrategyType.IRON_CONDOR:
            base = 0.5 if direction == SignalType.NEUTRAL else 0.2
            iv_bonus = 0.4 if iv_high else 0.0
            return base + iv_bonus, "Range-bound + high IV favours iron condors"

        if strat == StrategyType.IRON_BUTTERFLY:
            base = 0.4 if direction == SignalType.NEUTRAL else 0.15
            iv_bonus = 0.45 if iv_high else 0.0
            return base + iv_bonus, "Pinning near ATM + high IV"

        if strat == StrategyType.SHORT_STRADDLE:
            base = 0.4 if direction == SignalType.NEUTRAL else 0.1
            iv_bonus = 0.5 if iv_high else 0.0
            return base + iv_bonus, "High IV + low expected move"

        if strat == StrategyType.SHORT_STRANGLE:
            base = 0.45 if direction == SignalType.NEUTRAL else 0.15
            iv_bonus = 0.45 if iv_high else 0.0
            return base + iv_bonus, "High IV + range-bound"

        # Directional spreads
        if strat == StrategyType.BULL_CALL_SPREAD:
            if direction == SignalType.BULLISH:
                return 0.5 + strength * 0.4, "Bullish signal supports debit call spread"
            return 0.1, "Not favoured in current direction"

        if strat == StrategyType.BEAR_PUT_SPREAD:
            if direction == SignalType.BEARISH:
                return 0.5 + strength * 0.4, "Bearish signal supports debit put spread"
            return 0.1, "Not favoured in current direction"

        if strat == StrategyType.CALENDAR_SPREAD:
            base = 0.3
            iv_bonus = 0.3 if iv_low else 0.0  # buy when IV is low
            return base + iv_bonus, "Calendar benefits from rising IV"

        if strat == StrategyType.RATIO_SPREAD:
            base = 0.25 if iv_high else 0.1
            return base + strength * 0.2, "Ratio spread in high IV"

        if strat == StrategyType.JADE_LIZARD:
            if direction == SignalType.BULLISH and iv_high:
                return 0.7, "Bullish + high IV ideal for jade lizard"
            return 0.15, "Conditions not ideal"

        # CUSTOM
        return 0.1, "No specific conditions matched"

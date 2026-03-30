"""Strategy manager: registry, scanning, and position monitoring."""

from __future__ import annotations

import logging
from typing import Any

from options_bot.core.models import (
    MarketData,
    OptionChain,
    Signal,
    StrategyPosition,
    StrategyType,
)
from options_bot.strategies.base import BaseStrategy
from options_bot.strategies.iron_butterfly import IronButterfly
from options_bot.strategies.iron_condor import IronCondor
from options_bot.strategies.jade_lizard import JadeLizard
from options_bot.strategies.spreads import (
    BearPutSpread,
    BullCallSpread,
    CalendarSpread,
    RatioSpread,
)
from options_bot.strategies.straddle_strangle import ShortStraddle, ShortStrangle

logger = logging.getLogger(__name__)

# Mapping from strategy name / type to concrete class (with default params)
_STRATEGY_REGISTRY: dict[str, type[BaseStrategy]] = {
    "iron_condor": IronCondor,
    "iron_butterfly": IronButterfly,
    "short_straddle": ShortStraddle,
    "short_strangle": ShortStrangle,
    "bull_call_spread": BullCallSpread,
    "bear_put_spread": BearPutSpread,
    "calendar_spread": CalendarSpread,
    "ratio_spread": RatioSpread,
    "jade_lizard": JadeLizard,
}


class StrategyManager:
    """Central hub that owns strategy instances and coordinates scanning,
    entry checks, and position monitoring.
    """

    def __init__(self) -> None:
        self._strategies: dict[str, BaseStrategy] = {}

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register_strategy(self, strategy: BaseStrategy) -> None:
        """Register a strategy instance.  Overwrites any existing strategy
        with the same ``strategy_type`` value.
        """
        key = strategy.strategy_type.value
        self._strategies[key] = strategy
        logger.info("Registered strategy: %s (%s)", strategy.name, key)

    def register_defaults(self, **overrides: dict[str, Any]) -> None:
        """Instantiate and register all built-in strategies with default (or
        overridden) parameters.

        Parameters
        ----------
        overrides:
            Keys are strategy type values (e.g. ``"iron_condor"``), values
            are dicts of constructor kwargs.
        """
        for key, cls in _STRATEGY_REGISTRY.items():
            kwargs = overrides.get(key, {})
            self.register_strategy(cls(**kwargs))

    # ------------------------------------------------------------------
    # Lookup
    # ------------------------------------------------------------------

    def get_strategy(self, name: str) -> BaseStrategy | None:
        """Return the registered strategy by type value or name."""
        return self._strategies.get(name)

    def get_enabled_strategies(
        self,
        config: dict[str, Any],
    ) -> list[BaseStrategy]:
        """Return strategies enabled in *config*.

        Expected config shape::

            {
                "enabled_strategies": ["iron_condor", "short_strangle", ...],
            }

        If ``enabled_strategies`` is missing or empty, return all registered
        strategies.
        """
        enabled_keys: list[str] = config.get("enabled_strategies", [])
        if not enabled_keys:
            return list(self._strategies.values())
        return [
            s for key, s in self._strategies.items()
            if key in enabled_keys
        ]

    @property
    def all_strategies(self) -> list[BaseStrategy]:
        return list(self._strategies.values())

    # ------------------------------------------------------------------
    # Scanning
    # ------------------------------------------------------------------

    def scan_all(
        self,
        option_chain: OptionChain,
        market_data: MarketData,
        signals: list[Signal],
        config: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Run ``scan`` on every enabled strategy and return aggregated
        candidate setups.

        Each returned dict includes a ``"strategy"`` key pointing to the
        originating :class:`BaseStrategy` instance.
        """
        strategies = (
            self.get_enabled_strategies(config)
            if config
            else self.all_strategies
        )
        all_setups: list[dict[str, Any]] = []
        for strategy in strategies:
            try:
                setups = strategy.scan(option_chain, market_data, signals)
                for setup in setups:
                    setup["strategy"] = strategy
                    setup["strategy_name"] = strategy.name
                    setup["strategy_type"] = strategy.strategy_type.value
                all_setups.extend(setups)
            except Exception:
                logger.exception(
                    "Error scanning with strategy %s", strategy.name,
                )
        return all_setups

    # ------------------------------------------------------------------
    # Position monitoring
    # ------------------------------------------------------------------

    def monitor_positions(
        self,
        positions: list[StrategyPosition],
        market_data: MarketData,
    ) -> list[dict[str, Any]]:
        """Check every open position for exit signals or adjustments.

        Returns a list of action dicts with keys:
            - ``position``: the :class:`StrategyPosition`
            - ``action``: ``"exit"`` | ``"adjust"``
            - ``reason``: human-readable explanation
            - ``details``: adjustment details (for ``"adjust"`` actions)
        """
        actions: list[dict[str, Any]] = []

        for position in positions:
            strategy = self._strategies.get(position.strategy_type.value)
            if strategy is None:
                logger.warning(
                    "No registered strategy for type %s, skipping.",
                    position.strategy_type.value,
                )
                continue

            # Check exit
            try:
                should_exit, reason = strategy.should_exit(position, market_data)
                if should_exit:
                    actions.append({
                        "position": position,
                        "action": "exit",
                        "reason": reason,
                        "details": {},
                    })
                    continue  # no need to check adjustments if exiting
            except Exception:
                logger.exception(
                    "Error checking exit for %s", position.tag,
                )

            # Check adjustments
            try:
                adjustments = strategy.adjust(position, market_data)
                for adj in adjustments:
                    actions.append({
                        "position": position,
                        "action": "adjust",
                        "reason": adj.get("reason", ""),
                        "details": adj,
                    })
            except Exception:
                logger.exception(
                    "Error checking adjustments for %s", position.tag,
                )

        return actions

    # ------------------------------------------------------------------
    # Factory
    # ------------------------------------------------------------------

    @staticmethod
    def create_strategy(
        name: str,
        **kwargs: Any,
    ) -> BaseStrategy:
        """Factory method: create a strategy instance by name.

        Parameters
        ----------
        name:
            Strategy type value, e.g. ``"iron_condor"``, ``"jade_lizard"``.
        kwargs:
            Forwarded to the strategy constructor.

        Raises
        ------
        ValueError
            If *name* is not a known strategy type.
        """
        cls = _STRATEGY_REGISTRY.get(name)
        if cls is None:
            available = ", ".join(sorted(_STRATEGY_REGISTRY))
            raise ValueError(
                f"Unknown strategy {name!r}. Available: {available}"
            )
        return cls(**kwargs)

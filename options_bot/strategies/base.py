"""Base strategy abstract class for the Indian options trading bot."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

from options_bot.core.models import (
    MarketData,
    OptionChain,
    Signal,
    StrategyPosition,
    StrategyType,
)

logger = logging.getLogger(__name__)


class BaseStrategy(ABC):
    """Abstract base for all option strategies.

    Every concrete strategy must define how to scan for setups, construct
    positions, and decide on entry / exit / adjustment.
    """

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable strategy name."""

    @property
    @abstractmethod
    def strategy_type(self) -> StrategyType:
        """Enum member that identifies this strategy."""

    @property
    @abstractmethod
    def description(self) -> str:
        """Short description of the strategy mechanics."""

    # ------------------------------------------------------------------
    # Abstract methods
    # ------------------------------------------------------------------

    @abstractmethod
    def scan(
        self,
        option_chain: OptionChain,
        market_data: MarketData,
        signals: list[Signal],
    ) -> list[dict[str, Any]]:
        """Scan the option chain and return candidate setups.

        Each setup is a dict describing a potential trade (strikes, expiry,
        expected premium, etc.).
        """

    @abstractmethod
    def construct(
        self,
        option_chain: OptionChain,
        setup: dict[str, Any],
    ) -> StrategyPosition:
        """Turn a candidate setup into a fully-specified ``StrategyPosition``."""

    @abstractmethod
    def should_enter(
        self,
        signals: list[Signal],
        risk_check: dict[str, Any],
    ) -> bool:
        """Return *True* if the signals and risk parameters favour entry."""

    @abstractmethod
    def should_exit(
        self,
        position: StrategyPosition,
        market_data: MarketData,
    ) -> tuple[bool, str]:
        """Decide whether to close *position*.

        Returns ``(True, reason)`` if an exit is warranted, otherwise
        ``(False, "")``.
        """

    @abstractmethod
    def adjust(
        self,
        position: StrategyPosition,
        market_data: MarketData,
    ) -> list[dict[str, Any]]:
        """Return a list of adjustment actions for a live position.

        Each action is a dict with keys like ``action`` ("roll", "add_leg",
        "close_leg", "convert"), plus the relevant contract details.
        """

    # ------------------------------------------------------------------
    # Concrete helpers
    # ------------------------------------------------------------------

    def validate_entry(
        self,
        position: StrategyPosition,
        risk_manager: Any,
    ) -> bool:
        """Validate a proposed entry against the risk manager.

        Parameters
        ----------
        position:
            The candidate position to validate.
        risk_manager:
            Object exposing ``check_position(position) -> dict`` with at
            least a ``"approved"`` boolean key.

        Returns
        -------
        bool
            *True* when the risk manager approves the trade.
        """
        if not position.legs:
            logger.warning("Cannot validate entry: position has no legs.")
            return False

        try:
            result = risk_manager.check_position(position)
        except Exception:
            logger.exception("Risk manager raised an exception during check.")
            return False

        approved = result.get("approved", False)
        if not approved:
            reason = result.get("reason", "unknown")
            logger.info(
                "Entry rejected by risk manager for %s: %s",
                self.name,
                reason,
            )
        return approved

    def calculate_reward_risk(self, position: StrategyPosition) -> float:
        """Return the reward-to-risk ratio for *position*.

        For credit strategies the ratio is ``max_profit / abs(max_loss)``.
        For debit strategies the ratio is ``max_profit / net_premium_paid``.
        Returns 0.0 when the ratio cannot be computed.
        """
        if position.max_loss == 0:
            return 0.0
        return abs(position.max_profit / position.max_loss)

    # ------------------------------------------------------------------
    # Dunder helpers
    # ------------------------------------------------------------------

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} name={self.name!r}>"

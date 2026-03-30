"""Walk-forward optimisation for strategy parameter tuning."""

from __future__ import annotations

import copy
import itertools
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Sequence

import numpy as np
import pandas as pd

from options_bot.backtesting.engine import BacktestEngine, BacktestResult
from options_bot.backtesting.metrics import PerformanceMetrics
from options_bot.core.exceptions import BacktestError


# ---------------------------------------------------------------------------
# Result containers
# ---------------------------------------------------------------------------

@dataclass
class WindowResult:
    """Result of a single in-sample / out-of-sample window."""
    window_index: int
    in_sample_start: date
    in_sample_end: date
    out_sample_start: date
    out_sample_end: date
    best_params: dict
    in_sample_metrics: dict
    out_sample_metrics: dict


@dataclass
class WalkForwardResult:
    """Aggregated walk-forward optimisation result."""
    windows: list[WindowResult] = field(default_factory=list)
    combined_out_sample_equity: pd.Series = field(
        default_factory=lambda: pd.Series(dtype=float)
    )
    combined_out_sample_metrics: dict = field(default_factory=dict)
    robustness: float = 0.0


# ---------------------------------------------------------------------------
# Optimiser
# ---------------------------------------------------------------------------

class WalkForwardOptimizer:
    """Rolling walk-forward optimiser.

    The data is split into successive windows of *in_sample_days* +
    *out_sample_days*.  For each window the strategy parameters are
    optimised on the in-sample portion, then the best parameters are
    validated on the out-of-sample portion.

    Parameters
    ----------
    engine_kwargs : dict
        Keyword arguments forwarded to :class:`BacktestEngine` (e.g.
        ``initial_capital``, ``commission``, ``slippage``).
    objective : str
        Metric to maximise during in-sample optimisation.
        Must be a key in :meth:`PerformanceMetrics.summary`.
    """

    def __init__(
        self,
        engine_kwargs: dict | None = None,
        objective: str = "sharpe_ratio",
    ):
        self._engine_kwargs = engine_kwargs or {}
        self._objective = objective

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def optimize(
        self,
        strategy_factory: Any,
        data: dict[date, dict],
        in_sample_days: int = 180,
        out_sample_days: int = 60,
        step_days: int = 60,
        param_grid: dict[str, list] | None = None,
    ) -> WalkForwardResult:
        """Run walk-forward optimisation.

        Parameters
        ----------
        strategy_factory
            A callable ``strategy_factory(**params)`` that returns a strategy
            instance compatible with :class:`BacktestEngine`.
        data : dict[date, dict]
            Full historical data keyed by date.
        in_sample_days : int
            Length of the in-sample training window.
        out_sample_days : int
            Length of the out-of-sample validation window.
        step_days : int
            How many days to step forward between windows.
        param_grid : dict[str, list]
            Parameter grid to search.  E.g.
            ``{"period": [10, 20], "threshold": [0.5, 1.0]}``.

        Returns
        -------
        WalkForwardResult
        """
        if param_grid is None:
            param_grid = {}

        sorted_dates = sorted(data.keys())
        if not sorted_dates:
            raise BacktestError("Data is empty")

        first_date = sorted_dates[0]
        last_date = sorted_dates[-1]

        windows: list[WindowResult] = []
        oos_equities: list[pd.Series] = []

        window_idx = 0
        is_start = first_date

        while True:
            is_end = is_start + timedelta(days=in_sample_days - 1)
            oos_start = is_end + timedelta(days=1)
            oos_end = oos_start + timedelta(days=out_sample_days - 1)

            if oos_end > last_date:
                break

            # Filter data for each window
            is_data = {d: data[d] for d in sorted_dates if is_start <= d <= is_end}
            oos_data = {d: data[d] for d in sorted_dates if oos_start <= d <= oos_end}

            if not is_data or not oos_data:
                is_start += timedelta(days=step_days)
                continue

            # In-sample optimisation
            best_params = self._optimize_in_sample(
                strategy_factory, is_data, param_grid
            )

            # In-sample backtest with best params (for reporting)
            is_result = self._run_backtest(strategy_factory, is_data, best_params)
            is_metrics_obj = PerformanceMetrics(is_result.equity_curve, is_result.trades)
            is_metrics = is_metrics_obj.summary()

            # Out-of-sample validation
            oos_metrics = self._validate_out_sample(
                strategy_factory, oos_data, best_params
            )

            oos_result = self._run_backtest(strategy_factory, oos_data, best_params)
            oos_equities.append(oos_result.equity_curve)

            windows.append(WindowResult(
                window_index=window_idx,
                in_sample_start=is_start,
                in_sample_end=is_end,
                out_sample_start=oos_start,
                out_sample_end=oos_end,
                best_params=best_params,
                in_sample_metrics=is_metrics,
                out_sample_metrics=oos_metrics,
            ))

            window_idx += 1
            is_start += timedelta(days=step_days)

        # Combine OOS equity curves
        combined_eq = self._combine_equity_curves(oos_equities)
        combined_metrics = {}
        if len(combined_eq) > 1:
            pm = PerformanceMetrics(combined_eq, [])
            combined_metrics = pm.summary()

        rob = self.robustness_score(windows)

        return WalkForwardResult(
            windows=windows,
            combined_out_sample_equity=combined_eq,
            combined_out_sample_metrics=combined_metrics,
            robustness=rob,
        )

    # ------------------------------------------------------------------
    # In-sample optimisation
    # ------------------------------------------------------------------

    def _optimize_in_sample(
        self,
        strategy_factory: Any,
        data: dict[date, dict],
        param_grid: dict[str, list],
    ) -> dict:
        """Grid search over *param_grid*, return best params.

        If the grid is empty, returns ``{}``.
        """
        if not param_grid:
            return {}

        keys = list(param_grid.keys())
        values = list(param_grid.values())
        combos = list(itertools.product(*values))

        best_score = -np.inf
        best_params: dict = {}

        for combo in combos:
            params = dict(zip(keys, combo))
            result = self._run_backtest(strategy_factory, data, params)
            pm = PerformanceMetrics(result.equity_curve, result.trades)
            score = pm.summary().get(self._objective, 0.0)

            if score > best_score:
                best_score = score
                best_params = params

        return best_params

    # ------------------------------------------------------------------
    # Out-of-sample validation
    # ------------------------------------------------------------------

    def _validate_out_sample(
        self,
        strategy_factory: Any,
        data: dict[date, dict],
        params: dict,
    ) -> dict:
        """Run the strategy with *params* on out-of-sample *data*.

        Returns the summary metrics dict.
        """
        result = self._run_backtest(strategy_factory, data, params)
        pm = PerformanceMetrics(result.equity_curve, result.trades)
        return pm.summary()

    # ------------------------------------------------------------------
    # Robustness score
    # ------------------------------------------------------------------

    @staticmethod
    def robustness_score(windows: Sequence[WindowResult]) -> float:
        """Compute a robustness score in [0, 1].

        The score is the ratio of windows where the out-of-sample objective
        is positive (profitable) to the total number of windows, weighted
        by the consistency of out-of-sample vs in-sample performance.

        A score of 1.0 means every window was profitable OOS.
        """
        if not windows:
            return 0.0

        n_profitable = 0
        ratios = []

        for w in windows:
            oos_return = w.out_sample_metrics.get("total_return", 0.0)
            is_return = w.in_sample_metrics.get("total_return", 0.0)

            if oos_return > 0:
                n_profitable += 1

            # Ratio of OOS / IS performance (capped at 1.0)
            if is_return > 0 and oos_return > 0:
                ratios.append(min(oos_return / is_return, 1.0))
            elif oos_return > 0:
                ratios.append(0.5)
            else:
                ratios.append(0.0)

        profitability = n_profitable / len(windows)
        consistency = float(np.mean(ratios)) if ratios else 0.0

        # Weighted combination
        return round(0.6 * profitability + 0.4 * consistency, 4)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _run_backtest(
        self,
        strategy_factory: Any,
        data: dict[date, dict],
        params: dict,
    ) -> BacktestResult:
        engine = BacktestEngine(**self._engine_kwargs)
        strategy = strategy_factory(**params)
        return engine.run(strategy, data)

    @staticmethod
    def _combine_equity_curves(curves: list[pd.Series]) -> pd.Series:
        """Chain multiple OOS equity curves, adjusting for continuity."""
        if not curves:
            return pd.Series(dtype=float)

        combined = curves[0].copy()
        for curve in curves[1:]:
            if len(curve) == 0:
                continue
            # Scale so the next curve starts where the previous ended
            offset = combined.iloc[-1] - curve.iloc[0]
            adjusted = curve + offset
            # Drop the first point to avoid overlap
            combined = pd.concat([combined, adjusted.iloc[1:]])

        return combined

"""Performance metrics for backtest results."""

from __future__ import annotations

from dataclasses import dataclass
from io import StringIO
from typing import Sequence

import numpy as np
import pandas as pd

from options_bot.core.models import Trade


_TRADING_DAYS_PER_YEAR = 252
_RISK_FREE_RATE = 0.065  # ~6.5 % Indian G-sec benchmark


class PerformanceMetrics:
    """Compute a comprehensive set of performance metrics from an equity curve
    and a list of completed trades.

    Parameters
    ----------
    equity_curve : pd.Series
        Daily portfolio equity indexed by datetime / date.
    trades : list[Trade]
        Completed trades (with ``net_pnl`` populated).
    risk_free_rate : float
        Annualised risk-free rate for Sharpe / Sortino.
    """

    def __init__(
        self,
        equity_curve: pd.Series,
        trades: Sequence[Trade],
        risk_free_rate: float = _RISK_FREE_RATE,
    ):
        self._equity = equity_curve.sort_index().astype(float)
        self._trades = list(trades)
        self._rf = risk_free_rate

        # Pre-compute daily returns
        self._daily_returns = self._equity.pct_change().dropna()

    # ------------------------------------------------------------------
    # Return metrics
    # ------------------------------------------------------------------

    @property
    def total_return(self) -> float:
        """Total return as a decimal (e.g. 0.25 = 25 %)."""
        if len(self._equity) < 2:
            return 0.0
        return (self._equity.iloc[-1] / self._equity.iloc[0]) - 1.0

    @property
    def cagr(self) -> float:
        """Compound Annual Growth Rate."""
        if len(self._equity) < 2:
            return 0.0
        n_days = (self._equity.index[-1] - self._equity.index[0]).days
        if n_days <= 0:
            return 0.0
        years = n_days / 365.25
        total = self._equity.iloc[-1] / self._equity.iloc[0]
        if total <= 0:
            return -1.0
        return float(total ** (1.0 / years) - 1.0)

    @property
    def sharpe_ratio(self) -> float:
        """Annualised Sharpe ratio."""
        if len(self._daily_returns) < 2:
            return 0.0
        excess = self._daily_returns - self._rf / _TRADING_DAYS_PER_YEAR
        std = float(excess.std(ddof=1))
        if std == 0:
            return 0.0
        return float(excess.mean() / std * np.sqrt(_TRADING_DAYS_PER_YEAR))

    @property
    def sortino_ratio(self) -> float:
        """Annualised Sortino ratio (downside deviation only)."""
        if len(self._daily_returns) < 2:
            return 0.0
        excess = self._daily_returns - self._rf / _TRADING_DAYS_PER_YEAR
        downside = excess[excess < 0]
        if len(downside) == 0:
            return float("inf")
        downside_std = float(downside.std(ddof=1))
        if downside_std == 0:
            return float("inf")
        return float(excess.mean() / downside_std * np.sqrt(_TRADING_DAYS_PER_YEAR))

    @property
    def calmar_ratio(self) -> float:
        """CAGR / max drawdown."""
        mdd = self.max_drawdown
        if mdd == 0:
            return float("inf") if self.cagr > 0 else 0.0
        return self.cagr / mdd

    # ------------------------------------------------------------------
    # Drawdown
    # ------------------------------------------------------------------

    @property
    def max_drawdown(self) -> float:
        """Maximum drawdown as a positive decimal (e.g. 0.15 = 15 %)."""
        if len(self._equity) < 2:
            return 0.0
        running_max = self._equity.cummax()
        drawdowns = (self._equity - running_max) / running_max
        return float(-drawdowns.min())

    @property
    def max_drawdown_duration(self) -> int:
        """Longest drawdown duration in calendar days."""
        if len(self._equity) < 2:
            return 0
        running_max = self._equity.cummax()
        in_dd = self._equity < running_max

        max_dur = 0
        current_dur = 0
        prev_idx = None
        for idx, is_dd in in_dd.items():
            if is_dd:
                if prev_idx is not None:
                    current_dur += (idx - prev_idx).days
                else:
                    current_dur = 0
                prev_idx = idx
            else:
                max_dur = max(max_dur, current_dur)
                current_dur = 0
                prev_idx = None
        max_dur = max(max_dur, current_dur)
        return max_dur

    # ------------------------------------------------------------------
    # Trade statistics
    # ------------------------------------------------------------------

    @property
    def total_trades(self) -> int:
        return len(self._trades)

    @property
    def win_rate(self) -> float:
        """Fraction of winning trades (0-1)."""
        if not self._trades:
            return 0.0
        winners = sum(1 for t in self._trades if t.net_pnl > 0)
        return winners / len(self._trades)

    @property
    def avg_win(self) -> float:
        """Average PnL of winning trades."""
        wins = [t.net_pnl for t in self._trades if t.net_pnl > 0]
        return float(np.mean(wins)) if wins else 0.0

    @property
    def avg_loss(self) -> float:
        """Average PnL of losing trades (returned as negative)."""
        losses = [t.net_pnl for t in self._trades if t.net_pnl <= 0]
        return float(np.mean(losses)) if losses else 0.0

    @property
    def profit_factor(self) -> float:
        """Gross profit / gross loss."""
        gross_profit = sum(t.net_pnl for t in self._trades if t.net_pnl > 0)
        gross_loss = abs(sum(t.net_pnl for t in self._trades if t.net_pnl <= 0))
        if gross_loss == 0:
            return float("inf") if gross_profit > 0 else 0.0
        return gross_profit / gross_loss

    @property
    def expectancy(self) -> float:
        """Expected PnL per trade (win_rate * avg_win + loss_rate * avg_loss)."""
        if not self._trades:
            return 0.0
        wr = self.win_rate
        return wr * self.avg_win + (1 - wr) * self.avg_loss

    @property
    def avg_trade_duration(self) -> float:
        """Average trade duration in days."""
        durations = [
            t.duration_days for t in self._trades if t.duration_days is not None
        ]
        return float(np.mean(durations)) if durations else 0.0

    # ------------------------------------------------------------------
    # Monthly returns
    # ------------------------------------------------------------------

    @property
    def monthly_returns(self) -> pd.DataFrame:
        """Monthly returns as a Year x Month DataFrame (%)."""
        if len(self._daily_returns) == 0:
            return pd.DataFrame()
        monthly = self._equity.resample("ME").last().pct_change().dropna()
        df = pd.DataFrame({
            "year": monthly.index.year,
            "month": monthly.index.month,
            "return": monthly.values,
        })
        pivot = df.pivot_table(index="year", columns="month", values="return", aggfunc="sum")
        pivot.columns = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ][: len(pivot.columns)]
        return pivot

    # ------------------------------------------------------------------
    # Risk-adjusted return
    # ------------------------------------------------------------------

    @property
    def risk_adjusted_return(self) -> float:
        """CAGR / annualised volatility."""
        if len(self._daily_returns) < 2:
            return 0.0
        ann_vol = float(self._daily_returns.std(ddof=1) * np.sqrt(_TRADING_DAYS_PER_YEAR))
        if ann_vol == 0:
            return 0.0
        return self.cagr / ann_vol

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------

    def summary(self) -> dict:
        """Return a dict of all key metrics."""
        return {
            "total_return": round(self.total_return, 6),
            "cagr": round(self.cagr, 6),
            "sharpe_ratio": round(self.sharpe_ratio, 4),
            "sortino_ratio": round(self.sortino_ratio, 4),
            "calmar_ratio": round(self.calmar_ratio, 4),
            "max_drawdown": round(self.max_drawdown, 6),
            "max_drawdown_duration_days": self.max_drawdown_duration,
            "win_rate": round(self.win_rate, 4),
            "profit_factor": round(self.profit_factor, 4),
            "avg_win": round(self.avg_win, 2),
            "avg_loss": round(self.avg_loss, 2),
            "expectancy": round(self.expectancy, 2),
            "total_trades": self.total_trades,
            "avg_trade_duration_days": round(self.avg_trade_duration, 2),
            "risk_adjusted_return": round(self.risk_adjusted_return, 4),
        }

    def print_report(self) -> str:
        """Return a human-readable performance report."""
        s = self.summary()
        buf = StringIO()
        buf.write("=" * 50 + "\n")
        buf.write("       BACKTEST PERFORMANCE REPORT\n")
        buf.write("=" * 50 + "\n\n")

        buf.write("--- Returns ---\n")
        buf.write(f"  Total Return      : {s['total_return'] * 100:>10.2f} %\n")
        buf.write(f"  CAGR              : {s['cagr'] * 100:>10.2f} %\n")
        buf.write(f"  Risk-Adj Return   : {s['risk_adjusted_return']:>10.4f}\n\n")

        buf.write("--- Risk ---\n")
        buf.write(f"  Sharpe Ratio      : {s['sharpe_ratio']:>10.4f}\n")
        buf.write(f"  Sortino Ratio     : {s['sortino_ratio']:>10.4f}\n")
        buf.write(f"  Calmar Ratio      : {s['calmar_ratio']:>10.4f}\n")
        buf.write(f"  Max Drawdown      : {s['max_drawdown'] * 100:>10.2f} %\n")
        buf.write(f"  Max DD Duration   : {s['max_drawdown_duration_days']:>10d} days\n\n")

        buf.write("--- Trades ---\n")
        buf.write(f"  Total Trades      : {s['total_trades']:>10d}\n")
        buf.write(f"  Win Rate          : {s['win_rate'] * 100:>10.2f} %\n")
        buf.write(f"  Profit Factor     : {s['profit_factor']:>10.4f}\n")
        buf.write(f"  Avg Win           : {s['avg_win']:>10.2f}\n")
        buf.write(f"  Avg Loss          : {s['avg_loss']:>10.2f}\n")
        buf.write(f"  Expectancy/Trade  : {s['expectancy']:>10.2f}\n")
        buf.write(f"  Avg Duration      : {s['avg_trade_duration_days']:>10.2f} days\n")
        buf.write("=" * 50 + "\n")
        return buf.getvalue()

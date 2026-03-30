"""Technical indicators and composite signal generation."""

from __future__ import annotations

from datetime import datetime
from typing import Sequence

import numpy as np
import pandas as pd

from options_bot.core.models import Signal, SignalType


class TechnicalAnalyzer:
    """Standard technical indicators computed on pandas Series / DataFrames.

    All methods are static so callers need not hold state.  The
    ``generate_signals`` convenience method runs every indicator and returns
    a list of :class:`Signal` objects.
    """

    # ------------------------------------------------------------------
    # Individual indicators
    # ------------------------------------------------------------------

    @staticmethod
    def rsi(prices: pd.Series, period: int = 14) -> pd.Series:
        """Relative Strength Index (Wilder smoothing).

        Parameters
        ----------
        prices : pd.Series
            Close prices.
        period : int
            Look-back window (default 14).

        Returns
        -------
        pd.Series
            RSI values in [0, 100].
        """
        delta = prices.diff()
        gain = delta.clip(lower=0.0)
        loss = -delta.clip(upper=0.0)

        # Wilder (exponential) smoothing
        avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()

        rs = avg_gain / avg_loss.replace(0, np.nan)
        rsi_series = 100.0 - 100.0 / (1.0 + rs)
        return rsi_series

    @staticmethod
    def macd(
        prices: pd.Series,
        fast: int = 12,
        slow: int = 26,
        signal: int = 9,
    ) -> tuple[pd.Series, pd.Series, pd.Series]:
        """Moving Average Convergence Divergence.

        Returns
        -------
        tuple
            (macd_line, signal_line, histogram)
        """
        ema_fast = prices.ewm(span=fast, adjust=False).mean()
        ema_slow = prices.ewm(span=slow, adjust=False).mean()
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()
        histogram = macd_line - signal_line
        return macd_line, signal_line, histogram

    @staticmethod
    def bollinger_bands(
        prices: pd.Series,
        period: int = 20,
        std: float = 2.0,
    ) -> tuple[pd.Series, pd.Series, pd.Series]:
        """Bollinger Bands.

        Returns
        -------
        tuple
            (upper_band, middle_band, lower_band)
        """
        middle = prices.rolling(window=period).mean()
        rolling_std = prices.rolling(window=period).std(ddof=0)
        upper = middle + std * rolling_std
        lower = middle - std * rolling_std
        return upper, middle, lower

    @staticmethod
    def vwap(ohlcv_df: pd.DataFrame) -> pd.Series:
        """Volume-Weighted Average Price (intra-day or rolling).

        Expects columns: ``high``, ``low``, ``close``, ``volume``.
        """
        typical_price = (ohlcv_df["high"] + ohlcv_df["low"] + ohlcv_df["close"]) / 3.0
        cum_tp_vol = (typical_price * ohlcv_df["volume"]).cumsum()
        cum_vol = ohlcv_df["volume"].cumsum()
        return cum_tp_vol / cum_vol.replace(0, np.nan)

    @staticmethod
    def supertrend(
        ohlcv_df: pd.DataFrame,
        period: int = 10,
        multiplier: float = 3.0,
    ) -> pd.Series:
        """Supertrend indicator.

        Expects columns: ``high``, ``low``, ``close``.

        Returns
        -------
        pd.Series
            Supertrend value for each bar.  The trend flips when price
            crosses the band.
        """
        hl2 = (ohlcv_df["high"] + ohlcv_df["low"]) / 2.0
        atr = TechnicalAnalyzer.atr(ohlcv_df, period)

        upper_band = hl2 + multiplier * atr
        lower_band = hl2 - multiplier * atr

        close = ohlcv_df["close"]
        n = len(close)

        supertrend = pd.Series(np.nan, index=close.index)
        direction = pd.Series(1, index=close.index)  # 1 = up, -1 = down

        final_upper = upper_band.copy()
        final_lower = lower_band.copy()

        for i in range(1, n):
            # Final upper band
            if final_upper.iloc[i] < final_upper.iloc[i - 1] or close.iloc[i - 1] > final_upper.iloc[i - 1]:
                final_upper.iloc[i] = upper_band.iloc[i]
            else:
                final_upper.iloc[i] = final_upper.iloc[i - 1]

            # Final lower band
            if final_lower.iloc[i] > final_lower.iloc[i - 1] or close.iloc[i - 1] < final_lower.iloc[i - 1]:
                final_lower.iloc[i] = lower_band.iloc[i]
            else:
                final_lower.iloc[i] = final_lower.iloc[i - 1]

            # Direction
            if direction.iloc[i - 1] == 1:
                if close.iloc[i] < final_lower.iloc[i]:
                    direction.iloc[i] = -1
                else:
                    direction.iloc[i] = 1
            else:
                if close.iloc[i] > final_upper.iloc[i]:
                    direction.iloc[i] = 1
                else:
                    direction.iloc[i] = -1

            # Supertrend value
            if direction.iloc[i] == 1:
                supertrend.iloc[i] = final_lower.iloc[i]
            else:
                supertrend.iloc[i] = final_upper.iloc[i]

        # First bar
        supertrend.iloc[0] = final_upper.iloc[0]

        return supertrend

    @staticmethod
    def atr(ohlcv_df: pd.DataFrame, period: int = 14) -> pd.Series:
        """Average True Range.

        Expects columns: ``high``, ``low``, ``close``.
        """
        high = ohlcv_df["high"]
        low = ohlcv_df["low"]
        prev_close = ohlcv_df["close"].shift(1)

        tr1 = high - low
        tr2 = (high - prev_close).abs()
        tr3 = (low - prev_close).abs()
        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

        return true_range.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()

    @staticmethod
    def moving_averages(
        prices: pd.Series,
        periods: list[int] | None = None,
    ) -> dict[int, pd.Series]:
        """Simple Moving Averages for multiple periods.

        Returns
        -------
        dict
            Mapping of period -> SMA Series.
        """
        if periods is None:
            periods = [20, 50, 200]
        return {p: prices.rolling(window=p).mean() for p in periods}

    # ------------------------------------------------------------------
    # Composite signal generation
    # ------------------------------------------------------------------

    @classmethod
    def generate_signals(cls, ohlcv_df: pd.DataFrame) -> list[Signal]:
        """Run all indicators on *ohlcv_df* and return a list of signals.

        Expects columns: ``open``, ``high``, ``low``, ``close``, ``volume``.
        At least 200 rows are recommended for reliable MA signals.
        """
        signals: list[Signal] = []
        close = ohlcv_df["close"]
        last_close = float(close.iloc[-1])
        now = datetime.now()

        # --- RSI ---
        rsi_series = cls.rsi(close)
        last_rsi = float(rsi_series.iloc[-1]) if not rsi_series.empty else 50.0
        if last_rsi < 30:
            signals.append(Signal(
                signal_type=SignalType.BULLISH,
                strength=min((30 - last_rsi) / 30, 1.0),
                source="rsi",
                timestamp=now,
                metadata={"rsi": round(last_rsi, 2), "interpretation": "oversold"},
            ))
        elif last_rsi > 70:
            signals.append(Signal(
                signal_type=SignalType.BEARISH,
                strength=min((last_rsi - 70) / 30, 1.0),
                source="rsi",
                timestamp=now,
                metadata={"rsi": round(last_rsi, 2), "interpretation": "overbought"},
            ))
        else:
            signals.append(Signal(
                signal_type=SignalType.NEUTRAL,
                strength=0.1,
                source="rsi",
                timestamp=now,
                metadata={"rsi": round(last_rsi, 2), "interpretation": "neutral"},
            ))

        # --- MACD ---
        macd_line, signal_line, histogram = cls.macd(close)
        if len(histogram) >= 2:
            last_hist = float(histogram.iloc[-1])
            prev_hist = float(histogram.iloc[-2])
            if last_hist > 0 and prev_hist <= 0:
                signals.append(Signal(
                    signal_type=SignalType.BULLISH,
                    strength=0.6,
                    source="macd",
                    timestamp=now,
                    metadata={"histogram": round(last_hist, 4), "crossover": "bullish"},
                ))
            elif last_hist < 0 and prev_hist >= 0:
                signals.append(Signal(
                    signal_type=SignalType.BEARISH,
                    strength=0.6,
                    source="macd",
                    timestamp=now,
                    metadata={"histogram": round(last_hist, 4), "crossover": "bearish"},
                ))
            else:
                direction = SignalType.BULLISH if last_hist > 0 else SignalType.BEARISH
                signals.append(Signal(
                    signal_type=direction,
                    strength=0.3,
                    source="macd",
                    timestamp=now,
                    metadata={"histogram": round(last_hist, 4), "crossover": "none"},
                ))

        # --- Bollinger Bands ---
        upper, middle, lower = cls.bollinger_bands(close)
        if not upper.empty and not np.isnan(upper.iloc[-1]):
            bb_upper = float(upper.iloc[-1])
            bb_lower = float(lower.iloc[-1])
            bb_middle = float(middle.iloc[-1])
            bb_width = bb_upper - bb_lower
            if bb_width > 0:
                bb_pos = (last_close - bb_lower) / bb_width  # 0 = at lower, 1 = at upper
                if bb_pos >= 1.0:
                    signals.append(Signal(
                        signal_type=SignalType.BEARISH,
                        strength=min(bb_pos - 1.0 + 0.5, 1.0),
                        source="bollinger",
                        timestamp=now,
                        metadata={"bb_position": round(bb_pos, 4), "interpretation": "above_upper"},
                    ))
                elif bb_pos <= 0.0:
                    signals.append(Signal(
                        signal_type=SignalType.BULLISH,
                        strength=min(abs(bb_pos) + 0.5, 1.0),
                        source="bollinger",
                        timestamp=now,
                        metadata={"bb_position": round(bb_pos, 4), "interpretation": "below_lower"},
                    ))

        # --- Supertrend ---
        if len(ohlcv_df) >= 10:
            st = cls.supertrend(ohlcv_df)
            last_st = float(st.iloc[-1]) if not np.isnan(st.iloc[-1]) else last_close
            if last_close > last_st:
                signals.append(Signal(
                    signal_type=SignalType.BULLISH,
                    strength=0.6,
                    source="supertrend",
                    timestamp=now,
                    metadata={"supertrend": round(last_st, 2), "trend": "up"},
                ))
            else:
                signals.append(Signal(
                    signal_type=SignalType.BEARISH,
                    strength=0.6,
                    source="supertrend",
                    timestamp=now,
                    metadata={"supertrend": round(last_st, 2), "trend": "down"},
                ))

        # --- Moving average alignment ---
        mas = cls.moving_averages(close, [20, 50, 200])
        ma_vals = {}
        for p, s in mas.items():
            if len(s) >= p and not np.isnan(s.iloc[-1]):
                ma_vals[p] = float(s.iloc[-1])

        if len(ma_vals) == 3:
            if ma_vals[20] > ma_vals[50] > ma_vals[200]:
                signals.append(Signal(
                    signal_type=SignalType.BULLISH,
                    strength=0.7,
                    source="ma_alignment",
                    timestamp=now,
                    metadata={"ma20": round(ma_vals[20], 2), "ma50": round(ma_vals[50], 2), "ma200": round(ma_vals[200], 2), "alignment": "bullish"},
                ))
            elif ma_vals[20] < ma_vals[50] < ma_vals[200]:
                signals.append(Signal(
                    signal_type=SignalType.BEARISH,
                    strength=0.7,
                    source="ma_alignment",
                    timestamp=now,
                    metadata={"ma20": round(ma_vals[20], 2), "ma50": round(ma_vals[50], 2), "ma200": round(ma_vals[200], 2), "alignment": "bearish"},
                ))

        return signals

"""Open Interest analysis for signal generation."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

import numpy as np

from options_bot.core.models import OptionChain, Signal, SignalType


class OIAnalyzer:
    """Analyse option-chain Open Interest to derive support / resistance
    levels and directional signals."""

    # ------------------------------------------------------------------
    # Put-Call Ratio
    # ------------------------------------------------------------------

    @staticmethod
    def pcr(option_chain: OptionChain) -> float:
        """Compute Put-Call Ratio based on open interest.

        PCR = total_put_oi / total_call_oi
        """
        total_call_oi = sum(c.oi for c in option_chain.calls)
        total_put_oi = sum(p.oi for p in option_chain.puts)
        if total_call_oi == 0:
            return float("inf") if total_put_oi > 0 else 1.0
        return total_put_oi / total_call_oi

    @staticmethod
    def pcr_signal(pcr_value: float) -> Signal:
        """Generate a directional signal from the put-call ratio.

        * PCR < 0.7 -> excessively bullish crowd -> contrarian BEARISH
        * PCR > 1.3 -> excessively bearish crowd -> contrarian BULLISH
        * Otherwise NEUTRAL
        """
        if pcr_value < 0.7:
            strength = min((0.7 - pcr_value) / 0.7, 1.0)
            return Signal(
                signal_type=SignalType.BEARISH,
                strength=strength,
                source="pcr",
                timestamp=datetime.now(),
                metadata={"pcr": round(pcr_value, 4), "interpretation": "overbought"},
            )
        elif pcr_value > 1.3:
            strength = min((pcr_value - 1.3) / 1.3, 1.0)
            return Signal(
                signal_type=SignalType.BULLISH,
                strength=strength,
                source="pcr",
                timestamp=datetime.now(),
                metadata={"pcr": round(pcr_value, 4), "interpretation": "oversold"},
            )
        else:
            return Signal(
                signal_type=SignalType.NEUTRAL,
                strength=0.2,
                source="pcr",
                timestamp=datetime.now(),
                metadata={"pcr": round(pcr_value, 4), "interpretation": "neutral"},
            )

    # ------------------------------------------------------------------
    # Max Pain
    # ------------------------------------------------------------------

    @staticmethod
    def max_pain(option_chain: OptionChain) -> float:
        """Calculate the max-pain strike -- the price at which option writers
        incur the least total payout.

        For each candidate strike *K* we compute the total intrinsic value
        that all outstanding contracts would have if the underlying expired
        at *K*.  The strike that minimises this total is max pain.
        """
        if not option_chain.strikes:
            return 0.0

        min_pain = float("inf")
        mp_strike = option_chain.strikes[0]

        for k in option_chain.strikes:
            total_pain = 0.0
            for call in option_chain.calls:
                itm = max(k - call.strike, 0.0)
                total_pain += itm * call.oi
            for put in option_chain.puts:
                itm = max(put.strike - k, 0.0)
                total_pain += itm * put.oi
            if total_pain < min_pain:
                min_pain = total_pain
                mp_strike = k

        return mp_strike

    # ------------------------------------------------------------------
    # OI Buildup analysis
    # ------------------------------------------------------------------

    @staticmethod
    def oi_buildup(
        current_chain: OptionChain,
        prev_chain: OptionChain,
    ) -> dict:
        """Classify OI + price change into long/short buildup categories.

        For each strike we look at the *change in OI* and the *change in
        last price* of the option:

        +--------+---------+------------------+
        | OI chg | Price   | Interpretation   |
        +========+=========+==================+
        | +      | +       | Long buildup     |
        +--------+---------+------------------+
        | +      | -       | Short buildup    |
        +--------+---------+------------------+
        | -      | +       | Short covering   |
        +--------+---------+------------------+
        | -      | -       | Long unwinding   |
        +--------+---------+------------------+

        Returns a dict with keys ``calls`` and ``puts``, each containing a
        list of dicts per strike.
        """
        def _classify(oi_change: int, price_change: float) -> str:
            if oi_change > 0 and price_change > 0:
                return "long_buildup"
            elif oi_change > 0 and price_change <= 0:
                return "short_buildup"
            elif oi_change < 0 and price_change > 0:
                return "short_covering"
            elif oi_change < 0 and price_change <= 0:
                return "long_unwinding"
            return "no_change"

        def _build_map(quotes):
            return {q.strike: q for q in quotes}

        prev_calls = _build_map(prev_chain.calls)
        prev_puts = _build_map(prev_chain.puts)

        call_buildup = []
        for c in current_chain.calls:
            prev = prev_calls.get(c.strike)
            if prev is None:
                continue
            oi_chg = c.oi - prev.oi
            price_chg = c.last_price - prev.last_price
            call_buildup.append({
                "strike": c.strike,
                "oi_change": oi_chg,
                "price_change": round(price_chg, 2),
                "category": _classify(oi_chg, price_chg),
            })

        put_buildup = []
        for p in current_chain.puts:
            prev = prev_puts.get(p.strike)
            if prev is None:
                continue
            oi_chg = p.oi - prev.oi
            price_chg = p.last_price - prev.last_price
            put_buildup.append({
                "strike": p.strike,
                "oi_change": oi_chg,
                "price_change": round(price_chg, 2),
                "category": _classify(oi_chg, price_chg),
            })

        return {"calls": call_buildup, "puts": put_buildup}

    # ------------------------------------------------------------------
    # Support / resistance from OI concentration
    # ------------------------------------------------------------------

    @staticmethod
    def support_resistance_from_oi(
        option_chain: OptionChain,
        n_levels: int = 3,
    ) -> dict:
        """Identify key support and resistance levels from OI concentration.

        * **Resistance**: strikes with highest *call OI* above spot
          (call writers create a ceiling).
        * **Support**: strikes with highest *put OI* below spot
          (put writers create a floor).

        Returns
        -------
        dict
            ``{"resistance": [strike, ...], "support": [strike, ...],
              "max_call_oi_strike": float, "max_put_oi_strike": float}``
        """
        spot = option_chain.underlying_value

        # Calls above spot -> resistance
        calls_above = [(c.strike, c.oi) for c in option_chain.calls if c.strike >= spot]
        calls_above.sort(key=lambda x: x[1], reverse=True)
        resistance = [s for s, _ in calls_above[:n_levels]]

        # Puts below spot -> support
        puts_below = [(p.strike, p.oi) for p in option_chain.puts if p.strike <= spot]
        puts_below.sort(key=lambda x: x[1], reverse=True)
        support = [s for s, _ in puts_below[:n_levels]]

        max_call_strike = calls_above[0][0] if calls_above else 0.0
        max_put_strike = puts_below[0][0] if puts_below else 0.0

        return {
            "resistance": sorted(resistance),
            "support": sorted(support),
            "max_call_oi_strike": max_call_strike,
            "max_put_oi_strike": max_put_strike,
        }

    # ------------------------------------------------------------------
    # Composite OI change signal
    # ------------------------------------------------------------------

    @staticmethod
    def oi_change_signal(option_chain: OptionChain) -> Signal:
        """Derive a directional signal from changes in call / put OI.

        Uses ``change_in_oi`` field on each :class:`OptionQuote`.

        * Net *put OI addition* above spot -> bearish
        * Net *call OI addition* above spot -> bearish (writers selling ceiling)
        * But we use a simplified aggregate: if call OI is being added more
          aggressively than put OI at/near ATM, writers are capping upside ->
          mildly bearish.  Vice-versa for puts.
        """
        spot = option_chain.underlying_value
        atm = option_chain.atm_strike

        # Aggregate change_in_oi near ATM (+/- 5 strikes)
        atm_idx = (
            option_chain.strikes.index(atm) if atm in option_chain.strikes else 0
        )
        n_strikes = len(option_chain.strikes)
        lo = max(atm_idx - 5, 0)
        hi = min(atm_idx + 6, n_strikes)
        near_strikes = set(option_chain.strikes[lo:hi])

        call_oi_chg = sum(
            c.change_in_oi for c in option_chain.calls if c.strike in near_strikes
        )
        put_oi_chg = sum(
            p.change_in_oi for p in option_chain.puts if p.strike in near_strikes
        )

        total_chg = abs(call_oi_chg) + abs(put_oi_chg)
        if total_chg == 0:
            return Signal(
                signal_type=SignalType.NEUTRAL,
                strength=0.0,
                source="oi_change",
                timestamp=datetime.now(),
                metadata={"call_oi_chg": call_oi_chg, "put_oi_chg": put_oi_chg},
            )

        # Call writers adding OI -> resistance -> bearish pressure
        # Put writers adding OI -> support -> bullish pressure
        net = put_oi_chg - call_oi_chg  # positive => more put writing => support => bullish
        strength = min(abs(net) / total_chg, 1.0)

        if net > 0:
            sig_type = SignalType.BULLISH
        elif net < 0:
            sig_type = SignalType.BEARISH
        else:
            sig_type = SignalType.NEUTRAL

        return Signal(
            signal_type=sig_type,
            strength=strength,
            source="oi_change",
            timestamp=datetime.now(),
            metadata={
                "call_oi_chg": call_oi_chg,
                "put_oi_chg": put_oi_chg,
                "net": net,
            },
        )

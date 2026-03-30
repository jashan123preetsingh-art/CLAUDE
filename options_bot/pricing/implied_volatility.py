"""Implied volatility calculation using Newton-Raphson and bisection methods.

Supports building IV surfaces, skew analysis, and term-structure extraction
from NSE option chain data.
"""

from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd

from options_bot.core.models import OptionChain, OptionType
from options_bot.pricing.black_scholes import BlackScholes


class IVCalculationError(Exception):
    """Raised when IV calculation fails to converge."""


class ImpliedVolatility:
    """Implied volatility calculator with multiple numerical methods."""

    def __init__(self) -> None:
        self._bs = BlackScholes()

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def calculate(
        self,
        market_price: float,
        S: float,
        K: float,
        T: float,
        r: float,
        option_type: OptionType,
        method: str = "newton_raphson",
        tol: float = 1e-6,
        max_iter: int = 200,
    ) -> float:
        """Calculate implied volatility from the observed market price.

        Parameters
        ----------
        market_price : Observed option premium.
        S, K, T, r  : Standard BS parameters.
        option_type  : CALL or PUT.
        method       : 'newton_raphson' (default) or 'bisection'.
        tol          : Convergence tolerance.
        max_iter     : Maximum iterations.

        Returns
        -------
        Annualised implied volatility as a decimal (e.g. 0.20 for 20%).

        Raises
        ------
        IVCalculationError if the method fails to converge.
        """
        # Quick sanity: price must exceed intrinsic
        if T <= 0:
            raise IVCalculationError("Cannot compute IV at expiry (T <= 0).")

        intrinsic = max(S - K, 0.0) if option_type == OptionType.CALL else max(K - S, 0.0)
        if market_price < intrinsic - 1e-8:
            raise IVCalculationError(
                f"Market price {market_price:.4f} is below intrinsic {intrinsic:.4f}."
            )
        if market_price <= 0:
            raise IVCalculationError("Market price must be positive.")

        if method == "newton_raphson":
            return self.newton_raphson_iv(market_price, S, K, T, r, option_type, tol, max_iter)
        elif method == "bisection":
            return self.bisection_iv(market_price, S, K, T, r, option_type, tol, max_iter)
        else:
            raise ValueError(f"Unknown method: {method}. Use 'newton_raphson' or 'bisection'.")

    # ------------------------------------------------------------------
    # Newton-Raphson
    # ------------------------------------------------------------------

    def newton_raphson_iv(
        self,
        market_price: float,
        S: float,
        K: float,
        T: float,
        r: float,
        option_type: OptionType,
        tol: float = 1e-6,
        max_iter: int = 200,
    ) -> float:
        """Newton-Raphson method for IV.

        Uses vega as the derivative.  Falls back to bisection if vega is
        too small or if the iterate leaves [0.001, 10.0].
        """
        # Initial guess via Brenner-Subrahmanyam approximation
        sigma = self._initial_guess(market_price, S, K, T, r, option_type)

        for _ in range(max_iter):
            bs_price = self._bs.price(S, K, T, r, sigma, option_type)
            diff = bs_price - market_price

            if abs(diff) < tol:
                return sigma

            # Vega in absolute terms (not per-pct-point)
            vega = self._bs.vega(S, K, T, r, sigma) * 100.0

            if abs(vega) < 1e-12:
                # Vega too small -- fall back
                return self.bisection_iv(market_price, S, K, T, r, option_type, tol, max_iter)

            sigma -= diff / vega

            # Guard rails
            if sigma <= 0.001 or sigma > 10.0:
                return self.bisection_iv(market_price, S, K, T, r, option_type, tol, max_iter)

        raise IVCalculationError(
            f"Newton-Raphson failed to converge after {max_iter} iterations "
            f"(last sigma={sigma:.6f}, diff={diff:.6f})."
        )

    # ------------------------------------------------------------------
    # Bisection
    # ------------------------------------------------------------------

    def bisection_iv(
        self,
        market_price: float,
        S: float,
        K: float,
        T: float,
        r: float,
        option_type: OptionType,
        tol: float = 1e-6,
        max_iter: int = 200,
    ) -> float:
        """Bisection method for IV -- guaranteed convergence if bounds bracket root."""
        lo, hi = 0.001, 5.0

        price_lo = self._bs.price(S, K, T, r, lo, option_type)
        price_hi = self._bs.price(S, K, T, r, hi, option_type)

        # Widen upper bound if needed
        while price_hi < market_price and hi < 20.0:
            hi *= 2.0
            price_hi = self._bs.price(S, K, T, r, hi, option_type)

        if price_lo > market_price or price_hi < market_price:
            raise IVCalculationError(
                f"Bisection cannot bracket IV: price_lo={price_lo:.4f}, "
                f"price_hi={price_hi:.4f}, market={market_price:.4f}."
            )

        for _ in range(max_iter):
            mid = 0.5 * (lo + hi)
            price_mid = self._bs.price(S, K, T, r, mid, option_type)

            if abs(price_mid - market_price) < tol:
                return mid

            if price_mid > market_price:
                hi = mid
            else:
                lo = mid

            if (hi - lo) < tol * 0.01:
                return mid

        return 0.5 * (lo + hi)

    # ------------------------------------------------------------------
    # IV surface / skew / term structure
    # ------------------------------------------------------------------

    def iv_surface(self, option_chain: OptionChain) -> pd.DataFrame:
        """Build an IV surface DataFrame from a single-expiry option chain.

        Returns a DataFrame indexed by strike with columns
        ['strike', 'call_iv', 'put_iv', 'moneyness'].
        """
        rows: list[dict] = []
        spot = option_chain.underlying_value
        expiry = option_chain.expiry

        for strike in option_chain.strikes:
            row: dict = {"strike": strike, "moneyness": strike / spot if spot else 0.0}

            call = option_chain.get_call(strike)
            if call is not None and call.iv > 0:
                row["call_iv"] = call.iv
            else:
                row["call_iv"] = np.nan

            put = option_chain.get_put(strike)
            if put is not None and put.iv > 0:
                row["put_iv"] = put.iv
            else:
                row["put_iv"] = np.nan

            rows.append(row)

        df = pd.DataFrame(rows)
        if not df.empty:
            df = df.sort_values("strike").reset_index(drop=True)
        return df

    def iv_skew(self, option_chain: OptionChain, expiry=None) -> dict:
        """Calculate IV skew metrics for a given option chain.

        Returns
        -------
        dict with keys:
            atm_iv       -- IV at ATM strike
            skew_25d     -- 25-delta put IV minus 25-delta call IV
            skew_ratio   -- OTM put IV / OTM call IV
            smile_wings  -- average wing IV minus ATM IV
            put_skew     -- slope of put IV curve (per strike unit)
        """
        spot = option_chain.underlying_value
        atm = option_chain.atm_strike

        atm_call = option_chain.get_call(atm)
        atm_put = option_chain.get_put(atm)
        atm_iv = 0.0
        if atm_call and atm_call.iv > 0:
            atm_iv = atm_call.iv
        elif atm_put and atm_put.iv > 0:
            atm_iv = atm_put.iv

        # Collect OTM IVs
        otm_put_ivs: list[tuple[float, float]] = []
        otm_call_ivs: list[tuple[float, float]] = []

        for strike in option_chain.strikes:
            if strike < atm:
                p = option_chain.get_put(strike)
                if p and p.iv > 0:
                    otm_put_ivs.append((strike, p.iv))
            elif strike > atm:
                c = option_chain.get_call(strike)
                if c and c.iv > 0:
                    otm_call_ivs.append((strike, c.iv))

        # Skew ratio: avg OTM put IV / avg OTM call IV
        avg_put_iv = np.mean([iv for _, iv in otm_put_ivs]) if otm_put_ivs else 0.0
        avg_call_iv = np.mean([iv for _, iv in otm_call_ivs]) if otm_call_ivs else 0.0
        skew_ratio = avg_put_iv / avg_call_iv if avg_call_iv > 0 else 0.0

        # Smile wings
        wing_avg = np.mean([avg_put_iv, avg_call_iv]) if (avg_put_iv > 0 and avg_call_iv > 0) else 0.0
        smile_wings = wing_avg - atm_iv if atm_iv > 0 else 0.0

        # Simple put skew: linear slope (IV per strike)
        put_skew = 0.0
        if len(otm_put_ivs) >= 2:
            strikes_arr = np.array([s for s, _ in otm_put_ivs])
            ivs_arr = np.array([iv for _, iv in otm_put_ivs])
            coeffs = np.polyfit(strikes_arr, ivs_arr, 1)
            put_skew = float(coeffs[0])

        # 25-delta skew approximation using ~5% OTM strikes
        offset = 0.05 * spot
        skew_25d = 0.0
        put_25d = [iv for s, iv in otm_put_ivs if abs(s - (atm - offset)) < offset * 0.5]
        call_25d = [iv for s, iv in otm_call_ivs if abs(s - (atm + offset)) < offset * 0.5]
        if put_25d and call_25d:
            skew_25d = float(np.mean(put_25d) - np.mean(call_25d))

        return {
            "atm_iv": atm_iv,
            "skew_25d": skew_25d,
            "skew_ratio": float(skew_ratio),
            "smile_wings": float(smile_wings),
            "put_skew": put_skew,
        }

    def iv_term_structure(self, option_chains: list[OptionChain]) -> dict:
        """IV term structure across multiple expiries.

        Parameters
        ----------
        option_chains : list of OptionChain, each for a different expiry.

        Returns
        -------
        dict mapping expiry (date) -> atm_iv (float).
        """
        term: dict = {}

        for chain in sorted(option_chains, key=lambda c: c.expiry):
            atm = chain.atm_strike
            atm_call = chain.get_call(atm)
            atm_put = chain.get_put(atm)

            iv = 0.0
            if atm_call and atm_call.iv > 0 and atm_put and atm_put.iv > 0:
                iv = (atm_call.iv + atm_put.iv) / 2.0
            elif atm_call and atm_call.iv > 0:
                iv = atm_call.iv
            elif atm_put and atm_put.iv > 0:
                iv = atm_put.iv

            term[chain.expiry] = iv

        return term

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _initial_guess(
        self,
        market_price: float,
        S: float,
        K: float,
        T: float,
        r: float,
        option_type: OptionType,
    ) -> float:
        """Brenner-Subrahmanyam initial IV guess."""
        # sigma ≈ sqrt(2*pi/T) * C/S  (for ATM)
        guess = np.sqrt(2.0 * np.pi / T) * market_price / S
        return float(np.clip(guess, 0.05, 3.0))

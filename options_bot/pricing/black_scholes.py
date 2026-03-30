"""Black-Scholes option pricing model with Greeks calculation.

Implements the standard Black-Scholes-Merton framework for European option
pricing, tailored for Indian equity options (NIFTY, BANKNIFTY, stock options).
"""

from __future__ import annotations

import numpy as np
from scipy.stats import norm

from options_bot.core.models import Greeks, OptionType


class BlackScholes:
    """Black-Scholes pricing engine for European options.

    Parameters
    ----------
    S : float or array-like  -- Spot price of the underlying
    K : float or array-like  -- Strike price
    T : float or array-like  -- Time to expiry in years (e.g. 30/365)
    r : float                -- Risk-free rate (annualised, e.g. 0.07 for 7%)
    sigma : float or array   -- Volatility (annualised, e.g. 0.20 for 20%)
    option_type : OptionType -- CALL or PUT
    """

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _d1(S: float, K: float, T: float, r: float, sigma: float) -> float:
        """Calculate d1 of the Black-Scholes formula."""
        if T <= 0 or sigma <= 0:
            return np.inf if S > K else (-np.inf if S < K else 0.0)
        return (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))

    @staticmethod
    def _d2(S: float, K: float, T: float, r: float, sigma: float) -> float:
        """Calculate d2 of the Black-Scholes formula."""
        if T <= 0 or sigma <= 0:
            return np.inf if S > K else (-np.inf if S < K else 0.0)
        return (np.log(S / K) + (r - 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))

    @staticmethod
    def _d1_d2(S, K, T, r, sigma):
        """Return (d1, d2) handling edge cases for scalar or array inputs."""
        S = np.asarray(S, dtype=np.float64)
        K = np.asarray(K, dtype=np.float64)
        T = np.asarray(T, dtype=np.float64)
        sigma = np.asarray(sigma, dtype=np.float64)

        sqrt_T = np.sqrt(np.maximum(T, 0.0))
        denom = sigma * sqrt_T

        # Mask where computation is valid
        valid = (T > 0) & (sigma > 0)

        log_ratio = np.where(K > 0, np.log(np.maximum(S / np.maximum(K, 1e-15), 1e-15)), 0.0)

        d1 = np.where(
            valid,
            (log_ratio + (r + 0.5 * sigma ** 2) * T) / np.where(denom > 0, denom, 1.0),
            np.where(S > K, np.inf, np.where(S < K, -np.inf, 0.0)),
        )
        d2 = np.where(
            valid,
            d1 - denom,
            d1,
        )
        return d1, d2

    # ------------------------------------------------------------------
    # Price
    # ------------------------------------------------------------------

    def price(
        self,
        S: float,
        K: float,
        T: float,
        r: float,
        sigma: float,
        option_type: OptionType,
    ) -> float:
        """Return the Black-Scholes option price.

        At expiry (T=0) returns intrinsic value.
        """
        if T <= 0:
            if option_type == OptionType.CALL:
                return max(S - K, 0.0)
            return max(K - S, 0.0)

        d1 = self._d1(S, K, T, r, sigma)
        d2 = self._d2(S, K, T, r, sigma)

        if option_type == OptionType.CALL:
            return float(S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2))
        return float(K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1))

    # ------------------------------------------------------------------
    # Greeks
    # ------------------------------------------------------------------

    def delta(
        self,
        S: float,
        K: float,
        T: float,
        r: float,
        sigma: float,
        option_type: OptionType,
    ) -> float:
        """Option delta -- sensitivity of price to spot move."""
        if T <= 0:
            if option_type == OptionType.CALL:
                return 1.0 if S > K else (0.5 if S == K else 0.0)
            return -1.0 if S < K else (-0.5 if S == K else 0.0)

        d1 = self._d1(S, K, T, r, sigma)
        if option_type == OptionType.CALL:
            return float(norm.cdf(d1))
        return float(norm.cdf(d1) - 1.0)

    def gamma(
        self,
        S: float,
        K: float,
        T: float,
        r: float,
        sigma: float,
    ) -> float:
        """Option gamma -- rate of change of delta. Same for calls and puts."""
        if T <= 0 or sigma <= 0 or S <= 0:
            return 0.0

        d1 = self._d1(S, K, T, r, sigma)
        return float(norm.pdf(d1) / (S * sigma * np.sqrt(T)))

    def theta(
        self,
        S: float,
        K: float,
        T: float,
        r: float,
        sigma: float,
        option_type: OptionType,
    ) -> float:
        """Option theta -- time decay per calendar day (negative for long)."""
        if T <= 0 or sigma <= 0:
            return 0.0

        d1 = self._d1(S, K, T, r, sigma)
        d2 = self._d2(S, K, T, r, sigma)
        sqrt_T = np.sqrt(T)

        # Common term
        first_term = -(S * norm.pdf(d1) * sigma) / (2.0 * sqrt_T)

        if option_type == OptionType.CALL:
            annual = first_term - r * K * np.exp(-r * T) * norm.cdf(d2)
        else:
            annual = first_term + r * K * np.exp(-r * T) * norm.cdf(-d2)

        # Return per-calendar-day theta
        return float(annual / 365.0)

    def vega(
        self,
        S: float,
        K: float,
        T: float,
        r: float,
        sigma: float,
    ) -> float:
        """Option vega -- sensitivity to 1% change in IV.

        Returned per 1 percentage-point move in vol (i.e. divided by 100).
        """
        if T <= 0 or sigma <= 0:
            return 0.0

        d1 = self._d1(S, K, T, r, sigma)
        return float(S * norm.pdf(d1) * np.sqrt(T) / 100.0)

    def rho(
        self,
        S: float,
        K: float,
        T: float,
        r: float,
        sigma: float,
        option_type: OptionType,
    ) -> float:
        """Option rho -- sensitivity to 1% change in risk-free rate."""
        if T <= 0:
            return 0.0

        d2 = self._d2(S, K, T, r, sigma)

        if option_type == OptionType.CALL:
            return float(K * T * np.exp(-r * T) * norm.cdf(d2) / 100.0)
        return float(-K * T * np.exp(-r * T) * norm.cdf(-d2) / 100.0)

    def all_greeks(
        self,
        S: float,
        K: float,
        T: float,
        r: float,
        sigma: float,
        option_type: OptionType,
    ) -> Greeks:
        """Return all Greeks as a Greeks dataclass instance."""
        return Greeks(
            delta=self.delta(S, K, T, r, sigma, option_type),
            gamma=self.gamma(S, K, T, r, sigma),
            theta=self.theta(S, K, T, r, sigma, option_type),
            vega=self.vega(S, K, T, r, sigma),
            rho=self.rho(S, K, T, r, sigma, option_type),
            iv=sigma,
        )

    # ------------------------------------------------------------------
    # Vectorized batch methods (numpy arrays)
    # ------------------------------------------------------------------

    def price_vectorized(
        self,
        S: np.ndarray,
        K: np.ndarray,
        T: np.ndarray,
        r: float,
        sigma: np.ndarray,
        option_type: OptionType,
    ) -> np.ndarray:
        """Vectorized Black-Scholes price for arrays of inputs."""
        S = np.asarray(S, dtype=np.float64)
        K = np.asarray(K, dtype=np.float64)
        T = np.asarray(T, dtype=np.float64)
        sigma = np.asarray(sigma, dtype=np.float64)

        d1, d2 = self._d1_d2(S, K, T, r, sigma)

        if option_type == OptionType.CALL:
            prices = S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
            # At expiry use intrinsic
            expired = T <= 0
            prices = np.where(expired, np.maximum(S - K, 0.0), prices)
        else:
            prices = K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)
            expired = T <= 0
            prices = np.where(expired, np.maximum(K - S, 0.0), prices)

        return prices

    def delta_vectorized(
        self,
        S: np.ndarray,
        K: np.ndarray,
        T: np.ndarray,
        r: float,
        sigma: np.ndarray,
        option_type: OptionType,
    ) -> np.ndarray:
        """Vectorized delta calculation."""
        S = np.asarray(S, dtype=np.float64)
        K = np.asarray(K, dtype=np.float64)
        T = np.asarray(T, dtype=np.float64)
        sigma = np.asarray(sigma, dtype=np.float64)

        d1, _ = self._d1_d2(S, K, T, r, sigma)

        if option_type == OptionType.CALL:
            deltas = norm.cdf(d1)
            expired = T <= 0
            deltas = np.where(expired, np.where(S > K, 1.0, np.where(S == K, 0.5, 0.0)), deltas)
        else:
            deltas = norm.cdf(d1) - 1.0
            expired = T <= 0
            deltas = np.where(expired, np.where(S < K, -1.0, np.where(S == K, -0.5, 0.0)), deltas)

        return deltas

    def gamma_vectorized(
        self,
        S: np.ndarray,
        K: np.ndarray,
        T: np.ndarray,
        r: float,
        sigma: np.ndarray,
    ) -> np.ndarray:
        """Vectorized gamma calculation."""
        S = np.asarray(S, dtype=np.float64)
        K = np.asarray(K, dtype=np.float64)
        T = np.asarray(T, dtype=np.float64)
        sigma = np.asarray(sigma, dtype=np.float64)

        d1, _ = self._d1_d2(S, K, T, r, sigma)
        sqrt_T = np.sqrt(np.maximum(T, 1e-15))
        denom = S * sigma * sqrt_T

        valid = (T > 0) & (sigma > 0) & (S > 0)
        gammas = np.where(valid, norm.pdf(d1) / np.where(denom > 0, denom, 1.0), 0.0)
        return gammas

    def vega_vectorized(
        self,
        S: np.ndarray,
        K: np.ndarray,
        T: np.ndarray,
        r: float,
        sigma: np.ndarray,
    ) -> np.ndarray:
        """Vectorized vega (per 1 pct-point vol move)."""
        S = np.asarray(S, dtype=np.float64)
        T = np.asarray(T, dtype=np.float64)
        sigma = np.asarray(sigma, dtype=np.float64)

        d1, _ = self._d1_d2(S, np.asarray(K, dtype=np.float64), T, r, sigma)
        valid = (T > 0) & (sigma > 0)
        vegas = np.where(valid, S * norm.pdf(d1) * np.sqrt(np.maximum(T, 0.0)) / 100.0, 0.0)
        return vegas

    def theta_vectorized(
        self,
        S: np.ndarray,
        K: np.ndarray,
        T: np.ndarray,
        r: float,
        sigma: np.ndarray,
        option_type: OptionType,
    ) -> np.ndarray:
        """Vectorized theta (per calendar day)."""
        S = np.asarray(S, dtype=np.float64)
        K = np.asarray(K, dtype=np.float64)
        T = np.asarray(T, dtype=np.float64)
        sigma = np.asarray(sigma, dtype=np.float64)

        d1, d2 = self._d1_d2(S, K, T, r, sigma)
        sqrt_T = np.sqrt(np.maximum(T, 1e-15))
        valid = (T > 0) & (sigma > 0)

        first_term = -(S * norm.pdf(d1) * sigma) / (2.0 * sqrt_T)

        if option_type == OptionType.CALL:
            annual = first_term - r * K * np.exp(-r * T) * norm.cdf(d2)
        else:
            annual = first_term + r * K * np.exp(-r * T) * norm.cdf(-d2)

        thetas = np.where(valid, annual / 365.0, 0.0)
        return thetas

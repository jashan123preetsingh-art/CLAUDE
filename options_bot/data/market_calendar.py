"""NSE market calendar with holiday lists, trading-day calculations, and
expiry date logic for Indian derivatives markets.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

IST = ZoneInfo("Asia/Kolkata")

# NSE trading hours (normal session).
MARKET_OPEN = time(9, 15)
MARKET_CLOSE = time(15, 30)
PRE_OPEN_START = time(9, 0)
PRE_OPEN_END = time(9, 8)

# ---------------------------------------------------------------------------
# NSE holidays 2024-2026
#   Source: NSE circulars.  The 2026 list is provisional and should be
#   updated once the official circular is published (typically Dec/Jan).
# ---------------------------------------------------------------------------

_NSE_HOLIDAYS: set[date] = {
    # ---- 2024 ----
    date(2024, 1, 26),   # Republic Day
    date(2024, 3, 8),    # Maha Shivaratri
    date(2024, 3, 25),   # Holi
    date(2024, 3, 29),   # Good Friday
    date(2024, 4, 11),   # Id-Ul-Fitr (Ramadan)
    date(2024, 4, 14),   # Dr. Ambedkar Jayanti
    date(2024, 4, 17),   # Ram Navami
    date(2024, 4, 21),   # Mahavir Jayanti
    date(2024, 5, 1),    # Maharashtra Day
    date(2024, 5, 23),   # Buddha Purnima
    date(2024, 6, 17),   # Eid-Ul-Adha (Bakri Id)
    date(2024, 7, 17),   # Muharram
    date(2024, 8, 15),   # Independence Day
    date(2024, 9, 16),   # Milad-un-Nabi
    date(2024, 10, 2),   # Mahatma Gandhi Jayanti
    date(2024, 10, 12),  # Dussehra
    date(2024, 11, 1),   # Diwali (Laxmi Pujan)
    date(2024, 11, 15),  # Guru Nanak Jayanti
    date(2024, 12, 25),  # Christmas

    # ---- 2025 ----
    date(2025, 1, 26),   # Republic Day (Sunday – observed Mon if applicable; NSE closed)
    date(2025, 2, 26),   # Maha Shivaratri
    date(2025, 3, 14),   # Holi
    date(2025, 3, 31),   # Id-Ul-Fitr (Ramadan)
    date(2025, 4, 10),   # Mahavir Jayanti
    date(2025, 4, 14),   # Dr. Ambedkar Jayanti
    date(2025, 4, 18),   # Good Friday
    date(2025, 5, 1),    # Maharashtra Day
    date(2025, 5, 12),   # Buddha Purnima
    date(2025, 6, 7),    # Eid-Ul-Adha (Bakri Id)
    date(2025, 7, 6),    # Muharram
    date(2025, 8, 15),   # Independence Day
    date(2025, 8, 16),   # Janmashtami
    date(2025, 8, 27),   # Ganesh Chaturthi
    date(2025, 9, 5),    # Milad-un-Nabi
    date(2025, 10, 2),   # Mahatma Gandhi Jayanti / Dussehra
    date(2025, 10, 21),  # Diwali (Laxmi Pujan)
    date(2025, 10, 22),  # Diwali (Balipratipada)
    date(2025, 11, 5),   # Guru Nanak Jayanti
    date(2025, 12, 25),  # Christmas

    # ---- 2026 (provisional) ----
    date(2026, 1, 26),   # Republic Day
    date(2026, 2, 17),   # Maha Shivaratri
    date(2026, 3, 4),    # Holi
    date(2026, 3, 20),   # Id-Ul-Fitr (Ramadan)
    date(2026, 3, 30),   # Ram Navami
    date(2026, 4, 3),    # Good Friday
    date(2026, 4, 14),   # Dr. Ambedkar Jayanti
    date(2026, 5, 1),    # Maharashtra Day / Buddha Purnima
    date(2026, 5, 28),   # Eid-Ul-Adha (Bakri Id)
    date(2026, 6, 25),   # Muharram
    date(2026, 8, 15),   # Independence Day
    date(2026, 8, 25),   # Milad-un-Nabi
    date(2026, 10, 2),   # Mahatma Gandhi Jayanti
    date(2026, 10, 19),  # Dussehra
    date(2026, 11, 9),   # Diwali (Laxmi Pujan)
    date(2026, 11, 24),  # Guru Nanak Jayanti
    date(2026, 12, 25),  # Christmas
}


class NSECalendar:
    """NSE market calendar and expiry-date utilities.

    All date-time calculations use **Asia/Kolkata** timezone.
    """

    def __init__(self, extra_holidays: Optional[set[date]] = None) -> None:
        self._holidays = set(_NSE_HOLIDAYS)
        if extra_holidays:
            self._holidays |= extra_holidays

    # ------------------------------------------------------------------
    # Trading-day queries
    # ------------------------------------------------------------------

    def is_trading_day(self, d: date) -> bool:
        """Return *True* if *d* is a regular trading day (not weekend,
        not a gazetted NSE holiday)."""
        if d.weekday() >= 5:  # Saturday=5, Sunday=6
            return False
        return d not in self._holidays

    def is_market_open(self) -> bool:
        """Check whether the NSE is open **right now** (live clock)."""
        now = datetime.now(IST)
        if not self.is_trading_day(now.date()):
            return False
        return MARKET_OPEN <= now.time() <= MARKET_CLOSE

    def is_pre_open(self) -> bool:
        """Check whether we are in the pre-open session."""
        now = datetime.now(IST)
        if not self.is_trading_day(now.date()):
            return False
        return PRE_OPEN_START <= now.time() <= PRE_OPEN_END

    def get_next_trading_day(self, d: date) -> date:
        """Return the next trading day strictly after *d*."""
        candidate = d + timedelta(days=1)
        while not self.is_trading_day(candidate):
            candidate += timedelta(days=1)
        return candidate

    def get_previous_trading_day(self, d: date) -> date:
        """Return the most recent trading day strictly before *d*."""
        candidate = d - timedelta(days=1)
        while not self.is_trading_day(candidate):
            candidate -= timedelta(days=1)
        return candidate

    def days_to_expiry(self, expiry_date: date) -> int:
        """Calendar days from today to *expiry_date* (can be negative)."""
        return (expiry_date - date.today()).days

    def trading_days_between(self, start: date, end: date) -> int:
        """Count trading days in the half-open interval [start, end)."""
        if start >= end:
            return 0
        count = 0
        current = start
        while current < end:
            if self.is_trading_day(current):
                count += 1
            current += timedelta(days=1)
        return count

    def trading_days_to_expiry(self, expiry_date: date) -> int:
        """Trading days from today (inclusive) to *expiry_date* (exclusive)."""
        return self.trading_days_between(date.today(), expiry_date)

    # ------------------------------------------------------------------
    # Expiry date calculations
    # ------------------------------------------------------------------

    def get_expiry_date(
        self,
        symbol: str,
        expiry_type: str = "weekly",
        reference_date: Optional[date] = None,
    ) -> date:
        """Calculate the next expiry date for *symbol*.

        Parameters
        ----------
        symbol:
            E.g. ``"NIFTY"``, ``"BANKNIFTY"``, ``"FINNIFTY"``.
        expiry_type:
            ``"weekly"`` or ``"monthly"``.
        reference_date:
            Date from which to find the *next* expiry.  Defaults to today.

        Returns
        -------
        date
            The expiry date, adjusted for holidays.

        Notes
        -----
        * Weekly index expiries are on **Thursday** (NIFTY, BANKNIFTY,
          FINNIFTY each have a designated day but NSE has consolidated
          them to Thursday as of late 2024).
        * Monthly equity / index expiries are the **last Thursday** of
          the month.
        * If the computed Thursday is a holiday, the expiry moves to the
          previous trading day.
        """
        ref = reference_date or date.today()
        symbol_upper = symbol.upper().strip()

        if expiry_type == "monthly":
            return self._monthly_expiry(ref)

        # Weekly expiry — default day is Thursday (weekday 3).
        expiry_weekday = self._weekly_expiry_weekday(symbol_upper)
        return self._next_weekly_expiry(ref, expiry_weekday)

    def get_monthly_expiry(self, year: int, month: int) -> date:
        """Return the monthly F&O expiry date for *year*/*month*."""
        return self._monthly_expiry(date(year, month, 1))

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    @staticmethod
    def _weekly_expiry_weekday(symbol: str) -> int:
        """Return the standard weekday for weekly expiry.

        As of Nov 2024 all weekly index expiries are on Thursday (3).
        Historically: NIFTY=Thu, BANKNIFTY=Wed, FINNIFTY=Tue.
        """
        # Keep a mapping in case NSE changes again.
        _MAP = {
            "NIFTY": 3,
            "BANKNIFTY": 3,
            "FINNIFTY": 3,
            "MIDCPNIFTY": 3,
            "SENSEX": 4,  # BSE Sensex is Friday
        }
        return _MAP.get(symbol, 3)

    def _next_weekly_expiry(self, ref: date, weekday: int) -> date:
        """Find the nearest expiry day on or after *ref*."""
        days_ahead = (weekday - ref.weekday()) % 7
        candidate = ref + timedelta(days=days_ahead)
        # If today IS the expiry day but market is still open, return today.
        # Otherwise, if past the expiry day this week, jump to next week.
        if candidate < ref:
            candidate += timedelta(days=7)
        # Adjust for holidays.
        return self._adjust_for_holiday(candidate)

    def _monthly_expiry(self, ref: date) -> date:
        """Last Thursday of the month of *ref*, holiday-adjusted."""
        # Find last day of month.
        if ref.month == 12:
            next_month_first = date(ref.year + 1, 1, 1)
        else:
            next_month_first = date(ref.year, ref.month + 1, 1)
        last_day = next_month_first - timedelta(days=1)

        # Walk back to the last Thursday.
        offset = (last_day.weekday() - 3) % 7  # Thursday = 3
        last_thursday = last_day - timedelta(days=offset)

        adjusted = self._adjust_for_holiday(last_thursday)

        # If the adjusted expiry is before *ref*, compute for the next month.
        if adjusted < ref:
            if ref.month == 12:
                return self._monthly_expiry(date(ref.year + 1, 1, 1))
            return self._monthly_expiry(date(ref.year, ref.month + 1, 1))

        return adjusted

    def _adjust_for_holiday(self, d: date) -> date:
        """If *d* is not a trading day, move to the previous trading day."""
        while not self.is_trading_day(d):
            d -= timedelta(days=1)
        return d

    # ------------------------------------------------------------------
    # Convenience
    # ------------------------------------------------------------------

    def get_holidays(self, year: int) -> list[date]:
        """Return sorted list of NSE holidays for *year*."""
        return sorted(d for d in self._holidays if d.year == year)

    def add_holiday(self, d: date) -> None:
        """Dynamically add a holiday."""
        self._holidays.add(d)

    def remove_holiday(self, d: date) -> None:
        """Remove a holiday (e.g. if NSE updates the list)."""
        self._holidays.discard(d)

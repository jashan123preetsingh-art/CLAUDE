"""Historical data manager backed by SQLite.

Stores and retrieves OHLCV bars, option chain snapshots, and implied
volatility surfaces for back-testing and analysis.
"""

from __future__ import annotations

import json
import logging
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Any, Generator, Optional

import pandas as pd

from options_bot.core.exceptions import DataValidationError
from options_bot.core.models import (
    Greeks,
    OHLCV,
    OptionChain,
    OptionQuote,
    OptionType,
)

logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = Path("data/options_bot.db")

# ---------------------------------------------------------------------------
# Schema DDL
# ---------------------------------------------------------------------------

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS ohlcv (
    symbol      TEXT    NOT NULL,
    timestamp   TEXT    NOT NULL,
    open        REAL    NOT NULL,
    high        REAL    NOT NULL,
    low         REAL    NOT NULL,
    close       REAL    NOT NULL,
    volume      INTEGER NOT NULL,
    oi          INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (symbol, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_ohlcv_symbol_ts
    ON ohlcv (symbol, timestamp);

CREATE TABLE IF NOT EXISTS option_chain_snapshot (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol          TEXT    NOT NULL,
    underlying      REAL    NOT NULL,
    expiry          TEXT    NOT NULL,
    snapshot_time   TEXT    NOT NULL,
    data_json       TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oc_symbol_time
    ON option_chain_snapshot (symbol, snapshot_time);

CREATE INDEX IF NOT EXISTS idx_oc_symbol_expiry
    ON option_chain_snapshot (symbol, expiry);

CREATE TABLE IF NOT EXISTS iv_data (
    symbol      TEXT    NOT NULL,
    strike      REAL    NOT NULL,
    expiry      TEXT    NOT NULL,
    timestamp   TEXT    NOT NULL,
    iv          REAL    NOT NULL,
    option_type TEXT    NOT NULL,
    underlying  REAL    NOT NULL DEFAULT 0,
    PRIMARY KEY (symbol, strike, expiry, timestamp, option_type)
);

CREATE INDEX IF NOT EXISTS idx_iv_symbol_ts
    ON iv_data (symbol, timestamp);
"""


# ---------------------------------------------------------------------------
# HistoricalDataManager
# ---------------------------------------------------------------------------

class HistoricalDataManager:
    """Manages persistent storage of market data in SQLite.

    Parameters
    ----------
    db_path:
        Path to the SQLite database file.  Created automatically if it
        does not exist.
    """

    def __init__(self, db_path: str | Path = DEFAULT_DB_PATH) -> None:
        self._db_path = Path(db_path)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    # ------------------------------------------------------------------
    # DB helpers
    # ------------------------------------------------------------------

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(_SCHEMA_SQL)

    @contextmanager
    def _connect(self) -> Generator[sqlite3.Connection, None, None]:
        conn = sqlite3.connect(str(self._db_path), timeout=10)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    # ------------------------------------------------------------------
    # OHLCV
    # ------------------------------------------------------------------

    def save_ohlcv(self, symbol: str, data: list[OHLCV]) -> int:
        """Insert or replace OHLCV bars.  Returns number of rows written."""
        if not data:
            return 0

        symbol = symbol.upper().strip()
        rows = []
        for bar in data:
            if not bar.validate():
                logger.warning("Skipping invalid OHLCV bar: %s", bar)
                continue
            rows.append((
                symbol,
                bar.timestamp.isoformat(),
                bar.open,
                bar.high,
                bar.low,
                bar.close,
                bar.volume,
                bar.oi,
            ))

        with self._connect() as conn:
            conn.executemany(
                """
                INSERT OR REPLACE INTO ohlcv
                    (symbol, timestamp, open, high, low, close, volume, oi)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows,
            )

        logger.info("Saved %d OHLCV bars for %s.", len(rows), symbol)
        return len(rows)

    def get_ohlcv(
        self,
        symbol: str,
        start: date | datetime,
        end: date | datetime,
    ) -> pd.DataFrame:
        """Retrieve OHLCV data as a DataFrame.

        Returns a DataFrame indexed by *timestamp* with columns:
        ``open, high, low, close, volume, oi``.
        """
        symbol = symbol.upper().strip()
        start_str = start.isoformat() if isinstance(start, datetime) else datetime.combine(start, datetime.min.time()).isoformat()
        end_str = end.isoformat() if isinstance(end, datetime) else datetime.combine(end, datetime.max.time()).isoformat()

        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT timestamp, open, high, low, close, volume, oi
                FROM ohlcv
                WHERE symbol = ? AND timestamp >= ? AND timestamp <= ?
                ORDER BY timestamp
                """,
                (symbol, start_str, end_str),
            ).fetchall()

        if not rows:
            return pd.DataFrame(columns=["open", "high", "low", "close", "volume", "oi"])

        df = pd.DataFrame([dict(r) for r in rows])
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df.set_index("timestamp", inplace=True)
        return df

    # ------------------------------------------------------------------
    # Option chain snapshots
    # ------------------------------------------------------------------

    def save_option_chain_snapshot(self, chain: OptionChain) -> int:
        """Persist an option chain snapshot.  Returns the row id."""
        data_json = self._serialise_option_chain(chain)

        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO option_chain_snapshot
                    (symbol, underlying, expiry, snapshot_time, data_json)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    chain.symbol,
                    chain.underlying_value,
                    chain.expiry.isoformat(),
                    chain.timestamp.isoformat(),
                    data_json,
                ),
            )
            row_id = cursor.lastrowid or 0

        # Also update the IV data table for surface building.
        self._extract_and_save_iv(chain)

        logger.info(
            "Saved option chain snapshot id=%d for %s expiry=%s",
            row_id, chain.symbol, chain.expiry,
        )
        return row_id

    def get_option_chain_history(
        self,
        symbol: str,
        start: date | datetime,
        end: date | datetime,
    ) -> list[OptionChain]:
        """Load option chain snapshots within a date range."""
        symbol = symbol.upper().strip()
        start_str = start.isoformat() if isinstance(start, datetime) else datetime.combine(start, datetime.min.time()).isoformat()
        end_str = end.isoformat() if isinstance(end, datetime) else datetime.combine(end, datetime.max.time()).isoformat()

        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT data_json
                FROM option_chain_snapshot
                WHERE symbol = ? AND snapshot_time >= ? AND snapshot_time <= ?
                ORDER BY snapshot_time
                """,
                (symbol, start_str, end_str),
            ).fetchall()

        chains: list[OptionChain] = []
        for row in rows:
            try:
                chains.append(self._deserialise_option_chain(row["data_json"]))
            except (json.JSONDecodeError, KeyError, TypeError) as exc:
                logger.warning("Failed to deserialise option chain snapshot: %s", exc)
                continue

        return chains

    # ------------------------------------------------------------------
    # IV surface
    # ------------------------------------------------------------------

    def build_iv_surface(
        self,
        symbol: str,
        target_date: date,
    ) -> pd.DataFrame:
        """Build an IV surface (strikes x expiries) for a given date.

        Returns a DataFrame where the index is strike price and columns
        are expiry dates, with IV values as the cell values.  Uses the
        latest snapshot taken on *target_date*.
        """
        symbol = symbol.upper().strip()
        day_start = datetime.combine(target_date, datetime.min.time()).isoformat()
        day_end = datetime.combine(target_date, datetime.max.time()).isoformat()

        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT strike, expiry, iv, option_type
                FROM iv_data
                WHERE symbol = ? AND timestamp >= ? AND timestamp <= ?
                ORDER BY strike, expiry
                """,
                (symbol, day_start, day_end),
            ).fetchall()

        if not rows:
            return pd.DataFrame()

        records: list[dict[str, Any]] = [dict(r) for r in rows]
        df = pd.DataFrame(records)

        # Average calls and puts IV per (strike, expiry).
        pivot = df.pivot_table(
            index="strike",
            columns="expiry",
            values="iv",
            aggfunc="mean",
        )
        pivot.columns = [date.fromisoformat(c) if isinstance(c, str) else c for c in pivot.columns]
        pivot.sort_index(axis=0, inplace=True)
        pivot.sort_index(axis=1, inplace=True)
        return pivot

    def get_iv_history(
        self,
        symbol: str,
        strike: float,
        expiry: date,
        start: date,
        end: date,
    ) -> pd.DataFrame:
        """Get IV history for a specific strike/expiry combination.

        Returns a DataFrame with ``timestamp, iv, option_type`` columns.
        """
        symbol = symbol.upper().strip()
        start_str = datetime.combine(start, datetime.min.time()).isoformat()
        end_str = datetime.combine(end, datetime.max.time()).isoformat()

        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT timestamp, iv, option_type
                FROM iv_data
                WHERE symbol = ? AND strike = ? AND expiry = ?
                      AND timestamp >= ? AND timestamp <= ?
                ORDER BY timestamp
                """,
                (symbol, strike, expiry.isoformat(), start_str, end_str),
            ).fetchall()

        if not rows:
            return pd.DataFrame(columns=["timestamp", "iv", "option_type"])

        df = pd.DataFrame([dict(r) for r in rows])
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        return df

    # ------------------------------------------------------------------
    # Data cleanup
    # ------------------------------------------------------------------

    def cleanup_old_data(self, days_to_keep: int = 365) -> None:
        """Remove data older than *days_to_keep* days."""
        cutoff = (datetime.now() - pd.Timedelta(days=days_to_keep)).isoformat()

        with self._connect() as conn:
            for table, col in [
                ("ohlcv", "timestamp"),
                ("option_chain_snapshot", "snapshot_time"),
                ("iv_data", "timestamp"),
            ]:
                cursor = conn.execute(
                    f"DELETE FROM {table} WHERE {col} < ?",  # noqa: S608
                    (cutoff,),
                )
                logger.info("Cleaned %d rows from %s.", cursor.rowcount, table)

    # ------------------------------------------------------------------
    # Serialisation helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _serialise_option_chain(chain: OptionChain) -> str:
        """Convert an OptionChain to a JSON string."""

        def _quote_to_dict(q: OptionQuote) -> dict:
            return {
                "strike": q.strike,
                "option_type": q.option_type.value,
                "expiry": q.expiry.isoformat(),
                "last_price": q.last_price,
                "bid": q.bid,
                "ask": q.ask,
                "bid_qty": q.bid_qty,
                "ask_qty": q.ask_qty,
                "volume": q.volume,
                "oi": q.oi,
                "change_in_oi": q.change_in_oi,
                "iv": q.iv,
                "underlying_value": q.underlying_value,
            }

        payload = {
            "symbol": chain.symbol,
            "underlying_value": chain.underlying_value,
            "expiry": chain.expiry.isoformat(),
            "timestamp": chain.timestamp.isoformat(),
            "strikes": chain.strikes,
            "calls": [_quote_to_dict(c) for c in chain.calls],
            "puts": [_quote_to_dict(p) for p in chain.puts],
        }
        return json.dumps(payload)

    @staticmethod
    def _deserialise_option_chain(raw: str) -> OptionChain:
        """Reconstruct an OptionChain from its JSON representation."""
        d = json.loads(raw)

        def _dict_to_quote(q: dict) -> OptionQuote:
            return OptionQuote(
                strike=q["strike"],
                option_type=OptionType(q["option_type"]),
                expiry=date.fromisoformat(q["expiry"]),
                last_price=q["last_price"],
                bid=q["bid"],
                ask=q["ask"],
                bid_qty=q["bid_qty"],
                ask_qty=q["ask_qty"],
                volume=q["volume"],
                oi=q["oi"],
                change_in_oi=q["change_in_oi"],
                iv=q["iv"],
                greeks=Greeks(iv=q["iv"]),
                underlying_value=q.get("underlying_value", 0),
            )

        return OptionChain(
            symbol=d["symbol"],
            underlying_value=d["underlying_value"],
            expiry=date.fromisoformat(d["expiry"]),
            timestamp=datetime.fromisoformat(d["timestamp"]),
            calls=[_dict_to_quote(c) for c in d["calls"]],
            puts=[_dict_to_quote(p) for p in d["puts"]],
            strikes=d["strikes"],
        )

    def _extract_and_save_iv(self, chain: OptionChain) -> None:
        """Extract IV data from a chain snapshot and store it."""
        rows: list[tuple] = []
        ts = chain.timestamp.isoformat()

        for quote in chain.calls:
            if quote.iv > 0:
                rows.append((
                    chain.symbol,
                    quote.strike,
                    chain.expiry.isoformat(),
                    ts,
                    quote.iv,
                    OptionType.CALL.value,
                    chain.underlying_value,
                ))

        for quote in chain.puts:
            if quote.iv > 0:
                rows.append((
                    chain.symbol,
                    quote.strike,
                    chain.expiry.isoformat(),
                    ts,
                    quote.iv,
                    OptionType.PUT.value,
                    chain.underlying_value,
                ))

        if not rows:
            return

        with self._connect() as conn:
            conn.executemany(
                """
                INSERT OR REPLACE INTO iv_data
                    (symbol, strike, expiry, timestamp, iv, option_type, underlying)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                rows,
            )

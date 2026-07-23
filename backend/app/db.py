"""Optional SQLAlchemy persistence layer.

Defines ORM models for scan snapshots and watchlist entries. The core app runs
purely in-memory; enable persistence by calling ``init_db()`` at startup and
using ``SessionLocal``. Uses ``DATABASE_URL`` (SQLite by default so it works
with zero infra; point it at PostgreSQL in production).
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.config import get_settings

_settings = get_settings()
engine = create_engine(_settings.database_url, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, future=True)


class Base(DeclarativeBase):
    pass


class ScanResultRow(Base):
    __tablename__ = "scan_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    symbol: Mapped[str] = mapped_column(String(32), index=True)
    swing_type: Mapped[str] = mapped_column(String(16), index=True)
    confidence: Mapped[float] = mapped_column(Float)
    entry_low: Mapped[float] = mapped_column(Float)
    stop_loss: Mapped[float] = mapped_column(Float)
    target2: Mapped[float] = mapped_column(Float)
    risk_reward: Mapped[float] = mapped_column(Float)


class WatchlistRow(Base):
    __tablename__ = "watchlist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    added_ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


def init_db() -> None:
    """Create tables. Safe to call repeatedly."""
    Base.metadata.create_all(engine)

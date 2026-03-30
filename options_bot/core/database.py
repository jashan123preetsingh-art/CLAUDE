"""Database layer using SQLAlchemy for trade and order persistence."""

from datetime import datetime, date
from typing import Optional
from pathlib import Path

from sqlalchemy import (
    create_engine, Column, Integer, String, Float, DateTime, Date,
    Text, Enum, JSON, func
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from options_bot.core.logger import get_logger

logger = get_logger(__name__)
Base = declarative_base()


class TradeRecord(Base):
    """SQLAlchemy model for completed trades."""
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trade_id = Column(String(50), unique=True, nullable=False)
    strategy_type = Column(String(50), nullable=False)
    strategy_name = Column(String(100))
    underlying = Column(String(20), nullable=False)
    entry_time = Column(DateTime, nullable=False)
    exit_time = Column(DateTime)
    legs = Column(JSON)  # Serialized leg details
    net_premium = Column(Float, default=0.0)
    pnl = Column(Float, default=0.0)
    pnl_pct = Column(Float, default=0.0)
    charges = Column(Float, default=0.0)
    net_pnl = Column(Float, default=0.0)
    max_profit = Column(Float)
    max_loss = Column(Float)
    entry_greeks = Column(JSON)
    exit_greeks = Column(JSON)
    status = Column(String(20), default="CLOSED")
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class OrderRecord(Base):
    """SQLAlchemy model for orders."""
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String(50), unique=True, nullable=False)
    trade_id = Column(String(50))
    symbol = Column(String(50), nullable=False)
    strike = Column(Float)
    expiry = Column(Date)
    option_type = Column(String(5))
    side = Column(String(10), nullable=False)
    order_type = Column(String(20), nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(Float)
    trigger_price = Column(Float)
    filled_price = Column(Float)
    status = Column(String(20), nullable=False)
    broker_order_id = Column(String(100))
    tag = Column(String(50))
    placed_at = Column(DateTime, default=datetime.utcnow)
    filled_at = Column(DateTime)
    cancelled_at = Column(DateTime)


class DailySnapshot(Base):
    """SQLAlchemy model for daily portfolio snapshots."""
    __tablename__ = "daily_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, unique=True, nullable=False)
    capital = Column(Float, nullable=False)
    total_pnl = Column(Float, default=0.0)
    realized_pnl = Column(Float, default=0.0)
    unrealized_pnl = Column(Float, default=0.0)
    num_open_positions = Column(Integer, default=0)
    num_trades = Column(Integer, default=0)
    win_count = Column(Integer, default=0)
    loss_count = Column(Integer, default=0)
    portfolio_delta = Column(Float, default=0.0)
    portfolio_gamma = Column(Float, default=0.0)
    portfolio_theta = Column(Float, default=0.0)
    portfolio_vega = Column(Float, default=0.0)
    margin_used = Column(Float, default=0.0)
    max_drawdown = Column(Float, default=0.0)


class OHLCVRecord(Base):
    """SQLAlchemy model for OHLCV data."""
    __tablename__ = "ohlcv"

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(20), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Integer, default=0)
    interval = Column(String(10), default="1d")


class OptionChainSnapshot(Base):
    """SQLAlchemy model for option chain snapshots."""
    __tablename__ = "option_chain_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(20), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    expiry = Column(Date, nullable=False)
    spot_price = Column(Float, nullable=False)
    data = Column(JSON)  # Full chain data serialized


class Database:
    """Database manager for the trading bot."""

    def __init__(self, db_url: str = "sqlite:///data/trading_bot.db"):
        # Ensure data directory exists
        if db_url.startswith("sqlite:///"):
            db_path = db_url.replace("sqlite:///", "")
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)

        self.engine = create_engine(db_url, echo=False)
        self.SessionLocal = sessionmaker(bind=self.engine)
        Base.metadata.create_all(self.engine)
        logger.info(f"Database initialized: {db_url}")

    def get_session(self) -> Session:
        """Get a new database session."""
        return self.SessionLocal()

    def save_trade(self, trade_data: dict):
        """Save a completed trade record."""
        with self.get_session() as session:
            record = TradeRecord(**trade_data)
            session.add(record)
            session.commit()
            logger.debug(f"Trade saved: {trade_data.get('trade_id')}")

    def save_order(self, order_data: dict):
        """Save an order record."""
        with self.get_session() as session:
            record = OrderRecord(**order_data)
            session.merge(record)
            session.commit()

    def save_daily_snapshot(self, snapshot_data: dict):
        """Save daily portfolio snapshot."""
        with self.get_session() as session:
            record = DailySnapshot(**snapshot_data)
            session.merge(record)
            session.commit()

    def save_ohlcv(self, symbol: str, data: list[dict]):
        """Save OHLCV data records."""
        with self.get_session() as session:
            for row in data:
                record = OHLCVRecord(symbol=symbol, **row)
                session.add(record)
            session.commit()
            logger.debug(f"Saved {len(data)} OHLCV records for {symbol}")

    def save_option_chain_snapshot(self, snapshot_data: dict):
        """Save option chain snapshot."""
        with self.get_session() as session:
            record = OptionChainSnapshot(**snapshot_data)
            session.add(record)
            session.commit()

    def get_trades(self, start_date: Optional[date] = None,
                   end_date: Optional[date] = None,
                   strategy: Optional[str] = None,
                   limit: int = 100) -> list[dict]:
        """Get trade records with optional filtering."""
        with self.get_session() as session:
            query = session.query(TradeRecord)

            if start_date:
                query = query.filter(
                    TradeRecord.entry_time >= datetime.combine(
                        start_date, datetime.min.time()))
            if end_date:
                query = query.filter(
                    TradeRecord.entry_time <= datetime.combine(
                        end_date, datetime.max.time()))
            if strategy:
                query = query.filter(
                    TradeRecord.strategy_type == strategy)

            records = query.order_by(
                TradeRecord.entry_time.desc()
            ).limit(limit).all()

            return [
                {
                    "trade_id": r.trade_id,
                    "strategy_type": r.strategy_type,
                    "strategy_name": r.strategy_name,
                    "underlying": r.underlying,
                    "entry_time": r.entry_time.isoformat()
                    if r.entry_time else None,
                    "exit_time": r.exit_time.isoformat()
                    if r.exit_time else None,
                    "pnl": r.pnl,
                    "net_pnl": r.net_pnl,
                    "charges": r.charges,
                    "status": r.status,
                    "legs": r.legs,
                }
                for r in records
            ]

    def get_orders(self, trade_id: Optional[str] = None,
                   status: Optional[str] = None,
                   limit: int = 100) -> list[dict]:
        """Get order records."""
        with self.get_session() as session:
            query = session.query(OrderRecord)

            if trade_id:
                query = query.filter(OrderRecord.trade_id == trade_id)
            if status:
                query = query.filter(OrderRecord.status == status)

            records = query.order_by(
                OrderRecord.placed_at.desc()
            ).limit(limit).all()

            return [
                {
                    "order_id": r.order_id,
                    "trade_id": r.trade_id,
                    "symbol": r.symbol,
                    "strike": r.strike,
                    "option_type": r.option_type,
                    "side": r.side,
                    "quantity": r.quantity,
                    "price": r.price,
                    "filled_price": r.filled_price,
                    "status": r.status,
                    "broker_order_id": r.broker_order_id,
                }
                for r in records
            ]

    def get_performance_summary(self) -> dict:
        """Get overall performance summary."""
        with self.get_session() as session:
            trades = session.query(TradeRecord).filter(
                TradeRecord.status == "CLOSED"
            ).all()

            if not trades:
                return {
                    "total_trades": 0,
                    "total_pnl": 0.0,
                    "total_charges": 0.0,
                    "net_pnl": 0.0,
                    "win_count": 0,
                    "loss_count": 0,
                    "win_rate": 0.0,
                    "avg_pnl": 0.0,
                    "max_win": 0.0,
                    "max_loss": 0.0,
                }

            pnls = [t.net_pnl or 0 for t in trades]
            wins = [p for p in pnls if p > 0]
            losses = [p for p in pnls if p <= 0]

            return {
                "total_trades": len(trades),
                "total_pnl": sum(t.pnl or 0 for t in trades),
                "total_charges": sum(t.charges or 0 for t in trades),
                "net_pnl": sum(pnls),
                "win_count": len(wins),
                "loss_count": len(losses),
                "win_rate": len(wins) / len(trades) * 100
                if trades else 0.0,
                "avg_pnl": sum(pnls) / len(pnls) if pnls else 0.0,
                "avg_win": sum(wins) / len(wins) if wins else 0.0,
                "avg_loss": sum(losses) / len(losses) if losses else 0.0,
                "max_win": max(pnls) if pnls else 0.0,
                "max_loss": min(pnls) if pnls else 0.0,
                "profit_factor": abs(sum(wins) / sum(losses))
                if losses and sum(losses) != 0 else 0.0,
            }

    def get_equity_curve(self) -> list[dict]:
        """Get equity curve from daily snapshots."""
        with self.get_session() as session:
            records = session.query(DailySnapshot).order_by(
                DailySnapshot.date
            ).all()

            return [
                {
                    "date": r.date.isoformat(),
                    "capital": r.capital,
                    "pnl": r.total_pnl,
                    "drawdown": r.max_drawdown,
                }
                for r in records
            ]

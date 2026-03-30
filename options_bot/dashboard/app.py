"""Flask-based web dashboard for the trading bot."""

import json
from datetime import datetime

from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO
from flask_cors import CORS

from options_bot.core.logger import get_logger

logger = get_logger(__name__)


def create_app(config=None):
    """Create and configure the Flask dashboard application."""
    app = Flask(
        __name__,
        template_folder="templates",
        static_folder="static",
    )

    app.config["SECRET_KEY"] = (
        config.get("dashboard.secret_key", "dev-secret-key")
        if config else "dev-secret-key"
    )

    CORS(app)
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

    # Store references for route handlers
    app.bot_config = config
    app.trading_engine = None
    app.portfolio = None
    app.start_time = datetime.now()

    # ── Routes ──────────────────────────────────────────────

    @app.route("/")
    def index():
        """Main dashboard page."""
        return render_template("index.html")

    @app.route("/api/status")
    def api_status():
        """Bot status endpoint."""
        engine = app.trading_engine
        uptime = (datetime.now() - app.start_time).total_seconds()

        return jsonify({
            "status": "running" if engine and engine._running else "stopped",
            "mode": (config.get("app.mode", "paper")
                     if config else "paper"),
            "uptime_seconds": uptime,
            "uptime_display": _format_uptime(uptime),
            "timestamp": datetime.now().isoformat(),
        })

    @app.route("/api/positions")
    def api_positions():
        """Current open positions."""
        portfolio = app.portfolio
        if not portfolio:
            return jsonify({"positions": [], "count": 0})

        positions = []
        for pos in portfolio.get_open_positions():
            legs = []
            for leg in pos.legs:
                legs.append({
                    "symbol": getattr(
                        leg.contract, 'symbol', 'N/A'
                    ) if hasattr(leg, 'contract') else 'N/A',
                    "side": leg.side.value if hasattr(
                        leg.side, 'value') else str(leg.side),
                    "qty": leg.quantity,
                    "entry_price": leg.entry_price,
                    "current_price": leg.current_price,
                    "pnl": leg.unrealized_pnl or 0,
                    "delta": leg.greeks.delta if leg.greeks else 0,
                    "gamma": leg.greeks.gamma if leg.greeks else 0,
                    "theta": leg.greeks.theta if leg.greeks else 0,
                    "vega": leg.greeks.vega if leg.greeks else 0,
                })

            positions.append({
                "id": pos.id,
                "strategy": pos.strategy_type.value,
                "name": pos.name,
                "entry_time": pos.entry_time.isoformat()
                if pos.entry_time else None,
                "net_premium": pos.net_premium,
                "max_profit": pos.max_profit,
                "max_loss": pos.max_loss,
                "legs": legs,
                "total_pnl": sum(l["pnl"] for l in legs),
            })

        return jsonify({
            "positions": positions,
            "count": len(positions),
        })

    @app.route("/api/trades")
    def api_trades():
        """Trade history."""
        portfolio = app.portfolio
        if not portfolio:
            return jsonify({"trades": [], "count": 0})

        trades = []
        for pos in portfolio.get_closed_positions():
            pnl = sum(
                leg.pnl for leg in pos.legs if leg.pnl is not None
            )
            trades.append({
                "id": pos.id,
                "strategy": pos.strategy_type.value,
                "name": pos.name,
                "entry_time": pos.entry_time.isoformat()
                if pos.entry_time else None,
                "exit_time": pos.exit_time.isoformat()
                if pos.exit_time else None,
                "pnl": pnl,
                "status": pos.status.value,
            })

        return jsonify({
            "trades": trades,
            "count": len(trades),
        })

    @app.route("/api/pnl")
    def api_pnl():
        """P&L data for charts."""
        portfolio = app.portfolio
        if not portfolio:
            return jsonify({
                "total_pnl": 0,
                "daily_pnl": 0,
                "realized_pnl": 0,
                "unrealized_pnl": 0,
            })

        summary = portfolio.summary()
        return jsonify(summary)

    @app.route("/api/greeks")
    def api_greeks():
        """Portfolio Greeks summary."""
        portfolio = app.portfolio
        if not portfolio:
            return jsonify({
                "delta": 0, "gamma": 0, "theta": 0, "vega": 0,
            })

        greeks = portfolio.portfolio_greeks()
        return jsonify({
            "delta": round(greeks.delta, 4),
            "gamma": round(greeks.gamma, 6),
            "theta": round(greeks.theta, 2),
            "vega": round(greeks.vega, 2),
        })

    @app.route("/api/signals")
    def api_signals():
        """Current market signals."""
        # Placeholder - would be connected to signal aggregator
        return jsonify({
            "signals": [
                {
                    "name": "IV Rank",
                    "value": 45,
                    "direction": "NEUTRAL",
                    "strength": 45,
                },
                {
                    "name": "PCR",
                    "value": 0.95,
                    "direction": "NEUTRAL",
                    "strength": 50,
                },
                {
                    "name": "RSI",
                    "value": 55,
                    "direction": "NEUTRAL",
                    "strength": 40,
                },
                {
                    "name": "MACD",
                    "value": 0,
                    "direction": "BULLISH",
                    "strength": 60,
                },
            ]
        })

    @app.route("/api/risk")
    def api_risk():
        """Risk metrics."""
        portfolio = app.portfolio
        if not portfolio:
            return jsonify({
                "var_95": 0, "margin_used": 0,
                "margin_utilization": 0, "drawdown": 0,
                "daily_loss_limit": 5.0, "daily_loss_used": 0,
            })

        summary = portfolio.summary()
        return jsonify({
            "var_95": 0,  # Would be calculated by risk manager
            "margin_used": summary["margin_used"],
            "margin_utilization": summary["margin_utilization_pct"],
            "drawdown": summary["drawdown_pct"],
            "daily_loss_limit": (
                config.get("risk.max_daily_loss_pct", 5.0)
                if config else 5.0
            ),
            "daily_loss_used": abs(summary["daily_pnl"]) / max(
                summary["current_capital"], 1) * 100,
        })

    @app.route("/api/option-chain")
    def api_option_chain():
        """Live option chain data."""
        return jsonify({"chain": [], "spot": 0, "symbol": "NIFTY 50"})

    @app.route("/api/backtest")
    def api_backtest():
        """Backtest results."""
        return jsonify({"results": None, "message": "No backtest run yet"})

    @app.route("/api/strategy/toggle", methods=["POST"])
    def api_toggle_strategy():
        """Enable/disable a strategy."""
        data = request.get_json()
        strategy = data.get("strategy")
        enabled = data.get("enabled", True)
        return jsonify({
            "strategy": strategy,
            "enabled": enabled,
            "message": f"Strategy {strategy} "
                       f"{'enabled' if enabled else 'disabled'}",
        })

    @app.route("/api/bot/start", methods=["POST"])
    def api_start_bot():
        """Start the trading bot."""
        engine = app.trading_engine
        if engine:
            engine.start()
            return jsonify({"status": "started"})
        return jsonify({"status": "error", "message": "No engine configured"})

    @app.route("/api/bot/stop", methods=["POST"])
    def api_stop_bot():
        """Stop the trading bot."""
        engine = app.trading_engine
        if engine:
            engine.stop()
            return jsonify({"status": "stopped"})
        return jsonify({"status": "error", "message": "No engine configured"})

    # ── SocketIO Events ─────────────────────────────────────

    @socketio.on("connect")
    def handle_connect():
        logger.info("Dashboard client connected")

    @socketio.on("disconnect")
    def handle_disconnect():
        logger.info("Dashboard client disconnected")

    @socketio.on("request_update")
    def handle_request_update():
        """Client requests latest data."""
        portfolio = app.portfolio
        if portfolio:
            socketio.emit("portfolio_update", portfolio.summary())

    def emit_update(event: str, data: dict):
        """Emit real-time update to all connected clients."""
        socketio.emit(event, data)

    app.emit_update = emit_update

    return app, socketio


def _format_uptime(seconds: float) -> str:
    """Format uptime seconds as human-readable string."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    if hours > 0:
        return f"{hours}h {minutes}m {secs}s"
    elif minutes > 0:
        return f"{minutes}m {secs}s"
    return f"{secs}s"

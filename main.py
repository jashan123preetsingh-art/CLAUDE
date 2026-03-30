#!/usr/bin/env python3
"""
IndiaOptions AlgoBot - Options Trading Bot for Indian Markets
=============================================================

A comprehensive algorithmic options trading bot for NSE/BSE
supporting multiple strategies, backtesting, and live trading.

Usage:
    python main.py run [--mode paper|live]
    python main.py backtest [--strategy iron_condor] [--start 2023-01-01] [--end 2024-12-31]
    python main.py dashboard [--port 8080]
    python main.py scan [--symbol NIFTY]
    python main.py analyze [--symbol NIFTY]
"""

import sys
import signal
import logging
from datetime import datetime, date

import click

from options_bot.core.config import ConfigManager
from options_bot.core.logger import get_logger, setup_logging


logger = get_logger(__name__)


@click.group()
@click.option("--config", default="config.yaml", help="Path to config file")
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose logging")
@click.pass_context
def cli(ctx, config, verbose):
    """IndiaOptions AlgoBot - Options Trading Bot for Indian Markets."""
    ctx.ensure_object(dict)
    setup_logging(level="DEBUG" if verbose else "INFO")
    ctx.obj["config"] = ConfigManager(config)
    logger.info("IndiaOptions AlgoBot v1.0.0")


@cli.command()
@click.option("--mode", type=click.Choice(["paper", "live"]), default="paper",
              help="Trading mode")
@click.pass_context
def run(ctx, mode):
    """Start the trading bot."""
    config = ctx.obj["config"]

    logger.info(f"Starting bot in {mode.upper()} mode...")

    from options_bot.trading.live_engine import LiveTradingEngine
    from options_bot.strategies.strategy_manager import StrategyManager
    from options_bot.risk.risk_manager import RiskManager
    from options_bot.signals.signal_aggregator import SignalAggregator

    if mode == "paper":
        from options_bot.broker.paper_broker import PaperBroker
        broker = PaperBroker(
            initial_capital=config.get("backtesting.initial_capital", 1_000_000)
        )
    else:
        broker_name = config.get("broker.default", "zerodha")
        if broker_name == "zerodha":
            from options_bot.broker.zerodha import ZerodhaBroker
            broker = ZerodhaBroker(config)
        elif broker_name == "angel_one":
            from options_bot.broker.angel_one import AngelOneBroker
            broker = AngelOneBroker(config)
        else:
            logger.error(f"Unknown broker: {broker_name}")
            sys.exit(1)

    strategy_manager = StrategyManager(config)
    risk_manager = RiskManager(config)
    signal_aggregator = SignalAggregator(config)

    engine = LiveTradingEngine(
        config=config,
        broker=broker,
        strategy_manager=strategy_manager,
        risk_manager=risk_manager,
        signal_aggregator=signal_aggregator,
    )

    # Graceful shutdown
    def shutdown_handler(signum, frame):
        logger.info("Shutdown signal received. Stopping bot...")
        engine.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    engine.start()


@cli.command()
@click.option("--strategy", "-s", default="iron_condor",
              help="Strategy to backtest")
@click.option("--symbol", default="NIFTY 50", help="Underlying symbol")
@click.option("--start", default="2023-01-01", help="Start date (YYYY-MM-DD)")
@click.option("--end", default="2024-12-31", help="End date (YYYY-MM-DD)")
@click.option("--capital", default=1_000_000, type=float,
              help="Initial capital (INR)")
@click.option("--monte-carlo", "-mc", is_flag=True,
              help="Run Monte Carlo simulation")
@click.option("--walk-forward", "-wf", is_flag=True,
              help="Run walk-forward optimization")
@click.pass_context
def backtest(ctx, strategy, symbol, start, end, capital, monte_carlo,
             walk_forward):
    """Run strategy backtesting."""
    config = ctx.obj["config"]

    logger.info(f"Backtesting {strategy} on {symbol}")
    logger.info(f"Period: {start} to {end} | Capital: ₹{capital:,.0f}")

    from options_bot.backtesting.engine import BacktestEngine
    from options_bot.backtesting.metrics import PerformanceMetrics
    from options_bot.strategies.strategy_manager import StrategyManager

    strategy_manager = StrategyManager(config)
    strategy_obj = strategy_manager.get_strategy(strategy)

    if strategy_obj is None:
        logger.error(f"Unknown strategy: {strategy}")
        sys.exit(1)

    engine = BacktestEngine(
        initial_capital=capital,
        commission=config.get("backtesting.commission_per_order", 20),
        slippage_pct=config.get("backtesting.slippage_pct", 0.05),
        start_date=datetime.strptime(start, "%Y-%m-%d").date(),
        end_date=datetime.strptime(end, "%Y-%m-%d").date(),
    )

    result = engine.run(strategy_obj, symbol)

    # Print performance report
    metrics = PerformanceMetrics(result.equity_curve, result.trades)
    print("\n" + "=" * 60)
    print(metrics.print_report())
    print("=" * 60)

    if monte_carlo:
        from options_bot.backtesting.monte_carlo import MonteCarloSimulator
        logger.info("Running Monte Carlo simulation (10,000 runs)...")
        mc = MonteCarloSimulator()
        mc_result = mc.simulate(result.trades)
        intervals = mc.confidence_intervals(mc_result)
        print("\n--- Monte Carlo Results ---")
        for level, values in intervals.items():
            print(f"  {level*100:.0f}% CI: "
                  f"₹{values['lower']:,.0f} to ₹{values['upper']:,.0f}")

    if walk_forward:
        from options_bot.backtesting.walk_forward import WalkForwardOptimizer
        logger.info("Running walk-forward optimization...")
        wfo = WalkForwardOptimizer()
        wf_result = wfo.optimize(
            strategy_obj, symbol,
            in_sample_days=config.get(
                "backtesting.walk_forward.in_sample_days", 180),
            out_sample_days=config.get(
                "backtesting.walk_forward.out_of_sample_days", 30),
            step_days=config.get("backtesting.walk_forward.step_days", 30),
        )
        print(f"\nWalk-Forward Robustness Score: "
              f"{wf_result.robustness_score:.2%}")


@cli.command()
@click.option("--port", default=8080, type=int, help="Dashboard port")
@click.option("--host", default="0.0.0.0", help="Dashboard host")
@click.pass_context
def dashboard(ctx, port, host):
    """Launch the web dashboard."""
    config = ctx.obj["config"]

    logger.info(f"Starting dashboard on http://{host}:{port}")

    from options_bot.dashboard.app import create_app
    app, socketio = create_app(config)
    socketio.run(app, host=host, port=port, debug=config.get(
        "dashboard.debug", False))


@cli.command()
@click.option("--symbol", "-s", default="NIFTY 50", help="Symbol to scan")
@click.pass_context
def scan(ctx, symbol):
    """Scan for trading opportunities."""
    config = ctx.obj["config"]

    logger.info(f"Scanning opportunities for {symbol}...")

    from options_bot.data.nse_fetcher import NSEFetcher
    from options_bot.strategies.strategy_manager import StrategyManager
    from options_bot.signals.signal_aggregator import SignalAggregator

    fetcher = NSEFetcher()
    strategy_manager = StrategyManager(config)
    signal_aggregator = SignalAggregator(config)

    # Fetch data
    chain = fetcher.get_option_chain(symbol)
    market_data = fetcher.get_indices_quote(symbol)

    if chain is None:
        logger.error("Failed to fetch option chain")
        sys.exit(1)

    # Generate signals
    signals = signal_aggregator.generate_all(chain, market_data)
    market_view = signal_aggregator.get_market_view()

    print(f"\n{'='*50}")
    print(f"  Market Scan: {symbol}")
    print(f"  Spot: ₹{chain.spot_price:,.2f}")
    print(f"  Market View: {market_view['direction']} "
          f"(Confidence: {market_view['confidence']:.0f}%)")
    print(f"{'='*50}")

    # Scan strategies
    setups = strategy_manager.scan_all(chain, market_data, signals)
    if setups:
        print(f"\n  Found {len(setups)} potential setups:")
        for i, setup in enumerate(setups, 1):
            print(f"\n  {i}. {setup['strategy']} - {setup['name']}")
            print(f"     Max Profit: ₹{setup.get('max_profit', 0):,.0f}")
            print(f"     Max Loss:   ₹{setup.get('max_loss', 0):,.0f}")
            print(f"     R:R Ratio:  {setup.get('reward_risk', 0):.2f}")
    else:
        print("\n  No setups found matching current conditions.")


@cli.command()
@click.option("--symbol", "-s", default="NIFTY 50", help="Symbol to analyze")
@click.pass_context
def analyze(ctx, symbol):
    """Analyze option chain and market conditions."""
    config = ctx.obj["config"]

    logger.info(f"Analyzing {symbol}...")

    from options_bot.data.nse_fetcher import NSEFetcher
    from options_bot.signals.iv_analysis import IVAnalyzer
    from options_bot.signals.oi_analysis import OIAnalyzer

    fetcher = NSEFetcher()
    chain = fetcher.get_option_chain(symbol)

    if chain is None:
        logger.error("Failed to fetch option chain")
        sys.exit(1)

    iv_analyzer = IVAnalyzer()
    oi_analyzer = OIAnalyzer()

    # PCR
    pcr = oi_analyzer.pcr(chain)
    max_pain_strike = oi_analyzer.max_pain(chain)
    support_resistance = oi_analyzer.support_resistance_from_oi(chain)

    print(f"\n{'='*50}")
    print(f"  Option Chain Analysis: {symbol}")
    print(f"  Spot: ₹{chain.spot_price:,.2f}")
    print(f"{'='*50}")
    print(f"\n  Put-Call Ratio: {pcr:.3f}")
    print(f"  Max Pain: ₹{max_pain_strike:,.0f}")
    print(f"  OI Support: ₹{support_resistance.get('support', 'N/A')}")
    print(f"  OI Resistance: ₹{support_resistance.get('resistance', 'N/A')}")

    # ATM IV
    from options_bot.utils.helpers import atm_strike
    atm = atm_strike(chain.spot_price)
    if atm in chain.strikes:
        call_iv = chain.strikes[atm].get("call_iv", 0)
        put_iv = chain.strikes[atm].get("put_iv", 0)
        print(f"\n  ATM Strike: {atm}")
        print(f"  ATM Call IV: {call_iv:.2f}%")
        print(f"  ATM Put IV: {put_iv:.2f}%")


@cli.command()
@click.pass_context
def status(ctx):
    """Show current bot status and positions."""
    config = ctx.obj["config"]
    print("\n  IndiaOptions AlgoBot Status")
    print("  " + "=" * 40)
    print(f"  Mode: {config.get('app.mode', 'paper').upper()}")
    print(f"  Exchange: {config.get('market.exchange', 'NSE')}")
    print(f"  Strategies: {', '.join(config.get('strategies.enabled', []))}")
    print(f"  Max Positions: {config.get('strategies.max_positions', 5)}")
    print(f"  Risk per Trade: {config.get('risk.max_loss_per_trade_pct', 2)}%")
    print(f"  Max Daily Loss: {config.get('risk.max_daily_loss_pct', 5)}%")


if __name__ == "__main__":
    cli()

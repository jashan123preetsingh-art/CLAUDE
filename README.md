# IndiaOptions AlgoBot

A comprehensive, production-grade algorithmic options trading bot for Indian markets (NSE/BSE). Supports multiple proven strategies, full backtesting with Monte Carlo simulation, live/paper trading, and a real-time web dashboard.

## Features

### Strategies
- **Iron Condor** - Sell OTM call & put spreads for range-bound markets
- **Iron Butterfly** - Sell ATM straddle with OTM wing protection
- **Short Straddle / Strangle** - Premium collection on high IV
- **Bull Call / Bear Put Spreads** - Directional plays with defined risk
- **Calendar Spread** - Exploit term structure differences
- **Ratio Spread** - Asymmetric risk/reward profiles
- **Jade Lizard** - Short put + call spread with no upside risk

### Supported Instruments
- **NIFTY 50** (Lot size: 25)
- **BANK NIFTY** (Lot size: 15)
- **FINNIFTY** (Lot size: 25)
- Individual NSE stocks with F&O

### Signal Generation
- IV Rank / Percentile analysis
- Put-Call Ratio (PCR) analysis
- Open Interest buildup & Max Pain
- Technical indicators (RSI, MACD, Bollinger Bands, VWAP, SuperTrend)
- Volatility smile/skew analysis

### Backtesting Engine
- Historical strategy backtesting with realistic costs
- Indian F&O commission model (Brokerage + STT + Exchange + GST + Stamp Duty)
- Slippage modeling
- Walk-forward optimization
- Monte Carlo simulation (10,000 runs)
- Performance metrics: Sharpe, Sortino, Calmar, Max Drawdown, Win Rate, Profit Factor

### Risk Management
- Position sizing: Kelly Criterion, Fixed Fractional, Optimal F
- Portfolio-level Greeks management (Delta, Gamma, Theta, Vega limits)
- Value at Risk (VaR) - Parametric & Historical
- Expected Shortfall (CVaR)
- SPAN-like margin approximation
- Auto stop-loss / take-profit
- Daily loss circuit breaker
- Real-time drawdown monitoring

### Broker Integration
- **Zerodha Kite Connect** - Full order management & WebSocket feed
- **Angel One SmartAPI** - Complete trading integration
- **Paper Broker** - Simulated trading for strategy testing (no real money)

### Web Dashboard
- Real-time P&L tracking with Plotly charts
- Open positions with live Greeks
- Portfolio risk metrics display
- Market signals visualization
- Trade history & analytics
- Dark-themed professional trading terminal UI

## Quick Start

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd CLAUDE

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your broker API keys
```

### Configuration

Edit `config.yaml` to customize:
- Trading mode (paper/live)
- Enabled strategies and parameters
- Risk limits
- Signal thresholds
- Broker settings

### Usage

```bash
# Start in paper trading mode (default)
python main.py run --mode paper

# Start live trading
python main.py run --mode live

# Run backtesting
python main.py backtest --strategy iron_condor --start 2023-01-01 --end 2024-12-31
python main.py backtest -s short_straddle --capital 2000000 --monte-carlo --walk-forward

# Scan for trading opportunities
python main.py scan --symbol "NIFTY 50"

# Analyze option chain
python main.py analyze --symbol "BANKNIFTY"

# Launch web dashboard
python main.py dashboard --port 8080

# Check bot status
python main.py status
```

## Project Structure

```
options_bot/
├── core/               # Core models, config, logging, database
│   ├── models.py       # All data models (Options, Greeks, Positions, Orders)
│   ├── config.py       # YAML config manager with .env override
│   ├── database.py     # SQLAlchemy persistence layer
│   ├── logger.py       # Colored logging with file rotation
│   └── exceptions.py   # Custom exception hierarchy
├── data/               # Data layer
│   ├── nse_fetcher.py  # NSE website data fetcher with rate limiting
│   ├── historical.py   # Historical data storage & IV surface builder
│   ├── market_calendar.py # NSE trading calendar & expiry dates
│   └── live_feed.py    # WebSocket & polling live data feeds
├── pricing/            # Options pricing engine
│   ├── black_scholes.py    # BS model with vectorized Greeks
│   ├── implied_volatility.py # Newton-Raphson & Bisection IV solver
│   ├── greeks_engine.py    # Portfolio Greeks aggregation
│   └── payoff.py          # Strategy payoff & probability of profit
├── strategies/         # Strategy implementations
│   ├── base.py         # Abstract strategy interface
│   ├── iron_condor.py  # Iron Condor with Greek-based adjustments
│   ├── iron_butterfly.py
│   ├── straddle_strangle.py # Short Straddle & Strangle
│   ├── spreads.py      # Bull/Bear/Calendar/Ratio spreads
│   ├── jade_lizard.py
│   └── strategy_manager.py # Strategy registry & scanner
├── signals/            # Signal generation
│   ├── iv_analysis.py  # IV Rank, Percentile, Mean Reversion
│   ├── oi_analysis.py  # PCR, Max Pain, OI Buildup
│   ├── technicals.py   # RSI, MACD, Bollinger, VWAP, SuperTrend
│   └── signal_aggregator.py # Weighted signal combination
├── backtesting/        # Backtesting engine
│   ├── engine.py       # Core backtest loop with margin tracking
│   ├── metrics.py      # Sharpe, Sortino, Calmar, Drawdown, etc.
│   ├── monte_carlo.py  # Monte Carlo simulation
│   └── walk_forward.py # Walk-forward optimization
├── risk/               # Risk management
│   ├── risk_manager.py # Pre-trade checks, VaR, stress testing
│   ├── position_sizer.py # Kelly, Fixed Fractional sizing
│   └── margin_calculator.py # SPAN-like margin estimation
├── broker/             # Broker integrations
│   ├── base_broker.py  # Abstract broker interface
│   ├── zerodha.py      # Zerodha Kite Connect
│   ├── angel_one.py    # Angel One SmartAPI
│   └── paper_broker.py # Simulated paper trading broker
├── trading/            # Live trading engine
│   ├── live_engine.py  # Main trading loop with market hours handling
│   ├── order_manager.py # Order placement, modification, cancellation
│   └── portfolio.py    # Portfolio tracking & P&L
├── dashboard/          # Web dashboard
│   ├── app.py          # Flask + SocketIO application
│   └── templates/
│       └── index.html  # Trading terminal dashboard UI
└── utils/
    └── helpers.py      # Utility functions, formatting, NSE helpers
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Web Dashboard                   │
│          (Flask + SocketIO + Plotly)             │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│              Live Trading Engine                  │
│    (Market Hours Loop + Auto Square-off)         │
├──────────┬──────────┬───────────┬───────────────┤
│  Signal  │ Strategy │   Risk    │    Order      │
│Generator │  Engine  │  Manager  │   Manager     │
├──────────┴──────────┴───────────┴───────────────┤
│              Pricing Engine                       │
│    (Black-Scholes + Greeks + IV Solver)          │
├─────────────────────────────────────────────────┤
│              Data Layer                           │
│    (NSE Fetcher + Historical + Live Feed)        │
├─────────────────────────────────────────────────┤
│              Broker Layer                         │
│    (Zerodha | Angel One | Paper Broker)          │
└─────────────────────────────────────────────────┘
```

## License

MIT

# StockPulse - Indian Stock Market Analytics SaaS

A production-grade stock analytics and scanner platform for Indian markets (NSE & BSE) with real-time data, institutional-grade scanners, fundamental analysis, options chain, FII/DII tracking, and market news.

## Features

### Market Scanners (Chartink-style)
- 17+ pre-built scanners: Day High/Low, 52W Breakout, Volume Spikes, Gap Up/Down, ORB, etc.
- Custom scanner builder with user-defined conditions
- Real-time scanning across 3000+ instruments
- Quality scoring system for each signal

### Fundamental Screener (Screener.in-style)
- Screen by PE, ROE, ROCE, Debt/Equity, Dividend Yield
- Preset screens: Value Picks, Growth Stars, High ROE
- Sortable columns with sector filtering

### Stock Detail Pages (Investing.com-style)
- Full price data with OHLCV
- Candlestick charts with TradingView Lightweight Charts
- Fundamental ratios, financial statements
- Shareholding pattern visualization
- Quality score with visual bars

### Options Chain (Sensibull-style)
- Live option chain for all F&O stocks
- Max Pain calculation, Put-Call Ratio (PCR)
- OI analysis with change tracking
- Multiple expiry support

### FII & DII Dashboard
- Daily net flows (buy/sell)
- Cumulative tracking (15D, 30D, 1Y)
- Sector-wise FPI allocation

### Market News + Alert System
- Live news feed, Telegram alerts, Web notifications

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TailwindCSS, Framer Motion |
| Charts | TradingView Lightweight Charts |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Real-time | WebSocket |
| Data | Yahoo Finance, NSE API |

## Quick Start

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm start

# Docker
docker-compose up --build
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/stocks` | List stocks with search/filter |
| `GET /api/scanners/:key` | Run scanner |
| `GET /api/fundamentals/:symbol` | Stock fundamentals |
| `GET /api/fii-dii/latest` | Latest FII/DII |
| `GET /api/options/:symbol` | Options chain |
| `GET /api/charts/:symbol` | Chart data |
| `GET /api/news` | Market news |
| `POST /api/alerts` | Create alert |

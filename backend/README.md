# AI Swing Trading Screener — Backend

A production-grade, provider-agnostic screener for the Indian equity & F&O
markets (NSE / BSE). It scans a universe of stocks, computes a full technical /
volume / trend / momentum feature set, applies liquidity, exclusion,
fundamental, delivery and news filters, scores every candidate with a weighted
AI scoring engine, and returns only institutional-quality swing setups with an
attached risk-management plan.

> **Runs out of the box with zero credentials.** The default `synthetic`
> data provider generates realistic, reproducible market data for a seed
> universe so the entire pipeline — scan, score, screen, risk-plan, API — works
> end-to-end immediately. Point it at a real broker by changing one env var.

---

## Quickstart

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # optional; defaults are fine for a demo

# Run the API
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000/docs         (interactive Swagger)
# → http://localhost:8000/api/top-picks

# …or run a scan straight from the CLI
python scan_cli.py --type weekly --limit 10
python scan_cli.py --json
```

Or with Docker (API + worker + Redis + Postgres):

```bash
docker compose up --build
```

Run the tests:

```bash
PYTHONPATH=. pytest -q
```

---

## Architecture

Every module has a single responsibility and speaks through Pydantic models
(`app/models/schemas.py`), so pieces are swappable and independently testable.

```
app/
├── config.py            # 12-factor settings (pydantic-settings)
├── main.py              # FastAPI app + CORS + lifespan
├── models/schemas.py    # the shared data contract
├── data/                # provider abstraction — swap brokers with one env var
│   ├── base.py                 # MarketDataProvider ABC (async)
│   ├── factory.py              # DATA_PROVIDER -> implementation (safe fallback)
│   ├── universe.py             # curated NSE seed universe
│   └── providers/
│       ├── synthetic.py        # zero-credential realistic data (default)
│       ├── upstox.py           # Upstox API v2
│       ├── dhan.py             # Dhan API v2
│       ├── angelone.py         # Angel One SmartAPI
│       └── shoonya.py          # Shoonya (Finvasia)
├── indicators/          # pure pandas/numpy — no TA-Lib required
│   ├── trend.py                # EMA, VWAP, ADX, ATR, Supertrend
│   ├── momentum.py             # RSI, MACD
│   ├── volatility.py           # Bollinger, Keltner, Donchian, HV
│   ├── volume.py               # OBV, volume SMA/RVol, volume profile (POC/HVN/LVN)
│   ├── levels.py               # pivots, CPR, 52w extremes, swing points, gap%
│   ├── structure.py            # HH/HL/LH/LL, BOS, trend strength, rel. strength
│   └── __init__.py             # compute_features(): the feature aggregator
├── patterns/detectors.py# VCP, Darvas, Cup&Handle, Bull Flag, Flat Base, …
├── filters/eligibility.py# liquidity/exclusion + fundamental + news + delivery
├── scoring/engine.py    # weighted AI score (Tech40/Vol20/Trend15/Mom10/Fund10/News5)
├── screeners/           # weekly / monthly / long-term / F&O + registry
├── risk/manager.py      # entry, ATR stop, 3 targets, R:R, position sizing
├── services/
│   ├── scanner.py              # async orchestrator (bounded concurrency)
│   ├── store.py                # cached results + watchlist
│   ├── cache.py                # Redis with in-memory fallback
│   └── alerts.py               # Telegram + email
├── tasks/celery_app.py  # daily automated scan + alerts
└── db.py                # optional SQLAlchemy persistence (Postgres/SQLite)
```

### The scan pipeline

```
universe → history → compute_features → eligibility gate
        → fundamentals + news gate → AI score → per-screener evaluation
        → risk plan → ranked StockResult cards
```

Per-symbol failures are isolated (one bad symbol never aborts a scan) and the
work is fanned out with a concurrency semaphore.

---

## Scoring

Final confidence (0–100) is a transparent weighted blend:

| Sub-score   | Weight | Drivers |
|-------------|:-----:|---------|
| Technical   | 40%   | EMA stack, VWAP, Supertrend, structure, 52w-high proximity, BOS |
| Volume      | 20%   | relative volume, delivery %, OBV trend |
| Trend       | 15%   | ADX, linear-fit trend strength, RS vs Nifty |
| Momentum    | 10%   | RSI sweet-spot, MACD, ATR expansion |
| Fundamental | 10%   | ROE/ROCE/D-E/growth/promoter/OCF/EPS |
| News        | 5%    | sentiment, red-flag penalties |

Score gates per horizon: **Weekly > 80 · Monthly > 85 · Long-Term > 90**.

---

## API

| Method | Endpoint | Description |
|-------|----------|-------------|
| GET | `/api/weekly` | Weekly swing setups (3–10d) |
| GET | `/api/monthly` | Monthly swing setups (2–8w) |
| GET | `/api/delivery` | Long-term delivery/investment picks |
| GET | `/api/fno` | F&O swing setups (OI build-up aware) |
| GET | `/api/top-picks` | Top N of every category |
| GET | `/api/search?q=` | Search results by symbol/name/sector |
| GET | `/api/sectors` | Sector strength ranking |
| GET | `/api/market-overview` | Market breadth summary |
| GET/POST/DELETE | `/api/watchlist` | Read / add / remove watchlist |
| POST | `/api/alerts` | Dispatch Telegram/email for high-conviction picks |
| POST | `/api/scan` | Force a fresh scan |

All list endpoints accept `?sort=score|volume|delivery|rr` and `?limit=`.

---

## Switching data providers

Set `DATA_PROVIDER` in `.env` to `upstox`, `dhan`, `angelone`, or `shoonya`
and provide that provider's credentials. The broker providers implement the
real historical-candle endpoints; production deployments additionally load the
provider's instrument master to map trading symbols to instrument tokens. If a
provider can't be constructed (missing creds), the factory logs and falls back
to `synthetic` so the service always starts.

---

## Scope & honesty note

This backend implements the full architecture and the core of every subsystem
in the spec — data abstraction, the complete indicator/pattern library, the
filter pipeline, the weighted scoring engine, all four screeners, risk
management, the REST API, caching, alerts, scheduled automation, tests and
Docker. The broker providers ship with real endpoint shapes but need live
credentials and an instrument-master mapping to pull production data;
fundamentals/news use the synthetic provider by default and are designed to be
backed by real fundamentals and a News API in production (the `MarketDataProvider`
interface already exposes `get_fundamentals` / `get_news`). Nothing here is
investment advice — outputs are analytical and for research only.

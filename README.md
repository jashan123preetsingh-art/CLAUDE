# CLAUDE

This repository hosts the **AI Swing Trading Screener** — a production-grade,
provider-agnostic screener for the Indian equity & F&O markets (NSE / BSE).

## Contents

- **[`backend/`](./backend)** — the Python / FastAPI screener engine: data-source
  abstraction (Upstox · Dhan · Angel One · Shoonya), a full pandas/numpy
  indicator & chart-pattern library, liquidity/fundamental/news/delivery
  filters, a weighted AI scoring engine, four screeners (weekly · monthly ·
  long-term · F&O), risk management, a REST API, caching, alerts, scheduled
  automation, tests and Docker. **Runs with zero credentials** via a synthetic
  data provider. See [`backend/README.md`](./backend/README.md).

Quick start:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000   # http://localhost:8000/docs
# or:  python scan_cli.py --type weekly --limit 10
```

> Nothing in this repository is investment advice. Outputs are analytical and
> for research only.

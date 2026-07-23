"""FastAPI application entrypoint.

Run locally with::

    uvicorn app.main:app --reload --port 8000

Then hit http://localhost:8000/docs for the interactive API, or
http://localhost:8000/api/top-picks for the headline results.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.routes import router
from app.config import get_settings
from app.logging_config import configure_logging, get_logger

settings = get_settings()
configure_logging(settings.log_level)
log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(
        "AI Swing Screener v%s starting (provider=%s, universe_limit=%s)",
        __version__,
        settings.data_provider,
        settings.universe_limit,
    )
    yield
    log.info("shutting down")


app = FastAPI(
    title="AI Swing Trading Screener",
    version=__version__,
    description="Institutional-quality swing screener for NSE/BSE (weekly, monthly, long-term, F&O).",
    lifespan=lifespan,
)

# The React/Next dashboard runs on a different origin in dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": __version__, "provider": settings.data_provider}


@app.get("/")
async def root():
    return {
        "name": "AI Swing Trading Screener",
        "version": __version__,
        "docs": "/docs",
        "endpoints": [
            "/api/weekly", "/api/monthly", "/api/delivery", "/api/fno",
            "/api/top-picks", "/api/search", "/api/sectors",
            "/api/market-overview", "/api/watchlist", "/api/alerts", "/api/scan",
        ],
    }

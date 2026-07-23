"""FastAPI routes implementing the screener's public contract.

All read endpoints serve from the cached scan; ``/api/scan`` forces a refresh.
Results can be sorted by score / volume / delivery / risk-reward and filtered.
"""
from __future__ import annotations

from collections import defaultdict
from enum import Enum

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.models.schemas import StockResult, SwingType
from app.services.alerts import dispatch_alerts
from app.services.store import get_store

router = APIRouter(prefix="/api")


class SortKey(str, Enum):
    score = "score"
    volume = "volume"
    delivery = "delivery"
    rr = "rr"


_SORTERS = {
    SortKey.score: lambda r: r.confidence_score,
    SortKey.volume: lambda r: r.volume_spike_pct or 0,
    SortKey.delivery: lambda r: r.delivery_pct or 0,
    SortKey.rr: lambda r: r.risk.risk_reward,
}


def _sorted(results: list[StockResult], sort: SortKey, limit: int) -> list[StockResult]:
    out = sorted(results, key=_SORTERS[sort], reverse=True)
    return out[:limit] if limit else out


async def _serve(swing: SwingType, sort: SortKey, limit: int) -> list[StockResult]:
    store = get_store()
    await store.ensure_scanned()
    return _sorted(store.bucket(swing), sort, limit)


@router.get("/weekly", response_model=list[StockResult])
async def weekly(sort: SortKey = SortKey.score, limit: int = 50):
    return await _serve(SwingType.WEEKLY, sort, limit)


@router.get("/monthly", response_model=list[StockResult])
async def monthly(sort: SortKey = SortKey.score, limit: int = 50):
    return await _serve(SwingType.MONTHLY, sort, limit)


@router.get("/delivery", response_model=list[StockResult])
async def delivery(sort: SortKey = SortKey.delivery, limit: int = 50):
    """Long-term delivery / investment picks (delivery-quality names)."""
    return await _serve(SwingType.LONG_TERM, sort, limit)


@router.get("/fno", response_model=list[StockResult])
async def fno(sort: SortKey = SortKey.score, limit: int = 50):
    return await _serve(SwingType.FNO, sort, limit)


class TopPicks(BaseModel):
    weekly: list[StockResult]
    monthly: list[StockResult]
    delivery: list[StockResult]
    fno: list[StockResult]


@router.get("/top-picks", response_model=TopPicks)
async def top_picks(limit: int = 10):
    store = get_store()
    await store.ensure_scanned()
    return TopPicks(
        weekly=_sorted(store.bucket(SwingType.WEEKLY), SortKey.score, limit),
        monthly=_sorted(store.bucket(SwingType.MONTHLY), SortKey.score, limit),
        delivery=_sorted(store.bucket(SwingType.LONG_TERM), SortKey.score, limit),
        fno=_sorted(store.bucket(SwingType.FNO), SortKey.score, limit),
    )


@router.get("/search", response_model=list[StockResult])
async def search(q: str = Query(..., min_length=1), limit: int = 25):
    store = get_store()
    await store.ensure_scanned()
    ql = q.lower()
    hits = [
        r for r in store.all_results()
        if ql in r.symbol.lower() or ql in r.name.lower() or ql in r.sector.lower()
    ]
    return _sorted(hits, SortKey.score, limit)


class SectorStrength(BaseModel):
    sector: str
    avg_score: float
    count: int
    top_symbol: str | None = None


@router.get("/sectors", response_model=list[SectorStrength])
async def sectors():
    store = get_store()
    await store.ensure_scanned()
    agg: dict[str, list[StockResult]] = defaultdict(list)
    for r in store.all_results():
        agg[r.sector].append(r)
    out = []
    for sector, rs in agg.items():
        rs.sort(key=lambda r: r.confidence_score, reverse=True)
        out.append(
            SectorStrength(
                sector=sector,
                avg_score=round(sum(r.confidence_score for r in rs) / len(rs), 1),
                count=len(rs),
                top_symbol=rs[0].symbol,
            )
        )
    out.sort(key=lambda s: s.avg_score, reverse=True)
    return out


class MarketOverview(BaseModel):
    total_candidates: int
    weekly: int
    monthly: int
    delivery: int
    fno: int
    avg_confidence: float
    strongest_sector: str | None
    last_scan_ts: float


@router.get("/market-overview", response_model=MarketOverview)
async def market_overview():
    store = get_store()
    await store.ensure_scanned()
    allr = store.all_results()
    sector_scores: dict[str, list[float]] = defaultdict(list)
    for r in allr:
        sector_scores[r.sector].append(r.confidence_score)
    strongest = (
        max(sector_scores.items(), key=lambda kv: sum(kv[1]) / len(kv[1]))[0]
        if sector_scores
        else None
    )
    return MarketOverview(
        total_candidates=len(allr),
        weekly=len(store.bucket(SwingType.WEEKLY)),
        monthly=len(store.bucket(SwingType.MONTHLY)),
        delivery=len(store.bucket(SwingType.LONG_TERM)),
        fno=len(store.bucket(SwingType.FNO)),
        avg_confidence=round(sum(r.confidence_score for r in allr) / len(allr), 1) if allr else 0.0,
        strongest_sector=strongest,
        last_scan_ts=store.last_scan_ts,
    )


# --- watchlist ---
class WatchlistOp(BaseModel):
    symbol: str


@router.get("/watchlist", response_model=list[StockResult])
async def watchlist():
    store = get_store()
    await store.ensure_scanned()
    syms = set(store.watchlist_symbols())
    return [r for r in store.all_results() if r.symbol in syms]


@router.post("/watchlist")
async def watchlist_add(op: WatchlistOp):
    get_store().add_watch(op.symbol)
    return {"ok": True, "watchlist": get_store().watchlist_symbols()}


@router.delete("/watchlist")
async def watchlist_remove(op: WatchlistOp):
    get_store().remove_watch(op.symbol)
    return {"ok": True, "watchlist": get_store().watchlist_symbols()}


# --- alerts / scan control ---
@router.post("/alerts")
async def alerts(min_score: float = 85.0):
    store = get_store()
    await store.ensure_scanned()
    sent = await dispatch_alerts(store.all_results(), min_score=min_score)
    return {"dispatched": sent, "min_score": min_score}


@router.post("/scan")
async def scan_now():
    store = get_store()
    await store.ensure_scanned(force=True)
    return {
        "ok": True,
        "counts": {
            st.value: len(store.bucket(st)) for st in SwingType
        },
        "last_scan_ts": store.last_scan_ts,
    }

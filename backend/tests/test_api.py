"""End-to-end API + scanner tests using the synthetic provider."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.scanner import Scanner


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_dashboard_serves(client):
    r = client.get("/dashboard")
    assert r.status_code == 200
    assert "AI SWING SCREENER" in r.text or "AI Swing Trading Screener" in r.text


def test_scan_produces_results(client):
    r = client.post("/api/scan")
    assert r.status_code == 200
    counts = r.json()["counts"]
    # synthetic universe is shaped so at least one bucket has candidates
    assert sum(counts.values()) > 0


def test_endpoints_serve(client):
    for path in ["/api/weekly", "/api/monthly", "/api/delivery", "/api/fno",
                 "/api/sectors", "/api/market-overview", "/api/top-picks"]:
        assert client.get(path).status_code == 200


def test_result_contract(client):
    results = client.get("/api/weekly?limit=5").json()
    if results:
        r = results[0]
        for key in ["symbol", "name", "sector", "current_price", "confidence_score",
                    "scores", "risk", "reasons"]:
            assert key in r
        assert r["risk"]["stop_loss"] < r["risk"]["target1"]
        assert r["confidence_score"] > 80  # weekly gate


def test_search(client):
    client.post("/api/scan")
    r = client.get("/api/search?q=bank")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_scanner_direct():
    scanner = Scanner()
    buckets = await scanner.scan()
    await scanner.aclose()
    assert set(buckets.keys()) == {"weekly", "monthly", "long_term", "fno"}
    # every returned result must respect its score gate
    for r in buckets["weekly"]:
        assert r.confidence_score > 80
    for r in buckets["long_term"]:
        assert r.confidence_score > 90

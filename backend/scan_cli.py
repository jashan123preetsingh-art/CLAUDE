#!/usr/bin/env python3
"""Command-line scanner — run a full scan and print institutional-format cards.

Usage::

    python scan_cli.py                 # all swing types, top 5 each
    python scan_cli.py --type weekly --limit 10
    python scan_cli.py --json          # machine-readable output
"""
from __future__ import annotations

import argparse
import asyncio
import json

from app.models.schemas import StockResult, SwingType
from app.services.scanner import Scanner

DIVIDER = "━" * 60


def render_card(r: StockResult) -> str:
    lines = [
        DIVIDER,
        f"{r.symbol}  |  {r.name}",
        f"Sector: {r.sector}   Exchange: {r.exchange.value}   Type: {r.swing_type.value}",
        f"Price: ₹{r.current_price}   Market Cap: ₹{r.market_cap_cr:,.0f} Cr",
        f"Confidence: {r.confidence_score}  "
        f"(Tech {r.scores.technical} / Vol {r.scores.volume} / Trend {r.scores.trend} / "
        f"Mom {r.scores.momentum} / Fund {r.scores.fundamental} / News {r.scores.news})",
        f"Entry: {r.risk.entry_low}-{r.risk.entry_high}   SL: {r.risk.stop_loss}   "
        f"ATR-stop: {r.risk.atr_stop}",
        f"Targets: T1 {r.risk.target1}  T2 {r.risk.target2}  T3 {r.risk.target3}   "
        f"R:R {r.risk.risk_reward}",
        f"Hold ~{r.risk.expected_holding_days}d   Size: {r.risk.position_size_shares} sh   "
        f"Max risk {r.risk.max_risk_pct}%",
        f"Delivery%: {r.delivery_pct}   VolSpike%: {r.volume_spike_pct}   ATR: {r.atr}",
        f"RSI: {r.rsi}   MACD hist: {r.macd_hist}   ADX: {r.adx}   RS: {r.relative_strength}",
        f"Patterns: {', '.join(r.patterns) or '—'}",
        f"Reasons: {', '.join(r.reasons)}",
        f"Risk factors: {', '.join(r.risk_factors) or '—'}",
    ]
    return "\n".join(lines)


async def main() -> None:
    p = argparse.ArgumentParser(description="AI Swing Trading Screener CLI")
    p.add_argument("--type", choices=[t.value for t in SwingType], default=None)
    p.add_argument("--limit", type=int, default=5)
    p.add_argument("--json", action="store_true")
    args = p.parse_args()

    types = [SwingType(args.type)] if args.type else list(SwingType)
    scanner = Scanner()
    buckets = await scanner.scan(types)
    await scanner.aclose()

    if args.json:
        payload = {
            k: [json.loads(r.model_dump_json()) for r in v[: args.limit]]
            for k, v in buckets.items()
        }
        print(json.dumps(payload, indent=2, default=str))
        return

    for st in types:
        results = buckets.get(st.value, [])[: args.limit]
        print(f"\n########## {st.value.upper()}  ({len(buckets.get(st.value, []))} qualified) ##########")
        if not results:
            print("  (no qualifying setups)")
        for r in results:
            print(render_card(r))
    print(DIVIDER)


if __name__ == "__main__":
    asyncio.run(main())

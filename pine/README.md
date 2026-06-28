# EMA + Market Structure PRO (v3)

A focused, **non-repainting TradingView Pine Script v6** price-action engine —
deliberately *no* liquidity sweeps, FVGs, order blocks or oscillators. Just a
fast, clean, reliable decision engine.

> File: [`InstitutionalEMA_MarketStructure.pine`](./InstitutionalEMA_MarketStructure.pine)

## Engines

| Engine | What it does |
| --- | --- |
| **Triple-EMA + Strength** | 8 / 33 / 200. Trend **quality** is measured by EMA separation, not just order: **Weak · Moderate · Strong · Explosive**. |
| **Market Structure** | Strong-BOS / CHoCH only (close beyond structure + body ≥ 60 % + > ATR×0.15). ATR-adaptive swing length (10 / 15 / 20). |
| **Key Levels + Freshness** | Demand/supply zones scored **Fresh · Tested 1x · Tested 2x · Weak**. Fresher = brighter border + higher confidence. Premium colours; broken support → orange, broken resistance → cyan. |
| **Market-State Engine** | Classifies **Trending · Pullback · Range · Compression**. Signals are blocked in Range / Compression. |
| **Confidence + Grade** | 0-100 (trend-strength 20 · structure 20 · zone-freshness 20 · displacement 15 · EMA align 5 · session 5 · HTF 15). Rendered as **A+ (95-100) / A (90-94) / B (≥ threshold)** — anything below is hidden. |
| **HTF confirmation** | One higher timeframe (default 1H). Alignment adds to confidence; conflict reduces it. |
| **Auto risk** | On every signal: Entry / Stop / Take-Profit lines + RR label, drawn for you. |

## A signal needs ALL of this

**BUY** (SELL mirrors): bullish trend · strong displacement BOS/CHoCH · price in a
**fresh demand** zone · market state Trending/Pullback (not Range/Compression) ·
trend strength ≥ Moderate · RR ≥ **1:2** · confidence ≥ threshold · optional session.

Prints as a small `BUY A+ 96%` label, with Entry/SL/TP auto-drawn.

## Dashboard (top-right)

Trend · **Strength** · **Market State** · HTF · Structure · Nearest Demand ·
Nearest Resistance · **Recommended RR** · Confidence + grade.

## Visual polish

Gradient EMA fill (intensity scales with separation), small consistent labels,
faded BOS/CHoCH tags, transparent backgrounds, tidy spacing.

## Non-repainting

Swings & zones from confirmed `ta.pivot*` (fixed lag). HTF reads the previous
completed bar with lookahead-on. Every state resolves on bar close.

## Install

**TradingView → Pine Editor** → clear editor → paste → save → **Add to chart**.
Defaults tuned for **XAUUSD 15m**. If signals feel too rare, lower *Min
confidence* or disable the session restriction first.

---

*Structure engine inspired by "Market Structure" © Leviathan; key-level concept
inspired by "Bjorgum Key Levels" © Bjorgum. Self-contained, no imports.
Educational / analytical tool — not financial advice.*

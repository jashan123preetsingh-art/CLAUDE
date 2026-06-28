# EMA + Market Structure PRO (v2)

A premium-grade, **non-repainting TradingView Pine Script v6** indicator. Four
engines that only fire a signal when *everything* aligns.

> File: [`InstitutionalEMA_MarketStructure.pine`](./InstitutionalEMA_MarketStructure.pine)

## Engines

| Engine | What it does |
| --- | --- |
| **Triple-EMA trend** | **8** (momentum / white), **33** (trend / orange), **200** (macro / red). Bullish = `8 > 33 > 200` and price above the 33 (does **not** require price above the 200 — that only delays entries). |
| **Market Structure** | Strong-BOS / CHoCH only. A break counts when the candle **closes** beyond structure, body ≥ 60 % of range, and penetration > ATR × 0.15. Weak breaks are ignored. **Adaptive swing length** scales with volatility (low → 10, mid → 15, high → 20). |
| **Key Levels** | Adaptive demand/supply zones with **touch-based strength** (★☆), brighter borders the more a level is respected. Premium colours — support **blue**, resistance **yellow**, broken support → **orange**, broken resistance → **cyan**. |
| **Confidence Engine** | 0-100 score: Trend 20 · Structure 20 · Zone 20 · Displacement 20 · EMA alignment 10 · Session 10. |

## A signal needs ALL of this

**BUY** (SELL is the mirror):
1. ✓ Bullish EMA trend
2. ✓ Strong displacement BOS/CHoCH (not a weak break)
3. ✓ Strong candle (body ≥ 60 % **or** range ≥ 1.2 ATR)
4. ✓ Price inside a fresh **demand** zone
5. ✓ ATR expansion — no flat EMAs, no contracted/ranging market
6. ✓ Risk:Reward ≥ **1:2** (SL at structure/zone, TP at next zone)
7. ✓ Confidence ≥ **85 %** (configurable)
8. ✓ (optional) London / New York / Asia session

Signals print as a clean `BUY 94%` / `SELL 91%` label.

## Dashboard (top-right, configurable)

Trend · Momentum · Structure (HH/HL…) · Nearest Demand · Nearest Resistance ·
Session · **Confidence %** with live signal.

## Extras

- **Candle colouring** (optional): dark-green bull trend, grey pullback, dark-red bear.
- **Smart filter**: blocks signals on flat EMAs, contracted ATR, small bodies, or RR < target.
- **Rich alerts** with trend, confidence, structure, zone, symbol and timeframe; plus
  simple `alertcondition` alerts for BUY/SELL, strong BOS, and zone breaks.

## Non-repainting

Swings & zones use confirmed `ta.pivot*` (fixed lag). Adaptive swing selects
between **constant-length** pivot streams (10/15/20) by ATR regime, so each
stream stays non-repainting. Breaks, zone touches and zone breaks all evaluate
on closed bars.

## Install

**TradingView → Pine Editor** → clear the editor → paste the file → save → **Add
to chart**. Tune EMAs, swing/zone look-back, confidence threshold, RR and
sessions in settings. Defaults are tuned for **XAUUSD 15m**.

---

*Structure engine inspired by "Market Structure" © Leviathan; key-level concept
inspired by "Bjorgum Key Levels" © Bjorgum. Self-contained, no library imports.
Educational / analytical tool — not financial advice.*

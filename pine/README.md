# EMA + Market Structure PRO (v4)

A premium, **non-repainting TradingView Pine Script v6** price-action workstation.
A clean trading *assistant* — not another Smart-Money-Concepts dump. It focuses
only on Trend · Market Structure · Demand/Supply · EMA · Price Action · Momentum.
No liquidity sweeps, FVGs, order blocks, RSI, MACD, VWAP or volume profile.

> File: [`InstitutionalEMA_MarketStructure.pine`](./InstitutionalEMA_MarketStructure.pine)

## The pipeline

A single small dot prints **only** when the entire chain passes:

```
Strong trend → healthy pullback to the 8/33 EMA → strong confirmation candle
→ strong BOS → fresh demand/supply zone → confidence ≥ threshold → DOT
```

No BUY/SELL text, no arrows. A **green dot below** = bullish setup, **red dot
above** = bearish. The chart guides you; it doesn't shout.

## Engines

| Engine | What it does |
| --- | --- |
| **Trend Strength** | Composite of EMA separation **+** slope **+** ATR expansion → Weak · Moderate · Strong · Explosive. Drives confidence and the dynamic EMA colour. |
| **Market State** | Trending · Pullback · Compression · Range. Entries are blocked in Range and Compression. |
| **Dynamic Pullback** | Arms on a healthy pullback to the 8/33 EMA in a strong trend, then waits for a strong confirmation candle + BOS — no buying blindly after a break. |
| **Entry-Candle Quality** | Body ≥ 60 %, close near the extreme, small rejection wick, no doji / spinning top. |
| **Zones** | Demand/supply zones created on confirmed pivots, merged when they overlap, capped at `Max zones`. Broken zones recolour (support→orange, resistance→cyan) rather than vanish, so the chart updates instantly without lag. |
| **Confidence** | Weighted: Trend 25 · Structure 20 · Zone 20 · Pullback 15 · Candle 10 · HTF 10. |
| **HTF confirmation** | Optional higher timeframe (default 1H) raises/lowers confidence. Non-repainting. |
| **Cooldown** | After a dot, no new same-direction signal until structure flips or N bars pass (default 15). |

## Dashboard (minimal)

Trend · Strength · Market State · Confidence · HTF · Nearest Demand · Nearest
Resistance · Recommended RR · Session. Nothing else.

## Modes

- **Beginner** — EMAs, entry dots, zones, dashboard.
- **Advanced** — adds structure, BOS/CHoCH, risk lines (Entry/SL/TP), quality stars.

## Visual design

Dynamic Momentum-EMA colour (brightens with strength), gradient fill, thin lines,
soft transparency, small labels, capped structure labels — old objects are pruned
automatically so it stays fast even on 1-minute charts.

## Alerts

"High-Probability Bullish/Bearish Setup" with confidence, trend, state, RR, HTF,
symbol and timeframe — never "BUY"/"SELL".

## Install

**TradingView → Pine Editor** → clear editor → paste → save → **Add to chart**.
Defaults tuned for **XAUUSD 15m**. Dots are intentionally rare; to see more during
testing, lower *Min confidence* or shorten the cooldown.

---

*Structure concept inspired by "Market Structure" © Leviathan; zone concept
inspired by "Bjorgum Key Levels" © Bjorgum. Self-contained, no imports.
Educational / analytical tool — not financial advice.*

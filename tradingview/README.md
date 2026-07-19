# Smart Money Institutional Suite (SMI) — TradingView / Pine Script v6

An original, institutional-grade Smart Money Concepts (SMC) / ICT trading
system for TradingView, written in **Pine Script v6**. It is built around a
single **unified Market Structure Engine** — every module consumes the same
structural data, so there is no duplicated structure logic anywhere in the
script.

> **Original work.** This is a clean-room implementation of *public* ICT/SMC
> concepts and standard engineering practices. No commercial or proprietary
> indicator was copied or reverse-engineered.

## File

- `SmartMoneyInstitutional.pine` — the complete indicator (single file).

## Design philosophy — clean by default

A trading tool should give a fast, calm market read, not bury the chart. So the
indicator ships **minimal by default** — only the high-signal modules are on:

- Color-adaptive **dynamic trend line** (the centerpiece)
- **BOS / CHoCH** structure breaks (subtle dashed line + small text tag)
- Clean **swing HH/HL/LH/LL** text (no chip boxes)
- A few **Order Blocks** and **Fair Value Gaps** (mitigated ones auto-removed)
- **Premium / Discount** equilibrium
- The **dashboard** with the MTF panel, **probability meter**, Signal Status and
  Entry/SL/TP

Everything else — MSS labels, Inducement, Sweeps, Liquidity balls/voids, Volume
Profile, Sessions/Kill zones, internal structure — is **off by default** and one
checkbox away when you want it. Turn on only what you read.

## How to use

1. Open TradingView → **Pine Editor**.
2. Paste the contents of `SmartMoneyInstitutional.pine`.
3. Click **Add to chart**.
4. Open the indicator **Settings** to enable/disable modules and tune them.
5. For alerts: create an alert on the symbol and choose
   **"Any alert() function call"** as the condition. Each event sends its own
   descriptive message.

## Engineering guarantees

| Guarantee | How it is enforced |
|-----------|--------------------|
| **Non-repainting** | Structure is built only from *confirmed* pivots (`ta.pivothigh/low` are offset by their length, so a swing is N bars old before any module reads it). |
| **No future data** | `request.security()` uses `lookahead_off` plus the confirmed-bar idiom. No real-time peeking. |
| **Replay safe** | All state mutation and drawing is guarded by `barstate.*`, so the bar-replay tool reproduces identical output. |
| **Self-cleaning** | Mitigated order blocks, filled FVGs, swept liquidity and stale objects are deleted automatically. Array sizes are capped by performance mode. |
| **Modular** | Every module has an on/off switch and its own settings group. |
| **Performant** | One ATR / one volume MA / one EMA shared across all modules; object budgets scale with `Performance mode` (Lite / Balanced / Max). |

## Architecture

```
                ┌─────────────────────────────────────────┐
                │   MARKET STRUCTURE ENGINE (Section 4)    │
                │  internal + swing pivots, HH/HL/LH/LL,   │
                │  trend state — the single source of truth│
                └───────────────────┬─────────────────────┘
                                    │  (consumed by everything)
   ┌───────────────┬───────────────┼───────────────┬───────────────┐
   ▼               ▼               ▼               ▼               ▼
 BOS/CHoCH/MSS   Inducement     Liquidity        Sweeps         Order Blocks
   ▼               ▼               ▼               ▼               ▼
   FVG          Premium/Disc   Dyn. Trendline   MTF Bias       Confluence
                                                                   ▼
                                                          AI Entry / SL / TP
                                                                   ▼
                                              Dashboard · Sessions · Alerts
```

## Modules

1. **Market Structure Engine** — independent *internal* (fast) and *swing*
   (slow) structure with HH/HL/LH/LL classification, adjustable sensitivity,
   optional ATR noise filter and optional Williams-fractal confirmation.
2. **BOS** — continuation break of a protected swing (close-confirmed, optional
   displacement / volume filter).
3. **CHoCH** — *first* counter-trend break (warning of changing control).
4. **MSS** — the displacement-backed continuation break that **confirms** a
   CHoCH. MSS is never marked on the same event as a CHoCH.
5. **Inducement (IDM)** — nearest minor liquidity that fuels the real move;
   distinct from a sweep, drawn with blue dotted lines and optional trap zones.
6. **Liquidity** — equal highs/lows (buy/sell-side), pools, untouched/resting
   liquidity, and liquidity voids.
7. **Liquidity Sweeps** — wick vs body, partial vs complete, tagged `SWEPT`.
8. **Order Blocks** — last opposite candle before a confirmed displacement
   break; `Fresh → Tested → Mitigated → Broken` lifecycle with auto-delete.
9. **Fair Value Gaps** — 3-candle imbalance with min ATR/% size, consequent
   encroachment (CE) line, and `Active → Partial → Filled` mitigation.
10. **Dynamic Trendline** — weighted composite of structure, internal trend,
    EMA slope, momentum, premium/discount and break events (not a naive pivot
    line); reports trend score, age and distance.
11. **Premium / Discount** — dealing range with equilibrium (Fib 50%) and
    optional shading.
11b. **Volume Profile (HVN/LVN/POC)** — buckets recent volume into price bins to
    reveal High-Volume Nodes (acceptance / strong S-R), Low-Volume Nodes
    (imbalance / fast-move zones), the Point of Control line, and a 70% value
    area. Drawn to the right of price on the last bar only (non-repainting,
    self-cleaning).
12. **Multi-Timeframe** — non-repainting bias across **8 timeframes**
    (Daily · 12H · 4H · 1H · 30m · 15m · 5m · 1m), shown in a clean 3-column
    panel with a **Volatility Timer** countdown to each candle close, plus an
    aggregated HTF bias. Timers are computed from the wall clock so they work on
    any chart timeframe.
13. **Confluence Engine** — weighted 0–100 probability per side
    (e.g. *93% Long*).
14. **AI Entry** — fully symmetric and **trigger-driven**: a bullish trigger
    (MSS/BOS/sweep/CHoCH) produces a LONG, a bearish one a SHORT, so reversal
    longs appear even inside a broader downtrend. Each side must also clear the
    probability threshold; if both fire, the higher-scoring side wins.
15. **AI Stop Loss** — three modes: **AI Optimized** (buffer adapts to the live
    volatility regime so stops sit outside normal noise), Structure, or ATR.
16. **AI Take Profit** — TP1/TP2/TP3 by risk-reward, with an optional
    **Liquidity-aware** mode that snaps the final target onto the nearest
    opposing liquidity / swing.
17. **Dashboard** — professional floating panel: accent header, blue row labels,
    orange gridlines, the 8-timeframe trend + Volatility Timer panel, a
    highlighted **Signal Status** (BUY/SELL Active vs Waiting), and
    **Entry Price / Stop Loss (pts) / TP1 (pts) / Active PL** rows. Optional
    detailed SMC rows (structure, liquidity, OB, FVG, probability) can be toggled
    on. The dynamic trend line is a color-adaptive, price-hugging plot
    (green = bullish, red = bearish, gray = transition) with hysteresis so it
    holds direction instead of flickering.

### Visual polish

- **HP-UP / HP-DOWN** high-probability reversal tags on confirmed swing points
  (toggle in the Market Structure group) for a clean chart instead of dense
  HH/HL/LH/LL text.
- **Liquidity balls** — blue circle markers on resting/uncollected liquidity
  pools, useful as logical take-profit magnets.
- **Extended order-block zones** that grow with price for the long, clean
  institutional look.
18. **Session Engine** — Asia / London / New York, ICT kill zones, optional
    Silver Bullet windows.
19. **Alert Engine** — independent message for every event.
20. **Performance Engine** — array caps, object reuse, shared calculations.

## Settings groups

Settings are organised into numbered groups (① General → ⑰ Performance) so each
module is easy to find. Colours, transparency, sensitivity, object limits,
dashboard size/position, session times and the performance mode are all
user-configurable, with Dark/Light theme support.

## Disclaimer

This indicator is a market-analysis tool for educational purposes. It is **not**
financial advice and does not guarantee profits. Always do your own research and
manage risk.

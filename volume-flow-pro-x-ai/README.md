# Volume Flow Pro X AI

**The Ultimate Day Trading Workspace** — an institutional Volume Profile + VWAP
decision-support terminal for TradingView, written in **Pine Script v6**.

This is *not* a buy/sell signal indicator. It is a clean, Bloomberg/Bookmap-grade
workspace built on four primitives only: **Price, Volume, VWAP, and the Volume
Profile**. It answers the five questions a day trader asks every morning:

1. Where is fair value? → **VWAP suite + POC / Value Area**
2. Who controls the market? → **Market Bias + Volume Flow**
3. Where are institutions interested? → **HVN / LVN + Value Area edges**
4. Where is the safest trade location? → **AI Trade Plan (entry/stop/targets)**
5. Where should the trade be managed? → **Score, R:R, and key levels**

---

## Installation

1. Open TradingView → **Pine Editor**.
2. Paste the contents of [`VolumeFlowProXAI.pine`](./VolumeFlowProXAI.pine).
3. Click **Add to chart**. When prompted, click a candle to set the Anchored
   VWAP origin (only relevant if you enable the Anchored VWAP module).

Works on any symbol/timeframe, but it is tuned for **intraday day trading**
(1m–15m) on instruments with real volume (futures, stocks, liquid crypto).

---

## Modules implemented

| # | Module | What it does |
|---|--------|--------------|
| M1 | **Fixed Range Volume Profile** | POC, VAH, VAL with overlap-accurate volume binning, Auto/Session/Manual range modes, right/left side, configurable resolution & width |
| M2 | **Anchored VWAP** | VWAP anchored to a user-clicked candle / date |
| M3 | **VWAP Suite** | Daily (with slope/direction), Weekly, Monthly VWAP |
| M4 | **Std-Dev Bands** | ±1σ / ±2σ volume-weighted bands on Daily VWAP with soft fills |
| M6/M7 | **Value Area & HVN/LVN** | 70% (configurable) value area; top-N high/low volume nodes only — no clutter |
| M8 | **Volume Flow Engine** | Relative-volume rating (Very High→Very Low) + buying/selling pressure |
| M9 | **Smart Price Action** | Trend EMA, swing pivots, dynamic support/resistance, HH/LL structure |
| M12 | **Market Condition** | Trending / Range / Balanced / Compression / Expansion + volatility regime |
| M13 | **Trade Quality** | Independent 0–100 long & short scoring → grade (A+…D) and Market Quality |
| M14/M21 | **AI Trade Plan** | A clean status tag — WAIT / SETUP FORMING / BUY-SELL PLAN READY — with score, grade and the reasons behind it (no entry/stop/target clutter) |
| M15 | **Dashboard** | Dark-glass terminal panel: bias, state, VWAP, POC/VA, HVN/LVN, flow, plan |
| M16 | **Smart Alerts** | VWAP break/bounce/reject, POC break, value-area entry, plan-ready, score threshold |
| M17 | **Clean Chart** | All drawings are recycled on the last bar; object count stays bounded |
| M18 | **Customization** | Every color, module, opacity, position, size, and threshold is an input |

### Pro upgrade (v2)

| Feature | What it does |
|---------|--------------|
| **Multi-Timeframe POC** | Daily / Weekly / Monthly Point of Control so you instantly see where institutions traded across timeframes (approximated from intraday bars, lookback capped for performance) |
| **Ranked Key Levels** | A dedicated panel showing only the **top 5** levels, ranked by strength (★ rating) then proximity — Weekly/Monthly POC & VWAP outrank intraday HVN/LVN. Prices colour as resistance (above) or support (below) |
| **Session Intelligence** | Active session (Asia / London / New York), ADR(N), today's range, range-used %, Initial Balance (configurable minutes), and best (highest-volume) session of the day |
| **Auction Market Theory** | Profile shape — **P-shape** (accumulation), **b-shape** (distribution), **D-shape** (balanced) — plus Poor High / Poor Low warnings and a Day-Type classifier (Trend / Balanced / Expansion / Compression / Normal) |
| **Volume Delta Approximation** | Buyers % vs Sellers % and a "Buyers/Sellers Dominating" read, estimated from bar location × volume (Pine has no true bid/ask tape) |
| **AI Morning Brief** | A pre-trade panel: bias, day type, preferred buy zone (VAL–POC), preferred sell zone (POC–VAH), expected range, best session, plan and confidence |

### The Brain — Five-Layer Auction Intelligence (v4)

The intelligence is **not** a pile of indicators. There are **no EMAs, no RSI,
no MACD** in the decision path. Trend is derived from auction + structure, and
every status flows through one fixed hierarchy that mirrors how a discretionary
futures trader actually thinks:

```
Market Phase  →  Auction (40%)  →  Structure (30%)  →  VWAP (20%)  →  Participation (10%)  →  Decision
```

| Layer | Role | What it reads |
|-------|------|---------------|
| **1 · Market Phase** (top priority) | "What environment is this?" — gates confidence and whether trend trades are even allowed | Opening Drive · Trend Day · Pullback · Reversal · Expansion · Compression · Balanced Auction · Continuation · Rotational |
| **2 · Auction Intelligence** (40%) | "Where is value and who controls it?" | Price vs VAH/VAL/POC, acceptance/rejection, POC migration, balance vs imbalance |
| **3 · Market Structure** (30%) | "Does price action confirm?" — pure HH/HL/LH/LL, breakouts, expansion/compression (no ICT terms) | swing structure + breakouts |
| **4 · VWAP Context** (20%) | "Cheap, fair or expensive?" | above/below, slope, distance, Daily/Weekly/Monthly/Anchored |
| **5 · Participation** (10%) | "Is the move supported?" | relative volume, expansion/contraction, buy/sell pressure |

The **composite Trend** (Strong Bullish → Strong Bearish) is a weighted blend of
layers 2–5 (40/30/20/10), with Phase governing confidence — never a moving
average. The **Decision Engine** (WAIT / WATCH / BUY PULLBACK / SELL RETEST /
NO TRADE, plus MANAGE / MOVE STOP / TAKE PARTIAL / EXIT when *Active Position*
is set) is produced strictly in that order and **explains itself** in plain
English: Phase → Auction → Structure → VWAP → Volume → conclusion.

Supporting panels: **Market GPS** (live price location), **Institutional
Confluence** (`X/6` pillar agreement, ★ rated), **Market Energy**, **Risk**
read, and the ranked **Key Levels** panel (top-5, institutional levels first).
The AI only explains — it never predicts a target or prints buy/sell arrows.

---

## Design principles

- **The chart is more important than the indicator.** Candles stay visible;
  levels use thin lines and soft transparency.
- **No signal spam.** A plan only *arms* when the score clears your threshold,
  the trend agrees, and price is outside the value area. Most of the time the
  engine correctly says **WAIT**.
- **Day-trader default view** ≈ 10–12 meaningful levels: Daily/Weekly VWAP,
  POC, VAH/VAL, top-2 HVN/LVN, PDH/PDL, and the opening range.
- **Non-repainting.** VWAPs accumulate bar-by-bar; previous-day levels use the
  `high[1]` + `lookahead_on` idiom. Replay-compatible.

---

## How the Trade Plan engine works

Long and short setups are scored independently across VWAP position, POC
position, trend, market structure, volume pressure, relative volume, and a
healthy-pullback-into-value bonus. The higher-conviction side wins. A plan is
only labelled **READY** when:

```
score ≥ your threshold  AND  trend agrees  AND  price is outside the Value Area
```

Otherwise it shows **SETUP FORMING** (close but not confirmed) or **WAIT**.
The on-chart output is a clean tag only — the plan status plus its score, grade
and reasons. Execution (entry, stop, targets) is left to the trader; the
indicator's job is to tell you *when and why* there is an edge, and to keep you
out the rest of the time.

---

## Key inputs to know

- **Volume Profile → Range Mode**: `Auto (Lookback)` for a rolling window,
  `Session` for today's developing profile, `Manual Bars` for a fixed count.
- **Volume Profile → Resolution / Width (bars) / Gap**: rows, and how wide /
  how far off the last candle the histogram is drawn. The profile lives in the
  **right margin** (the empty area to the right of price), never on top of the
  candles — like TradingView/Bookmap. `Side = Left` makes the bars grow leftward
  toward price (still inside the margin).
- **AI Trade Plan → Min Trade Score**: raise it to be more selective (default 70).
- **Theme**: `Dark Glass` (default) or `Light`; full color overrides available.

---

## Deliberately not built (and why)

A few requested ideas aren't a good fit for Pine Script and would be dishonest
to fake, so they're left out rather than shipped half-working:

- **True bid/ask volume delta** — Pine has no access to the order tape. We ship a
  transparent *approximation* (Buyers/Sellers %) instead of pretending to have real delta.
- **Replay coaching / trade replay review** ("good entry, poor exit") — Pine can't
  persist a trade journal across sessions or read your fills, so a genuine post-trade
  coach belongs in a companion app, not the indicator. The Morning Brief + live plan
  cover the *pre*-trade side well.
- **Next-day level projection** — beyond the ADR-based Expected Range we already show,
  projecting tomorrow's POC/VA reliably needs data Pine doesn't expose intraday.

## Notes & limitations

- The volume profile is approximated from OHLCV bars (TradingView does not expose
  true tick-by-tick data to Pine). Overlap-proportional binning makes it
  considerably more accurate than single-bin approaches, but it is still an
  OHLC-based estimate.
- "AI" here means a transparent, rules-based scoring engine — every conclusion is
  explainable via the on-chart reasons. No external model is called.
- Profile and levels are drawn on the **last bar** for performance; they update
  in real time as new bars close.

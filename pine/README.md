# GainzAlgo V2 Alpha — Pine Script

TradingView **Pine Script v5** tools that encode the GainzAlgo V2 Alpha
*filtering* philosophy: they don't predict the market — they screen out noise
and only fire when independent factors align. If confirmation is missing, the
Alpha Dashboard reads **NO TRADE**. Quality > Quantity.

| File | Type | Use it for |
|------|------|-----------|
| **`GainzAlgoV2_Indicator.pine`** | Indicator (study) | The full Alpha feature set: confirmed BUY/SELL arrows, READY/BOS/CHoCH/FLOW/LIQ labels, ATR TP/SL, MTF convergence, CVD order-flow, Alpha Dashboard, presets. **Start here.** |
| `GainzAlgoV2.pine` | Strategy | Earlier logic wired into TradingView's backtester (entries/exits, equity curve). |

## The indicator (GainzAlgoV2_Indicator.pine)

### 1. Confirmed signals & early labels
- **BUY / SELL arrows** — locked on **bar close** (`nonRepaint` on by default) so
  historical signals never move or disappear (no repaint, no lag).
- **Early momentum labels** (toggle *Show READY/BOS/CHoCH/FLOW/LIQ*):
  - **READY** — momentum building, one layer away from a full signal.
  - **BOS / CHoCH** — Break of Structure / Change of Character.
  - **FLOW** — order-flow burst (CVD + volume + impulse aligned).
  - **LIQ** — liquidity swept at a prior swing.

### 2. Six-layer signal filtering
A signal needs at least **`Min layers to confirm`** (default **5 of 6**) aligned,
and that side must beat the other:

| Layer | Long condition |
|-------|----------------|
| **L1 Trend** | Multi-timeframe convergence (≥2 of 3 TFs bullish) |
| **L2 Structure** | Higher-High/Higher-Low **or** Break of Structure up |
| **L3 Momentum** | Impulsive up candle, body ≥ ATR × mult |
| **L4 Order flow** | Volume spike **and** CVD rising |
| **L5 Volatility** | ATR expansion vs baseline |
| **L6 Liquidity** | Swept prior low / reacting from fresh demand |

Shorts mirror each. **Quality score** = layers ÷ 6 × 100.

### 3. Multi-timeframe trend convergence
Three configurable timeframes (default **1H / 4H / D**), each shown Bull/Bear/Flat
in the dashboard, with an overall **Convergence** verdict.

### 4. Order flow (CVD)
Cumulative Volume Delta vs its EMA gives the L4 order-flow read and the **FLOW**
label — confirms whether a move is genuinely backed by participation.

### 5. ATR-based, volatility-adaptive TP/SL
Stop = **ATR × `slAtrMult`** (auto-widens as volatility rises). Three named
targets, drawn as labelled level lines on every signal:

| Target | Default R:R | Nickname |
|--------|-------------|----------|
| TP1 | 1:1 | *Toe in the water* |
| TP2 | 1:2 | *Feeling spicy* |
| TP3 | 1:3 | *All-in* |

All multipliers and R:R ratios are adjustable.

### 6. Presets
`Market preset` recalibrates strictness, cooldown and SL/TP width in one click:
**Custom · Tight / Ranging · Volatile / Trending · Scalp · Swing**. Pick *Custom*
to drive every input yourself.

### 7. Daily signal control (few, high-quality trades)
| Input | Default | Effect |
|-------|---------|--------|
| Max signals per day | **3** | Hard cap per session (tune 2–4). Dashboard shows `DONE FOR DAY`. |
| Cooldown bars | **10** | Minimum spacing so signals don't cluster. |

### 8. Alpha Dashboard
Top-right table summarising: verdict (BUY/SELL/READY/NO TRADE), preset, layers
passed, quality score, each MTF trend + convergence, every layer's live state,
signals used today, and the active SL/TP multipliers.

## Usage
1. TradingView → **Pine Editor** → paste `GainzAlgoV2_Indicator.pine`.
2. **Add to chart.**
3. Pick a **preset** (or Custom) and tune the timeframes/ATR/R:R for your market.
4. Alerts: `GainzAlgo V2 BUY`, `GainzAlgo V2 SELL`, `GainzAlgo V2 READY`.

## Notes
- All higher-timeframe data uses `lookahead_off`; signals confirm on bar close —
  **non-repainting**.
- Decision-support tool, **not** financial advice. Keep the spec's risk rules:
  risk ≤ 1 % per trade, max 2 losses/day, no revenge trading, no chasing candles.
- This is an independent GainzAlgo-*style* implementation, not the commercial
  GainzAlgo V2 Alpha product or its exact proprietary formulas.

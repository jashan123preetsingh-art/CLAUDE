# GainzAlgo V2 Alpha — Pine Script

Two TradingView **Pine Script v5** files that encode the GainzAlgo V2
*filtering* philosophy: they do not try to predict the market — they filter out
low-quality trades and only fire when multiple **independent** factors align.
If confirmation is missing, the dashboard reads **NO TRADE**.

| File | Type | Use it for |
|------|------|-----------|
| **`GainzAlgoV2_Indicator.pine`** | Indicator (study) | Clean BUY/SELL signals on the chart with Entry/SL/TP levels + dashboard + alerts. **Start here.** |
| `GainzAlgoV2.pine` | Strategy | Same logic wired into TradingView's backtester (entries/exits, equity curve). |

Both share the same 9-filter engine and quality score. The **indicator** just
paints signals and levels; the **strategy** additionally simulates trades so you
can backtest. Pick the indicator if you want a clean overlay to trade manually.

## How it works

Every bar is scored against 9 independent filters:

| # | Filter      | Long condition                                   |
|---|-------------|--------------------------------------------------|
| 1 | Trend       | HTF fast EMA > slow EMA and price above it       |
| 2 | Structure   | Higher-High **and** Higher-Low (swing pivots)    |
| 3 | Momentum    | Impulsive up candle, body ≥ ATR × mult           |
| 4 | Volume      | Up candle on above-average volume                |
| 5 | Volatility  | ATR expansion vs its baseline                    |
| 6 | Liquidity   | Swept the prior swing low then reclaimed it      |
| 7 | Supply/Demand | Reaction up from a fresh demand zone           |
| 8 | BOS         | Break of Structure to the upside                 |
| 9 | CHOCH       | Change of Character confirming the turn          |

Shorts mirror each condition. A signal is produced **only** when:

- `confirmations ≥ minConfirms` (default **7**), **and**
- `quality score ≥ minScore` (default **78** / 100), **and**
- that side outscores the opposite side (no conflicting entries), **and**
- the daily trade controls below still allow a new entry.

Score = confirmations / 9 × 100, matching the spec's 0–100 Trade Quality Score
(< 70 → NO TRADE, 70–80 Good, 80–90 Strong, 90+ Exceptional). The default of
78 requires **≥ 7 of 9** filters to align — deliberately strict so only
high-probability setups pass.

## Fewer, higher-quality trades per day

To keep it to a handful of A+ setups instead of a stream of signals, the
strategy enforces daily trade controls (group **Daily Trade Control**):

| Input | Default | Effect |
|-------|---------|--------|
| Max trades per day | **3** | Hard cap on entries per session (tune 2–4). Dashboard shows `DONE FOR DAY` once hit. |
| Max losses per day | **2** | Halts trading for the rest of the day after N losers — enforces the spec's "no revenge trading". |
| Cooldown bars | **10** | Minimum bars between entries so signals don't cluster. |

The dashboard's **Trades today** row shows `used / max (L: losses)` live. To make
it stricter still, raise `Minimum confirmations` to 8 (score 89) or lower
`Max trades per day` to 2.

## Risk & targets

- **Stop loss:** beyond the last swing (low for buys / high for sells) plus an
  ATR buffer — outside liquidity, never a tight stop.
- **Take profits:** TP1/TP2/TP3 at configurable R:R (defaults 1:2 / 1:3 / 1:4),
  scaled out 40 % / 35 % / 25 %.
- **Management:** the position is force-closed if market structure flips against
  it. Minimum enforced R:R at TP1 is 1:2.

## Usage

1. Open TradingView → **Pine Editor**.
2. Paste the contents of `GainzAlgoV2.pine`.
3. **Add to chart.** A top-right dashboard shows the live filter readout and the
   BUY / SELL / NO TRADE verdict.
4. Tune inputs (HTF, EMA lengths, ATR, volume multiplier, R:R) per instrument.
5. Alerts: `GainzAlgo V2 BUY` / `GainzAlgo V2 SELL` fire only on a fully
   confirmed signal.

## Notes

- HTF values are requested with `lookahead_off` to avoid repainting.
- This is a decision-support / backtesting tool, **not** financial advice. The
  spec's risk rules still apply: risk ≤ 1 % per trade, max 2 losses/day, no
  revenge trading, no chasing candles.

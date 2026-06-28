# Institutional 15-Minute EMA & Market Structure System

A professional-grade, **non-repainting TradingView Pine Script v6** indicator that
automates a complete institutional intraday workflow. Built primarily for **Gold
(XAUUSD) on the 15-minute chart**, but every length, threshold, colour and module
is user-configurable for Forex, Indices and Crypto on any timeframe.

> File: [`InstitutionalEMA_MarketStructure.pine`](./InstitutionalEMA_MarketStructure.pine)

---

## What it does

| Module | Description |
| --- | --- |
| **Triple-EMA Trend Engine** | Fast (5 / white), Medium (50 / orange), Macro (200 / red). Classifies *Strong Bullish*, *Strong Bearish*, *No-Trade* and *Ranging* states with background shading and a dashboard label. |
| **Slope Filter** | Measures 50 & 200 EMA slope normalised to ATR/bar; rejects trades when EMAs are near-horizontal (user threshold). |
| **Market Structure** | Confirmed-pivot Swing Highs/Lows, **BOS**, **CHOCH**, and **HH / HL / LH / LL** labelling with optional structure lines. |
| **SBR / RBS Zones** | Detects broken support that becomes resistance (SBR) and broken resistance that becomes support (RBS), confirmed on retest, drawn as shaded institutional zones. |
| **HTF Confirmation** | Pulls H1 / H4 / Daily (configurable) trend + swing support/resistance **without repainting**; can gate signals to HTF direction. |
| **Pullback + Candlestick Entry** | Requires a pullback into the 50/200 EMA or an SBR/RBS zone, plus bullish/bearish engulfing or morning/evening star, plus a 5-EMA reclaim, plus intact structure. |
| **Counter-Trend & Re-Entry** | Optional modules for HTF-rejection counter-trend setups (TP projected at the 200 EMA) and trend-continuation re-entries. |
| **Risk Management** | Swing / ATR / hybrid stop-loss, multi-target projection (fixed pips **or** 1:2 / 1:3 / 1:4 RR), Entry/SL/TP lines and RR boxes. |
| **Dashboard** | Trend, HTF trend, structure, EMA alignment, distance from EMAs, signal, entry, SL, TP, RR, ATR, volatility, session and a confluence-based **Win-Probability score**. |
| **Filters** | London / New York session windows, volume-above-average, and a choppiness filter (EMA compression + frequent crossings) that blocks signals in ranging conditions. |
| **Alerts** | `alertcondition()` for BUY, SELL, Re-entry BUY/SELL, Trend Change, BOS, CHOCH, SBR, RBS, Counter-Trend and Strong Momentum Candle, plus rich `alert()` messages carrying ticker, timeframe, entry, SL, TP1, TP2, trend and structure. |

---

## Non-repainting design

- **Structure** uses confirmed `ta.pivothigh` / `ta.pivotlow` (fixed lag = pivot
  length), so once a swing/BOS/CHOCH prints it never redraws.
- **HTF data** is requested with `lookahead = barmerge.lookahead_on` against the
  **previous completed HTF bar** (`expr[1]`) — the canonical Pine pattern that
  yields a stable value across real-time updates with no look-ahead bias.
- **Signals** evaluate on bar close; use *"Once Per Bar Close"* alerts for fully
  confirmed entries.

---

## Installation

1. Open **TradingView → Pine Editor**.
2. Paste the contents of `InstitutionalEMA_MarketStructure.pine`.
3. Click **Add to chart**.
4. Open the indicator settings to tune EMAs, sensitivities, sessions, HTF, risk
   and visuals.

## Suggested defaults (XAUUSD 15m)

- EMAs `5 / 50 / 200`, Pivot length `8`, Min slope `0.05` ATR/bar.
- HTF `H1`, HTF filter **on**, Choppiness filter **on**.
- Stop-Loss `Swing + ATR` (1.5×), Targets `Risk Reward 1:2`.
- Sessions: London `0800-1700`, New York `1300-2200` (GMT).
- `pipSize = 0.1` for Gold (use `0.0001` for most FX pairs).

> Adjust `pipSize` per symbol when using fixed-pip targets, and widen the pivot
> length on higher timeframes for fewer, more significant swings.

---

*Educational / analytical tool. Not financial advice — always validate on your
own data and backtests before trading.*

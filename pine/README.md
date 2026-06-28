# EMA + Market Structure + Key Levels

A clean, **non-repainting TradingView Pine Script v6** indicator that pairs three
proven engines instead of one over-engineered block:

> File: [`InstitutionalEMA_MarketStructure.pine`](./InstitutionalEMA_MarketStructure.pine)

| Engine | What it does | Credit |
| --- | --- | --- |
| **Triple-EMA trend layer** | Fast (5 / white), Medium (50 / orange), Macro (200 / red), with optional fill and trend background. Configurable lengths, colours, widths, visibility. | — |
| **Market Structure** | Clean swing detection (HH / HL / LH / LL) plus **BOS** and **CHoCH** lines/labels. Candle-close or wick break confirmation. | logic inspired by *"Market Structure"* © Leviathan; swing generation © @BacktestRookies |
| **Key Levels** | Adaptive S/R **zones** with ATR-standardised width that self-align/merge when they overlap, extend right, and **flip colour when broken** — a broken support that becomes resistance (or vice-versa) is drawn cleanly instead of with bespoke SBR/RBS retest code. | logic inspired by *"Bjorgum Key Levels"* © Bjorgum |

Everything is **self-contained** — no external library import. Bjorgum's
candle-pattern and TSI machinery were intentionally dropped; only the clean
key-level zone engine is kept.

## How they pair — the EMA confluence signal

A **BUY** prints when all three line up:

1. **Market Structure** — bullish break of structure (BOS/CHoCH), and
2. **EMA trend** — `5 > 50 > 200` and price above the 200 EMA *(toggle)*, and
3. **Key Levels** — price is sitting inside a key zone *(toggle)*.

**SELL** is the mirror image. Both filters are individually switchable, so you
can run the signal loose (structure only) or strict (structure + trend + zone).

## Alerts

`BUY confluence`, `SELL confluence`, bullish/bearish `BOS/CHoCH`, and key-level
`Resistance break` / `Support break`.

## Non-repainting

Swings and zones are built from confirmed `ta.pivot*` points (fixed lag, never
redraw); BOS/CHoCH and zone flips evaluate on closed bars.

## Install

1. **TradingView → Pine Editor**, paste the file, **Add to chart**.
2. Tune EMAs, Swing Length, and Key-Level look-left/right + zone width to taste.

### Suggested starting points (XAUUSD 15m)

- EMAs `5 / 50 / 200`.
- Swing Length `20`, BOS confirmation `Candle Close`.
- Key Levels: Look Left `20`, Look Right `15`, zones `4`/side, width `0.5 ATR`,
  source `HA`, align + extend on.

> Larger swing/look-back values = fewer, more significant structure points and
> zones; lower values = more, on faster timeframes.

---

*Educational / analytical tool. Not financial advice.*

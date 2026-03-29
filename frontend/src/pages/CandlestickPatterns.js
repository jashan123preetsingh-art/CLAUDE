import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { stocksAPI, chartsAPI } from '../utils/api';
import { formatCurrency, formatPercent, getChangeColor } from '../utils/format';

// Candlestick pattern detection functions
function detectPatterns(candles) {
  if (!candles || candles.length < 5) return [];
  const patterns = [];

  for (let i = 2; i < candles.length; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    const pp = candles[i - 2];
    const body = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;
    const isGreen = c.close > c.open;
    const pBody = Math.abs(p.close - p.open);
    const pIsGreen = p.close > p.open;

    // Doji
    if (body < range * 0.1 && range > 0) {
      patterns.push({ index: i, name: 'Doji', type: 'neutral', reliability: 'Medium',
        desc: 'Open and close are nearly equal. Signals indecision.' });
    }

    // Hammer (bullish)
    if (lowerWick >= body * 2 && upperWick < body * 0.5 && body > 0 && !pIsGreen) {
      patterns.push({ index: i, name: 'Hammer', type: 'bullish', reliability: 'High',
        desc: 'Long lower shadow with small body at the top. Bullish reversal after downtrend.' });
    }

    // Shooting Star (bearish)
    if (upperWick >= body * 2 && lowerWick < body * 0.5 && body > 0 && pIsGreen) {
      patterns.push({ index: i, name: 'Shooting Star', type: 'bearish', reliability: 'High',
        desc: 'Long upper shadow with small body at bottom. Bearish reversal after uptrend.' });
    }

    // Bullish Engulfing
    if (isGreen && !pIsGreen && c.open <= p.close && c.close >= p.open && body > pBody) {
      patterns.push({ index: i, name: 'Bullish Engulfing', type: 'bullish', reliability: 'Very High',
        desc: 'Green candle completely engulfs previous red candle. Strong bullish reversal.' });
    }

    // Bearish Engulfing
    if (!isGreen && pIsGreen && c.open >= p.close && c.close <= p.open && body > pBody) {
      patterns.push({ index: i, name: 'Bearish Engulfing', type: 'bearish', reliability: 'Very High',
        desc: 'Red candle completely engulfs previous green candle. Strong bearish reversal.' });
    }

    // Morning Star (3 candle bullish)
    if (i >= 2) {
      const ppBody = Math.abs(pp.close - pp.open);
      const ppIsGreen = pp.close > pp.open;
      if (!ppIsGreen && ppBody > range * 0.3 && pBody < ppBody * 0.3 && isGreen && body > ppBody * 0.5) {
        patterns.push({ index: i, name: 'Morning Star', type: 'bullish', reliability: 'Very High',
          desc: 'Three candle pattern: large red, small body, large green. Strong bullish reversal.' });
      }
    }

    // Evening Star (3 candle bearish)
    if (i >= 2) {
      const ppBody = Math.abs(pp.close - pp.open);
      const ppIsGreen = pp.close > pp.open;
      if (ppIsGreen && ppBody > range * 0.3 && pBody < ppBody * 0.3 && !isGreen && body > ppBody * 0.5) {
        patterns.push({ index: i, name: 'Evening Star', type: 'bearish', reliability: 'Very High',
          desc: 'Three candle pattern: large green, small body, large red. Strong bearish reversal.' });
      }
    }

    // Three White Soldiers
    if (i >= 2 && isGreen && pIsGreen && pp.close > pp.open) {
      if (c.close > p.close && p.close > pp.close && body > range * 0.3 && pBody > range * 0.3) {
        patterns.push({ index: i, name: 'Three White Soldiers', type: 'bullish', reliability: 'Very High',
          desc: 'Three consecutive green candles with higher closes. Strong bullish continuation.' });
      }
    }

    // Three Black Crows
    if (i >= 2 && !isGreen && !pIsGreen && pp.close < pp.open) {
      if (c.close < p.close && p.close < pp.close && body > range * 0.3 && pBody > range * 0.3) {
        patterns.push({ index: i, name: 'Three Black Crows', type: 'bearish', reliability: 'Very High',
          desc: 'Three consecutive red candles with lower closes. Strong bearish continuation.' });
      }
    }

    // Spinning Top
    if (body < range * 0.3 && upperWick > body * 0.5 && lowerWick > body * 0.5 && body > range * 0.05) {
      patterns.push({ index: i, name: 'Spinning Top', type: 'neutral', reliability: 'Low',
        desc: 'Small body with wicks on both sides. Signals market indecision.' });
    }

    // Marubozu (strong momentum)
    if (body > range * 0.9 && range > 0) {
      patterns.push({ index: i, name: isGreen ? 'Bullish Marubozu' : 'Bearish Marubozu',
        type: isGreen ? 'bullish' : 'bearish', reliability: 'High',
        desc: `Full body ${isGreen ? 'green' : 'red'} candle with minimal wicks. Strong ${isGreen ? 'buying' : 'selling'} pressure.` });
    }

    // Inverted Hammer
    if (upperWick >= body * 2 && lowerWick < body * 0.3 && body > 0 && !pIsGreen) {
      patterns.push({ index: i, name: 'Inverted Hammer', type: 'bullish', reliability: 'Medium',
        desc: 'Long upper shadow with small body at bottom during downtrend. Potential bullish reversal.' });
    }

    // Hanging Man
    if (lowerWick >= body * 2 && upperWick < body * 0.3 && body > 0 && pIsGreen) {
      patterns.push({ index: i, name: 'Hanging Man', type: 'bearish', reliability: 'Medium',
        desc: 'Long lower shadow with small body at top during uptrend. Potential bearish reversal.' });
    }

    // Tweezer Top
    if (i >= 1 && Math.abs(c.high - p.high) < range * 0.02 && !isGreen && pIsGreen) {
      patterns.push({ index: i, name: 'Tweezer Top', type: 'bearish', reliability: 'High',
        desc: 'Two candles with matching highs. Second candle is bearish. Reversal signal.' });
    }

    // Tweezer Bottom
    if (i >= 1 && Math.abs(c.low - p.low) < range * 0.02 && isGreen && !pIsGreen) {
      patterns.push({ index: i, name: 'Tweezer Bottom', type: 'bullish', reliability: 'High',
        desc: 'Two candles with matching lows. Second candle is bullish. Reversal signal.' });
    }

    // Piercing Line
    if (isGreen && !pIsGreen && c.open < p.close && c.close > (p.open + p.close) / 2 && c.close < p.open) {
      patterns.push({ index: i, name: 'Piercing Line', type: 'bullish', reliability: 'High',
        desc: 'Green candle opens below previous close and closes above the midpoint. Bullish reversal.' });
    }

    // Dark Cloud Cover
    if (!isGreen && pIsGreen && c.open > p.close && c.close < (p.open + p.close) / 2 && c.close > p.open) {
      patterns.push({ index: i, name: 'Dark Cloud Cover', type: 'bearish', reliability: 'High',
        desc: 'Red candle opens above previous close and closes below the midpoint. Bearish reversal.' });
    }
  }

  return patterns;
}

const PATTERN_CATALOG = [
  { name: 'Doji', type: 'neutral', desc: 'Open and close are nearly equal, indicating market indecision' },
  { name: 'Hammer', type: 'bullish', desc: 'Small body at top with long lower shadow — bullish reversal' },
  { name: 'Shooting Star', type: 'bearish', desc: 'Small body at bottom with long upper shadow — bearish reversal' },
  { name: 'Bullish Engulfing', type: 'bullish', desc: 'Green candle fully engulfs previous red candle' },
  { name: 'Bearish Engulfing', type: 'bearish', desc: 'Red candle fully engulfs previous green candle' },
  { name: 'Morning Star', type: 'bullish', desc: 'Three-candle bullish reversal pattern' },
  { name: 'Evening Star', type: 'bearish', desc: 'Three-candle bearish reversal pattern' },
  { name: 'Three White Soldiers', type: 'bullish', desc: 'Three consecutive rising green candles' },
  { name: 'Three Black Crows', type: 'bearish', desc: 'Three consecutive falling red candles' },
  { name: 'Piercing Line', type: 'bullish', desc: 'Opens below, closes above midpoint of previous red candle' },
  { name: 'Dark Cloud Cover', type: 'bearish', desc: 'Opens above, closes below midpoint of previous green candle' },
  { name: 'Inverted Hammer', type: 'bullish', desc: 'Long upper wick, small body at bottom in downtrend' },
  { name: 'Hanging Man', type: 'bearish', desc: 'Long lower wick, small body at top in uptrend' },
  { name: 'Tweezer Top', type: 'bearish', desc: 'Two candles with equal highs — bearish reversal' },
  { name: 'Tweezer Bottom', type: 'bullish', desc: 'Two candles with equal lows — bullish reversal' },
  { name: 'Marubozu', type: 'neutral', desc: 'Full-body candle with no wicks — strong momentum' },
  { name: 'Spinning Top', type: 'neutral', desc: 'Small body with equal wicks — indecision' },
];

const SCAN_SYMBOLS = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BAJFINANCE', 'ITC',
  'TATAMOTORS', 'SUNPHARMA', 'LT', 'MARUTI', 'TITAN', 'ADANIENT', 'WIPRO', 'BHARTIARTL',
  'AXISBANK', 'KOTAKBANK', 'HINDUNILVR', 'NTPC', 'POWERGRID', 'TATASTEEL', 'JSWSTEEL',
  'HCLTECH', 'TECHM', 'M&M', 'ULTRACEMCO', 'ONGC', 'COALINDIA', 'DRREDDY',
];

export default function CandlestickPatterns() {
  const [tab, setTab] = useState('scanner');
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState([]);
  const [progress, setProgress] = useState(0);
  const [filterType, setFilterType] = useState('all');

  const runPatternScan = async () => {
    setScanning(true);
    setScanResults([]);
    setProgress(0);

    const results = [];
    for (let i = 0; i < SCAN_SYMBOLS.length; i++) {
      const sym = SCAN_SYMBOLS[i];
      setProgress(Math.round(((i + 1) / SCAN_SYMBOLS.length) * 100));
      try {
        const [chartRes, quoteRes] = await Promise.allSettled([
          chartsAPI.data(sym, { period: '3m', timeframe: '1D' }),
          stocksAPI.live(sym),
        ]);

        if (chartRes.status === 'fulfilled' && chartRes.value.data?.candles?.length > 5) {
          const candles = chartRes.value.data.candles;
          const patterns = detectPatterns(candles);
          const lastPatterns = patterns.filter(p => p.index >= candles.length - 3);

          if (lastPatterns.length > 0) {
            const quote = quoteRes.status === 'fulfilled' ? quoteRes.value.data : {};
            lastPatterns.forEach(pat => {
              results.push({
                symbol: sym,
                ltp: quote.ltp,
                change_pct: quote.change_pct,
                pattern: pat.name,
                type: pat.type,
                reliability: pat.reliability,
                desc: pat.desc,
                date: candles[pat.index]?.time,
              });
            });
          }
        }
      } catch {}
      // Small delay to avoid rate limiting
      if (i % 5 === 4) await new Promise(r => setTimeout(r, 300));
    }

    setScanResults(results);
    setScanning(false);
  };

  const filteredResults = filterType === 'all' ? scanResults
    : scanResults.filter(r => r.type === filterType);

  return (
    <div className="p-3 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="t-card overflow-hidden mb-2">
        <div className="flex items-center justify-between px-3 py-2">
          <div>
            <h1 className="text-sm font-bold text-white font-mono tracking-wide">CANDLESTICK PATTERN RECOGNITION</h1>
            <p className="text-[9px] text-terminal-muted font-mono mt-0.5">
              Scan NIFTY 50 stocks for candlestick patterns | Powered by algorithmic detection
            </p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setTab('scanner')}
              className={`t-btn ${tab === 'scanner' ? 't-btn-green' : 't-btn-default'}`}>SCANNER</button>
            <button onClick={() => setTab('catalog')}
              className={`t-btn ${tab === 'catalog' ? 't-btn-green' : 't-btn-default'}`}>PATTERN CATALOG</button>
          </div>
        </div>
      </div>

      {tab === 'scanner' && (
        <>
          {/* Scanner Controls */}
          <div className="t-card px-3 py-2 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={runPatternScan}
                disabled={scanning}
                className={`t-btn ${scanning ? 't-btn-default' : 't-btn-green'} px-4 py-1.5`}
              >
                {scanning ? `SCANNING... ${progress}%` : 'SCAN 30 STOCKS'}
              </button>
              {scanning && (
                <div className="w-32 h-1.5 bg-terminal-bg rounded-full overflow-hidden">
                  <div className="h-full bg-terminal-green rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>

            <div className="flex gap-1">
              {['all', 'bullish', 'bearish', 'neutral'].map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={`t-btn ${filterType === t ? 't-btn-green' : 't-btn-default'} capitalize`}>
                  {t === 'all' ? 'ALL' : t.toUpperCase()}
                  {t !== 'all' && scanResults.length > 0 && (
                    <span className="ml-1 text-[8px]">({scanResults.filter(r => r.type === t).length})</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {scanResults.length > 0 && (
            <div className="t-card overflow-hidden">
              <div className="t-header">
                DETECTED PATTERNS ({filteredResults.length} results)
              </div>
              <div className="overflow-x-auto">
                <table className="t-table">
                  <thead>
                    <tr>
                      <th className="text-left">SYMBOL</th>
                      <th>LTP</th>
                      <th>CHG%</th>
                      <th className="text-left">PATTERN</th>
                      <th>TYPE</th>
                      <th>RELIABILITY</th>
                      <th>DATE</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((r, i) => (
                      <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                        <td className="text-left">
                          <Link to={`/charts/${r.symbol}`} className="text-terminal-cyan hover:underline font-semibold">{r.symbol}</Link>
                        </td>
                        <td className="text-white">{formatCurrency(r.ltp)}</td>
                        <td className={getChangeColor(r.change_pct)}>{formatPercent(r.change_pct)}</td>
                        <td className="text-left text-white font-semibold">{r.pattern}</td>
                        <td>
                          <span className={`t-badge ${
                            r.type === 'bullish' ? 'bg-terminal-green/10 text-terminal-green' :
                            r.type === 'bearish' ? 'bg-terminal-red/10 text-terminal-red' :
                            'bg-terminal-yellow/10 text-terminal-yellow'
                          }`}>
                            {r.type.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span className={`text-[9px] font-semibold ${
                            r.reliability === 'Very High' ? 'text-terminal-green' :
                            r.reliability === 'High' ? 'text-terminal-cyan' :
                            'text-terminal-muted'
                          }`}>
                            {r.reliability}
                          </span>
                        </td>
                        <td className="text-terminal-muted text-[10px]">{r.date}</td>
                        <td>
                          <Link to={`/charts/${r.symbol}`} className="t-btn t-btn-default text-[8px]">CHART</Link>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!scanning && scanResults.length === 0 && (
            <div className="t-card flex items-center justify-center h-64 flex-col gap-3">
              <span className="text-3xl">&#128200;</span>
              <p className="text-terminal-muted font-mono text-xs">Click "SCAN 30 STOCKS" to detect candlestick patterns</p>
              <p className="text-terminal-muted font-mono text-[9px]">Scans recent 3-month daily candles for 17+ patterns</p>
            </div>
          )}
        </>
      )}

      {tab === 'catalog' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {PATTERN_CATALOG.map((pat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="t-card-hover p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-mono font-bold text-white">{pat.name}</h3>
                <span className={`t-badge ${
                  pat.type === 'bullish' ? 'bg-terminal-green/10 text-terminal-green' :
                  pat.type === 'bearish' ? 'bg-terminal-red/10 text-terminal-red' :
                  'bg-terminal-yellow/10 text-terminal-yellow'
                }`}>
                  {pat.type.toUpperCase()}
                </span>
              </div>
              <p className="text-[10px] text-terminal-text leading-relaxed">{pat.desc}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

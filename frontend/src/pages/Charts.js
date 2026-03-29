import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { chartsAPI, stocksAPI } from '../utils/api';
import { formatCurrency, formatPercent, formatVolume, getChangeColor } from '../utils/format';

const TIMEFRAMES = [
  { key: '1H', label: '1H' },
  { key: '4H', label: '4H' },
  { key: '1D', label: '1D' },
  { key: '1W', label: '1W' },
  { key: '1M', label: '1M' },
];

const PERIODS = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: '3y', label: '3Y' },
  { key: '5y', label: '5Y' },
  { key: '10y', label: '10Y' },
  { key: 'max', label: 'MAX' },
];

const POPULAR = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BAJFINANCE', 'ITC', 'TATAMOTORS', 'SUNPHARMA', 'LT', 'MARUTI', 'TITAN', 'ADANIENT', 'WIPRO', 'NIFTY', 'BANKNIFTY'];

export default function Charts() {
  const { symbol: paramSymbol } = useParams();
  const [symbol, setSymbol] = useState(paramSymbol || 'RELIANCE');
  const [period, setPeriod] = useState('1y');
  const [timeframe, setTimeframe] = useState('1D');
  const [chartData, setChartData] = useState(null);
  const [stockInfo, setStockInfo] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [crosshairData, setCrosshairData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [indicators, setIndicators] = useState({ sma20: true, sma50: true, volume: true });
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => { loadData(); }, [symbol, period, timeframe]);
  useEffect(() => {
    if (chartData && chartRef.current) renderChart();
    return () => { if (chartInstanceRef.current) { try { chartInstanceRef.current.remove(); } catch {} } };
  }, [chartData, indicators]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [chartRes, stockRes] = await Promise.allSettled([
        chartsAPI.data(symbol, { period, timeframe }),
        stocksAPI.live(symbol),
      ]);
      if (chartRes.status === 'fulfilled' && chartRes.value.data?.candles?.length > 0) {
        setChartData(chartRes.value.data);
      } else {
        setChartData(null);
        setError('No chart data available. Try a different symbol or period.');
      }
      if (stockRes.status === 'fulfilled') setStockInfo(stockRes.value.data);
    } catch (err) {
      setError('Failed to load chart data. Backend may be starting up.');
      setChartData(null);
    }
    finally { setLoading(false); }
  };

  const renderChart = async () => {
    if (chartInstanceRef.current) { try { chartInstanceRef.current.remove(); } catch {} }
    if (!chartData?.candles?.length) return;

    try {
      const { createChart, CandlestickSeries, HistogramSeries, LineSeries } = await import('lightweight-charts');
      const isIntraday = chartData.isIntraday;

      const chart = createChart(chartRef.current, {
        width: chartRef.current.clientWidth,
        height: 550,
        layout: {
          background: { color: '#0a0e14' },
          textColor: '#484f58',
          fontSize: 10,
          fontFamily: 'JetBrains Mono, Consolas, monospace',
        },
        grid: {
          vertLines: { color: '#1c233320' },
          horzLines: { color: '#1c233320' },
        },
        crosshair: {
          mode: 0,
          vertLine: { color: '#58a6ff30', width: 1, labelBackgroundColor: '#111720' },
          horzLine: { color: '#58a6ff30', width: 1, labelBackgroundColor: '#111720' },
        },
        rightPriceScale: {
          borderColor: '#1c233360',
          scaleMargins: { top: 0.05, bottom: 0.2 },
          textColor: '#484f58',
        },
        timeScale: {
          borderColor: '#1c233360',
          timeVisible: isIntraday,
          secondsVisible: false,
          rightOffset: 5,
          barSpacing: 8,
        },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#00d68f',
        downColor: '#ff4757',
        borderUpColor: '#00d68f',
        borderDownColor: '#ff4757',
        wickUpColor: '#00d68f80',
        wickDownColor: '#ff475780',
      });

      candleSeries.setData(chartData.candles.map(c => ({
        time: c.time, open: c.open, high: c.high, low: c.low, close: c.close,
      })));

      if (indicators.volume) {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        });
        chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
        volumeSeries.setData(chartData.candles.map(c => ({
          time: c.time, value: c.volume || 0,
          color: c.close >= c.open ? '#00d68f12' : '#ff475712',
        })));
      }

      if (indicators.sma20 && chartData.candles.length > 20) {
        const sma20Series = chart.addSeries(LineSeries, {
          color: '#e3b34160', lineWidth: 1,
          priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
        });
        const sma20 = [];
        for (let i = 19; i < chartData.candles.length; i++) {
          const sum = chartData.candles.slice(i - 19, i + 1).reduce((s, c) => s + c.close, 0);
          sma20.push({ time: chartData.candles[i].time, value: sum / 20 });
        }
        sma20Series.setData(sma20);
      }

      if (indicators.sma50 && chartData.candles.length > 50) {
        const sma50Series = chart.addSeries(LineSeries, {
          color: '#58a6ff40', lineWidth: 1,
          priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
        });
        const sma50 = [];
        for (let i = 49; i < chartData.candles.length; i++) {
          const sum = chartData.candles.slice(i - 49, i + 1).reduce((s, c) => s + c.close, 0);
          sma50.push({ time: chartData.candles[i].time, value: sum / 50 });
        }
        sma50Series.setData(sma50);
      }

      chart.subscribeCrosshairMove((param) => {
        if (!param || !param.time) { setCrosshairData(null); return; }
        const candle = param.seriesData?.get(candleSeries);
        if (candle) {
          setCrosshairData({
            time: param.time, open: candle.open, high: candle.high, low: candle.low, close: candle.close,
            change: candle.close - candle.open,
            changePct: ((candle.close - candle.open) / candle.open * 100),
          });
        }
      });

      chart.timeScale().fitContent();
      chartInstanceRef.current = chart;

      const ro = new ResizeObserver(() => {
        if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
      });
      ro.observe(chartRef.current);
    } catch (err) {
      console.error('Chart render error:', err);
      setError('Chart rendering failed. Please refresh.');
    }
  };

  const handleSymbolSearch = (e) => {
    if (e.key === 'Enter' && searchInput.trim()) {
      setSymbol(searchInput.trim().toUpperCase());
      setSearchInput('');
    }
  };

  const info = stockInfo || {};
  const displayData = crosshairData || info;

  return (
    <div className="p-2 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="t-card overflow-hidden mb-2">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="SEARCH SYMBOL..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSymbolSearch}
              className="t-input w-36"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white font-mono">{symbol}</h1>
                {info.ltp && (
                  <>
                    <span className={`text-sm font-mono font-bold ${getChangeColor(info.change_pct)}`}>
                      {formatCurrency(info.ltp)}
                    </span>
                    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                      info.change_pct >= 0 ? 'bg-terminal-green/10 text-terminal-green' : 'bg-terminal-red/10 text-terminal-red'
                    }`}>
                      {formatPercent(info.change_pct)}
                    </span>
                  </>
                )}
              </div>
              <p className="text-[9px] text-terminal-muted font-mono">{info.name || symbol} | NSE</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to={`/stock/${symbol}`} className="t-btn t-btn-default">DETAIL</Link>
            <Link to={`/options/${symbol}`} className="t-btn t-btn-default">OPTIONS</Link>
            <Link to={`/patterns`} className="t-btn t-btn-default">PATTERNS</Link>
          </div>
        </div>

        {/* Symbol Strip */}
        <div className="flex gap-0.5 px-2 pb-2 flex-wrap">
          {POPULAR.map(s => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono font-semibold transition-all ${
                symbol === s
                  ? 'bg-terminal-green/15 text-terminal-green border border-terminal-green/25'
                  : 'bg-terminal-bg text-terminal-muted border border-terminal-border hover:border-terminal-border-bright hover:text-terminal-text'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="t-card px-2 py-1.5 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Timeframe */}
          <div className="flex gap-0.5 bg-terminal-bg rounded p-0.5">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key)}
                className={`px-2.5 py-1 rounded text-[10px] font-mono font-semibold transition-all ${
                  timeframe === tf.key
                    ? 'bg-terminal-green/15 text-terminal-green'
                    : 'text-terminal-muted hover:text-terminal-text'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-terminal-border" />

          {/* Period */}
          <div className="flex gap-0.5">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-2 py-1 rounded text-[10px] font-mono ${
                  period === p.key
                    ? 'bg-terminal-blue/15 text-terminal-blue'
                    : 'text-terminal-muted hover:text-terminal-text'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-terminal-border" />

          {/* Indicator toggles */}
          <div className="flex items-center gap-2 text-[9px] font-mono">
            <button onClick={() => setIndicators(p => ({...p, sma20: !p.sma20}))}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${indicators.sma20 ? 'text-terminal-yellow' : 'text-terminal-muted'}`}>
              <span className="w-2 h-0.5 bg-terminal-yellow/60 inline-block rounded" /> SMA20
            </button>
            <button onClick={() => setIndicators(p => ({...p, sma50: !p.sma50}))}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${indicators.sma50 ? 'text-terminal-blue' : 'text-terminal-muted'}`}>
              <span className="w-2 h-0.5 bg-terminal-blue/60 inline-block rounded" /> SMA50
            </button>
            <button onClick={() => setIndicators(p => ({...p, volume: !p.volume}))}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${indicators.volume ? 'text-terminal-text' : 'text-terminal-muted'}`}>
              VOL
            </button>
          </div>
        </div>

        {/* OHLCV */}
        <div className="flex items-center gap-3 text-[10px] font-mono text-terminal-muted">
          <span>O:<span className="text-white ml-0.5">{formatCurrency(displayData.open)}</span></span>
          <span>H:<span className="text-white ml-0.5">{formatCurrency(displayData.high)}</span></span>
          <span>L:<span className="text-white ml-0.5">{formatCurrency(displayData.low)}</span></span>
          <span>C:<span className={`ml-0.5 ${crosshairData ? getChangeColor(crosshairData.change) : 'text-white'}`}>
            {formatCurrency(displayData.close || displayData.ltp)}
          </span></span>
          {crosshairData && (
            <span className={`font-semibold ${getChangeColor(crosshairData.changePct)}`}>
              {crosshairData.changePct >= 0 ? '+' : ''}{crosshairData.changePct?.toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      {/* Chart Area */}
      <div className="t-card overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-terminal-bg/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-terminal-green/30 border-t-terminal-green rounded-full animate-spin" />
              <span className="text-[10px] font-mono text-terminal-muted">LOADING CHART DATA...</span>
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="flex items-center justify-center h-[550px] flex-col gap-3">
            <span className="text-terminal-red text-xs font-mono">{error}</span>
            <button onClick={loadData} className="t-btn t-btn-green">RETRY</button>
          </div>
        )}
        <div ref={chartRef} className="w-full" style={{ height: 550 }} />
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-px bg-terminal-border mt-2 rounded overflow-hidden">
        {[
          { label: 'OPEN', value: formatCurrency(info.open) },
          { label: 'PREV CLOSE', value: formatCurrency(info.prev_close) },
          { label: 'DAY HIGH', value: formatCurrency(info.high) },
          { label: 'DAY LOW', value: formatCurrency(info.low) },
          { label: '52W HIGH', value: formatCurrency(info.week_52_high) },
          { label: '52W LOW', value: formatCurrency(info.week_52_low) },
          { label: 'VOLUME', value: formatVolume(info.volume) },
          { label: 'AVG VOL', value: formatVolume(info.avg_volume_10d) },
        ].map((stat, i) => (
          <div key={i} className="bg-terminal-card p-2">
            <p className="text-[8px] text-terminal-muted font-mono">{stat.label}</p>
            <p className="text-[11px] font-mono text-white font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

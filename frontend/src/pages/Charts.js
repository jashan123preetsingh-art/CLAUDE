import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { chartsAPI, stocksAPI } from '../utils/api';
import { formatCurrency, formatPercent, formatVolume, getChangeColor } from '../utils/format';

const TIMEFRAMES = [
  { key: '1H', label: '1H', desc: '1 Hour' },
  { key: '4H', label: '4H', desc: '4 Hours' },
  { key: '1D', label: '1D', desc: 'Daily' },
  { key: '1W', label: '1W', desc: 'Weekly' },
  { key: '1M', label: '1M', desc: 'Monthly' },
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

const POPULAR = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BAJFINANCE', 'ITC', 'TATAMOTORS', 'SUNPHARMA', 'LT', 'MARUTI', 'TITAN', 'ADANIENT', 'WIPRO'];

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
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => { loadData(); }, [symbol, period, timeframe]);
  useEffect(() => {
    if (chartData && chartRef.current) renderChart();
    return () => { if (chartInstanceRef.current) chartInstanceRef.current.remove(); };
  }, [chartData]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [chartRes, stockRes] = await Promise.allSettled([
        chartsAPI.data(symbol, { period, timeframe }),
        stocksAPI.live(symbol),
      ]);
      if (chartRes.status === 'fulfilled') setChartData(chartRes.value.data);
      if (stockRes.status === 'fulfilled') setStockInfo(stockRes.value.data);
    } catch { setChartData(null); }
    finally { setLoading(false); }
  };

  const renderChart = async () => {
    if (chartInstanceRef.current) chartInstanceRef.current.remove();
    if (!chartData?.candles?.length) return;

    try {
      const { createChart, CandlestickSeries, HistogramSeries, LineSeries } = await import('lightweight-charts');
      const isIntraday = chartData.isIntraday;

      const chart = createChart(chartRef.current, {
        width: chartRef.current.clientWidth,
        height: 600,
        layout: {
          background: { color: '#080a0f' },
          textColor: '#797f89',
          fontSize: 11,
          fontFamily: 'JetBrains Mono, monospace',
        },
        grid: {
          vertLines: { color: '#1a1d2318' },
          horzLines: { color: '#1a1d2318' },
        },
        crosshair: {
          mode: 0,
          vertLine: { color: '#4facfe40', width: 1, labelBackgroundColor: '#1a1d23' },
          horzLine: { color: '#4facfe40', width: 1, labelBackgroundColor: '#1a1d23' },
        },
        rightPriceScale: {
          borderColor: '#1a1d2350',
          scaleMargins: { top: 0.05, bottom: 0.2 },
          textColor: '#797f89',
        },
        timeScale: {
          borderColor: '#1a1d2350',
          timeVisible: isIntraday,
          secondsVisible: false,
          rightOffset: 5,
          barSpacing: 8,
        },
      });

      // Candlestick series
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#00d4aa',
        downColor: '#ff4757',
        borderUpColor: '#00d4aa',
        borderDownColor: '#ff4757',
        wickUpColor: '#00d4aa90',
        wickDownColor: '#ff475790',
      });

      // Volume histogram
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });

      // Set data
      candleSeries.setData(chartData.candles.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })));

      volumeSeries.setData(chartData.candles.map(c => ({
        time: c.time,
        value: c.volume || 0,
        color: c.close >= c.open ? '#00d4aa15' : '#ff475715',
      })));

      // Add 20-period SMA if enough data
      if (chartData.candles.length > 20) {
        const sma20Series = chart.addSeries(LineSeries, {
          color: '#fbbf2480',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });

        const sma20 = [];
        for (let i = 19; i < chartData.candles.length; i++) {
          const sum = chartData.candles.slice(i - 19, i + 1).reduce((s, c) => s + c.close, 0);
          sma20.push({ time: chartData.candles[i].time, value: sum / 20 });
        }
        sma20Series.setData(sma20);
      }

      // Add 50-period SMA if enough data
      if (chartData.candles.length > 50) {
        const sma50Series = chart.addSeries(LineSeries, {
          color: '#4facfe50',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });

        const sma50 = [];
        for (let i = 49; i < chartData.candles.length; i++) {
          const sum = chartData.candles.slice(i - 49, i + 1).reduce((s, c) => s + c.close, 0);
          sma50.push({ time: chartData.candles[i].time, value: sum / 50 });
        }
        sma50Series.setData(sma50);
      }

      // Crosshair move handler
      chart.subscribeCrosshairMove((param) => {
        if (!param || !param.time) {
          setCrosshairData(null);
          return;
        }
        const candle = param.seriesData?.get(candleSeries);
        const vol = param.seriesData?.get(volumeSeries);
        if (candle) {
          setCrosshairData({
            time: param.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: vol?.value,
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
      console.error('Chart error:', err);
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
    <div className="p-3 max-w-[1800px] mx-auto">
      {/* Terminal Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Symbol..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSymbolSearch}
              className="input-dark w-32 text-xs py-1.5"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white font-mono">{symbol}</h1>
                <span className={`text-sm font-mono font-bold ${getChangeColor(info.change_pct)}`}>
                  {info.ltp ? formatCurrency(info.ltp) : ''}
                </span>
                <span className={`text-xs font-mono ${getChangeColor(info.change_pct)}`}>
                  {info.change_pct ? formatPercent(info.change_pct) : ''}
                </span>
              </div>
              <p className="text-[10px] text-dark-500 font-mono">{info.name || symbol} | NSE</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/stock/${symbol}`} className="btn-secondary text-xs py-1">Detail</Link>
          <Link to={`/options/${symbol}`} className="btn-secondary text-xs py-1">Options</Link>
        </div>
      </div>

      {/* Popular Symbols Bar */}
      <div className="flex gap-1 mb-2 flex-wrap">
        {POPULAR.map(s => (
          <button
            key={s}
            onClick={() => setSymbol(s)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-all ${
              symbol === s
                ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                : 'bg-dark-800/50 text-dark-500 border border-dark-800 hover:border-dark-600'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Chart Controls */}
      <div className="glass-card p-2 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Timeframe selector */}
          <div className="flex gap-0.5 bg-dark-850 rounded p-0.5">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key)}
                title={tf.desc}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-all ${
                  timeframe === tf.key
                    ? 'bg-accent-green/20 text-accent-green'
                    : 'text-dark-500 hover:text-dark-300'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-dark-700" />

          {/* Period selector */}
          <div className="flex gap-0.5">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-2 py-1 rounded text-xs font-mono ${
                  period === p.key
                    ? 'bg-accent-blue/20 text-accent-blue'
                    : 'text-dark-500 hover:text-dark-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-dark-700" />

          {/* Indicators legend */}
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-yellow-400/50 inline-block rounded" /> SMA 20
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-blue-400/50 inline-block rounded" /> SMA 50
            </span>
          </div>
        </div>

        {/* OHLCV data */}
        <div className="flex items-center gap-3 text-[10px] font-mono text-dark-400">
          <span>O: <span className="text-dark-200">{formatCurrency(displayData.open)}</span></span>
          <span>H: <span className="text-dark-200">{formatCurrency(displayData.high)}</span></span>
          <span>L: <span className="text-dark-200">{formatCurrency(displayData.low)}</span></span>
          <span>C: <span className={crosshairData ? getChangeColor(crosshairData.change) : 'text-dark-200'}>
            {formatCurrency(displayData.close || displayData.ltp)}
          </span></span>
          <span>V: <span className="text-dark-200">{formatVolume(displayData.volume)}</span></span>
          {crosshairData && (
            <span className={getChangeColor(crosshairData.changePct)}>
              {crosshairData.changePct >= 0 ? '+' : ''}{crosshairData.changePct?.toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="glass-card overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-900/80 z-10">
            <div className="w-8 h-8 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
          </div>
        )}
        <div ref={chartRef} className="w-full" style={{ height: 600 }} />
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2 mt-2">
        {[
          { label: 'Open', value: formatCurrency(info.open) },
          { label: 'Prev Close', value: formatCurrency(info.prev_close) },
          { label: 'Day High', value: formatCurrency(info.high) },
          { label: 'Day Low', value: formatCurrency(info.low) },
          { label: '52W High', value: formatCurrency(info.week_52_high) },
          { label: '52W Low', value: formatCurrency(info.week_52_low) },
          { label: 'Volume', value: formatVolume(info.volume) },
          { label: 'Avg Vol', value: formatVolume(info.avg_volume_10d) },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-2">
            <p className="text-[9px] text-dark-500 font-mono">{stat.label}</p>
            <p className="text-xs font-mono text-white">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

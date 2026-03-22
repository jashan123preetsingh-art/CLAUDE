import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { chartsAPI, stocksAPI } from '../utils/api';
import { formatCurrency, formatPercent, formatVolume, getChangeColor } from '../utils/format';

const TIMEFRAMES = ['1D', '1W', '1M'];
const PERIODS = ['1m', '3m', '6m', '1y', '3y', '5y'];
const POPULAR = ['NIFTY 50', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BAJFINANCE', 'ITC', 'TATAMOTORS'];

export default function Charts() {
  const { symbol: paramSymbol } = useParams();
  const [symbol, setSymbol] = useState(paramSymbol || 'RELIANCE');
  const [period, setPeriod] = useState('1y');
  const [timeframe, setTimeframe] = useState('1D');
  const [chartData, setChartData] = useState(null);
  const [stockInfo, setStockInfo] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [symbol, period, timeframe]);

  useEffect(() => {
    if (chartData && chartRef.current) renderChart();
    return () => { if (chartInstanceRef.current) chartInstanceRef.current.remove(); };
  }, [chartData]);

  const loadData = async () => {
    try {
      const [chartRes, stockRes] = await Promise.allSettled([
        chartsAPI.data(symbol, { period, timeframe }),
        stocksAPI.live(symbol),
      ]);
      if (chartRes.status === 'fulfilled') setChartData(chartRes.value.data);
      if (stockRes.status === 'fulfilled') setStockInfo(stockRes.value.data);
    } catch {
      setChartData(null);
    }
  };

  const renderChart = async () => {
    if (chartInstanceRef.current) chartInstanceRef.current.remove();
    try {
      const { createChart, CandlestickSeries, HistogramSeries } = await import('lightweight-charts');
      const chart = createChart(chartRef.current, {
        width: chartRef.current.clientWidth,
        height: 500,
        layout: { background: { color: '#0d1017' }, textColor: '#9da2aa', fontSize: 11 },
        grid: { vertLines: { color: '#1a1d2320' }, horzLines: { color: '#1a1d2320' } },
        crosshair: { mode: 0, vertLine: { color: '#4facfe50', width: 1 }, horzLine: { color: '#4facfe50', width: 1 } },
        rightPriceScale: { borderColor: '#1a1d2350', scaleMargins: { top: 0.1, bottom: 0.2 } },
        timeScale: { borderColor: '#1a1d2350', timeVisible: timeframe !== '1D' },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#00d4aa',
        downColor: '#ff4757',
        borderUpColor: '#00d4aa',
        borderDownColor: '#ff4757',
        wickUpColor: '#00d4aa80',
        wickDownColor: '#ff475780',
      });

      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });

      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });

      if (chartData?.candles?.length > 0) {
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
          color: c.close >= c.open ? '#00d4aa20' : '#ff475720',
        })));

        chart.timeScale().fitContent();
      }

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

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{symbol}</h1>
              <span className={`text-sm font-mono font-medium ${getChangeColor(info.change_pct)}`}>
                {info.ltp ? formatCurrency(info.ltp) : ''} {info.change_pct ? formatPercent(info.change_pct) : ''}
              </span>
            </div>
            <p className="text-xs text-dark-500">{info.name || symbol} • NSE</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search symbol..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSymbolSearch}
            className="input-dark w-40 text-xs"
          />
          <Link to={`/stock/${symbol}`} className="btn-secondary text-xs">Detail</Link>
          <Link to={`/options/${symbol}`} className="btn-secondary text-xs">Options</Link>
        </div>
      </div>

      {/* Quick Stock Bar */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {POPULAR.map(s => (
          <button
            key={s}
            onClick={() => setSymbol(s.replace(' ', ''))}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
              symbol === s.replace(' ', '')
                ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                : 'bg-dark-800 text-dark-500 border border-dark-700 hover:border-dark-600'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Chart Controls */}
      <div className="glass-card p-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded text-xs ${timeframe === tf ? 'bg-accent-blue/20 text-accent-blue' : 'text-dark-500 hover:text-dark-300'}`}
              >
                {tf}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-dark-700" />
          <div className="flex gap-1">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded text-xs ${period === p ? 'bg-accent-green/20 text-accent-green' : 'text-dark-500 hover:text-dark-300'}`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-dark-500">
          <span>O: {formatCurrency(info.open)}</span>
          <span>H: {formatCurrency(info.high)}</span>
          <span>L: {formatCurrency(info.low)}</span>
          <span>V: {formatVolume(info.volume)}</span>
        </div>
      </div>

      {/* Chart */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
        <div ref={chartRef} className="w-full" style={{ height: 500 }} />
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-4">
        {[
          { label: 'Open', value: formatCurrency(info.open) },
          { label: 'Prev Close', value: formatCurrency(info.prev_close || info.close) },
          { label: 'Day High', value: formatCurrency(info.high) },
          { label: 'Day Low', value: formatCurrency(info.low) },
          { label: '52W High', value: formatCurrency(info.week_52_high) },
          { label: '52W Low', value: formatCurrency(info.week_52_low) },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-3">
            <p className="text-xs text-dark-500">{stat.label}</p>
            <p className="text-sm font-mono text-white mt-1">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

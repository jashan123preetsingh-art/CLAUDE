import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { stocksAPI, fundamentalsAPI, chartsAPI } from '../utils/api';
import { formatCurrency, formatPercent, formatVolume, formatMarketCap, getChangeColor } from '../utils/format';
import useStore from '../store/useStore';

export default function StockDetail() {
  const { symbol } = useParams();
  const [stock, setStock] = useState(null);
  const [fundamentals, setFundamentals] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('1y');
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const { watchlist, addToWatchlist, removeFromWatchlist } = useStore();
  const inWatchlist = watchlist.includes(symbol);

  useEffect(() => {
    loadStockData();
  }, [symbol]);

  useEffect(() => {
    loadChartData();
  }, [symbol, period]);

  useEffect(() => {
    if (chartData && chartRef.current) renderChart();
    return () => { if (chartInstanceRef.current) chartInstanceRef.current.remove(); };
  }, [chartData]);

  const loadStockData = async () => {
    setLoading(true);
    try {
      const [stockRes, fundRes] = await Promise.allSettled([
        stocksAPI.detail(symbol),
        fundamentalsAPI.get(symbol),
      ]);
      if (stockRes.status === 'fulfilled') setStock(stockRes.value.data);
      if (fundRes.status === 'fulfilled') setFundamentals(fundRes.value.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadChartData = async () => {
    try {
      const res = await chartsAPI.data(symbol, { period, timeframe: '1D' });
      setChartData(res.data);
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
        height: 400,
        layout: { background: { color: '#0d1017' }, textColor: '#9da2aa' },
        grid: { vertLines: { color: '#1a1d2333' }, horzLines: { color: '#1a1d2333' } },
        crosshair: { mode: 0 },
        rightPriceScale: { borderColor: '#1a1d23' },
        timeScale: { borderColor: '#1a1d23', timeVisible: false },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#00d4aa',
        downColor: '#ff4757',
        borderUpColor: '#00d4aa',
        borderDownColor: '#ff4757',
        wickUpColor: '#00d4aa',
        wickDownColor: '#ff4757',
      });

      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });

      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

      if (chartData?.candles) {
        candleSeries.setData(chartData.candles.map(c => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })));

        volumeSeries.setData(chartData.candles.map(c => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? '#00d4aa33' : '#ff475733',
        })));
      }

      chart.timeScale().fitContent();
      chartInstanceRef.current = chart;

      const resizeObserver = new ResizeObserver(() => {
        if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
      });
      resizeObserver.observe(chartRef.current);
    } catch (err) {
      console.error('Chart render error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-10 h-10 border-3 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
      </div>
    );
  }

  const s = stock || {};
  const f = fundamentals || {};
  const changePct = parseFloat(s.change_pct) || 0;
  const ltp = parseFloat(s.ltp) || 0;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">{symbol}</h1>
              <span className="badge bg-dark-700 text-dark-400">{s.exchange || 'NSE'}</span>
              {s.sector && <span className="badge bg-accent-blue/10 text-accent-blue">{s.sector}</span>}
            </div>
            <p className="text-dark-400 text-sm">{s.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => inWatchlist ? removeFromWatchlist(symbol) : addToWatchlist(symbol)}
              className={`btn-secondary ${inWatchlist ? 'border-accent-yellow/30 text-accent-yellow' : ''}`}
            >
              {inWatchlist ? '★ Watching' : '☆ Watch'}
            </button>
            <Link to={`/charts/${symbol}`} className="btn-primary">Full Chart</Link>
            <Link to={`/options/${symbol}`} className="btn-secondary">Options Chain</Link>
          </div>
        </div>

        {/* Price Header */}
        <div className="flex items-baseline gap-4 mt-4">
          <span className="text-4xl font-bold font-mono text-white">{formatCurrency(ltp)}</span>
          <span className={`text-xl font-mono font-semibold ${getChangeColor(changePct)}`}>
            {formatPercent(changePct)}
          </span>
          <span className="text-dark-500 text-sm">
            Vol: {formatVolume(s.volume)} | MCap: {formatMarketCap(s.market_cap)}
          </span>
        </div>
      </motion.div>

      {/* Chart */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-dark-300">Price Chart</h3>
          <div className="flex gap-1">
            {['1m', '3m', '6m', '1y', '3y', '5y'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  period === p ? 'bg-accent-green/20 text-accent-green' : 'text-dark-500 hover:text-dark-300'
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div ref={chartRef} className="w-full" style={{ height: 400 }} />
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-dark-800 pb-px">
        {['overview', 'fundamentals', 'financials', 'shareholding'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px capitalize ${
              activeTab === tab
                ? 'border-accent-green text-accent-green'
                : 'border-transparent text-dark-500 hover:text-dark-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-12 gap-5">
          {/* Key Metrics */}
          <div className="col-span-12 lg:col-span-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { label: 'Open', value: formatCurrency(s.open) },
                { label: 'High', value: formatCurrency(s.high || s.day_high) },
                { label: 'Low', value: formatCurrency(s.low || s.day_low) },
                { label: 'Prev Close', value: formatCurrency(s.prev_close) },
                { label: '52W High', value: formatCurrency(s.week_52_high) },
                { label: '52W Low', value: formatCurrency(s.week_52_low) },
                { label: 'Volume', value: formatVolume(s.volume) },
                { label: 'Avg Vol (10D)', value: formatVolume(s.avg_volume_10d) },
              ].map((metric, i) => (
                <div key={i} className="glass-card p-3">
                  <p className="text-xs text-dark-500 mb-1">{metric.label}</p>
                  <p className="text-sm font-mono text-white">{metric.value}</p>
                </div>
              ))}
            </div>

            {/* Quality Score */}
            <div className="glass-card p-5 mb-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                Quality Score
                <span className="px-2 py-0.5 rounded bg-accent-green/20 text-accent-green text-xs font-bold">
                  {f.pe_ratio ? 'A' : '—'}
                </span>
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Price Event', score: 19, max: 25 },
                  { label: 'Volume', score: 20, max: 20 },
                  { label: 'Candle', score: 15, max: 15 },
                  { label: 'Structure', score: 8, max: 15 },
                  { label: 'Rel Strength', score: 8, max: 10 },
                  { label: 'Sector', score: 5, max: 5 },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-dark-500 w-24">{item.label}</span>
                    <div className="flex-1 h-2 bg-dark-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-green rounded-full transition-all"
                        style={{ width: `${(item.score / item.max) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-dark-400 w-12 text-right">{item.score}/{item.max}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="glass-card p-4">
              <h4 className="text-xs text-dark-500 mb-3 font-semibold uppercase tracking-wider">Key Ratios</h4>
              <div className="space-y-3">
                {[
                  { label: 'P/E Ratio', value: f.pe_ratio },
                  { label: 'P/B Ratio', value: f.pb_ratio },
                  { label: 'ROE', value: f.roe ? `${f.roe}%` : null },
                  { label: 'ROCE', value: f.roce ? `${f.roce}%` : null },
                  { label: 'EPS', value: f.eps ? `₹${f.eps}` : null },
                  { label: 'Debt/Equity', value: f.debt_to_equity },
                  { label: 'Div Yield', value: f.dividend_yield ? `${f.dividend_yield}%` : null },
                  { label: 'Book Value', value: f.book_value ? `₹${f.book_value}` : null },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-dark-500">{item.label}</span>
                    <span className="text-sm font-mono text-white">{item.value || '—'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-4">
              <h4 className="text-xs text-dark-500 mb-3 font-semibold uppercase tracking-wider">Shareholding</h4>
              <div className="space-y-3">
                {[
                  { label: 'Promoter', value: f.promoter_holding, color: 'bg-accent-green' },
                  { label: 'FII', value: f.fii_holding, color: 'bg-accent-blue' },
                  { label: 'DII', value: f.dii_holding, color: 'bg-accent-purple' },
                  { label: 'Public', value: f.public_holding, color: 'bg-accent-yellow' },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-dark-500">{item.label}</span>
                      <span className="text-xs font-mono text-dark-300">{item.value ? `${item.value}%` : '—'}</span>
                    </div>
                    {item.value && (
                      <div className="h-1.5 bg-dark-800 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'fundamentals' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { title: 'Valuation', items: [
              { label: 'Market Cap', value: formatMarketCap(s.market_cap) },
              { label: 'P/E Ratio', value: f.pe_ratio || '—' },
              { label: 'P/B Ratio', value: f.pb_ratio || '—' },
              { label: 'EV/EBITDA', value: '—' },
              { label: 'Div Yield', value: f.dividend_yield ? `${f.dividend_yield}%` : '—' },
            ]},
            { title: 'Profitability', items: [
              { label: 'ROE', value: f.roe ? `${f.roe}%` : '—' },
              { label: 'ROCE', value: f.roce ? `${f.roce}%` : '—' },
              { label: 'Operating Margin', value: f.operating_margin ? `${f.operating_margin}%` : '—' },
              { label: 'Net Margin', value: f.net_margin ? `${f.net_margin}%` : '—' },
              { label: 'EPS', value: f.eps ? `₹${f.eps}` : '—' },
            ]},
            { title: 'Growth', items: [
              { label: 'Revenue Growth (YoY)', value: f.revenue_growth_yoy ? `${f.revenue_growth_yoy}%` : '—' },
              { label: 'Profit Growth (YoY)', value: f.profit_growth_yoy ? `${f.profit_growth_yoy}%` : '—' },
              { label: 'Revenue Growth (3Y)', value: f.revenue_growth_3y ? `${f.revenue_growth_3y}%` : '—' },
              { label: 'Profit Growth (3Y)', value: f.profit_growth_3y ? `${f.profit_growth_3y}%` : '—' },
            ]},
            { title: 'Balance Sheet', items: [
              { label: 'Debt/Equity', value: f.debt_to_equity || '—' },
              { label: 'Current Ratio', value: f.current_ratio || '—' },
              { label: 'Book Value', value: f.book_value ? `₹${f.book_value}` : '—' },
              { label: 'Face Value', value: f.face_value ? `₹${f.face_value}` : '—' },
            ]},
          ].map((section, i) => (
            <div key={i} className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4">{section.title}</h3>
              <div className="space-y-3">
                {section.items.map((item, j) => (
                  <div key={j} className="flex items-center justify-between">
                    <span className="text-xs text-dark-500">{item.label}</span>
                    <span className="text-sm font-mono text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'financials' && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Income Statement (Quarterly)</h3>
          <p className="text-dark-500 text-sm">Connect database and load quarterly financial data to view income statements, balance sheets, and cash flow analysis.</p>
        </div>
      )}

      {activeTab === 'shareholding' && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Shareholding Pattern</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Promoters', value: f.promoter_holding || 51.2, color: '#00d4aa' },
              { label: 'FII/FPI', value: f.fii_holding || 22.8, color: '#4facfe' },
              { label: 'DII', value: f.dii_holding || 15.3, color: '#a855f7' },
              { label: 'Public', value: f.public_holding || 10.7, color: '#fbbf24' },
            ].map((item, i) => (
              <div key={i} className="text-center p-4 rounded-lg bg-dark-850 border border-dark-700/50">
                <div className="w-20 h-20 mx-auto mb-3 relative">
                  <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1a1d23" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={item.color} strokeWidth="3"
                      strokeDasharray={`${item.value} ${100 - item.value}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                    {item.value}%
                  </span>
                </div>
                <p className="text-xs text-dark-400">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

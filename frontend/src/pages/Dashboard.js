import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { stocksAPI, newsAPI, scannersAPI, fiiDiiAPI } from '../utils/api';
import { formatCurrency, formatPercent, formatVolume, getChangeColor, getChangeBg, timeAgo } from '../utils/format';

const POPULAR_SCANNERS = [
  { key: 'day_high', name: 'Day High', icon: '🔺' },
  { key: 'up_5pct_high_vol', name: 'Volume > 3x', icon: '🚀' },
  { key: 'week_52_high_breakout', name: '52W High Breakout', icon: '🏆' },
  { key: 'near_day_high', name: 'Near Day High', icon: '▲' },
  { key: 'opening_range_breakout', name: 'ORB Breakout', icon: '🎯' },
];

const QUICK_STOCKS = ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN'];

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [news, setNews] = useState([]);
  const [scannerPreview, setScannerPreview] = useState({});
  const [fiiDii, setFiiDii] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [overviewRes, newsRes, fiiRes] = await Promise.allSettled([
        stocksAPI.marketOverview(),
        newsAPI.live(),
        fiiDiiAPI.latest(),
      ]);

      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data);
      if (newsRes.status === 'fulfilled') setNews(newsRes.value.data?.slice(0, 6) || []);
      if (fiiRes.status === 'fulfilled') setFiiDii(fiiRes.value.data);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Stock Scanner</h1>
          <p className="text-dark-400 text-sm mt-1">
            Real-time market scanning across NSE & BSE — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 glass-card text-xs">
            <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
            <span className="text-dark-300">Market Open</span>
          </div>
        </div>
      </div>

      {/* Quick Stock Chips */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {QUICK_STOCKS.map(symbol => (
          <Link
            key={symbol}
            to={`/stock/${symbol}`}
            className="px-3 py-1.5 glass-card text-xs font-medium text-dark-300 hover:text-accent-green hover:border-accent-green/30 transition-all"
          >
            {symbol}
          </Link>
        ))}
      </div>

      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-12 gap-5">
        {/* Top Gainers & Losers */}
        <motion.div variants={itemVariants} className="col-span-12 lg:col-span-4">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="text-accent-green">▲</span> Top Gainers
              </h3>
              <span className="badge-green">NSE+BSE</span>
            </div>
            <div className="space-y-2">
              {(overview?.topGainers || demoGainers).slice(0, 5).map((stock, i) => (
                <Link key={i} to={`/stock/${stock.symbol}`} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-dark-700/50 transition-all group">
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-accent-green transition-colors">{stock.symbol}</p>
                    <p className="text-xs text-dark-500 truncate max-w-[120px]">{stock.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-white">{formatCurrency(stock.ltp)}</p>
                    <p className={`text-xs font-mono ${getChangeColor(stock.change_pct)}`}>{formatPercent(stock.change_pct)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="col-span-12 lg:col-span-4">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="text-accent-red">▼</span> Top Losers
              </h3>
              <span className="badge-red">NSE+BSE</span>
            </div>
            <div className="space-y-2">
              {(overview?.topLosers || demoLosers).slice(0, 5).map((stock, i) => (
                <Link key={i} to={`/stock/${stock.symbol}`} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-dark-700/50 transition-all group">
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-accent-red transition-colors">{stock.symbol}</p>
                    <p className="text-xs text-dark-500 truncate max-w-[120px]">{stock.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-white">{formatCurrency(stock.ltp)}</p>
                    <p className={`text-xs font-mono ${getChangeColor(stock.change_pct)}`}>{formatPercent(stock.change_pct)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="col-span-12 lg:col-span-4">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="text-accent-blue">🔥</span> Most Active
              </h3>
              <span className="badge bg-accent-blue/20 text-accent-blue">Volume</span>
            </div>
            <div className="space-y-2">
              {(overview?.mostActive || demoActive).slice(0, 5).map((stock, i) => (
                <Link key={i} to={`/stock/${stock.symbol}`} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-dark-700/50 transition-all group">
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-accent-blue transition-colors">{stock.symbol}</p>
                    <p className="text-xs text-dark-500">{formatVolume(stock.volume)} vol</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-white">{formatCurrency(stock.ltp)}</p>
                    <p className={`text-xs font-mono ${getChangeColor(stock.change_pct)}`}>{formatPercent(stock.change_pct)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Popular Scanners */}
        <motion.div variants={itemVariants} className="col-span-12 lg:col-span-6">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <span>📡</span> Popular Scans
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {POPULAR_SCANNERS.map(scanner => (
                <Link
                  key={scanner.key}
                  to={`/scanner/${scanner.key}`}
                  className="p-3 rounded-lg bg-dark-850 border border-dark-700/50 hover:border-accent-green/30 hover:bg-dark-800 transition-all group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>{scanner.icon}</span>
                    <span className="text-sm font-medium text-dark-200 group-hover:text-accent-green transition-colors">{scanner.name}</span>
                  </div>
                </Link>
              ))}
              <Link
                to="/scanner"
                className="p-3 rounded-lg bg-dark-850 border border-dashed border-dark-600 hover:border-accent-blue/50 transition-all flex items-center justify-center"
              >
                <span className="text-sm text-dark-400 hover:text-accent-blue">+ All Scanners</span>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* FII/DII Quick View */}
        <motion.div variants={itemVariants} className="col-span-12 lg:col-span-6">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>💰</span> FII & DII Data
              </h3>
              <Link to="/fii-dii" className="text-xs text-accent-blue hover:underline">View Full →</Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-dark-850 border border-dark-700/50">
                <p className="text-xs text-dark-500 mb-1">FII / FPI Net</p>
                <p className={`text-xl font-bold font-mono ${fiiDii?.fii_net >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                  {fiiDii ? formatCurrency(fiiDii.fii_net, true) : '-₹10,724 Cr'}
                </p>
                <p className={`text-xs mt-1 ${fiiDii?.fii_net >= 0 ? 'text-accent-green/70' : 'text-accent-red/70'}`}>
                  {fiiDii?.fii_net >= 0 ? 'Buying' : 'Selling'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-dark-850 border border-dark-700/50">
                <p className="text-xs text-dark-500 mb-1">DII Net</p>
                <p className={`text-xl font-bold font-mono ${fiiDii?.dii_net >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                  {fiiDii ? formatCurrency(fiiDii.dii_net, true) : '+₹9,977 Cr'}
                </p>
                <p className={`text-xs mt-1 ${fiiDii?.dii_net >= 0 ? 'text-accent-green/70' : 'text-accent-red/70'}`}>
                  {fiiDii?.dii_net >= 0 ? 'Buying' : 'Selling'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* News */}
        <motion.div variants={itemVariants} className="col-span-12">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>📰</span> Market News
              </h3>
              <Link to="/news" className="text-xs text-accent-blue hover:underline">All News →</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(news.length > 0 ? news : demoNews).map((article, i) => (
                <a
                  key={i}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-lg bg-dark-850 border border-dark-700/50 hover:border-dark-600 transition-all group"
                >
                  <p className="text-sm text-dark-200 group-hover:text-white transition-colors line-clamp-2 mb-2">
                    {article.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-dark-500">
                    <span>{article.source}</span>
                    <span>•</span>
                    <span>{timeAgo(article.published_at)}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

// Demo data for when API is not connected
const demoGainers = [
  { symbol: 'FIRSTORY', name: 'Firstory Inc', ltp: 245.30, change_pct: 19.64 },
  { symbol: 'RKDL', name: 'RK Diamond Ltd', ltp: 89.70, change_pct: 14.35 },
  { symbol: 'IRL', name: 'India Resources Ltd', ltp: 156.20, change_pct: 12.31 },
  { symbol: 'RELIANCE', name: 'Reliance Industries', ltp: 1414.40, change_pct: 2.16 },
  { symbol: 'TCS', name: 'TCS Ltd', ltp: 3890.50, change_pct: 1.85 },
];

const demoLosers = [
  { symbol: 'FIBRECARE', name: 'Fibrecare Ltd', ltp: 45.20, change_pct: -19.68 },
  { symbol: 'NOVAGRO', name: 'Novagro Ltd', ltp: 12.80, change_pct: -11.27 },
  { symbol: 'JINDALPOLY', name: 'Jindal Poly', ltp: 234.50, change_pct: -9.00 },
  { symbol: 'NBITD', name: 'NB ITD', ltp: 67.30, change_pct: -6.09 },
  { symbol: 'TOBSTAR', name: 'Tobstar Inc', ltp: 23.40, change_pct: -4.02 },
];

const demoActive = [
  { symbol: 'SUNPHARMA', name: 'Sun Pharma', ltp: 1245.60, change_pct: 3.45, volume: 45000000 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', ltp: 1680.90, change_pct: -0.25, volume: 38000000 },
  { symbol: 'KOOL', name: 'Kool Industries', ltp: 34.50, change_pct: 5.20, volume: 32000000 },
  { symbol: 'DEEPINGS', name: 'Deep Industries', ltp: 178.30, change_pct: -2.10, volume: 28000000 },
  { symbol: 'INFY', name: 'Infosys', ltp: 1520.40, change_pct: 1.12, volume: 25000000 },
];

const demoNews = [
  { title: 'Sensex jumps 500 points as FIIs turn buyers; Nifty above 22,500', source: 'Economic Times', url: '#', published_at: new Date() },
  { title: 'RBI MPC keeps repo rate unchanged at 6.5% for ninth consecutive time', source: 'Moneycontrol', url: '#', published_at: new Date(Date.now() - 3600000) },
  { title: 'IT stocks rally on strong Q4 guidance from TCS and Infosys', source: 'LiveMint', url: '#', published_at: new Date(Date.now() - 7200000) },
  { title: 'Adani Group stocks surge after positive credit rating outlook', source: 'NDTV Profit', url: '#', published_at: new Date(Date.now() - 10800000) },
  { title: 'Gold prices hit new all-time high amid global uncertainty', source: 'Business Standard', url: '#', published_at: new Date(Date.now() - 14400000) },
  { title: 'Auto stocks in focus as February sales data beats estimates', source: 'Financial Express', url: '#', published_at: new Date(Date.now() - 18000000) },
];

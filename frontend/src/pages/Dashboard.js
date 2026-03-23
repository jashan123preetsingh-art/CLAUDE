import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { stocksAPI, newsAPI, fiiDiiAPI } from '../utils/api';
import { formatCurrency, formatPercent, formatVolume, getChangeColor, getChangeBg, timeAgo } from '../utils/format';

const POPULAR_SCANNERS = [
  { key: 'top_gainers', name: 'Top Gainers', icon: '📈' },
  { key: 'top_losers', name: 'Top Losers', icon: '📉' },
  { key: 'most_active', name: 'Most Active', icon: '🔥' },
  { key: 'week_52_high_breakout', name: '52W High Breakout', icon: '🏆' },
  { key: 'up_5pct_high_vol', name: 'Up >5% + Volume', icon: '🚀' },
];

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [indices, setIndices] = useState([]);
  const [news, setNews] = useState([]);
  const [fiiDii, setFiiDii] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const [overviewRes, newsRes, fiiRes, idxRes] = await Promise.allSettled([
        stocksAPI.marketOverview(),
        newsAPI.live(),
        fiiDiiAPI.latest(),
        stocksAPI.indices(),
      ]);

      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data);
      if (newsRes.status === 'fulfilled') setNews(Array.isArray(newsRes.value.data) ? newsRes.value.data.slice(0, 6) : []);
      if (fiiRes.status === 'fulfilled') setFiiDii(fiiRes.value.data);
      if (idxRes.status === 'fulfilled') setIndices(idxRes.value.data || []);
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const itemVariants = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">StockPulse</h1>
          <p className="text-dark-400 text-sm mt-1">
            Live market data from NSE & BSE — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/heatmap" className="btn-primary text-xs">Heatmap</Link>
          <Link to="/sectors" className="btn-secondary text-xs">Sectors</Link>
          <div className="flex items-center gap-2 px-3 py-1.5 glass-card text-xs">
            <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
            <span className="text-dark-300">Live</span>
          </div>
        </div>
      </div>

      {/* Index Strip */}
      {indices.length > 0 && (
        <div className="flex gap-3 mb-6">
          {indices.map((idx, i) => (
            <div key={i} className="glass-card px-4 py-3 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-dark-400 font-medium">{idx.symbol}</span>
                <span className={`text-xs font-mono font-medium ${getChangeColor(idx.change_pct)}`}>
                  {formatPercent(idx.change_pct)}
                </span>
              </div>
              <p className="text-lg font-bold font-mono text-white mt-1">{formatCurrency(idx.ltp)}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
            <p className="text-dark-400 text-sm">Loading live market data...</p>
          </div>
        </div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-12 gap-5">
          {/* Top Gainers */}
          <motion.div variants={itemVariants} className="col-span-12 lg:col-span-4">
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="text-accent-green">▲</span> Top Gainers
                </h3>
                <span className="badge-green">LIVE</span>
              </div>
              <div className="space-y-2">
                {(overview?.topGainers || []).slice(0, 5).map((stock, i) => (
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
                {(!overview?.topGainers?.length) && <p className="text-dark-500 text-xs text-center py-4">Loading live data...</p>}
              </div>
            </div>
          </motion.div>

          {/* Top Losers */}
          <motion.div variants={itemVariants} className="col-span-12 lg:col-span-4">
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="text-accent-red">▼</span> Top Losers
                </h3>
                <span className="badge-red">LIVE</span>
              </div>
              <div className="space-y-2">
                {(overview?.topLosers || []).slice(0, 5).map((stock, i) => (
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
                {(!overview?.topLosers?.length) && <p className="text-dark-500 text-xs text-center py-4">Loading live data...</p>}
              </div>
            </div>
          </motion.div>

          {/* Most Active */}
          <motion.div variants={itemVariants} className="col-span-12 lg:col-span-4">
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="text-accent-blue">🔥</span> Most Active
                </h3>
                <span className="badge bg-accent-blue/20 text-accent-blue">Volume</span>
              </div>
              <div className="space-y-2">
                {(overview?.mostActive || []).slice(0, 5).map((stock, i) => (
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
                {(!overview?.mostActive?.length) && <p className="text-dark-500 text-xs text-center py-4">Loading live data...</p>}
              </div>
            </div>
          </motion.div>

          {/* Sector Performance */}
          {overview?.sectorPerformance?.length > 0 && (
            <motion.div variants={itemVariants} className="col-span-12 lg:col-span-6">
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Sector Performance</h3>
                  <Link to="/sectors" className="text-xs text-accent-blue hover:underline">View All →</Link>
                </div>
                <div className="space-y-2">
                  {overview.sectorPerformance.slice(0, 8).map((sec, i) => (
                    <Link key={i} to={`/sectors/${encodeURIComponent(sec.sector)}`} className="flex items-center justify-between py-1.5 hover:bg-dark-800/30 px-2 rounded transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-dark-300">{sec.sector}</span>
                        <span className="text-[10px] text-dark-600">({sec.count})</span>
                      </div>
                      <span className={`text-xs font-mono font-medium ${getChangeColor(sec.avg_change)}`}>
                        {formatPercent(sec.avg_change)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Popular Scanners + FII/DII */}
          <motion.div variants={itemVariants} className="col-span-12 lg:col-span-6">
            <div className="glass-card p-5 mb-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">Popular Scans</h3>
              <div className="grid grid-cols-2 gap-3">
                {POPULAR_SCANNERS.map(scanner => (
                  <Link key={scanner.key} to={`/scanner/${scanner.key}`}
                    className="p-3 rounded-lg bg-dark-850 border border-dark-700/50 hover:border-accent-green/30 hover:bg-dark-800 transition-all group">
                    <div className="flex items-center gap-2">
                      <span>{scanner.icon}</span>
                      <span className="text-sm font-medium text-dark-200 group-hover:text-accent-green transition-colors">{scanner.name}</span>
                    </div>
                  </Link>
                ))}
                <Link to="/scanner" className="p-3 rounded-lg bg-dark-850 border border-dashed border-dark-600 hover:border-accent-blue/50 transition-all flex items-center justify-center">
                  <span className="text-sm text-dark-400 hover:text-accent-blue">+ All Scanners</span>
                </Link>
              </div>
            </div>

            {/* FII/DII Quick */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">FII & DII</h3>
                <Link to="/fii-dii" className="text-xs text-accent-blue hover:underline">Full Data →</Link>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-dark-850 border border-dark-700/50">
                  <p className="text-xs text-dark-500 mb-1">FII / FPI Net</p>
                  <p className={`text-xl font-bold font-mono ${getChangeColor(fiiDii?.fii_net)}`}>
                    {fiiDii?.fii_net != null ? formatCurrency(fiiDii.fii_net, true) : '—'}
                  </p>
                  <p className="text-xs mt-1 text-dark-600">{fiiDii?.source === 'nse_live' ? 'from NSE' : ''}</p>
                </div>
                <div className="p-4 rounded-lg bg-dark-850 border border-dark-700/50">
                  <p className="text-xs text-dark-500 mb-1">DII Net</p>
                  <p className={`text-xl font-bold font-mono ${getChangeColor(fiiDii?.dii_net)}`}>
                    {fiiDii?.dii_net != null ? formatCurrency(fiiDii.dii_net, true) : '—'}
                  </p>
                  <p className="text-xs mt-1 text-dark-600">{fiiDii?.source === 'nse_live' ? 'from NSE' : ''}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* News */}
          <motion.div variants={itemVariants} className="col-span-12">
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">Market News</h3>
                <Link to="/news" className="text-xs text-accent-blue hover:underline">All News →</Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {news.map((article, i) => (
                  <a key={i} href={article.url} target="_blank" rel="noopener noreferrer"
                    className="p-4 rounded-lg bg-dark-850 border border-dark-700/50 hover:border-dark-600 transition-all group">
                    <p className="text-sm text-dark-200 group-hover:text-white transition-colors line-clamp-2 mb-2">{article.title}</p>
                    <div className="flex items-center gap-2 text-xs text-dark-500">
                      <span>{article.source}</span>
                      <span>-</span>
                      <span>{timeAgo(article.published_at)}</span>
                    </div>
                  </a>
                ))}
                {news.length === 0 && <p className="text-dark-500 text-xs col-span-3 text-center py-4">Loading live news...</p>}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

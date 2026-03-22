import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { scannersAPI } from '../utils/api';
import { formatCurrency, formatPercent, formatVolume, getChangeColor, getChangeBg } from '../utils/format';

const CATEGORIES = ['All Scans', 'MVP Picks', 'Price Levels', 'Performance', 'Volume'];

export default function Scanner() {
  const { key: activeKey } = useParams();
  const navigate = useNavigate();
  const [scanners, setScanners] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All Scans');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadScanners();
  }, []);

  useEffect(() => {
    if (activeKey) runScan(activeKey);
  }, [activeKey]);

  const loadScanners = async () => {
    try {
      const res = await scannersAPI.list();
      setScanners(res.data.scanners || []);
    } catch {
      setScanners(defaultScanners);
    }
  };

  const runScan = async (key) => {
    setLoading(true);
    try {
      const res = await scannersAPI.run(key);
      setResults(res.data);
    } catch {
      setResults({ scanner: key, name: key, stocks: [], count: 0 });
    } finally {
      setLoading(false);
    }
  };

  const filteredScanners = scanners.filter(s => {
    if (activeCategory !== 'All Scans' && s.category !== activeCategory) return false;
    if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Market Scanners</h1>
        <p className="text-dark-400 text-sm mt-1">Institutional-grade price action scanning across NSE & BSE</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <input
            type="text"
            placeholder="Search scans..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-dark w-full mb-4"
          />

          {/* Categories */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeCategory === cat
                    ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                    : 'bg-dark-800 text-dark-400 border border-dark-700 hover:border-dark-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Scanner List */}
          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {filteredScanners.map(scanner => (
              <button
                key={scanner.key}
                onClick={() => navigate(`/scanner/${scanner.key}`)}
                className={`w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  activeKey === scanner.key
                    ? 'bg-accent-green/10 text-accent-green border border-accent-green/20'
                    : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
                }`}
              >
                <span>{scanner.icon}</span>
                <span className="truncate">{scanner.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {!activeKey ? (
            <ScannerGrid scanners={filteredScanners} onSelect={(key) => navigate(`/scanner/${key}`)} />
          ) : (
            <ScannerResults results={results} loading={loading} />
          )}
        </div>
      </div>
    </div>
  );
}

function ScannerGrid({ scanners, onSelect }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {scanners.map((scanner, i) => (
        <motion.div
          key={scanner.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          onClick={() => onSelect(scanner.key)}
          className="scanner-card"
        >
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-semibold text-white group-hover:text-accent-green transition-colors">
              {scanner.name}
            </h3>
            <span className="text-lg">{scanner.icon}</span>
          </div>
          <p className="text-xs text-dark-500 leading-relaxed">{scanner.description}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}

function ScannerResults({ results, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
          <p className="text-dark-400 text-sm">Scanning...</p>
        </div>
      </div>
    );
  }

  if (!results) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>{results.icon}</span> {results.name}
          </h2>
          <p className="text-dark-500 text-xs">{results.description} — {results.count} stocks found</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-mono ${results.count > 0 ? 'badge-green' : 'bg-dark-700 text-dark-400'}`}>
          {results.count} results
        </span>
      </div>

      {results.stocks?.length > 0 ? (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="text-left p-3 text-dark-500 font-medium text-xs">Symbol</th>
                <th className="text-right p-3 text-dark-500 font-medium text-xs">LTP</th>
                <th className="text-right p-3 text-dark-500 font-medium text-xs">Change%</th>
                <th className="text-right p-3 text-dark-500 font-medium text-xs hidden md:table-cell">Volume</th>
                <th className="text-right p-3 text-dark-500 font-medium text-xs hidden lg:table-cell">Day Range</th>
                <th className="text-right p-3 text-dark-500 font-medium text-xs hidden lg:table-cell">52W Range</th>
              </tr>
            </thead>
            <tbody>
              {results.stocks.map((stock, i) => (
                <motion.tr
                  key={stock.symbol || i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-dark-800/50 hover:bg-dark-800/50 transition-colors"
                >
                  <td className="p-3">
                    <Link to={`/stock/${stock.symbol}`} className="hover:text-accent-green transition-colors">
                      <p className="font-medium text-white">{stock.symbol}</p>
                      <p className="text-xs text-dark-500 truncate max-w-[150px]">{stock.name}</p>
                    </Link>
                  </td>
                  <td className="p-3 text-right font-mono text-white">{formatCurrency(stock.ltp)}</td>
                  <td className="p-3 text-right">
                    <span className={`px-2 py-0.5 rounded text-xs font-mono ${getChangeBg(stock.change_pct)}`}>
                      {formatPercent(stock.change_pct)}
                    </span>
                  </td>
                  <td className="p-3 text-right text-dark-400 font-mono text-xs hidden md:table-cell">
                    {formatVolume(stock.volume)}
                    {stock.volume_ratio && <span className="text-dark-600 ml-1">({stock.volume_ratio}x)</span>}
                  </td>
                  <td className="p-3 text-right text-dark-400 text-xs hidden lg:table-cell">
                    {formatCurrency(stock.day_low)} - {formatCurrency(stock.day_high)}
                  </td>
                  <td className="p-3 text-right text-dark-400 text-xs hidden lg:table-cell">
                    {formatCurrency(stock.week_52_low)} - {formatCurrency(stock.week_52_high)}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <p className="text-dark-500">No stocks match this scanner's criteria right now</p>
        </div>
      )}
    </motion.div>
  );
}

const defaultScanners = [
  { key: 'day_high', name: 'Day High', description: 'Stocks at intraday high', icon: '🔺', category: 'Price Levels' },
  { key: 'day_low', name: 'Day Low', description: 'Stocks at intraday low', icon: '🔻', category: 'Price Levels' },
  { key: 'near_day_high', name: 'Near Day High', description: 'Within 1% of day high', icon: '▲', category: 'Price Levels' },
  { key: 'near_day_low', name: 'Near Day Low', description: 'Within 1% of day low', icon: '▼', category: 'Price Levels' },
  { key: 'week_52_high_breakout', name: '52W High Breakout', description: 'Breaking 52-week high', icon: '🏆', category: 'Price Levels' },
  { key: 'week_52_low_breakdown', name: '52W Low Breakdown', description: 'Breaking 52-week low', icon: '💥', category: 'Price Levels' },
  { key: 'high_volume', name: 'High Volume', description: 'Volume > 2x average', icon: '📊', category: 'Volume' },
  { key: 'up_5pct_high_vol', name: 'Up >5% + 2x Volume', description: 'Strong rally with volume', icon: '🚀', category: 'MVP Picks' },
  { key: 'down_5pct_high_vol', name: 'Down >5% + 2x Volume', description: 'Sharp selloff with volume', icon: '💀', category: 'MVP Picks' },
  { key: 'gap_up', name: 'Gap Up Opening', description: 'Opened above prev close', icon: '⬆️', category: 'Performance' },
  { key: 'gap_down', name: 'Gap Down Opening', description: 'Opened below prev close', icon: '⬇️', category: 'Performance' },
  { key: 'bullish_candle', name: 'Strong Bullish', description: 'Wide range bullish bar', icon: '🟢', category: 'Performance' },
  { key: 'bearish_candle', name: 'Strong Bearish', description: 'Wide range bearish bar', icon: '🔴', category: 'Performance' },
  { key: 'opening_range_breakout', name: 'ORB Breakout', description: 'Opening range breakout', icon: '🎯', category: 'Performance' },
  { key: 'top_gainers', name: 'Top Gainers', description: 'Highest gains today', icon: '📈', category: 'Performance' },
  { key: 'top_losers', name: 'Top Losers', description: 'Biggest drops today', icon: '📉', category: 'Performance' },
  { key: 'most_active', name: 'Most Active', description: 'Highest volume traded', icon: '🔥', category: 'Volume' },
];

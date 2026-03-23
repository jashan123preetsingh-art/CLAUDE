import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { sectorsAPI } from '../utils/api';
import { formatCurrency, formatPercent, formatVolume } from '../utils/format';

function getHeatColor(changePct) {
  if (changePct >= 5) return 'bg-green-600';
  if (changePct >= 3) return 'bg-green-600/80';
  if (changePct >= 2) return 'bg-green-700/80';
  if (changePct >= 1) return 'bg-green-800/70';
  if (changePct >= 0.5) return 'bg-green-900/60';
  if (changePct > 0) return 'bg-green-950/50';
  if (changePct === 0) return 'bg-dark-700';
  if (changePct > -0.5) return 'bg-red-950/50';
  if (changePct > -1) return 'bg-red-900/60';
  if (changePct > -2) return 'bg-red-800/70';
  if (changePct > -3) return 'bg-red-700/80';
  if (changePct > -5) return 'bg-red-600/80';
  return 'bg-red-600';
}

function getHeatTextColor(changePct) {
  if (Math.abs(changePct) >= 2) return 'text-white';
  return 'text-dark-200';
}

export default function Heatmap() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState('sector');
  const [sizeBy, setSizeBy] = useState('market_cap');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await sectorsAPI.heatmap();
      setStocks(res.data || []);
    } catch (err) {
      console.error('Heatmap error:', err);
    } finally {
      setLoading(false);
    }
  };

  const groupedData = useMemo(() => {
    if (stocks.length === 0) return {};
    const groups = {};
    stocks.forEach(s => {
      const key = groupBy === 'sector' ? (s.sector || 'Others') : s.exchange;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });

    // Sort sectors by total market cap
    const sorted = {};
    Object.entries(groups)
      .sort(([, a], [, b]) => {
        const aMcap = a.reduce((s, st) => s + (st.market_cap || 0), 0);
        const bMcap = b.reduce((s, st) => s + (st.market_cap || 0), 0);
        return bMcap - aMcap;
      })
      .forEach(([key, val]) => {
        sorted[key] = val.sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
      });

    return sorted;
  }, [stocks, groupBy]);

  // Calculate relative size for treemap blocks
  const maxMcap = useMemo(() => {
    return Math.max(...stocks.map(s => s.market_cap || 1), 1);
  }, [stocks]);

  return (
    <div className="p-4 max-w-[1800px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Market Heatmap</h1>
          <p className="text-dark-400 text-sm mt-1">
            {stocks.length} stocks across {Object.keys(groupedData).length} sectors — Live from NSE
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {['sector', 'exchange'].map(g => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-3 py-1.5 rounded text-xs capitalize ${groupBy === g ? 'bg-accent-blue/20 text-accent-blue' : 'text-dark-500 hover:text-dark-300'}`}
              >
                {g}
              </button>
            ))}
          </div>
          <button onClick={loadData} className="btn-secondary text-xs">Refresh</button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 mb-4">
        <span className="text-xs text-dark-500 mr-2">Change:</span>
        {['-5%', '-3%', '-1%', '0%', '+1%', '+3%', '+5%'].map((label, i) => {
          const vals = [-5, -3, -1, 0, 1, 3, 5];
          return (
            <div key={i} className={`w-12 h-5 rounded text-[9px] flex items-center justify-center ${getHeatColor(vals[i])} ${getHeatTextColor(vals[i])}`}>
              {label}
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
            <p className="text-dark-400 text-sm">Loading live heatmap from NSE...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedData).map(([sector, sectorStocks]) => {
            const avgChange = sectorStocks.reduce((s, st) => s + (st.change_pct || 0), 0) / sectorStocks.length;
            return (
              <motion.div
                key={sector}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Link to={`/sectors/${encodeURIComponent(sector)}`} className="text-sm font-semibold text-white hover:text-accent-blue transition-colors">
                      {sector}
                    </Link>
                    <span className="text-xs text-dark-500">({sectorStocks.length})</span>
                  </div>
                  <span className={`text-xs font-mono font-medium ${avgChange >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {formatPercent(avgChange)}
                  </span>
                </div>

                {/* Treemap Grid */}
                <div className="flex flex-wrap gap-0.5">
                  {sectorStocks.slice(0, 30).map((stock) => {
                    const size = sizeBy === 'market_cap'
                      ? Math.max(Math.sqrt((stock.market_cap || 1) / maxMcap) * 120, 50)
                      : 70;

                    return (
                      <Link
                        key={stock.symbol}
                        to={`/stock/${stock.symbol}`}
                        style={{ width: size, height: Math.max(size * 0.6, 40) }}
                        className={`rounded flex flex-col items-center justify-center p-1 transition-all hover:ring-1 hover:ring-white/30 ${getHeatColor(stock.change_pct)}`}
                      >
                        <span className={`text-[10px] font-bold truncate max-w-full ${getHeatTextColor(stock.change_pct)}`}>
                          {stock.symbol}
                        </span>
                        <span className={`text-[9px] font-mono ${getHeatTextColor(stock.change_pct)}`}>
                          {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct?.toFixed(1)}%
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

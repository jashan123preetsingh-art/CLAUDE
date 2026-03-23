import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { sectorsAPI } from '../utils/api';
import { formatCurrency, formatPercent, formatVolume, formatMarketCap, getChangeColor, getChangeBg } from '../utils/format';

export default function Sectors() {
  const { sector: paramSector } = useParams();
  const [sectors, setSectors] = useState([]);
  const [sectorDetail, setSectorDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (paramSector) {
      loadSectorDetail(paramSector);
    } else {
      loadSectors();
    }
  }, [paramSector]);

  const loadSectors = async () => {
    setLoading(true);
    try {
      const res = await sectorsAPI.list();
      setSectors(res.data || []);
    } catch (err) {
      console.error('Sectors error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSectorDetail = async (sector) => {
    setLoading(true);
    try {
      const res = await sectorsAPI.detail(sector);
      setSectorDetail(res.data);
    } catch (err) {
      console.error('Sector detail error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-3 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
      </div>
    );
  }

  // Sector detail view
  if (paramSector && sectorDetail) {
    const stocks = sectorDetail.stocks || [];
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/sectors" className="text-dark-500 hover:text-white transition-colors text-sm">&larr; All Sectors</Link>
          <span className="text-dark-600">/</span>
          <h1 className="text-2xl font-bold text-white">{decodeURIComponent(paramSector)}</h1>
          <span className="badge bg-dark-700 text-dark-400">{stocks.length} stocks</span>
        </div>

        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="text-left p-3 text-dark-500 text-xs">Symbol</th>
                <th className="text-right p-3 text-dark-500 text-xs">LTP</th>
                <th className="text-right p-3 text-dark-500 text-xs">Change%</th>
                <th className="text-right p-3 text-dark-500 text-xs hidden md:table-cell">Volume</th>
                <th className="text-right p-3 text-dark-500 text-xs hidden lg:table-cell">Market Cap</th>
                <th className="text-right p-3 text-dark-500 text-xs hidden lg:table-cell">52W High</th>
                <th className="text-right p-3 text-dark-500 text-xs hidden lg:table-cell">52W Low</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock, i) => (
                <tr key={stock.symbol} className="border-b border-dark-800/50 hover:bg-dark-800/50 transition-colors">
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
                  <td className="p-3 text-right text-dark-400 font-mono text-xs hidden md:table-cell">{formatVolume(stock.volume)}</td>
                  <td className="p-3 text-right text-dark-400 font-mono text-xs hidden lg:table-cell">{formatMarketCap(stock.market_cap)}</td>
                  <td className="p-3 text-right text-dark-400 font-mono text-xs hidden lg:table-cell">{formatCurrency(stock.week_52_high)}</td>
                  <td className="p-3 text-right text-dark-400 font-mono text-xs hidden lg:table-cell">{formatCurrency(stock.week_52_low)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Sectors overview
  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Sector Analysis</h1>
        <p className="text-dark-400 text-sm mt-1">Live sector performance across {sectors.length} sectors</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sectors.map((sec, i) => (
          <motion.div
            key={sec.sector}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <Link
              to={`/sectors/${encodeURIComponent(sec.sector)}`}
              className="glass-card-hover p-5 block"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">{sec.sector}</h3>
                <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${getChangeBg(sec.avgChange)}`}>
                  {formatPercent(sec.avgChange)}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-dark-500 mb-3">
                <span>{sec.count} stocks</span>
              </div>

              {/* Mini bar chart of stock performances */}
              <div className="flex gap-0.5 h-8 items-end">
                {(sec.stocks || []).slice(0, 15).map((s, j) => {
                  const height = Math.min(Math.abs(s.change_pct || 0) * 10, 100);
                  return (
                    <div
                      key={j}
                      className={`flex-1 rounded-t ${(s.change_pct || 0) >= 0 ? 'bg-accent-green/40' : 'bg-accent-red/40'}`}
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${s.symbol}: ${s.change_pct}%`}
                    />
                  );
                })}
              </div>

              {/* Top stocks in sector */}
              <div className="mt-3 flex flex-wrap gap-1">
                {(sec.stocks || []).slice(0, 5).map(s => (
                  <span key={s.symbol} className={`text-[10px] px-1.5 py-0.5 rounded ${getChangeBg(s.change_pct)}`}>
                    {s.symbol} {s.change_pct >= 0 ? '+' : ''}{s.change_pct?.toFixed(1)}%
                  </span>
                ))}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fiiDiiAPI } from '../utils/api';
import { formatCurrency, getChangeColor } from '../utils/format';

export default function FiiDii() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [cumulative, setCumulative] = useState(null);
  const [sectorData, setSectorData] = useState([]);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadData();
  }, [days]);

  const loadData = async () => {
    const [latestRes, histRes, cumRes, sectorRes] = await Promise.allSettled([
      fiiDiiAPI.latest(),
      fiiDiiAPI.history(days),
      fiiDiiAPI.cumulative(),
      fiiDiiAPI.sectorAllocation(),
    ]);

    if (latestRes.status === 'fulfilled') setLatest(latestRes.value.data);
    if (histRes.status === 'fulfilled') setHistory(histRes.value.data || []);
    if (cumRes.status === 'fulfilled') setCumulative(cumRes.value.data);
    if (sectorRes.status === 'fulfilled') setSectorData(sectorRes.value.data || []);
  };

  const data = latest || demoLatest;
  const cum = cumulative || demoCumulative;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">FII & DII Data</h1>
          <p className="text-dark-400 text-sm mt-1">Institutional Money Matrix | Real-time flow tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-500">Period:</span>
          {[15, 30, 90, 365].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded text-xs ${days === d ? 'bg-accent-green/20 text-accent-green' : 'text-dark-500 hover:text-dark-300'}`}
            >
              {d === 365 ? '1Y' : `${d}D`}
            </button>
          ))}
        </div>
      </div>

      {/* Latest Session */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-dark-400">Latest Extracted Session</h3>
            <p className="text-xs text-dark-600 mt-1">{data.date || 'Friday, 13 March 2026'}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            (data.fii_net || -10724) < 0 ? 'bg-accent-red/20 text-accent-red' : 'bg-accent-green/20 text-accent-green'
          }`}>
            {(data.fii_net || -10724) < 0 ? 'AGGRESSIVE SELLING' : 'NET BUYING'}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-dark-500 mb-2">FII / FPI Net</p>
            <p className={`text-3xl font-bold font-mono ${getChangeColor(data.fii_net || -10724)}`}>
              {formatCurrency(data.fii_net || -10724, true)}
            </p>
            <p className={`text-xs mt-1 ${(data.fii_net || -10724) < 0 ? 'text-accent-red/60' : 'text-accent-green/60'}`}>
              FII {(data.fii_net || -10724) < 0 ? 'SELLING' : 'BUYING'}: {Math.abs(((data.fii_net || -10724) / (data.fii_buy || 85000) * 100)).toFixed(0)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-2">DII Net</p>
            <p className={`text-3xl font-bold font-mono ${getChangeColor(data.dii_net || 9977)}`}>
              {formatCurrency(data.dii_net || 9977, true)}
            </p>
            <p className={`text-xs mt-1 ${(data.dii_net || 9977) > 0 ? 'text-accent-green/60' : 'text-accent-red/60'}`}>
              DII SUPPORT: {Math.abs(((data.dii_net || 9977) / (data.dii_buy || 22000) * 100)).toFixed(0)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-2">Combined Liquidity</p>
            <p className={`text-3xl font-bold font-mono ${getChangeColor((data.fii_net || -10724) + (data.dii_net || 9977))}`}>
              {formatCurrency((data.fii_net || -10724) + (data.dii_net || 9977), true)}
            </p>
            <p className="text-xs mt-1 text-dark-600">Net Drain/Infusion</p>
          </div>
          <div>
            <p className="text-xs text-dark-500 mb-2">FII Streak</p>
            <p className="text-3xl font-bold font-mono text-accent-red">
              {cum?.fii_selling_days || 2} Days
            </p>
            <p className="text-xs mt-1 text-accent-red/60">Consecutive Selling</p>
          </div>
        </div>
      </motion.div>

      {/* Cumulative Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'FII 5-Yr Cumulative', value: cum?.fii_total_net || -11010, color: 'red' },
          { label: 'DII 5-Yr Cumulative', value: cum?.dii_total_net || 20450, color: 'green' },
          { label: 'SIP Monthly Run Rate', value: 26500, color: 'blue', suffix: '' },
          { label: 'FII NSE200 Ownership', value: 16.1, color: 'purple', suffix: '%' },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-4"
          >
            <p className="text-xs text-dark-500 mb-2">{item.label}</p>
            <p className={`text-xl font-bold font-mono text-accent-${item.color}`}>
              {item.suffix === '%' ? `${item.value}%` : formatCurrency(item.value, true)}
            </p>
          </motion.div>
        ))}
      </div>

      {/* History Table */}
      <div className="glass-card overflow-hidden mb-6">
        <div className="p-4 border-b border-dark-700">
          <h3 className="text-sm font-semibold text-white">Daily Flow History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="text-left p-3 text-dark-500 text-xs">Date</th>
                <th className="text-right p-3 text-dark-500 text-xs">FII Buy</th>
                <th className="text-right p-3 text-dark-500 text-xs">FII Sell</th>
                <th className="text-right p-3 text-dark-500 text-xs">FII Net</th>
                <th className="text-right p-3 text-dark-500 text-xs">DII Buy</th>
                <th className="text-right p-3 text-dark-500 text-xs">DII Sell</th>
                <th className="text-right p-3 text-dark-500 text-xs">DII Net</th>
              </tr>
            </thead>
            <tbody>
              {(history.length > 0 ? history : demoHistory).map((row, i) => (
                <tr key={i} className="border-b border-dark-800/50 hover:bg-dark-800/30">
                  <td className="p-3 text-dark-300 text-xs">{row.date}</td>
                  <td className="p-3 text-right font-mono text-xs text-dark-400">{formatCurrency(row.fii_buy, true)}</td>
                  <td className="p-3 text-right font-mono text-xs text-dark-400">{formatCurrency(row.fii_sell, true)}</td>
                  <td className={`p-3 text-right font-mono text-xs font-medium ${getChangeColor(row.fii_net)}`}>{formatCurrency(row.fii_net, true)}</td>
                  <td className="p-3 text-right font-mono text-xs text-dark-400">{formatCurrency(row.dii_buy, true)}</td>
                  <td className="p-3 text-right font-mono text-xs text-dark-400">{formatCurrency(row.dii_sell, true)}</td>
                  <td className={`p-3 text-right font-mono text-xs font-medium ${getChangeColor(row.dii_net)}`}>{formatCurrency(row.dii_net, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sector Allocation */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Sector-Wise FII / FPI Allocation</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {(sectorData.length > 0 ? sectorData : demoSectors).map((sector, i) => (
            <div key={i} className="p-3 rounded-lg bg-dark-850 border border-dark-700/50">
              <p className="text-xs text-dark-500 mb-1">{sector.sector || sector.name}</p>
              <p className="text-sm font-bold text-white">{(sector.avg_fii_holding || sector.fii_pct || 0).toFixed(1)}%</p>
              <div className="h-1 bg-dark-800 rounded-full mt-2">
                <div className="h-full bg-accent-blue rounded-full" style={{ width: `${Math.min((sector.avg_fii_holding || sector.fii_pct || 0), 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const demoLatest = { fii_net: -10724, dii_net: 9977, fii_buy: 48000, fii_sell: 58724, dii_buy: 22000, dii_sell: 12023, date: '2026-03-13' };
const demoCumulative = { fii_total_net: -11010, dii_total_net: 20450, fii_selling_days: 2, fii_buying_days: 8 };
const demoHistory = [
  { date: '2026-03-13', fii_buy: 48000, fii_sell: 58724, fii_net: -10724, dii_buy: 22000, dii_sell: 12023, dii_net: 9977 },
  { date: '2026-03-12', fii_buy: 52000, fii_sell: 54100, fii_net: -2100, dii_buy: 19500, dii_sell: 17800, dii_net: 1700 },
  { date: '2026-03-11', fii_buy: 45000, fii_sell: 42000, fii_net: 3000, dii_buy: 18000, dii_sell: 19500, dii_net: -1500 },
  { date: '2026-03-10', fii_buy: 55000, fii_sell: 60200, fii_net: -5200, dii_buy: 24000, dii_sell: 18800, dii_net: 5200 },
  { date: '2026-03-07', fii_buy: 47000, fii_sell: 51500, fii_net: -4500, dii_buy: 21000, dii_sell: 16500, dii_net: 4500 },
];
const demoSectors = [
  { name: 'Financial Services', fii_pct: 34.5 },
  { name: 'Information Technology', fii_pct: 18.9 },
  { name: 'Oil & Gas', fii_pct: 12.7 },
  { name: 'Consumer Goods', fii_pct: 8.3 },
  { name: 'Healthcare', fii_pct: 6.8 },
  { name: 'Automobile', fii_pct: 5.4 },
  { name: 'Metals', fii_pct: 4.1 },
  { name: 'Others', fii_pct: 9.3 },
];

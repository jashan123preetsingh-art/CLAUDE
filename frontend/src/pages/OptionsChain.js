import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { optionsAPI } from '../utils/api';
import { formatCurrency, formatVolume, formatNumber } from '../utils/format';

const FNO_STOCKS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BAJFINANCE', 'TATAMOTORS', 'M&M', 'AXISBANK', 'ITC', 'LT'];

export default function OptionsChain() {
  const { symbol: paramSymbol } = useParams();
  const [symbol, setSymbol] = useState(paramSymbol || 'NIFTY');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedExpiry, setSelectedExpiry] = useState(null);
  const [searchSymbol, setSearchSymbol] = useState('');

  useEffect(() => {
    loadOptionsChain();
  }, [symbol]);

  const loadOptionsChain = async () => {
    setLoading(true);
    try {
      const res = await optionsAPI.chain(symbol);
      setData(res.data);
      if (res.data?.expiryDates?.length > 0 && !selectedExpiry) {
        setSelectedExpiry(res.data.expiryDates[0]);
      }
    } catch {
      setData(demoOptionsData);
    } finally {
      setLoading(false);
    }
  };

  const displayData = data || demoOptionsData;
  const analytics = displayData.analytics || {};
  const chain = displayData.chain || [];
  const atmStrike = displayData.underlyingValue
    ? chain.reduce((closest, item) => Math.abs(item.strike - displayData.underlyingValue) < Math.abs(closest.strike - displayData.underlyingValue) ? item : closest, chain[0] || { strike: 0 })?.strike
    : null;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Options Chain</h1>
          <p className="text-dark-400 text-sm mt-1">Live option chain with Greeks and analytics</p>
        </div>
      </div>

      {/* Symbol Selector */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {FNO_STOCKS.slice(0, 10).map(s => (
          <button
            key={s}
            onClick={() => { setSymbol(s); setSelectedExpiry(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              symbol === s
                ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                : 'bg-dark-800 text-dark-400 border border-dark-700 hover:border-dark-600'
            }`}
          >
            {s}
          </button>
        ))}
        <div className="relative">
          <input
            type="text"
            placeholder="Search symbol..."
            value={searchSymbol}
            onChange={(e) => setSearchSymbol(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && searchSymbol) { setSymbol(searchSymbol.toUpperCase()); setSearchSymbol(''); setSelectedExpiry(null); }}}
            className="input-dark w-32 text-xs"
          />
        </div>
      </div>

      {/* Analytics Bar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-dark-500">Spot</p>
          <p className="text-sm font-bold font-mono text-white">{formatCurrency(displayData.underlyingValue || 22500)}</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-dark-500">Max Pain</p>
          <p className="text-sm font-bold font-mono text-accent-yellow">{formatNumber(analytics.maxPain || 22500)}</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-dark-500">PCR</p>
          <p className={`text-sm font-bold font-mono ${(analytics.pcr || 0.85) > 1 ? 'text-accent-green' : 'text-accent-red'}`}>
            {analytics.pcr || 0.85}
          </p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-dark-500">Total Call OI</p>
          <p className="text-sm font-bold font-mono text-accent-red">{formatVolume(analytics.totalCallOI || 12500000)}</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-dark-500">Total Put OI</p>
          <p className="text-sm font-bold font-mono text-accent-green">{formatVolume(analytics.totalPutOI || 10625000)}</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-dark-500">Call Volume</p>
          <p className="text-sm font-bold font-mono text-dark-300">{formatVolume(analytics.totalCallVolume || 890000)}</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-xs text-dark-500">Put Volume</p>
          <p className="text-sm font-bold font-mono text-dark-300">{formatVolume(analytics.totalPutVolume || 750000)}</p>
        </div>
      </motion.div>

      {/* Expiry Selector */}
      {displayData.expiryDates && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {displayData.expiryDates.slice(0, 6).map(exp => (
            <button
              key={exp}
              onClick={() => setSelectedExpiry(exp)}
              className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all ${
                selectedExpiry === exp
                  ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30'
                  : 'bg-dark-800 text-dark-500 border border-dark-700 hover:border-dark-600'
              }`}
            >
              {exp}
            </button>
          ))}
        </div>
      )}

      {/* Options Chain Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-dark-700">
                  <th colSpan="5" className="bg-accent-red/5 p-2 text-accent-red text-center font-semibold border-r border-dark-700">CALLS</th>
                  <th className="bg-dark-800 p-2 text-white text-center font-semibold border-r border-dark-700">STRIKE</th>
                  <th colSpan="5" className="bg-accent-green/5 p-2 text-accent-green text-center font-semibold">PUTS</th>
                </tr>
                <tr className="border-b border-dark-700 text-dark-500">
                  <th className="p-2 text-right">OI</th>
                  <th className="p-2 text-right">Chng OI</th>
                  <th className="p-2 text-right">Volume</th>
                  <th className="p-2 text-right">IV</th>
                  <th className="p-2 text-right border-r border-dark-700">LTP</th>
                  <th className="p-2 text-center border-r border-dark-700 bg-dark-800">Strike</th>
                  <th className="p-2 text-right">LTP</th>
                  <th className="p-2 text-right">IV</th>
                  <th className="p-2 text-right">Volume</th>
                  <th className="p-2 text-right">Chng OI</th>
                  <th className="p-2 text-right">OI</th>
                </tr>
              </thead>
              <tbody>
                {chain.map((row, i) => {
                  const isATM = atmStrike && row.strike === atmStrike;
                  const isITMCall = displayData.underlyingValue && row.strike < displayData.underlyingValue;
                  const isITMPut = displayData.underlyingValue && row.strike > displayData.underlyingValue;

                  return (
                    <tr
                      key={i}
                      className={`border-b border-dark-800/30 hover:bg-dark-800/50 transition-colors ${isATM ? 'bg-accent-yellow/5 border-accent-yellow/20' : ''}`}
                    >
                      <td className={`p-2 text-right font-mono ${isITMCall ? 'bg-accent-red/5' : ''}`}>
                        {formatVolume(row.ce?.oi)}
                      </td>
                      <td className={`p-2 text-right font-mono ${isITMCall ? 'bg-accent-red/5' : ''} ${
                        (row.ce?.change_oi || 0) > 0 ? 'text-accent-green' : (row.ce?.change_oi || 0) < 0 ? 'text-accent-red' : 'text-dark-500'
                      }`}>
                        {formatVolume(row.ce?.change_oi)}
                      </td>
                      <td className={`p-2 text-right font-mono text-dark-400 ${isITMCall ? 'bg-accent-red/5' : ''}`}>
                        {formatVolume(row.ce?.volume)}
                      </td>
                      <td className={`p-2 text-right font-mono text-dark-400 ${isITMCall ? 'bg-accent-red/5' : ''}`}>
                        {row.ce?.iv || '—'}
                      </td>
                      <td className={`p-2 text-right font-mono font-medium text-white border-r border-dark-700 ${isITMCall ? 'bg-accent-red/5' : ''}`}>
                        {row.ce?.ltp ? formatCurrency(row.ce.ltp) : '—'}
                      </td>
                      <td className={`p-2 text-center font-mono font-bold border-r border-dark-700 bg-dark-800 ${isATM ? 'text-accent-yellow' : 'text-white'}`}>
                        {formatNumber(row.strike)}
                      </td>
                      <td className={`p-2 text-right font-mono font-medium text-white ${isITMPut ? 'bg-accent-green/5' : ''}`}>
                        {row.pe?.ltp ? formatCurrency(row.pe.ltp) : '—'}
                      </td>
                      <td className={`p-2 text-right font-mono text-dark-400 ${isITMPut ? 'bg-accent-green/5' : ''}`}>
                        {row.pe?.iv || '—'}
                      </td>
                      <td className={`p-2 text-right font-mono text-dark-400 ${isITMPut ? 'bg-accent-green/5' : ''}`}>
                        {formatVolume(row.pe?.volume)}
                      </td>
                      <td className={`p-2 text-right font-mono ${isITMPut ? 'bg-accent-green/5' : ''} ${
                        (row.pe?.change_oi || 0) > 0 ? 'text-accent-green' : (row.pe?.change_oi || 0) < 0 ? 'text-accent-red' : 'text-dark-500'
                      }`}>
                        {formatVolume(row.pe?.change_oi)}
                      </td>
                      <td className={`p-2 text-right font-mono ${isITMPut ? 'bg-accent-green/5' : ''}`}>
                        {formatVolume(row.pe?.oi)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const demoOptionsData = {
  symbol: 'NIFTY',
  underlyingValue: 22500.35,
  expiryDates: ['27-Mar-2026', '03-Apr-2026', '10-Apr-2026', '24-Apr-2026', '29-May-2026', '26-Jun-2026'],
  analytics: { maxPain: 22500, pcr: 0.85, totalCallOI: 12500000, totalPutOI: 10625000, totalCallVolume: 890000, totalPutVolume: 750000 },
  chain: [
    { strike: 22200, ce: { ltp: 345.5, oi: 850000, change_oi: 125000, volume: 45000, iv: 14.2 }, pe: { ltp: 42.3, oi: 420000, change_oi: -30000, volume: 28000, iv: 15.8 } },
    { strike: 22300, ce: { ltp: 265.2, oi: 1200000, change_oi: 180000, volume: 62000, iv: 13.5 }, pe: { ltp: 65.8, oi: 580000, change_oi: 45000, volume: 35000, iv: 15.1 } },
    { strike: 22400, ce: { ltp: 195.4, oi: 1850000, change_oi: 250000, volume: 85000, iv: 12.8 }, pe: { ltp: 98.2, oi: 750000, change_oi: 62000, volume: 48000, iv: 14.5 } },
    { strike: 22500, ce: { ltp: 138.6, oi: 2200000, change_oi: 320000, volume: 120000, iv: 12.1 }, pe: { ltp: 142.5, oi: 1980000, change_oi: 280000, volume: 110000, iv: 13.8 } },
    { strike: 22600, ce: { ltp: 92.3, oi: 1650000, change_oi: 195000, volume: 78000, iv: 11.8 }, pe: { ltp: 198.4, oi: 1250000, change_oi: 155000, volume: 68000, iv: 14.2 } },
    { strike: 22700, ce: { ltp: 58.7, oi: 1100000, change_oi: 140000, volume: 55000, iv: 11.5 }, pe: { ltp: 268.9, oi: 920000, change_oi: 98000, volume: 42000, iv: 14.8 } },
    { strike: 22800, ce: { ltp: 34.2, oi: 780000, change_oi: 95000, volume: 38000, iv: 11.2 }, pe: { ltp: 348.5, oi: 650000, change_oi: 72000, volume: 32000, iv: 15.5 } },
  ],
};

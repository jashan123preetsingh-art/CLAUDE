import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { optionsAPI } from '../utils/api';
import { formatCurrency, formatVolume, formatNumber } from '../utils/format';

const FNO_STOCKS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BAJFINANCE', 'TATAMOTORS', 'M&M', 'AXISBANK', 'ITC', 'LT'];

function OIBar({ value, max, color }) {
  const width = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-16 h-1.5 bg-terminal-bg rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export default function OptionsChain() {
  const { symbol: paramSymbol } = useParams();
  const [symbol, setSymbol] = useState(paramSymbol || 'NIFTY');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedExpiry, setSelectedExpiry] = useState(null);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [strikeRange, setStrikeRange] = useState(15);

  useEffect(() => { loadOptionsChain(); }, [symbol]);

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

  // Filter chain around ATM
  const atmIndex = chain.findIndex(c => c.strike === atmStrike);
  const filteredChain = atmIndex >= 0
    ? chain.slice(Math.max(0, atmIndex - strikeRange), Math.min(chain.length, atmIndex + strikeRange + 1))
    : chain;

  // Max OI for bar charts
  const maxOI = Math.max(...filteredChain.map(c => Math.max(c.ce?.oi || 0, c.pe?.oi || 0)), 1);

  // OI analysis
  const maxCallOIStrike = chain.reduce((max, c) => (c.ce?.oi || 0) > (max.ce?.oi || 0) ? c : max, chain[0] || {});
  const maxPutOIStrike = chain.reduce((max, c) => (c.pe?.oi || 0) > (max.pe?.oi || 0) ? c : max, chain[0] || {});

  return (
    <div className="p-3 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="t-card overflow-hidden mb-2">
        <div className="flex items-center justify-between px-3 py-2">
          <div>
            <h1 className="text-sm font-bold text-white font-mono tracking-wide">OPTIONS CHAIN</h1>
            <p className="text-[9px] text-terminal-muted font-mono mt-0.5">
              Live option chain with OI analysis, Max Pain & PCR | {displayData.source === 'nse_live' ? 'NSE LIVE' : 'DEMO DATA'}
            </p>
          </div>
          <Link to={`/charts/${symbol}`} className="t-btn t-btn-default">VIEW CHART</Link>
        </div>
      </div>

      {/* Symbol Selector */}
      <div className="t-card px-3 py-2 mb-2">
        <div className="flex gap-1 flex-wrap items-center">
          {FNO_STOCKS.map(s => (
            <button key={s} onClick={() => { setSymbol(s); setSelectedExpiry(null); }}
              className={`px-2 py-0.5 rounded text-[9px] font-mono font-semibold transition-all ${
                symbol === s
                  ? 'bg-terminal-green/15 text-terminal-green border border-terminal-green/25'
                  : 'bg-terminal-bg text-terminal-muted border border-terminal-border hover:text-terminal-text'
              }`}>
              {s}
            </button>
          ))}
          <input
            type="text" placeholder="SEARCH..."
            value={searchSymbol} onChange={(e) => setSearchSymbol(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && searchSymbol) { setSymbol(searchSymbol.toUpperCase()); setSearchSymbol(''); setSelectedExpiry(null); }}}
            className="t-input w-24"
          />
        </div>
      </div>

      {/* Analytics Strip */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-px bg-terminal-border rounded overflow-hidden mb-2">
        {[
          { label: 'SPOT', value: formatCurrency(displayData.underlyingValue || 0), color: 'text-white' },
          { label: 'MAX PAIN', value: formatNumber(analytics.maxPain || 0), color: 'text-terminal-yellow' },
          { label: 'PCR', value: (analytics.pcr || 0).toFixed(2), color: (analytics.pcr || 0) > 1 ? 'text-terminal-green' : 'text-terminal-red' },
          { label: 'CALL OI', value: formatVolume(analytics.totalCallOI || 0), color: 'text-terminal-red' },
          { label: 'PUT OI', value: formatVolume(analytics.totalPutOI || 0), color: 'text-terminal-green' },
          { label: 'CALL VOL', value: formatVolume(analytics.totalCallVolume || 0), color: 'text-terminal-text' },
          { label: 'PUT VOL', value: formatVolume(analytics.totalPutVolume || 0), color: 'text-terminal-text' },
          { label: 'MAX CALL OI', value: formatNumber(maxCallOIStrike?.strike || 0), color: 'text-terminal-red' },
        ].map((item, i) => (
          <div key={i} className="bg-terminal-card p-2 text-center">
            <p className="text-[8px] font-mono text-terminal-muted">{item.label}</p>
            <p className={`text-[11px] font-bold font-mono ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* OI Analysis Bar */}
      <div className="t-card px-3 py-2 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-[9px] font-mono">
            <span className="text-terminal-muted">OI ANALYSIS:</span>
            <span className="text-terminal-red">MAX CALL OI @ {formatNumber(maxCallOIStrike?.strike)} (RESISTANCE)</span>
            <span className="text-terminal-green">MAX PUT OI @ {formatNumber(maxPutOIStrike?.strike)} (SUPPORT)</span>
            <span className={analytics.pcr > 1 ? 'text-terminal-green' : 'text-terminal-red'}>
              PCR {analytics.pcr > 1.2 ? 'BULLISH' : analytics.pcr > 0.8 ? 'NEUTRAL' : 'BEARISH'} ({(analytics.pcr || 0).toFixed(2)})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-terminal-muted">STRIKES:</span>
            {[10, 15, 25, 50].map(n => (
              <button key={n} onClick={() => setStrikeRange(n)}
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${strikeRange === n ? 'text-terminal-green bg-terminal-green/10' : 'text-terminal-muted hover:text-terminal-text'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Expiry Selector */}
      {displayData.expiryDates && (
        <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
          {displayData.expiryDates.slice(0, 8).map(exp => (
            <button key={exp} onClick={() => setSelectedExpiry(exp)}
              className={`px-2.5 py-1 rounded text-[9px] font-mono font-semibold whitespace-nowrap transition-all ${
                selectedExpiry === exp
                  ? 'bg-terminal-blue/15 text-terminal-blue border border-terminal-blue/25'
                  : 'bg-terminal-card text-terminal-muted border border-terminal-border hover:text-terminal-text'
              }`}>
              {exp}
            </button>
          ))}
        </div>
      )}

      {/* Options Chain Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-terminal-green/30 border-t-terminal-green rounded-full animate-spin" />
        </div>
      ) : (
        <div className="t-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="t-table">
              <thead>
                <tr>
                  <th colSpan="6" className="text-center bg-terminal-red/5 text-terminal-red border-r border-terminal-border">
                    CALLS (CE)
                  </th>
                  <th className="text-center bg-terminal-header text-white border-r border-terminal-border">STRIKE</th>
                  <th colSpan="6" className="text-center bg-terminal-green/5 text-terminal-green">
                    PUTS (PE)
                  </th>
                </tr>
                <tr>
                  <th>OI BAR</th>
                  <th>OI</th>
                  <th>CHG OI</th>
                  <th>VOL</th>
                  <th>IV</th>
                  <th className="border-r border-terminal-border">LTP</th>
                  <th className="text-center bg-terminal-header border-r border-terminal-border">STRIKE</th>
                  <th>LTP</th>
                  <th>IV</th>
                  <th>VOL</th>
                  <th>CHG OI</th>
                  <th>OI</th>
                  <th>OI BAR</th>
                </tr>
              </thead>
              <tbody>
                {filteredChain.map((row, i) => {
                  const isATM = atmStrike && row.strike === atmStrike;
                  const isITMCall = displayData.underlyingValue && row.strike < displayData.underlyingValue;
                  const isITMPut = displayData.underlyingValue && row.strike > displayData.underlyingValue;

                  return (
                    <tr key={i} className={isATM ? 'bg-terminal-yellow/5' : ''}>
                      <td className={isITMCall ? 'bg-terminal-red/3' : ''}>
                        <OIBar value={row.ce?.oi || 0} max={maxOI} color="bg-terminal-red" />
                      </td>
                      <td className={`${isITMCall ? 'bg-terminal-red/3' : ''} text-terminal-text`}>
                        {formatVolume(row.ce?.oi)}
                      </td>
                      <td className={`${isITMCall ? 'bg-terminal-red/3' : ''} ${
                        (row.ce?.change_oi || 0) > 0 ? 'text-terminal-green' : (row.ce?.change_oi || 0) < 0 ? 'text-terminal-red' : 'text-terminal-muted'
                      }`}>
                        {formatVolume(row.ce?.change_oi)}
                      </td>
                      <td className={`${isITMCall ? 'bg-terminal-red/3' : ''} text-terminal-muted`}>{formatVolume(row.ce?.volume)}</td>
                      <td className={`${isITMCall ? 'bg-terminal-red/3' : ''} text-terminal-muted`}>{row.ce?.iv || '---'}</td>
                      <td className={`border-r border-terminal-border font-semibold text-white ${isITMCall ? 'bg-terminal-red/3' : ''}`}>
                        {row.ce?.ltp ? formatCurrency(row.ce.ltp) : '---'}
                      </td>
                      <td className={`text-center font-bold bg-terminal-header border-r border-terminal-border ${isATM ? 'text-terminal-yellow' : 'text-white'}`}>
                        {formatNumber(row.strike)}
                      </td>
                      <td className={`font-semibold text-white ${isITMPut ? 'bg-terminal-green/3' : ''}`}>
                        {row.pe?.ltp ? formatCurrency(row.pe.ltp) : '---'}
                      </td>
                      <td className={`${isITMPut ? 'bg-terminal-green/3' : ''} text-terminal-muted`}>{row.pe?.iv || '---'}</td>
                      <td className={`${isITMPut ? 'bg-terminal-green/3' : ''} text-terminal-muted`}>{formatVolume(row.pe?.volume)}</td>
                      <td className={`${isITMPut ? 'bg-terminal-green/3' : ''} ${
                        (row.pe?.change_oi || 0) > 0 ? 'text-terminal-green' : (row.pe?.change_oi || 0) < 0 ? 'text-terminal-red' : 'text-terminal-muted'
                      }`}>
                        {formatVolume(row.pe?.change_oi)}
                      </td>
                      <td className={`${isITMPut ? 'bg-terminal-green/3' : ''} text-terminal-text`}>
                        {formatVolume(row.pe?.oi)}
                      </td>
                      <td className={isITMPut ? 'bg-terminal-green/3' : ''}>
                        <OIBar value={row.pe?.oi || 0} max={maxOI} color="bg-terminal-green" />
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
    { strike: 22000, ce: { ltp: 545.5, oi: 650000, change_oi: 85000, volume: 32000, iv: 15.2 }, pe: { ltp: 22.3, oi: 280000, change_oi: -15000, volume: 18000, iv: 16.8 } },
    { strike: 22100, ce: { ltp: 450.2, oi: 750000, change_oi: 105000, volume: 38000, iv: 14.8 }, pe: { ltp: 32.8, oi: 350000, change_oi: 25000, volume: 22000, iv: 16.2 } },
    { strike: 22200, ce: { ltp: 345.5, oi: 850000, change_oi: 125000, volume: 45000, iv: 14.2 }, pe: { ltp: 42.3, oi: 420000, change_oi: -30000, volume: 28000, iv: 15.8 } },
    { strike: 22300, ce: { ltp: 265.2, oi: 1200000, change_oi: 180000, volume: 62000, iv: 13.5 }, pe: { ltp: 65.8, oi: 580000, change_oi: 45000, volume: 35000, iv: 15.1 } },
    { strike: 22400, ce: { ltp: 195.4, oi: 1850000, change_oi: 250000, volume: 85000, iv: 12.8 }, pe: { ltp: 98.2, oi: 750000, change_oi: 62000, volume: 48000, iv: 14.5 } },
    { strike: 22500, ce: { ltp: 138.6, oi: 2200000, change_oi: 320000, volume: 120000, iv: 12.1 }, pe: { ltp: 142.5, oi: 1980000, change_oi: 280000, volume: 110000, iv: 13.8 } },
    { strike: 22600, ce: { ltp: 92.3, oi: 1650000, change_oi: 195000, volume: 78000, iv: 11.8 }, pe: { ltp: 198.4, oi: 1250000, change_oi: 155000, volume: 68000, iv: 14.2 } },
    { strike: 22700, ce: { ltp: 58.7, oi: 1100000, change_oi: 140000, volume: 55000, iv: 11.5 }, pe: { ltp: 268.9, oi: 920000, change_oi: 98000, volume: 42000, iv: 14.8 } },
    { strike: 22800, ce: { ltp: 34.2, oi: 780000, change_oi: 95000, volume: 38000, iv: 11.2 }, pe: { ltp: 348.5, oi: 650000, change_oi: 72000, volume: 32000, iv: 15.5 } },
    { strike: 22900, ce: { ltp: 18.5, oi: 520000, change_oi: 65000, volume: 25000, iv: 10.8 }, pe: { ltp: 435.2, oi: 450000, change_oi: 48000, volume: 22000, iv: 16.2 } },
    { strike: 23000, ce: { ltp: 8.3, oi: 380000, change_oi: 42000, volume: 15000, iv: 10.5 }, pe: { ltp: 528.8, oi: 320000, change_oi: 35000, volume: 15000, iv: 17.0 } },
  ],
  source: 'demo',
};

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fundamentalsAPI, stocksAPI } from '../utils/api';
import { formatCurrency, formatPercent, formatMarketCap, getChangeColor, getChangeBg } from '../utils/format';

const PRESET_SCREENS = [
  { name: 'High ROE + Low Debt', filters: { minROE: 20, maxDebt: 0.5 } },
  { name: 'Value Picks (Low PE)', filters: { maxPE: 15, minROE: 12 } },
  { name: 'Growth Stars', filters: { minROE: 18, minROCE: 15 } },
  { name: 'Dividend Champions', filters: { minDividend: 3 } },
  { name: 'Small Cap Quality', filters: { minROE: 15, maxPE: 25 } },
];

const COLUMNS = [
  { key: 'symbol', label: 'Symbol', sortable: true },
  { key: 'ltp', label: 'LTP', sortable: true },
  { key: 'change_pct', label: 'Change%', sortable: true },
  { key: 'market_cap', label: 'Market Cap', sortable: true },
  { key: 'pe_ratio', label: 'P/E', sortable: true },
  { key: 'roe', label: 'ROE%', sortable: true },
  { key: 'roce', label: 'ROCE%', sortable: true },
  { key: 'debt_to_equity', label: 'D/E', sortable: true },
  { key: 'dividend_yield', label: 'Div%', sortable: true },
  { key: 'promoter_holding', label: 'Promoter%', sortable: true },
];

export default function Screener() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [sortKey, setSortKey] = useState('market_cap');
  const [sortDir, setSortDir] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadStocks();
  }, [filters]);

  const loadStocks = async () => {
    setLoading(true);
    try {
      const res = await fundamentalsAPI.screen(filters);
      setStocks(res.data || []);
    } catch {
      setStocks(demoStocks);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const displayStocks = stocks.length > 0 ? stocks : demoStocks;
  const filteredStocks = displayStocks
    .filter(s => !searchTerm || s.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) || s.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const aVal = a[sortKey] || 0;
      const bVal = b[sortKey] || 0;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Fundamental Screener</h1>
        <p className="text-dark-400 text-sm mt-1">Screen Indian stocks by fundamental metrics — like Screener.in</p>
      </div>

      {/* Preset Screens */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {PRESET_SCREENS.map((screen, i) => (
          <button
            key={i}
            onClick={() => setFilters(screen.filters)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800 text-dark-400 border border-dark-700 hover:border-accent-blue/30 hover:text-accent-blue transition-all"
          >
            {screen.name}
          </button>
        ))}
        <button
          onClick={() => setFilters({})}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-dark-500 hover:text-dark-300 transition-all"
        >
          Clear Filters
        </button>
      </div>

      {/* Filter Inputs */}
      <div className="glass-card p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { key: 'maxPE', label: 'Max P/E', placeholder: 'e.g. 25' },
            { key: 'minROE', label: 'Min ROE%', placeholder: 'e.g. 15' },
            { key: 'minROCE', label: 'Min ROCE%', placeholder: 'e.g. 12' },
            { key: 'maxDebt', label: 'Max D/E', placeholder: 'e.g. 1' },
            { key: 'minDividend', label: 'Min Div%', placeholder: 'e.g. 2' },
            { key: 'sector', label: 'Sector', placeholder: 'e.g. IT' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs text-dark-500 mb-1 block">{f.label}</label>
              <input
                type={f.key === 'sector' ? 'text' : 'number'}
                placeholder={f.placeholder}
                value={filters[f.key] || ''}
                onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value || undefined })}
                className="input-dark w-full text-xs"
              />
            </div>
          ))}
          <div className="flex items-end">
            <button onClick={loadStocks} className="btn-primary w-full">Screen</button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center justify-between mb-4">
        <input
          type="text"
          placeholder="Search symbol or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-dark w-64"
        />
        <span className="text-xs text-dark-500">{filteredStocks.length} stocks</span>
      </div>

      {/* Results Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-700">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={`text-left p-3 text-dark-500 font-medium text-xs cursor-pointer hover:text-dark-300 transition-colors ${
                      sortKey === col.key ? 'text-accent-green' : ''
                    }`}
                  >
                    {col.label} {sortKey === col.key && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((stock, i) => (
                <motion.tr
                  key={stock.symbol || i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.01 }}
                  className="border-b border-dark-800/50 hover:bg-dark-800/50 transition-colors"
                >
                  <td className="p-3">
                    <Link to={`/stock/${stock.symbol}`} className="hover:text-accent-green transition-colors">
                      <p className="font-medium text-white">{stock.symbol}</p>
                      <p className="text-xs text-dark-500 truncate max-w-[120px]">{stock.name}</p>
                    </Link>
                  </td>
                  <td className="p-3 font-mono text-white text-right">{formatCurrency(stock.ltp)}</td>
                  <td className="p-3 text-right">
                    <span className={`px-2 py-0.5 rounded text-xs font-mono ${getChangeBg(stock.change_pct)}`}>
                      {formatPercent(stock.change_pct)}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-dark-300 text-right text-xs">{formatMarketCap(stock.market_cap)}</td>
                  <td className="p-3 font-mono text-dark-300 text-right">{stock.pe_ratio || '—'}</td>
                  <td className="p-3 font-mono text-right">
                    <span className={stock.roe >= 15 ? 'text-accent-green' : 'text-dark-400'}>{stock.roe ? `${stock.roe}%` : '—'}</span>
                  </td>
                  <td className="p-3 font-mono text-right">
                    <span className={stock.roce >= 15 ? 'text-accent-green' : 'text-dark-400'}>{stock.roce ? `${stock.roce}%` : '—'}</span>
                  </td>
                  <td className="p-3 font-mono text-right">
                    <span className={stock.debt_to_equity <= 0.5 ? 'text-accent-green' : stock.debt_to_equity > 1 ? 'text-accent-red' : 'text-dark-400'}>
                      {stock.debt_to_equity || '—'}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-dark-300 text-right">{stock.dividend_yield ? `${stock.dividend_yield}%` : '—'}</td>
                  <td className="p-3 font-mono text-dark-300 text-right">{stock.promoter_holding ? `${stock.promoter_holding}%` : '—'}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const demoStocks = [
  { symbol: 'TCS', name: 'Tata Consultancy Services', ltp: 3890.50, change_pct: 1.85, market_cap: 1500000, pe_ratio: 32.4, roe: 45.2, roce: 56.8, debt_to_equity: 0.04, dividend_yield: 1.5, promoter_holding: 72.3 },
  { symbol: 'INFY', name: 'Infosys Ltd', ltp: 1520.40, change_pct: 1.12, market_cap: 750000, pe_ratio: 28.5, roe: 32.1, roce: 40.5, debt_to_equity: 0.08, dividend_yield: 2.3, promoter_holding: 14.8 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', ltp: 1680.90, change_pct: -0.25, market_cap: 1200000, pe_ratio: 21.3, roe: 16.8, roce: 18.2, debt_to_equity: 6.2, dividend_yield: 1.1, promoter_holding: 25.5 },
  { symbol: 'RELIANCE', name: 'Reliance Industries', ltp: 1414.40, change_pct: 2.16, market_cap: 1900000, pe_ratio: 25.8, roe: 9.5, roce: 12.3, debt_to_equity: 0.38, dividend_yield: 0.4, promoter_holding: 50.3 },
  { symbol: 'ITC', name: 'ITC Ltd', ltp: 456.20, change_pct: 0.45, market_cap: 480000, pe_ratio: 28.2, roe: 28.5, roce: 35.2, debt_to_equity: 0.01, dividend_yield: 3.2, promoter_holding: 0 },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance', ltp: 7250.30, change_pct: -1.20, market_cap: 420000, pe_ratio: 35.6, roe: 22.4, roce: 14.8, debt_to_equity: 3.5, dividend_yield: 0.5, promoter_holding: 54.7 },
  { symbol: 'SUNPHARMA', name: 'Sun Pharma', ltp: 1245.60, change_pct: 3.45, market_cap: 300000, pe_ratio: 38.2, roe: 14.2, roce: 16.5, debt_to_equity: 0.12, dividend_yield: 0.8, promoter_holding: 54.5 },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', ltp: 785.40, change_pct: 2.80, market_cap: 230000, pe_ratio: 12.5, roe: 28.9, roce: 18.7, debt_to_equity: 1.2, dividend_yield: 0.6, promoter_holding: 46.4 },
];

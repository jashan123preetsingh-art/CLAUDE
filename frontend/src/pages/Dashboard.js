import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { stocksAPI, newsAPI, fiiDiiAPI } from '../utils/api';
import { formatCurrency, formatPercent, formatVolume, getChangeColor, timeAgo } from '../utils/format';

const POPULAR_SCANNERS = [
  { key: 'top_gainers', name: 'TOP GAINERS' },
  { key: 'top_losers', name: 'TOP LOSERS' },
  { key: 'most_active', name: 'MOST ACTIVE' },
  { key: 'week_52_high_breakout', name: '52W HIGH' },
  { key: 'up_5pct_high_vol', name: 'UP >5% + VOL' },
  { key: 'gap_up', name: 'GAP UP' },
];

function SectionHeader({ title, badge, link, linkText }) {
  return (
    <div className="t-header flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span>{title}</span>
        {badge && <span className="t-badge bg-terminal-green/10 text-terminal-green">{badge}</span>}
      </div>
      {link && <Link to={link} className="text-terminal-blue hover:underline text-[9px]">{linkText || 'MORE'} &rarr;</Link>}
    </div>
  );
}

function StockRow({ stock, rank }) {
  return (
    <Link to={`/stock/${stock.symbol}`} className="flex items-center justify-between py-1.5 px-2.5 hover:bg-terminal-card-hover transition-colors group">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono text-terminal-muted w-3">{rank}</span>
        <div>
          <p className="text-[11px] font-mono font-semibold text-white group-hover:text-terminal-cyan transition-colors">{stock.symbol}</p>
          <p className="text-[9px] text-terminal-muted truncate max-w-[100px]">{stock.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[11px] font-mono text-white">{formatCurrency(stock.ltp)}</p>
        <p className={`text-[10px] font-mono font-semibold ${getChangeColor(stock.change_pct)}`}>{formatPercent(stock.change_pct)}</p>
      </div>
    </Link>
  );
}

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
      if (newsRes.status === 'fulfilled') setNews(Array.isArray(newsRes.value.data) ? newsRes.value.data.slice(0, 8) : []);
      if (fiiRes.status === 'fulfilled') setFiiDii(fiiRes.value.data);
      if (idxRes.status === 'fulfilled') setIndices(idxRes.value.data || []);
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 max-w-[1800px] mx-auto">
      {/* Index Cards */}
      {indices.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {indices.map((idx, i) => (
            <div key={i} className="t-card px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-terminal-muted font-semibold tracking-wide">{idx.symbol}</span>
                <span className={`t-badge ${idx.change_pct >= 0 ? 'bg-terminal-green/10 text-terminal-green' : 'bg-terminal-red/10 text-terminal-red'}`}>
                  {idx.change_pct >= 0 ? 'BULL' : 'BEAR'}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold font-mono text-white">{Number(idx.ltp).toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
                <span className={`text-xs font-mono font-semibold ${getChangeColor(idx.change_pct)}`}>
                  {formatPercent(idx.change_pct)}
                </span>
              </div>
              <div className="flex gap-3 mt-1 text-[9px] font-mono text-terminal-muted">
                <span>O: {Number(idx.open).toLocaleString('en-IN')}</span>
                <span>H: {Number(idx.high).toLocaleString('en-IN')}</span>
                <span>L: {Number(idx.low).toLocaleString('en-IN')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-terminal-green/30 border-t-terminal-green rounded-full animate-spin" />
            <p className="text-terminal-muted text-xs font-mono">LOADING MARKET DATA...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-2">
          {/* Top Gainers */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-12 lg:col-span-4">
            <div className="t-card overflow-hidden">
              <SectionHeader title="TOP GAINERS" badge="LIVE" link="/scanner/top_gainers" linkText="ALL" />
              <div className="divide-y divide-terminal-border/30">
                {(overview?.topGainers || []).slice(0, 8).map((stock, i) => (
                  <StockRow key={i} stock={stock} rank={i + 1} />
                ))}
                {(!overview?.topGainers?.length) && (
                  <p className="text-terminal-muted text-[10px] font-mono text-center py-6">AWAITING MARKET DATA...</p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Top Losers */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.05 } }} className="col-span-12 lg:col-span-4">
            <div className="t-card overflow-hidden">
              <SectionHeader title="TOP LOSERS" badge="LIVE" link="/scanner/top_losers" linkText="ALL" />
              <div className="divide-y divide-terminal-border/30">
                {(overview?.topLosers || []).slice(0, 8).map((stock, i) => (
                  <StockRow key={i} stock={stock} rank={i + 1} />
                ))}
                {(!overview?.topLosers?.length) && (
                  <p className="text-terminal-muted text-[10px] font-mono text-center py-6">AWAITING MARKET DATA...</p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Most Active */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.1 } }} className="col-span-12 lg:col-span-4">
            <div className="t-card overflow-hidden">
              <SectionHeader title="MOST ACTIVE" badge="VOL" link="/scanner/most_active" linkText="ALL" />
              <div className="divide-y divide-terminal-border/30">
                {(overview?.mostActive || []).slice(0, 8).map((stock, i) => (
                  <Link key={i} to={`/stock/${stock.symbol}`} className="flex items-center justify-between py-1.5 px-2.5 hover:bg-terminal-card-hover transition-colors group">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-terminal-muted w-3">{i + 1}</span>
                      <div>
                        <p className="text-[11px] font-mono font-semibold text-white group-hover:text-terminal-cyan transition-colors">{stock.symbol}</p>
                        <p className="text-[9px] text-terminal-muted">{formatVolume(stock.volume)} vol</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-mono text-white">{formatCurrency(stock.ltp)}</p>
                      <p className={`text-[10px] font-mono font-semibold ${getChangeColor(stock.change_pct)}`}>{formatPercent(stock.change_pct)}</p>
                    </div>
                  </Link>
                ))}
                {(!overview?.mostActive?.length) && (
                  <p className="text-terminal-muted text-[10px] font-mono text-center py-6">AWAITING MARKET DATA...</p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Sector Performance */}
          {overview?.sectorPerformance?.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.15 } }} className="col-span-12 lg:col-span-6">
              <div className="t-card overflow-hidden">
                <SectionHeader title="SECTOR PERFORMANCE" link="/sectors" linkText="VIEW ALL" />
                <div className="divide-y divide-terminal-border/30">
                  {overview.sectorPerformance.slice(0, 10).map((sec, i) => (
                    <Link key={i} to={`/sectors/${encodeURIComponent(sec.sector)}`}
                      className="flex items-center justify-between py-1.5 px-2.5 hover:bg-terminal-card-hover transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-terminal-muted w-3">{i + 1}</span>
                        <span className="text-[11px] font-mono text-terminal-text">{sec.sector}</span>
                        <span className="text-[9px] font-mono text-terminal-muted">({sec.count})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`h-1 rounded-full ${sec.avg_change >= 0 ? 'bg-terminal-green' : 'bg-terminal-red'}`}
                          style={{ width: `${Math.min(Math.abs(sec.avg_change) * 20, 60)}px` }} />
                        <span className={`text-[10px] font-mono font-semibold w-14 text-right ${getChangeColor(sec.avg_change)}`}>
                          {formatPercent(sec.avg_change)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Quick Scanners + FII/DII */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.2 } }} className="col-span-12 lg:col-span-6">
            {/* Quick Scanners */}
            <div className="t-card overflow-hidden mb-2">
              <SectionHeader title="QUICK SCANNERS" link="/scanner" linkText="ALL SCANS" />
              <div className="p-2 grid grid-cols-3 gap-1.5">
                {POPULAR_SCANNERS.map(scanner => (
                  <Link key={scanner.key} to={`/scanner/${scanner.key}`}
                    className="t-btn t-btn-default text-center py-2 hover:border-terminal-cyan/30 hover:text-terminal-cyan">
                    {scanner.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* FII/DII */}
            <div className="t-card overflow-hidden">
              <SectionHeader title="FII & DII FLOWS" link="/fii-dii" linkText="FULL DATA" />
              <div className="grid grid-cols-2 gap-px bg-terminal-border">
                <div className="bg-terminal-card p-3">
                  <p className="text-[9px] font-mono text-terminal-muted mb-1">FII / FPI NET</p>
                  <p className={`text-lg font-bold font-mono ${getChangeColor(fiiDii?.fii_net)}`}>
                    {fiiDii?.fii_net != null ? formatCurrency(fiiDii.fii_net, true) : '---'}
                  </p>
                  {fiiDii?.source === 'nse_live' && (
                    <span className="t-badge bg-terminal-green/10 text-terminal-green mt-1 inline-block">NSE LIVE</span>
                  )}
                </div>
                <div className="bg-terminal-card p-3">
                  <p className="text-[9px] font-mono text-terminal-muted mb-1">DII NET</p>
                  <p className={`text-lg font-bold font-mono ${getChangeColor(fiiDii?.dii_net)}`}>
                    {fiiDii?.dii_net != null ? formatCurrency(fiiDii.dii_net, true) : '---'}
                  </p>
                  {fiiDii?.source === 'nse_live' && (
                    <span className="t-badge bg-terminal-green/10 text-terminal-green mt-1 inline-block">NSE LIVE</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Market News */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.25 } }} className="col-span-12">
            <div className="t-card overflow-hidden">
              <SectionHeader title="MARKET NEWS" link="/news" linkText="ALL NEWS" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-terminal-border">
                {news.map((article, i) => (
                  <a key={i} href={article.url} target="_blank" rel="noopener noreferrer"
                    className="bg-terminal-card p-3 hover:bg-terminal-card-hover transition-colors group">
                    <p className="text-[11px] text-terminal-text group-hover:text-white transition-colors line-clamp-2 mb-2 leading-relaxed">{article.title}</p>
                    <div className="flex items-center gap-2 text-[9px] font-mono text-terminal-muted">
                      <span className="text-terminal-cyan">{article.source}</span>
                      <span>&bull;</span>
                      <span>{timeAgo(article.published_at)}</span>
                    </div>
                  </a>
                ))}
                {news.length === 0 && (
                  <p className="text-terminal-muted text-[10px] font-mono text-center py-6 col-span-4">LOADING NEWS FEED...</p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

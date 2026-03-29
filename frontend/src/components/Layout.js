import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import useStore from '../store/useStore';

const NAV_ITEMS = [
  { path: '/', label: 'DASHBOARD', shortcut: 'F1', icon: 'DH' },
  { path: '/charts', label: 'CHARTS', shortcut: 'F2', icon: 'CH' },
  { path: '/heatmap', label: 'HEATMAP', shortcut: 'F3', icon: 'HM' },
  { path: '/scanner', label: 'SCANNER', shortcut: 'F4', icon: 'SC' },
  { path: '/screener', label: 'SCREENER', shortcut: 'F5', icon: 'SR' },
  { path: '/options', label: 'OPTIONS', shortcut: 'F6', icon: 'OC' },
  { path: '/patterns', label: 'PATTERNS', shortcut: 'F7', icon: 'CP' },
  { path: '/sectors', label: 'SECTORS', shortcut: 'F8', icon: 'SE' },
  { path: '/fii-dii', label: 'FII/DII', shortcut: 'F9', icon: 'FD' },
  { path: '/news', label: 'NEWS', shortcut: 'F10', icon: 'NW' },
];

function MarketTicker() {
  const [tickerData, setTickerData] = useState([]);

  useEffect(() => {
    const fetchTicker = async () => {
      try {
        const res = await fetch((process.env.REACT_APP_API_URL || 'http://localhost:5000/api') + '/stocks/indices');
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) setTickerData(data);
      } catch {}
    };
    fetchTicker();
    const interval = setInterval(fetchTicker, 30000);
    return () => clearInterval(interval);
  }, []);

  if (tickerData.length === 0) return null;

  return (
    <div className="flex items-center gap-6">
      {tickerData.map((idx, i) => (
        <div key={i} className="flex items-center gap-2 font-mono text-[11px]">
          <span className="text-terminal-muted font-semibold">{idx.symbol}</span>
          <span className="text-white">{Number(idx.ltp).toLocaleString('en-IN', {maximumFractionDigits: 2})}</span>
          <span className={idx.change_pct >= 0 ? 'text-terminal-green' : 'text-terminal-red'}>
            {idx.change_pct >= 0 ? '+' : ''}{Number(idx.change_pct).toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const { sidebarOpen, toggleSidebar, wsConnected } = useStore();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isMarketOpen = () => {
    const now = new Date();
    const hours = now.getHours();
    const mins = now.getMinutes();
    const day = now.getDay();
    if (day === 0 || day === 6) return false;
    const timeVal = hours * 60 + mins;
    return timeVal >= 555 && timeVal <= 930; // 9:15 AM to 3:30 PM
  };

  return (
    <div className="flex flex-col h-screen bg-terminal-bg overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-10 bg-terminal-header border-b border-terminal-border flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-terminal-green to-terminal-cyan flex items-center justify-center">
              <span className="text-[8px] font-black text-terminal-bg">SP</span>
            </div>
            <span className="text-xs font-bold text-white tracking-wider font-mono">STOCKPULSE</span>
            <span className="text-[10px] text-terminal-muted font-mono">TERMINAL</span>
          </div>
          <div className="w-px h-4 bg-terminal-border" />
          <MarketTicker />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${isMarketOpen() ? 'bg-terminal-green animate-pulse' : 'bg-terminal-muted'}`} />
            <span className="text-[10px] font-mono text-terminal-muted">
              {isMarketOpen() ? 'MKT OPEN' : 'MKT CLOSED'}
            </span>
          </div>
          <div className="w-px h-4 bg-terminal-border" />
          <span className="text-[10px] font-mono text-terminal-muted">
            {time.toLocaleTimeString('en-IN', { hour12: false })} IST
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-44' : 'w-12'} flex-shrink-0 bg-terminal-sidebar border-r border-terminal-border flex flex-col transition-all duration-200`}>
          <nav className="flex-1 py-1 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-2 py-1.5 text-[11px] font-mono transition-all duration-100 border-l-2
                    ${isActive
                      ? 'border-terminal-green bg-terminal-green/5 text-terminal-green'
                      : 'border-transparent text-terminal-text hover:text-white hover:bg-white/3'
                    }`}
                >
                  <span className={`w-5 text-center text-[10px] font-bold flex-shrink-0 ${isActive ? 'text-terminal-green' : 'text-terminal-muted'}`}>
                    {item.icon}
                  </span>
                  {sidebarOpen && (
                    <>
                      <span className="flex-1 tracking-wide">{item.label}</span>
                      <span className="text-[8px] text-terminal-muted">{item.shortcut}</span>
                    </>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-2 border-t border-terminal-border">
            <button
              onClick={toggleSidebar}
              className="w-full flex items-center gap-2 text-terminal-muted hover:text-terminal-text text-[10px] font-mono transition-colors py-1"
            >
              <span className="text-xs">{sidebarOpen ? '\u00AB' : '\u00BB'}</span>
              {sidebarOpen && <span>COLLAPSE</span>}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-terminal-bg">
          <div className="min-h-full">{children}</div>
        </main>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-6 bg-terminal-header border-t border-terminal-border flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-terminal-green' : 'bg-terminal-red'}`} />
            <span className="text-[9px] font-mono text-terminal-muted">
              {wsConnected ? 'WS:CONNECTED' : 'WS:OFFLINE'}
            </span>
          </div>
          <span className="text-[9px] font-mono text-terminal-muted">NSE+BSE</span>
          <span className="text-[9px] font-mono text-terminal-muted">DATA:YAHOO+NSE</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[9px] font-mono text-terminal-muted">
            {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
          </span>
          <span className="text-[9px] font-mono text-terminal-green">STOCKPULSE v2.0</span>
        </div>
      </footer>
    </div>
  );
}

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import useStore from '../store/useStore';

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/scanner', label: 'Scanner', icon: '📡' },
  { path: '/screener', label: 'Screener', icon: '🔍' },
  { path: '/charts', label: 'Charts', icon: '📈' },
  { path: '/options', label: 'Options', icon: '⚡' },
  { path: '/fii-dii', label: 'FII & DII', icon: '💰' },
  { path: '/news', label: 'News', icon: '📰' },
  { path: '/alerts', label: 'Alerts', icon: '🔔' },
];

export default function Layout({ children }) {
  const location = useLocation();
  const { sidebarOpen, toggleSidebar, wsConnected } = useStore();

  return (
    <div className="flex h-screen bg-dark-950 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-56' : 'w-16'} flex-shrink-0 bg-dark-900 border-r border-dark-800
                         flex flex-col transition-all duration-300 ease-in-out`}>
        {/* Logo */}
        <div className="p-4 border-b border-dark-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-green to-accent-blue flex items-center justify-center text-dark-950 font-bold text-sm">
            SP
          </div>
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
              <span className="text-sm font-bold text-white">StockPulse</span>
              <span className="text-[10px] text-dark-500">NSE + BSE</span>
            </motion.div>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200
                  ${isActive
                    ? 'bg-accent-green/10 text-accent-green border border-accent-green/20'
                    : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
                  }`}
              >
                <span className="text-base flex-shrink-0">{item.icon}</span>
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Status */}
        <div className="p-3 border-t border-dark-800">
          <button onClick={toggleSidebar} className="w-full flex items-center gap-2 text-dark-500 hover:text-dark-300 text-xs transition-colors">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-accent-green' : 'bg-dark-600'}`} />
            {sidebarOpen && <span>{wsConnected ? 'Live' : 'Offline'}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}

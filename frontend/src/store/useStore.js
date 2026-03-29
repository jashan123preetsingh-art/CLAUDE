import { create } from 'zustand';

const useStore = create((set, get) => ({
  // Theme
  darkMode: true,

  // User
  user: null,
  token: localStorage.getItem('token'),
  setUser: (user, token) => {
    if (token) localStorage.setItem('token', token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  // Market data
  marketOverview: null,
  setMarketOverview: (data) => set({ marketOverview: data }),

  // Scanner
  activeScannerKey: null,
  scannerResults: null,
  setActiveScannerKey: (key) => set({ activeScannerKey: key }),
  setScannerResults: (results) => set({ scannerResults: results }),

  // Selected stock
  selectedStock: null,
  setSelectedStock: (stock) => set({ selectedStock: stock }),

  // Watchlist
  watchlist: JSON.parse(localStorage.getItem('watchlist') || '[]'),
  addToWatchlist: (symbol) => {
    const current = get().watchlist;
    if (!current.includes(symbol)) {
      const updated = [...current, symbol];
      localStorage.setItem('watchlist', JSON.stringify(updated));
      set({ watchlist: updated });
    }
  },
  removeFromWatchlist: (symbol) => {
    const updated = get().watchlist.filter(s => s !== symbol);
    localStorage.setItem('watchlist', JSON.stringify(updated));
    set({ watchlist: updated });
  },

  // WebSocket connection status
  wsConnected: false,
  setWsConnected: (val) => set({ wsConnected: val }),

  // Sidebar
  sidebarOpen: true,
  toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
}));

export default useStore;

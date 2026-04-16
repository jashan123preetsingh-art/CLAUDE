import { create } from "zustand";
import { Asset, Alert, Watchlist, TimeFrame } from "@/types";

interface AtlasStore {
  // Active state
  selectedAsset: string | null;
  selectedTimeFrame: TimeFrame;
  activeTab: string;
  sidebarOpen: boolean;

  // Data
  watchlists: Watchlist[];
  alerts: Alert[];
  favorites: string[];

  // Actions
  setSelectedAsset: (symbol: string | null) => void;
  setSelectedTimeFrame: (tf: TimeFrame) => void;
  setActiveTab: (tab: string) => void;
  toggleSidebar: () => void;
  addToFavorites: (symbol: string) => void;
  removeFromFavorites: (symbol: string) => void;
  addAlert: (alert: Alert) => void;
  removeAlert: (id: string) => void;
  toggleAlert: (id: string) => void;
}

export const useStore = create<AtlasStore>((set) => ({
  selectedAsset: null,
  selectedTimeFrame: "1D",
  activeTab: "overview",
  sidebarOpen: true,

  watchlists: [
    {
      id: "w1",
      userId: "u1",
      name: "Main Watchlist",
      assets: ["BTC/USD", "ETH/USD", "SOL/USD", "XAU/USD", "EUR/USD"],
      createdAt: new Date().toISOString(),
    },
  ],
  alerts: [
    {
      id: "a1", userId: "u1", type: "price", asset: "BTC/USD",
      condition: "above", value: 100000, channels: ["email", "telegram"],
      isActive: true, createdAt: new Date().toISOString(),
    },
    {
      id: "a2", userId: "u1", type: "whale", asset: "BTC",
      condition: "transfer_above", value: 1000, channels: ["telegram"],
      isActive: true, createdAt: new Date().toISOString(),
    },
  ],
  favorites: ["BTC/USD", "ETH/USD", "SOL/USD", "XAU/USD"],

  setSelectedAsset: (symbol) => set({ selectedAsset: symbol }),
  setSelectedTimeFrame: (tf) => set({ selectedTimeFrame: tf }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  addToFavorites: (symbol) =>
    set((s) => ({ favorites: [...s.favorites, symbol] })),
  removeFromFavorites: (symbol) =>
    set((s) => ({ favorites: s.favorites.filter((f) => f !== symbol) })),
  addAlert: (alert) => set((s) => ({ alerts: [...s.alerts, alert] })),
  removeAlert: (id) =>
    set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
  toggleAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id ? { ...a, isActive: !a.isActive } : a
      ),
    })),
}));

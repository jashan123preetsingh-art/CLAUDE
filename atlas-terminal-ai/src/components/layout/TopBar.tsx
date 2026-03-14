"use client";

import { Search, Bell, User, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useState } from "react";
import { getAllAssets } from "@/services/marketData";
import { formatCurrency, formatPercent, getChangeColor } from "@/lib/utils";
import Link from "next/link";

export default function TopBar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const assets = getAllAssets();

  const filteredAssets = searchQuery.length > 0
    ? assets.filter(
        (a) =>
          a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Ticker tape data
  const tickerAssets = assets.slice(0, 8);

  return (
    <header className="h-14 bg-atlas-surface border-b border-atlas-border flex items-center justify-between px-4 gap-4">
      {/* Ticker Tape */}
      <div className="flex-1 flex items-center gap-6 overflow-hidden">
        {tickerAssets.map((asset) => (
          <Link
            key={asset.id}
            href={`/asset/${asset.id}`}
            className="flex items-center gap-2 text-xs whitespace-nowrap hover:opacity-80 transition-opacity"
          >
            <span className="font-mono font-medium text-atlas-text">{asset.symbol}</span>
            <span className="font-mono">{formatCurrency(asset.price, asset.price < 10 ? 4 : 2)}</span>
            <span className={`font-mono flex items-center gap-0.5 ${getChangeColor(asset.changePercent24h)}`}>
              {asset.changePercent24h > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : asset.changePercent24h < 0 ? (
                <TrendingDown className="w-3 h-3" />
              ) : (
                <Minus className="w-3 h-3" />
              )}
              {formatPercent(asset.changePercent24h)}
            </span>
          </Link>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <div className="flex items-center gap-2 bg-atlas-card border border-atlas-border rounded-lg px-3 py-1.5">
          <Search className="w-4 h-4 text-atlas-muted" />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearch(e.target.value.length > 0);
            }}
            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
            className="bg-transparent text-sm text-atlas-text placeholder:text-atlas-muted outline-none w-40"
          />
          <kbd className="text-[10px] text-atlas-muted bg-atlas-surface px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </div>

        {showSearch && filteredAssets.length > 0 && (
          <div className="absolute top-full right-0 mt-2 w-72 bg-atlas-card border border-atlas-border rounded-lg shadow-xl overflow-hidden z-50">
            {filteredAssets.slice(0, 6).map((asset) => (
              <Link
                key={asset.id}
                href={`/asset/${asset.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-atlas-surface transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-atlas-text">{asset.symbol}</p>
                  <p className="text-xs text-atlas-muted">{asset.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono">{formatCurrency(asset.price, asset.price < 10 ? 4 : 2)}</p>
                  <p className={`text-xs font-mono ${getChangeColor(asset.changePercent24h)}`}>
                    {formatPercent(asset.changePercent24h)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <button className="relative p-2 text-atlas-muted hover:text-atlas-text transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-atlas-accent" />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-atlas-accent to-atlas-purple flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
      </div>
    </header>
  );
}

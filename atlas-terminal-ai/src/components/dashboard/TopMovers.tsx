"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { getTopMovers } from "@/services/marketData";
import { formatCurrency, formatPercent, getChangeColor } from "@/lib/utils";
import Link from "next/link";

export default function TopMovers() {
  const { gainers, losers } = getTopMovers();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Top Gainers */}
      <div className="bg-atlas-card border border-atlas-border rounded-xl">
        <div className="flex items-center gap-2 p-4 border-b border-atlas-border">
          <TrendingUp className="w-4 h-4 text-atlas-green" />
          <h3 className="text-sm font-semibold text-white">Top Gainers</h3>
        </div>
        <div className="divide-y divide-atlas-border/50">
          {gainers.map((asset, i) => (
            <Link
              key={asset.id}
              href={`/asset/${asset.id}`}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-atlas-surface/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-atlas-muted w-4">{i + 1}</span>
                <div>
                  <p className="text-sm font-medium text-white">{asset.symbol}</p>
                  <p className="text-xs text-atlas-muted">{asset.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono">{formatCurrency(asset.price, asset.price < 10 ? 4 : 2)}</p>
                <p className="text-xs font-mono text-atlas-green">{formatPercent(asset.changePercent24h)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Top Losers */}
      <div className="bg-atlas-card border border-atlas-border rounded-xl">
        <div className="flex items-center gap-2 p-4 border-b border-atlas-border">
          <TrendingDown className="w-4 h-4 text-atlas-red" />
          <h3 className="text-sm font-semibold text-white">Top Losers</h3>
        </div>
        <div className="divide-y divide-atlas-border/50">
          {losers.map((asset, i) => (
            <Link
              key={asset.id}
              href={`/asset/${asset.id}`}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-atlas-surface/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-atlas-muted w-4">{i + 1}</span>
                <div>
                  <p className="text-sm font-medium text-white">{asset.symbol}</p>
                  <p className="text-xs text-atlas-muted">{asset.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono">{formatCurrency(asset.price, asset.price < 10 ? 4 : 2)}</p>
                <p className="text-xs font-mono text-atlas-red">{formatPercent(asset.changePercent24h)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

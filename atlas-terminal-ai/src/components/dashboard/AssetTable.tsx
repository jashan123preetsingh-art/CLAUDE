"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, ArrowUpDown } from "lucide-react";
import { Asset } from "@/types";
import { formatCurrency, formatPercent, formatCompactNumber, getChangeColor, cn } from "@/lib/utils";
import { getAllAssets } from "@/services/marketData";
import { useStore } from "@/store/useStore";
import SparklineChart from "@/components/charts/SparklineChart";

type SortKey = "symbol" | "price" | "changePercent24h" | "volume24h" | "marketCap";

export default function AssetTable() {
  const [filter, setFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("marketCap");
  const [sortAsc, setSortAsc] = useState(false);
  const { favorites, addToFavorites, removeFromFavorites } = useStore();

  const allAssets = getAllAssets();
  const filtered = filter === "all"
    ? allAssets
    : filter === "favorites"
    ? allAssets.filter((a) => favorites.includes(a.symbol))
    : allAssets.filter((a) => a.class === filter);

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortKey] ?? 0;
    const bVal = b[sortKey] ?? 0;
    if (typeof aVal === "string" && typeof bVal === "string") return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const filters = [
    { label: "All", value: "all" },
    { label: "★", value: "favorites" },
    { label: "Crypto", value: "crypto" },
    { label: "Forex", value: "forex" },
    { label: "Indices", value: "index" },
    { label: "Commodities", value: "commodity" },
  ];

  return (
    <div className="bg-atlas-card border border-atlas-border rounded-xl overflow-hidden">
      {/* Filters */}
      <div className="flex items-center gap-1 p-3 border-b border-atlas-border">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              filter === f.value
                ? "bg-atlas-accent/10 text-atlas-accent border border-atlas-accent/20"
                : "text-atlas-muted hover:text-atlas-text hover:bg-atlas-surface"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-atlas-border text-xs text-atlas-muted">
              <th className="px-4 py-3 text-left w-8"></th>
              <th className="px-4 py-3 text-left cursor-pointer hover:text-atlas-text" onClick={() => handleSort("symbol")}>
                <span className="flex items-center gap-1">Asset <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th className="px-4 py-3 text-right cursor-pointer hover:text-atlas-text" onClick={() => handleSort("price")}>
                <span className="flex items-center justify-end gap-1">Price <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th className="px-4 py-3 text-right cursor-pointer hover:text-atlas-text" onClick={() => handleSort("changePercent24h")}>
                <span className="flex items-center justify-end gap-1">24h % <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th className="px-4 py-3 text-right hidden md:table-cell cursor-pointer hover:text-atlas-text" onClick={() => handleSort("volume24h")}>
                <span className="flex items-center justify-end gap-1">Volume <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th className="px-4 py-3 text-right hidden lg:table-cell cursor-pointer hover:text-atlas-text" onClick={() => handleSort("marketCap")}>
                <span className="flex items-center justify-end gap-1">Market Cap <ArrowUpDown className="w-3 h-3" /></span>
              </th>
              <th className="px-4 py-3 text-right hidden lg:table-cell">7D Chart</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((asset) => {
              const isFav = favorites.includes(asset.symbol);
              return (
                <tr
                  key={asset.id}
                  className="border-b border-atlas-border/50 hover:bg-atlas-surface/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => isFav ? removeFromFavorites(asset.symbol) : addToFavorites(asset.symbol)}
                      className="text-atlas-muted hover:text-atlas-yellow transition-colors"
                    >
                      <Star className={cn("w-4 h-4", isFav && "fill-atlas-yellow text-atlas-yellow")} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/asset/${asset.id}`} className="flex items-center gap-3 hover:opacity-80">
                      <div>
                        <p className="text-sm font-medium text-white">{asset.symbol}</p>
                        <p className="text-xs text-atlas-muted">{asset.name}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-white">
                    {formatCurrency(asset.price, asset.price < 10 ? 4 : 2)}
                  </td>
                  <td className={cn("px-4 py-3 text-right font-mono text-sm", getChangeColor(asset.changePercent24h))}>
                    {formatPercent(asset.changePercent24h)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-atlas-muted hidden md:table-cell">
                    {formatCurrency(asset.volume24h)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-atlas-muted hidden lg:table-cell">
                    {asset.marketCap ? formatCurrency(asset.marketCap) : "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="w-24 h-8 ml-auto">
                      {asset.sparkline && (
                        <SparklineChart data={asset.sparkline} positive={asset.changePercent24h >= 0} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

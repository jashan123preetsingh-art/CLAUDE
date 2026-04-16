"use client";

import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, Globe } from "lucide-react";
import { formatCurrency, formatCompactNumber } from "@/lib/utils";
import { getAllAssets } from "@/services/marketData";

export default function MarketOverview() {
  const assets = getAllAssets();
  const cryptoAssets = assets.filter((a) => a.class === "crypto");
  const totalMarketCap = cryptoAssets.reduce((sum, a) => sum + (a.marketCap || 0), 0);
  const totalVolume = assets.reduce((sum, a) => sum + a.volume24h, 0);
  const gainers = assets.filter((a) => a.changePercent24h > 0).length;
  const btc = assets.find((a) => a.id === "btc");
  const btcDominance = btc?.marketCap ? ((btc.marketCap / totalMarketCap) * 100) : 0;

  const stats = [
    {
      label: "Total Crypto Market Cap",
      value: formatCurrency(totalMarketCap),
      change: "+2.1%",
      positive: true,
      icon: DollarSign,
    },
    {
      label: "24h Volume",
      value: formatCurrency(totalVolume),
      change: "+5.8%",
      positive: true,
      icon: BarChart3,
    },
    {
      label: "BTC Dominance",
      value: `${btcDominance.toFixed(1)}%`,
      change: "+0.3%",
      positive: true,
      icon: Activity,
    },
    {
      label: "Market Sentiment",
      value: `${gainers}/${assets.length} Up`,
      change: "Greed: 72",
      positive: true,
      icon: Globe,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-atlas-card border border-atlas-border rounded-xl p-4 hover:border-atlas-accent/30 transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-atlas-muted">{stat.label}</span>
            <stat.icon className="w-4 h-4 text-atlas-muted" />
          </div>
          <p className="text-xl font-bold text-white font-mono">{stat.value}</p>
          <div className="flex items-center gap-1 mt-1">
            {stat.positive ? (
              <TrendingUp className="w-3 h-3 text-atlas-green" />
            ) : (
              <TrendingDown className="w-3 h-3 text-atlas-red" />
            )}
            <span className={`text-xs font-mono ${stat.positive ? "text-atlas-green" : "text-atlas-red"}`}>
              {stat.change}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

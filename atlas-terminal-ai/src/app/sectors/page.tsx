"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { PieChart, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { getSectorData } from "@/services/marketData";
import { formatCurrency, formatPercent, getChangeColor, cn } from "@/lib/utils";
import Link from "next/link";

export default function SectorsPage() {
  const sectors = getSectorData();

  const getMomentumStyle = (momentum: string) => {
    switch (momentum) {
      case "gaining": return "bg-atlas-green/10 text-atlas-green border-atlas-green/20";
      case "losing": return "bg-atlas-red/10 text-atlas-red border-atlas-red/20";
      default: return "bg-atlas-yellow/10 text-atlas-yellow border-atlas-yellow/20";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <PieChart className="w-6 h-6 text-atlas-purple" />
            Sector Trends
          </h1>
          <p className="text-sm text-atlas-muted mt-0.5">
            Track capital rotation and momentum across crypto sectors
          </p>
        </div>

        {/* Sector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sectors.map((sector) => (
            <div
              key={sector.id}
              className="bg-atlas-card border border-atlas-border rounded-xl p-5 hover:border-atlas-accent/30 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{sector.name}</h3>
                <span className={cn("text-xs px-2 py-1 rounded-full border font-medium", getMomentumStyle(sector.momentum))}>
                  {sector.momentum}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-xs text-atlas-muted mb-1">24h Change</p>
                  <p className={cn("text-lg font-bold font-mono", getChangeColor(sector.change24h))}>
                    {formatPercent(sector.change24h)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-atlas-muted mb-1">7d Change</p>
                  <p className={cn("text-lg font-bold font-mono", getChangeColor(sector.change7d))}>
                    {formatPercent(sector.change7d)}
                  </p>
                </div>
              </div>

              <div className="mb-3">
                <p className="text-xs text-atlas-muted mb-1">Market Cap</p>
                <p className="text-sm font-mono text-white">{formatCurrency(sector.totalMarketCap)}</p>
              </div>

              {/* Top Assets */}
              <div className="border-t border-atlas-border pt-3">
                <p className="text-xs text-atlas-muted mb-2">Top Performers</p>
                <div className="space-y-2">
                  {sector.topAssets.map((asset) => (
                    <Link
                      key={asset.id}
                      href={`/asset/${asset.id}`}
                      className="flex items-center justify-between hover:bg-atlas-surface/50 rounded-lg px-2 py-1.5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{asset.symbol}</span>
                        <span className="text-xs text-atlas-muted">{asset.name}</span>
                      </div>
                      <span className={cn("text-xs font-mono", getChangeColor(asset.changePercent24h))}>
                        {formatPercent(asset.changePercent24h)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Capital Rotation Insight */}
        <div className="bg-atlas-card border border-atlas-accent/20 rounded-xl p-6 glow-blue">
          <h3 className="text-lg font-semibold text-white mb-3">Capital Rotation Analysis</h3>
          <p className="text-sm text-atlas-text leading-relaxed">
            Capital is rotating from <span className="text-atlas-red font-medium">Gaming</span> into{" "}
            <span className="text-atlas-green font-medium">AI Tokens</span> and{" "}
            <span className="text-atlas-green font-medium">Memecoins</span>.{" "}
            The AI sector shows the strongest 7-day momentum at +22.1%, driven by growing adoption of
            decentralized compute networks. DeFi continues steady growth with TVL expansion across multiple
            chains. Watch for potential rotation into RWA tokens as institutional interest grows.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

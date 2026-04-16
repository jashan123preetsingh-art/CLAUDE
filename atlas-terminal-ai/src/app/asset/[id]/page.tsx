"use client";

import { use } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  TrendingUp, TrendingDown, Brain, Target, Shield, Zap,
  AlertTriangle, BarChart3, Activity, ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { getAssetBySymbol, getAIAnalysis, getAllAssets } from "@/services/marketData";
import { formatCurrency, formatPercent, getChangeColor, cn } from "@/lib/utils";
import SparklineChart from "@/components/charts/SparklineChart";

export default function AssetAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const asset = getAssetBySymbol(id) || getAllAssets()[0];
  const analysis = getAIAnalysis(id);

  const metrics = [
    { label: "24h High", value: formatCurrency(asset.high24h, asset.high24h < 10 ? 4 : 2) },
    { label: "24h Low", value: formatCurrency(asset.low24h, asset.low24h < 10 ? 4 : 2) },
    { label: "24h Volume", value: formatCurrency(asset.volume24h) },
    { label: "Market Cap", value: asset.marketCap ? formatCurrency(asset.marketCap) : "N/A" },
    { label: "Volatility", value: asset.volatility ? `${asset.volatility}%` : "N/A" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Back + Header */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-atlas-card rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-atlas-muted" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{asset.symbol}</h1>
              <span className="text-sm text-atlas-muted">{asset.name}</span>
              <span className="text-xs bg-atlas-card border border-atlas-border px-2 py-0.5 rounded-full text-atlas-muted uppercase">
                {asset.class}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-3xl font-bold font-mono text-white">
                {formatCurrency(asset.price, asset.price < 10 ? 4 : 2)}
              </span>
              <span className={cn("text-lg font-mono flex items-center gap-1", getChangeColor(asset.changePercent24h))}>
                {asset.changePercent24h >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                {formatPercent(asset.changePercent24h)}
              </span>
            </div>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="bg-atlas-card border border-atlas-border rounded-lg p-3">
              <p className="text-xs text-atlas-muted mb-1">{m.label}</p>
              <p className="text-sm font-mono font-medium text-white">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Chart Placeholder */}
        <div className="bg-atlas-card border border-atlas-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Price Chart</h2>
            <div className="flex gap-1">
              {["1H", "4H", "1D", "1W", "1M"].map((tf) => (
                <button
                  key={tf}
                  className={cn(
                    "px-3 py-1 rounded text-xs font-mono transition-colors",
                    tf === "1D"
                      ? "bg-atlas-accent/10 text-atlas-accent border border-atlas-accent/20"
                      : "text-atlas-muted hover:text-atlas-text"
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64 flex items-center justify-center">
            {asset.sparkline && (
              <div className="w-full h-full">
                <SparklineChart
                  data={asset.sparkline}
                  positive={asset.changePercent24h >= 0}
                  width={800}
                  height={240}
                />
              </div>
            )}
          </div>
        </div>

        {/* AI Analysis */}
        <div className="bg-atlas-card border border-atlas-accent/20 rounded-xl p-6 glow-blue">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-atlas-accent" />
            <h2 className="text-lg font-semibold text-white">AI Analysis</h2>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium",
              analysis.sentiment === "bullish" ? "bg-atlas-green/10 text-atlas-green" :
              analysis.sentiment === "bearish" ? "bg-atlas-red/10 text-atlas-red" :
              "bg-atlas-yellow/10 text-atlas-yellow"
            )}>
              {analysis.sentiment.toUpperCase()}
            </span>
            <span className="text-xs text-atlas-muted ml-auto">
              Confidence: {analysis.confidence}%
            </span>
          </div>

          <p className="text-sm text-atlas-text leading-relaxed mb-6">{analysis.summary}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Support Levels */}
            <div className="bg-atlas-surface rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-atlas-green" />
                <h3 className="text-sm font-medium text-white">Support Levels</h3>
              </div>
              <div className="space-y-2">
                {analysis.supportLevels.map((level, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-atlas-muted">S{i + 1}</span>
                    <span className="text-sm font-mono text-atlas-green">
                      {formatCurrency(level, level < 10 ? 4 : 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Resistance Levels */}
            <div className="bg-atlas-surface rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-atlas-red" />
                <h3 className="text-sm font-medium text-white">Resistance Levels</h3>
              </div>
              <div className="space-y-2">
                {analysis.resistanceLevels.map((level, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-atlas-muted">R{i + 1}</span>
                    <span className="text-sm font-mono text-atlas-red">
                      {formatCurrency(level, level < 10 ? 4 : 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Liquidity Zones */}
            <div className="bg-atlas-surface rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-atlas-cyan" />
                <h3 className="text-sm font-medium text-white">Liquidity Zones</h3>
              </div>
              <div className="space-y-2">
                {analysis.liquidityZones.map((zone, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm font-mono text-atlas-text">
                      {formatCurrency(zone.price, zone.price < 10 ? 4 : 0)}
                    </span>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded",
                      zone.strength === "high" ? "bg-atlas-accent/10 text-atlas-accent" :
                      zone.strength === "medium" ? "bg-atlas-yellow/10 text-atlas-yellow" :
                      "bg-atlas-muted/10 text-atlas-muted"
                    )}>
                      {zone.strength}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Key Factors */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-atlas-yellow" />
              Key Factors
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {analysis.keyFactors.map((factor, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-atlas-muted">
                  <AlertTriangle className="w-3 h-3 text-atlas-yellow mt-1 flex-shrink-0" />
                  {factor}
                </div>
              ))}
            </div>
          </div>

          {/* Prediction */}
          {analysis.prediction && (
            <div className="mt-6 p-4 bg-atlas-bg rounded-lg border border-atlas-border">
              <p className="text-xs text-atlas-muted mb-1">AI Prediction</p>
              <p className="text-sm text-atlas-text">{analysis.prediction}</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

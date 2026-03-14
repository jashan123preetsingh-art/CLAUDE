"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Fish, ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine,
  ExternalLink, Copy, TrendingUp, TrendingDown,
} from "lucide-react";
import { getWhaleTransactions } from "@/services/marketData";
import { formatCurrency, timeAgo, cn } from "@/lib/utils";

export default function WhaleTrackerPage() {
  const transactions = getWhaleTransactions();

  const stats = [
    { label: "Whale Txns (24h)", value: "847", change: "+12%", positive: true },
    { label: "Total Value Moved", value: "$2.4B", change: "+8%", positive: true },
    { label: "Exchange Inflows", value: "$890M", change: "-15%", positive: false },
    { label: "Exchange Outflows", value: "$1.2B", change: "+22%", positive: true },
  ];

  const getTypeStyle = (type: string) => {
    switch (type) {
      case "exchange_inflow": return { icon: ArrowDownToLine, color: "text-atlas-red", bg: "bg-atlas-red/10", label: "Exchange Inflow" };
      case "exchange_outflow": return { icon: ArrowUpFromLine, color: "text-atlas-green", bg: "bg-atlas-green/10", label: "Exchange Outflow" };
      default: return { icon: ArrowRightLeft, color: "text-atlas-yellow", bg: "bg-atlas-yellow/10", label: "Transfer" };
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Fish className="w-6 h-6 text-atlas-cyan" />
            Whale Tracker
          </h1>
          <p className="text-sm text-atlas-muted mt-0.5">
            Real-time large transaction monitoring across major blockchains
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-atlas-card border border-atlas-border rounded-xl p-4">
              <p className="text-xs text-atlas-muted mb-2">{stat.label}</p>
              <p className="text-xl font-bold font-mono text-white">{stat.value}</p>
              <span className={cn("text-xs font-mono flex items-center gap-1 mt-1",
                stat.positive ? "text-atlas-green" : "text-atlas-red"
              )}>
                {stat.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {stat.change}
              </span>
            </div>
          ))}
        </div>

        {/* Explanation */}
        <div className="bg-atlas-card border border-atlas-accent/20 rounded-xl p-4 glow-blue">
          <p className="text-sm text-atlas-text">
            <span className="font-semibold text-atlas-accent">How to read whale data: </span>
            <span className="text-atlas-green">Exchange Outflows</span> (coins leaving exchanges) are generally bullish — whales are accumulating.{" "}
            <span className="text-atlas-red">Exchange Inflows</span> (coins entering exchanges) may indicate selling pressure.{" "}
            <span className="text-atlas-yellow">Transfers</span> between wallets show whale repositioning.
          </p>
        </div>

        {/* Transaction List */}
        <div className="bg-atlas-card border border-atlas-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-atlas-border">
            <h2 className="text-sm font-semibold text-white">Recent Whale Transactions</h2>
          </div>
          <div className="divide-y divide-atlas-border/50">
            {transactions.map((tx) => {
              const style = getTypeStyle(tx.type);
              return (
                <div key={tx.id} className="px-4 py-4 hover:bg-atlas-surface/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", style.bg)}>
                        <style.icon className={cn("w-5 h-5", style.color)} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">
                            {tx.amount.toLocaleString()} {tx.asset}
                          </p>
                          <span className={cn("text-xs px-2 py-0.5 rounded font-medium", style.bg, style.color)}>
                            {style.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-atlas-muted">
                          <span className="font-mono">{tx.fromAddress}</span>
                          <ArrowRightLeft className="w-3 h-3" />
                          <span className="font-mono">{tx.toAddress}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono font-medium text-white">{formatCurrency(tx.usdValue)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-atlas-muted">{tx.blockchain}</span>
                        <span className="text-atlas-border">·</span>
                        <span className="text-xs text-atlas-muted">{timeAgo(tx.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

"use client";

import { Fish, ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { getWhaleTransactions } from "@/services/marketData";
import { formatCurrency, timeAgo, cn } from "@/lib/utils";
import Link from "next/link";

export default function WhaleActivityFeed() {
  const transactions = getWhaleTransactions().slice(0, 5);

  const getIcon = (type: string) => {
    switch (type) {
      case "exchange_inflow": return <ArrowDownToLine className="w-4 h-4 text-atlas-red" />;
      case "exchange_outflow": return <ArrowUpFromLine className="w-4 h-4 text-atlas-green" />;
      default: return <ArrowRightLeft className="w-4 h-4 text-atlas-yellow" />;
    }
  };

  const getLabel = (type: string) => {
    switch (type) {
      case "exchange_inflow": return "Exchange Inflow";
      case "exchange_outflow": return "Exchange Outflow";
      default: return "Transfer";
    }
  };

  return (
    <div className="bg-atlas-card border border-atlas-border rounded-xl">
      <div className="flex items-center justify-between p-4 border-b border-atlas-border">
        <div className="flex items-center gap-2">
          <Fish className="w-4 h-4 text-atlas-cyan" />
          <h3 className="text-sm font-semibold text-white">Whale Activity</h3>
        </div>
        <Link href="/whale-tracker" className="text-xs text-atlas-accent hover:underline">
          View all
        </Link>
      </div>
      <div className="divide-y divide-atlas-border/50">
        {transactions.map((tx) => (
          <div key={tx.id} className="px-4 py-3 hover:bg-atlas-surface/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getIcon(tx.type)}
                <div>
                  <p className="text-sm text-white">
                    {tx.amount.toLocaleString()} {tx.asset}
                  </p>
                  <p className="text-xs text-atlas-muted">
                    {getLabel(tx.type)} {tx.exchange ? `· ${tx.exchange}` : ""}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-atlas-muted">{formatCurrency(tx.usdValue)}</p>
                <p className="text-xs text-atlas-muted/70">{timeAgo(tx.timestamp)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

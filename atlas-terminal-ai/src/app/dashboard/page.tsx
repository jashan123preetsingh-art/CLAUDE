"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import MarketOverview from "@/components/dashboard/MarketOverview";
import AssetTable from "@/components/dashboard/AssetTable";
import TopMovers from "@/components/dashboard/TopMovers";
import WhaleActivityFeed from "@/components/dashboard/WhaleActivityFeed";
import NewsFeed from "@/components/dashboard/NewsFeed";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Market Dashboard</h1>
            <p className="text-sm text-atlas-muted mt-0.5">Real-time market intelligence across all asset classes</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-atlas-muted">
            <div className="w-2 h-2 rounded-full bg-atlas-green pulse-live" />
            <span>Live · Last updated just now</span>
          </div>
        </div>

        {/* Market Overview Stats */}
        <MarketOverview />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Asset Table - 2 columns */}
          <div className="lg:col-span-2">
            <AssetTable />
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            <WhaleActivityFeed />
            <NewsFeed />
          </div>
        </div>

        {/* Top Movers */}
        <TopMovers />
      </div>
    </DashboardLayout>
  );
}

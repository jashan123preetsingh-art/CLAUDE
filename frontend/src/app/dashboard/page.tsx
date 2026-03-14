"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/lib/api";
import type { DashboardStats } from "@/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard/stats").then(({ data }) => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Leads"
          value={stats?.totalLeads || 0}
          subtitle={`${stats?.leadsUsed || 0} / ${stats?.leadsLimit || 0} used`}
        />
        <StatCard
          title="Searches"
          value={stats?.totalSearches || 0}
          subtitle="Total searches run"
        />
        <StatCard
          title="Campaigns"
          value={stats?.totalCampaigns || 0}
          subtitle="Outreach campaigns"
        />
        <StatCard
          title="Plan"
          value={stats?.plan || "STARTER"}
          subtitle="Current plan"
        />
      </div>

      {/* Lead Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border">
          <h2 className="text-lg font-semibold mb-4">Lead Pipeline</h2>
          <div className="space-y-3">
            {Object.entries(stats?.leadsByStatus || {}).map(([status, count]) => (
              <div key={status} className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {status.replace("_", " ")}
                </span>
                <span className="font-semibold">{count as number}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border">
          <h2 className="text-lg font-semibold mb-4">Campaign Performance</h2>
          <div className="space-y-3">
            {stats?.campaignStats?.map((c) => (
              <div
                key={c.id}
                className="flex justify-between items-center text-sm"
              >
                <span className="text-gray-600 truncate mr-4">{c.name}</span>
                <div className="flex gap-4 text-xs">
                  <span>Sent: {c.sentCount}</span>
                  <span>Opens: {c.openCount}</span>
                  <span>Replies: {c.replyCount}</span>
                </div>
              </div>
            ))}
            {!stats?.campaignStats?.length && (
              <p className="text-gray-500 text-sm">No campaigns yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Leads */}
      <div className="bg-white p-6 rounded-xl border">
        <h2 className="text-lg font-semibold mb-4">Recent Leads</h2>
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-gray-500 border-b">
              <th className="pb-3">Business</th>
              <th className="pb-3">Type</th>
              <th className="pb-3">City</th>
              <th className="pb-3">Score</th>
              <th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {stats?.recentLeads?.map((lead) => (
              <tr key={lead.id} className="border-b last:border-0">
                <td className="py-3 font-medium">{lead.name}</td>
                <td className="py-3 text-gray-600">{lead.businessType}</td>
                <td className="py-3 text-gray-600">{lead.city}</td>
                <td className="py-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      lead.leadScore >= 70
                        ? "bg-green-100 text-green-700"
                        : lead.leadScore >= 40
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {lead.leadScore}
                  </span>
                </td>
                <td className="py-3">
                  <span className="text-xs text-gray-500">
                    {lead.leadStatus.replace("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number | string;
  subtitle: string;
}) {
  return (
    <div className="bg-white p-6 rounded-xl border">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}

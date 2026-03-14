"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/lib/api";
import type { Business, LeadStatus } from "@/types";

const STATUSES: { key: LeadStatus; label: string; color: string }[] = [
  { key: "NEW", label: "New Lead", color: "bg-blue-50 border-blue-200" },
  { key: "CONTACTED", label: "Contacted", color: "bg-yellow-50 border-yellow-200" },
  { key: "REPLIED", label: "Replied", color: "bg-green-50 border-green-200" },
  { key: "MEETING_BOOKED", label: "Meeting Booked", color: "bg-purple-50 border-purple-200" },
  { key: "CLOSED", label: "Closed", color: "bg-gray-50 border-gray-200" },
];

export default function CRMPage() {
  const [leads, setLeads] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/leads?limit=500").then(({ data }) => {
      setLeads(data.data);
      setLoading(false);
    });
  }, []);

  async function updateStatus(businessId: string, status: LeadStatus) {
    await api.patch(`/leads/${businessId}/status`, { status });
    setLeads((prev) =>
      prev.map((l) => (l.id === businessId ? { ...l, leadStatus: status } : l))
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse h-8 bg-gray-200 rounded w-48" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">CRM Pipeline</h1>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUSES.map((status) => {
          const statusLeads = leads.filter(
            (l) => l.leadStatus === status.key
          );
          return (
            <div
              key={status.key}
              className={`min-w-[280px] rounded-xl border p-4 ${status.color}`}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-sm">{status.label}</h2>
                <span className="text-xs bg-white px-2 py-0.5 rounded-full">
                  {statusLeads.length}
                </span>
              </div>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {statusLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-white p-3 rounded-lg border shadow-sm"
                  >
                    <div className="font-medium text-sm">{lead.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {lead.businessType} &middot; {lead.city}
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          lead.leadScore >= 70
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        Score: {lead.leadScore}
                      </span>
                      <select
                        value={lead.leadStatus}
                        onChange={(e) =>
                          updateStatus(lead.id, e.target.value as LeadStatus)
                        }
                        className="text-xs border rounded px-1 py-0.5"
                      >
                        {STATUSES.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                {statusLeads.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">
                    No leads
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}

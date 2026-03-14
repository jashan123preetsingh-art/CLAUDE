"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/lib/api";
import type { User } from "@/types";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api.get("/auth/me").then(({ data }) => setUser(data));
  }, []);

  if (!user) {
    return (
      <DashboardLayout>
        <div className="animate-pulse h-8 bg-gray-200 rounded w-48" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-6 max-w-2xl">
        {/* Profile */}
        <div className="bg-white p-6 rounded-xl border">
          <h2 className="text-lg font-semibold mb-4">Profile</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="font-medium">
                {user.firstName} {user.lastName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Company</span>
              <span className="font-medium">{user.company || "-"}</span>
            </div>
          </div>
        </div>

        {/* Plan & Usage */}
        <div className="bg-white p-6 rounded-xl border">
          <h2 className="text-lg font-semibold mb-4">Plan & Usage</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Current Plan</span>
              <span className="font-medium text-primary-600">{user.plan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Leads Used</span>
              <span className="font-medium">
                {user.leadsUsed} / {user.leadsLimit}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-primary-600 h-2 rounded-full"
                style={{
                  width: `${Math.min(
                    (user.leadsUsed / user.leadsLimit) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-white p-6 rounded-xl border">
          <h2 className="text-lg font-semibold mb-4">Integrations</h2>
          <div className="space-y-4">
            {["SendGrid", "Gmail API", "Zapier", "HubSpot", "Airtable"].map(
              (integration) => (
                <div
                  key={integration}
                  className="flex justify-between items-center"
                >
                  <span className="text-gray-700">{integration}</span>
                  <button className="text-sm px-3 py-1 border rounded-lg hover:bg-gray-50">
                    Connect
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/lib/api";
import type { Campaign, Project } from "@/types";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    projectId: "",
    subject: "",
    bodyTemplate: "",
    followUpEnabled: false,
    followUpDays: 3,
    followUpTemplate: "",
  });

  useEffect(() => {
    api.get("/campaigns").then(({ data }) => setCampaigns(data));
    api.get("/projects").then(({ data }) => setProjects(data));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const { data } = await api.post("/campaigns", form);
    setCampaigns((prev) => [data, ...prev]);
    setShowCreate(false);
    setForm({
      name: "",
      projectId: "",
      subject: "",
      bodyTemplate: "",
      followUpEnabled: false,
      followUpDays: 3,
      followUpTemplate: "",
    });
  }

  async function startCampaign(id: string) {
    await api.post(`/campaigns/${id}/start`);
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "RUNNING" } : c))
    );
  }

  async function pauseCampaign(id: string) {
    await api.post(`/campaigns/${id}/pause`);
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "PAUSED" } : c))
    );
  }

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Email Campaigns</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          {showCreate ? "Cancel" : "New Campaign"}
        </button>
      </div>

      {/* Create Campaign Form */}
      {showCreate && (
        <div className="bg-white p-6 rounded-xl border mb-6">
          <h2 className="text-lg font-semibold mb-4">Create Campaign</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project
                </label>
                <select
                  value={form.projectId}
                  onChange={(e) =>
                    setForm({ ...form, projectId: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Subject
              </label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                required
                placeholder="Use {BusinessName}, {City}, {Niche} as tags"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Body Template
              </label>
              <textarea
                value={form.bodyTemplate}
                onChange={(e) =>
                  setForm({ ...form, bodyTemplate: e.target.value })
                }
                required
                rows={6}
                placeholder="Hi,&#10;&#10;I came across {BusinessName} in {City}...&#10;&#10;Use {BusinessName}, {City}, {Niche} for personalization."
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.followUpEnabled}
                onChange={(e) =>
                  setForm({ ...form, followUpEnabled: e.target.checked })
                }
                id="followUp"
                className="rounded"
              />
              <label htmlFor="followUp" className="text-sm text-gray-700">
                Enable follow-up email
              </label>
            </div>
            {form.followUpEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Days after initial email
                  </label>
                  <input
                    type="number"
                    value={form.followUpDays}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        followUpDays: parseInt(e.target.value),
                      })
                    }
                    min={1}
                    max={30}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Follow-up template
                  </label>
                  <textarea
                    value={form.followUpTemplate}
                    onChange={(e) =>
                      setForm({ ...form, followUpTemplate: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            )}
            <button
              type="submit"
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Create Campaign
            </button>
          </form>
        </div>
      )}

      {/* Campaigns List */}
      <div className="space-y-4">
        {campaigns.map((campaign) => (
          <div key={campaign.id} className="bg-white p-6 rounded-xl border">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{campaign.name}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Subject: {campaign.subject}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    campaign.status === "RUNNING"
                      ? "bg-green-100 text-green-700"
                      : campaign.status === "COMPLETED"
                      ? "bg-blue-100 text-blue-700"
                      : campaign.status === "PAUSED"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {campaign.status}
                </span>
                {campaign.status === "DRAFT" && (
                  <button
                    onClick={() => startCampaign(campaign.id)}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                  >
                    Start
                  </button>
                )}
                {campaign.status === "RUNNING" && (
                  <button
                    onClick={() => pauseCampaign(campaign.id)}
                    className="px-3 py-1 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700"
                  >
                    Pause
                  </button>
                )}
              </div>
            </div>

            {/* Campaign Stats */}
            <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
              <div>
                <p className="text-xs text-gray-500">Recipients</p>
                <p className="text-lg font-semibold">
                  {campaign.totalRecipients}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Sent</p>
                <p className="text-lg font-semibold">{campaign.sentCount}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Opened</p>
                <p className="text-lg font-semibold">{campaign.openCount}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Replied</p>
                <p className="text-lg font-semibold">{campaign.replyCount}</p>
              </div>
            </div>
          </div>
        ))}

        {campaigns.length === 0 && (
          <div className="bg-white p-12 rounded-xl border text-center text-gray-400">
            <p className="text-lg">No campaigns yet</p>
            <p className="text-sm mt-2">
              Create your first email campaign to start outreach
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

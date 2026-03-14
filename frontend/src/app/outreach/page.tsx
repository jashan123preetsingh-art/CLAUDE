"use client";

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/lib/api";
import type { GeneratedOutreach } from "@/types";

export default function OutreachPage() {
  const [form, setForm] = useState({
    businessName: "",
    niche: "",
    location: "",
    websiteText: "",
    contactName: "",
    senderName: "",
    senderCompany: "",
  });
  const [result, setResult] = useState<GeneratedOutreach | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/outreach/generate", form);
      setResult(data);
    } catch {
      alert("Failed to generate outreach messages");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">AI Outreach Generator</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="bg-white p-6 rounded-xl border">
          <h2 className="text-lg font-semibold mb-4">Business Details</h2>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Name *
              </label>
              <input
                type="text"
                value={form.businessName}
                onChange={(e) =>
                  setForm({ ...form, businessName: e.target.value })
                }
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Niche *
                </label>
                <input
                  type="text"
                  value={form.niche}
                  onChange={(e) => setForm({ ...form, niche: e.target.value })}
                  required
                  placeholder="e.g., dentist"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location *
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  required
                  placeholder="e.g., New York"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Name (optional)
              </label>
              <input
                type="text"
                value={form.contactName}
                onChange={(e) =>
                  setForm({ ...form, contactName: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={form.senderName}
                  onChange={(e) =>
                    setForm({ ...form, senderName: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Company
                </label>
                <input
                  type="text"
                  value={form.senderCompany}
                  onChange={(e) =>
                    setForm({ ...form, senderCompany: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website Content (optional)
              </label>
              <textarea
                value={form.websiteText}
                onChange={(e) =>
                  setForm({ ...form, websiteText: e.target.value })
                }
                rows={3}
                placeholder="Paste key content from their website for more personalized messages"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? "Generating with AI..." : "Generate Outreach Messages"}
            </button>
          </form>
        </div>

        {/* Generated Messages */}
        <div className="space-y-4">
          {result ? (
            <>
              <MessageCard
                title="Cold Email"
                subtitle={result.email.subject}
                content={result.email.body}
              />
              <MessageCard
                title="Instagram DM"
                content={result.instagramDM}
              />
              <MessageCard
                title="LinkedIn Message"
                content={result.linkedinMessage}
              />
              <MessageCard
                title="Contact Form Message"
                content={result.contactFormMessage}
              />
            </>
          ) : (
            <div className="bg-white p-12 rounded-xl border text-center text-gray-400">
              <p className="text-lg">Generated messages will appear here</p>
              <p className="text-sm mt-2">
                Fill in the business details and click Generate
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function MessageCard({
  title,
  subtitle,
  content,
}: {
  title: string;
  subtitle?: string;
  content: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white p-4 rounded-xl border">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">
              Subject: {subtitle}
            </p>
          )}
        </div>
        <button
          onClick={copy}
          className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{content}</p>
    </div>
  );
}

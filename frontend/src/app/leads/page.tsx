"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import api from "@/lib/api";
import type { Business, LeadSearch } from "@/types";

export default function LeadsPage() {
  const [businessType, setBusinessType] = useState("");
  const [location, setLocation] = useState("");
  const [searching, setSearching] = useState(false);
  const [searches, setSearches] = useState<LeadSearch[]>([]);
  const [leads, setLeads] = useState<Business[]>([]);
  const [activeSearch, setActiveSearch] = useState<string | null>(null);

  useEffect(() => {
    api.get("/leads/searches").then(({ data }) => setSearches(data));
    api.get("/leads?limit=100").then(({ data }) => setLeads(data.data));
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    try {
      const { data } = await api.post("/leads/search", {
        businessType,
        location,
      });
      setActiveSearch(data.searchId);
      // Poll for results
      pollResults(data.searchId);
    } catch {
      alert("Search failed");
      setSearching(false);
    }
  }

  async function pollResults(searchId: string) {
    const interval = setInterval(async () => {
      const { data } = await api.get(`/leads/search/${searchId}`);
      if (data.status === "COMPLETED" || data.status === "FAILED") {
        clearInterval(interval);
        setSearching(false);
        setActiveSearch(null);
        if (data.businesses) {
          setLeads((prev) => [...data.businesses, ...prev]);
        }
        // Refresh searches list
        const searchesRes = await api.get("/leads/searches");
        setSearches(searchesRes.data);
      }
    }, 3000);
  }

  async function extractContacts(businessId: string) {
    try {
      await api.post(`/leads/${businessId}/extract-contacts`);
      // Refresh the lead
      const { data } = await api.get(`/leads/${businessId}`);
      setLeads((prev) =>
        prev.map((l) => (l.id === businessId ? data : l))
      );
    } catch {
      alert("Contact extraction failed");
    }
  }

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">Lead Search</h1>

      {/* Search Form */}
      <div className="bg-white p-6 rounded-xl border mb-6">
        <form onSubmit={handleSearch} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Type
            </label>
            <input
              type="text"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="e.g., dentists, gyms, restaurants"
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., New York, NY"
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap"
          >
            {searching ? "Searching..." : "Search Leads"}
          </button>
        </form>

        {activeSearch && (
          <div className="mt-4 flex items-center gap-2 text-sm text-primary-600">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Searching Google Maps for businesses...
          </div>
        )}
      </div>

      {/* Search History */}
      {searches.length > 0 && (
        <div className="bg-white p-6 rounded-xl border mb-6">
          <h2 className="text-lg font-semibold mb-3">Recent Searches</h2>
          <div className="flex flex-wrap gap-2">
            {searches.slice(0, 10).map((s) => (
              <span
                key={s.id}
                className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700"
              >
                {s.businessType} in {s.location} ({s.resultsCount} results)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            Leads ({leads.length})
          </h2>
          <div className="flex gap-2">
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/export/csv`}
              className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
            >
              Export CSV
            </a>
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/export/excel`}
              className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
            >
              Export Excel
            </a>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 bg-gray-50">
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Website</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Contacts</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{lead.name}</div>
                    <div className="text-xs text-gray-500">
                      {lead.businessType}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {lead.city}
                    {lead.state ? `, ${lead.state}` : ""}
                  </td>
                  <td className="px-4 py-3 text-sm">{lead.phone || "-"}</td>
                  <td className="px-4 py-3 text-sm">
                    {lead.websiteUrl ? (
                      <a
                        href={lead.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline"
                      >
                        Visit
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {lead.rating ? `${lead.rating} (${lead.reviewCount})` : "-"}
                  </td>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3 text-sm">
                    {lead.contacts?.length > 0 ? (
                      <span className="text-green-600">
                        {lead.contacts.filter((c) => c.email).length} emails
                      </span>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => extractContacts(lead.id)}
                      className="text-xs px-2 py-1 bg-primary-50 text-primary-700 rounded hover:bg-primary-100"
                    >
                      Extract
                    </button>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No leads yet. Search for businesses above to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}

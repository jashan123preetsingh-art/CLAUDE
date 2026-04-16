"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Settings, User, CreditCard, Bell, Shield, Palette, Key, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const sections = [
    {
      title: "Profile",
      icon: User,
      fields: [
        { label: "Display Name", value: "Trader Alpha", type: "text" },
        { label: "Email", value: "trader@example.com", type: "email" },
        { label: "Timezone", value: "UTC-5 (Eastern)", type: "select" },
      ],
    },
    {
      title: "Notifications",
      icon: Bell,
      fields: [
        { label: "Email Notifications", value: true, type: "toggle" },
        { label: "Telegram Alerts", value: true, type: "toggle" },
        { label: "Discord Webhook", value: false, type: "toggle" },
        { label: "Browser Push", value: true, type: "toggle" },
      ],
    },
    {
      title: "API Keys",
      icon: Key,
      fields: [
        { label: "API Key", value: "atl_sk_••••••••••••1234", type: "text" },
        { label: "Rate Limit", value: "1000 req/min", type: "text" },
      ],
    },
    {
      title: "Display",
      icon: Palette,
      fields: [
        { label: "Theme", value: "Dark (Terminal)", type: "select" },
        { label: "Default Currency", value: "USD", type: "select" },
        { label: "Number Format", value: "1,234.56", type: "select" },
      ],
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-atlas-muted" />
            Settings
          </h1>
          <p className="text-sm text-atlas-muted mt-0.5">Manage your account and preferences</p>
        </div>

        {/* Plan Info */}
        <div className="bg-atlas-card border border-atlas-accent/20 rounded-xl p-5 glow-blue">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="w-4 h-4 text-atlas-accent" />
                <span className="text-sm font-medium text-white">Current Plan: Pro</span>
              </div>
              <p className="text-xs text-atlas-muted">$49/month · Unlimited AI analyses · All features</p>
            </div>
            <button className="text-xs bg-atlas-surface text-atlas-text hover:bg-atlas-card border border-atlas-border px-3 py-1.5 rounded-lg transition-colors">
              Manage Subscription
            </button>
          </div>
        </div>

        {/* Settings Sections */}
        {sections.map((section) => (
          <div key={section.title} className="bg-atlas-card border border-atlas-border rounded-xl">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-atlas-border">
              <section.icon className="w-4 h-4 text-atlas-muted" />
              <h2 className="text-sm font-semibold text-white">{section.title}</h2>
            </div>
            <div className="p-5 space-y-4">
              {section.fields.map((field) => (
                <div key={field.label} className="flex items-center justify-between">
                  <label className="text-sm text-atlas-muted">{field.label}</label>
                  {field.type === "toggle" ? (
                    <button
                      className={cn(
                        "w-10 h-5 rounded-full transition-colors relative",
                        field.value ? "bg-atlas-accent" : "bg-atlas-surface"
                      )}
                    >
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all",
                          field.value ? "left-5.5" : "left-0.5"
                        )}
                      />
                    </button>
                  ) : (
                    <input
                      type="text"
                      defaultValue={field.value as string}
                      className="bg-atlas-surface border border-atlas-border rounded-lg px-3 py-1.5 text-sm text-atlas-text w-56 text-right outline-none focus:border-atlas-accent transition-colors"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Save */}
        <div className="flex justify-end">
          <button className="bg-atlas-accent hover:bg-atlas-accent/80 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

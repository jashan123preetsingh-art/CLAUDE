"use client";

import Link from "next/link";
import { Zap, Check, ArrowLeft } from "lucide-react";
import { PRICING_PLANS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-atlas-bg grid-bg">
      {/* Header */}
      <header className="border-b border-atlas-border bg-atlas-surface/50 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-atlas-accent to-atlas-cyan flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white tracking-wide">ATLAS TERMINAL</span>
          </Link>
          <Link href="/dashboard" className="text-sm bg-atlas-accent hover:bg-atlas-accent/80 text-white px-4 py-2 rounded-lg transition-colors">
            Launch Terminal
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Choose Your Trading Edge
          </h1>
          <p className="text-lg text-atlas-muted max-w-xl mx-auto">
            From free exploration to professional-grade analytics. Bloomberg-level intelligence
            at a fraction of the cost.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.tier}
              className={cn(
                "bg-atlas-card border rounded-2xl p-6 relative flex flex-col",
                plan.tier === "pro"
                  ? "border-atlas-accent glow-blue lg:scale-105"
                  : "border-atlas-border"
              )}
            >
              {plan.tier === "pro" && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-atlas-accent text-white text-xs px-4 py-1 rounded-full font-medium">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold text-white">${plan.price}</span>
                  <span className="text-sm text-atlas-muted">
                    {plan.period === "one-time" ? " one-time" : "/month"}
                  </span>
                </div>
                {plan.tier === "lifetime" && (
                  <p className="text-xs text-atlas-green">Pay once, use forever</p>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-atlas-text">
                    <Check className="w-4 h-4 text-atlas-green flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Limits */}
              <div className="border-t border-atlas-border pt-4 mb-4">
                <p className="text-xs text-atlas-muted mb-2 font-medium">Plan Limits</p>
                <div className="space-y-1.5 text-xs text-atlas-muted">
                  <div className="flex justify-between">
                    <span>Watchlists</span>
                    <span className="text-atlas-text">{plan.limits.watchlists === -1 ? "Unlimited" : plan.limits.watchlists}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Alerts</span>
                    <span className="text-atlas-text">{plan.limits.alerts === -1 ? "Unlimited" : plan.limits.alerts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>AI Analyses/day</span>
                    <span className="text-atlas-text">{plan.limits.aiAnalyses === -1 ? "Unlimited" : plan.limits.aiAnalyses}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Historical Data</span>
                    <span className="text-atlas-text">{plan.limits.historicalData}</span>
                  </div>
                </div>
              </div>

              <Link
                href="/dashboard"
                className={cn(
                  "block text-center py-3 rounded-xl text-sm font-medium transition-colors",
                  plan.tier === "pro"
                    ? "bg-atlas-accent text-white hover:bg-atlas-accent/80"
                    : "bg-atlas-surface text-atlas-text hover:bg-atlas-card border border-atlas-border"
                )}
              >
                {plan.tier === "free" ? "Get Started Free" : plan.tier === "lifetime" ? "Get Lifetime Access" : "Start 7-Day Trial"}
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ / Comparison note */}
        <div className="mt-20 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Bloomberg Terminal: $24,000/year</h2>
          <h3 className="text-xl text-atlas-accent mb-2">Atlas Terminal AI Pro: $588/year</h3>
          <p className="text-atlas-muted">That&apos;s 97% cheaper with AI-powered analysis included.</p>
        </div>
      </div>
    </div>
  );
}

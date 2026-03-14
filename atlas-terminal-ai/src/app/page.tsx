"use client";

import Link from "next/link";
import {
  Zap, BarChart3, Fish, Brain, Newspaper, Bell, Shield, Globe,
  ArrowRight, Check, ChevronRight, TrendingUp, Activity,
} from "lucide-react";
import { PRICING_PLANS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: BarChart3, title: "Real-Time Market Dashboard",
    description: "Live prices, volume, and volatility across crypto, forex, commodities, and indices. Customizable watchlists with Bloomberg-style data density.",
    color: "text-atlas-accent",
  },
  {
    icon: Brain, title: "AI Analysis Engine",
    description: "Click any asset for instant AI-generated analysis including trend direction, support/resistance zones, sentiment analysis, and macro factors.",
    color: "text-atlas-purple",
  },
  {
    icon: Fish, title: "Whale Tracking System",
    description: "Track large blockchain transactions in real-time. Detect exchange inflows/outflows, accumulation patterns, and wallet behavior.",
    color: "text-atlas-cyan",
  },
  {
    icon: Activity, title: "Sector Analytics",
    description: "Monitor momentum across AI tokens, DeFi, Layer 2, Gaming, and more. Identify capital rotation and sector trends before the crowd.",
    color: "text-atlas-green",
  },
  {
    icon: Newspaper, title: "AI News Intelligence",
    description: "Aggregated financial news with AI-powered summarization and sentiment classification. Instantly see how news impacts your assets.",
    color: "text-atlas-yellow",
  },
  {
    icon: Bell, title: "Smart Alert System",
    description: "Custom alerts for price levels, whale transactions, sector shifts, and volatility spikes. Delivered via email, Telegram, or Discord.",
    color: "text-atlas-red",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-atlas-bg">
      {/* Header */}
      <header className="border-b border-atlas-border bg-atlas-surface/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-atlas-accent to-atlas-cyan flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white tracking-wide">ATLAS TERMINAL</span>
            <span className="text-[10px] font-mono text-atlas-accent bg-atlas-accent/10 px-2 py-0.5 rounded-full">AI</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="text-sm text-atlas-muted hover:text-white transition-colors">Pricing</Link>
            <Link href="/dashboard" className="text-sm bg-atlas-accent hover:bg-atlas-accent/80 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
              Launch Terminal <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-atlas-accent/5 rounded-full blur-3xl" />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-atlas-card border border-atlas-border rounded-full px-4 py-1.5 mb-8">
            <div className="w-2 h-2 rounded-full bg-atlas-green pulse-live" />
            <span className="text-xs text-atlas-muted">Markets are live</span>
            <span className="text-xs text-atlas-accent">· 16,000+ assets tracked</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-6">
            Your AI-Powered{" "}
            <span className="gradient-text">Market Intelligence</span>{" "}
            Terminal
          </h1>
          <p className="text-lg text-atlas-muted max-w-2xl mx-auto mb-10">
            Bloomberg-level market analytics at a fraction of the cost. Real-time data, whale tracking,
            AI-driven analysis, and smart alerts — built for modern traders.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="bg-atlas-accent hover:bg-atlas-accent/80 text-white px-8 py-3.5 rounded-xl font-medium transition-all flex items-center gap-2 glow-blue"
            >
              <Zap className="w-5 h-5" />
              Start Free — No Credit Card
            </Link>
            <Link
              href="/pricing"
              className="border border-atlas-border hover:border-atlas-muted text-atlas-text px-8 py-3.5 rounded-xl font-medium transition-all"
            >
              View Pricing
            </Link>
          </div>
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-atlas-muted">
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-atlas-green" /> Free tier available</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-atlas-green" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-atlas-green" /> Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-atlas-card border border-atlas-border rounded-2xl p-1 glow-blue">
            <div className="bg-atlas-surface rounded-xl p-6">
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: "BTC/USD", value: "$98,450", change: "+2.43%", positive: true },
                  { label: "ETH/USD", value: "$3,842", change: "-1.44%", positive: false },
                  { label: "XAU/USD", value: "$2,648", change: "+0.70%", positive: true },
                  { label: "EUR/USD", value: "$1.0842", change: "+0.21%", positive: true },
                ].map((item) => (
                  <div key={item.label} className="bg-atlas-card border border-atlas-border rounded-lg p-4">
                    <p className="text-xs text-atlas-muted mb-1">{item.label}</p>
                    <p className="text-xl font-bold font-mono text-white">{item.value}</p>
                    <p className={cn("text-sm font-mono mt-1", item.positive ? "text-atlas-green" : "text-atlas-red")}>
                      {item.change}
                    </p>
                  </div>
                ))}
              </div>
              <div className="h-48 bg-atlas-bg rounded-lg border border-atlas-border flex items-center justify-center">
                <div className="text-center">
                  <TrendingUp className="w-12 h-12 text-atlas-accent/30 mx-auto mb-2" />
                  <p className="text-sm text-atlas-muted">Interactive charts and real-time data</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything You Need to Trade Smarter
            </h2>
            <p className="text-atlas-muted max-w-xl mx-auto">
              Professional-grade tools that were previously only available to institutional traders,
              now accessible to everyone.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-atlas-card border border-atlas-border rounded-xl p-6 hover:border-atlas-accent/30 transition-all group"
              >
                <feature.icon className={cn("w-10 h-10 mb-4", feature.color)} />
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-atlas-muted leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 px-6 bg-atlas-surface/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-atlas-muted">Start free. Upgrade when you need more power.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRICING_PLANS.map((plan) => (
              <div
                key={plan.tier}
                className={cn(
                  "bg-atlas-card border rounded-xl p-6 relative",
                  plan.tier === "pro"
                    ? "border-atlas-accent glow-blue"
                    : "border-atlas-border"
                )}
              >
                {plan.tier === "pro" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-atlas-accent text-white text-xs px-3 py-1 rounded-full font-medium">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold text-white">${plan.price}</span>
                  <span className="text-sm text-atlas-muted">/{plan.period === "one-time" ? "lifetime" : "mo"}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.slice(0, 5).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-atlas-muted">
                      <Check className="w-4 h-4 text-atlas-green flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/dashboard"
                  className={cn(
                    "block text-center py-2.5 rounded-lg text-sm font-medium transition-colors",
                    plan.tier === "pro"
                      ? "bg-atlas-accent text-white hover:bg-atlas-accent/80"
                      : "bg-atlas-surface text-atlas-text hover:bg-atlas-card border border-atlas-border"
                  )}
                >
                  {plan.tier === "free" ? "Get Started" : "Start Free Trial"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Level Up Your Trading?
          </h2>
          <p className="text-atlas-muted mb-8 max-w-xl mx-auto">
            Join thousands of traders using Atlas Terminal AI to gain an edge in crypto, forex, and macro markets.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-atlas-accent hover:bg-atlas-accent/80 text-white px-8 py-4 rounded-xl font-medium transition-all glow-blue text-lg"
          >
            <Zap className="w-5 h-5" />
            Launch Atlas Terminal
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-atlas-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-atlas-accent" />
            <span className="text-sm text-atlas-muted">Atlas Terminal AI</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-atlas-muted">
            <span>Privacy</span>
            <span>Terms</span>
            <span>API Docs</span>
            <span>Support</span>
          </div>
          <p className="text-xs text-atlas-muted/50">&copy; 2026 Atlas Terminal AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

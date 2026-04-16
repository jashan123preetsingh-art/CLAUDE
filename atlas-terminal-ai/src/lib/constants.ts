import { PricingPlan } from "@/types";

export const PRICING_PLANS: PricingPlan[] = [
  {
    tier: "free",
    name: "Explorer",
    price: 0,
    period: "month",
    features: [
      "Real-time market dashboard",
      "5 assets watchlist",
      "Basic market data",
      "Daily AI market brief",
      "Community access",
    ],
    limits: {
      watchlists: 1,
      alerts: 3,
      aiAnalyses: 5,
      historicalData: "7 days",
    },
  },
  {
    tier: "basic",
    name: "Trader",
    price: 20,
    period: "month",
    features: [
      "Everything in Explorer",
      "Unlimited watchlists",
      "Whale tracking alerts",
      "Sector trend analytics",
      "25 AI analyses per day",
      "Email & Telegram alerts",
      "30 days historical data",
    ],
    limits: {
      watchlists: 10,
      alerts: 25,
      aiAnalyses: 25,
      historicalData: "30 days",
    },
  },
  {
    tier: "pro",
    name: "Professional",
    price: 49,
    period: "month",
    features: [
      "Everything in Trader",
      "Unlimited AI analyses",
      "Liquidation heatmaps",
      "Order book analytics",
      "Custom AI prompts",
      "API access",
      "Priority support",
      "Full historical data",
      "Discord & Telegram alerts",
    ],
    limits: {
      watchlists: -1,
      alerts: -1,
      aiAnalyses: -1,
      historicalData: "Unlimited",
    },
  },
  {
    tier: "lifetime",
    name: "Lifetime Access",
    price: 999,
    period: "one-time",
    features: [
      "Everything in Professional",
      "Lifetime access",
      "Early access to new features",
      "Private community access",
      "1-on-1 onboarding call",
      "Custom dashboard layouts",
    ],
    limits: {
      watchlists: -1,
      alerts: -1,
      aiAnalyses: -1,
      historicalData: "Unlimited",
    },
  },
];

export const CRYPTO_SECTORS = [
  { name: "AI Tokens", slug: "ai", color: "#a855f7" },
  { name: "DeFi", slug: "defi", color: "#3b82f6" },
  { name: "Layer 2", slug: "layer2", color: "#06b6d4" },
  { name: "Gaming", slug: "gaming", color: "#22c55e" },
  { name: "Memecoins", slug: "meme", color: "#eab308" },
  { name: "RWA", slug: "rwa", color: "#f97316" },
  { name: "DePIN", slug: "depin", color: "#ec4899" },
  { name: "Layer 1", slug: "layer1", color: "#8b5cf6" },
];

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Whale Tracker", href: "/whale-tracker", icon: "Fish" },
  { label: "Sectors", href: "/sectors", icon: "PieChart" },
  { label: "News", href: "/news", icon: "Newspaper" },
  { label: "Alerts", href: "/alerts", icon: "Bell" },
  { label: "Settings", href: "/settings", icon: "Settings" },
];

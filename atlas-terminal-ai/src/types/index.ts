// ============================================================================
// ATLAS TERMINAL AI - Core Type Definitions
// ============================================================================

export type AssetClass = "crypto" | "forex" | "commodity" | "index";
export type Sentiment = "bullish" | "bearish" | "neutral";
export type AlertType = "price" | "whale" | "sector" | "volatility";
export type AlertChannel = "email" | "telegram" | "discord" | "push";
export type PlanTier = "free" | "basic" | "pro" | "lifetime";
export type TimeFrame = "1H" | "4H" | "1D" | "1W" | "1M";

export interface User {
  id: string;
  email: string;
  name: string;
  plan: PlanTier;
  createdAt: string;
  avatar?: string;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  class: AssetClass;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap?: number;
  high24h: number;
  low24h: number;
  volatility?: number;
  liquidity?: number;
  sparkline?: number[];
  lastUpdated: string;
}

export interface MarketData {
  id: string;
  assetId: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface WhaleTransaction {
  id: string;
  blockchain: string;
  hash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  asset: string;
  usdValue: number;
  timestamp: string;
  type: "transfer" | "exchange_inflow" | "exchange_outflow";
  exchange?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: Sentiment;
  relatedAssets: string[];
  category: string;
  imageUrl?: string;
}

export interface Alert {
  id: string;
  userId: string;
  type: AlertType;
  asset?: string;
  condition: string;
  value: number | string;
  channels: AlertChannel[];
  isActive: boolean;
  createdAt: string;
  lastTriggered?: string;
}

export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  assets: string[];
  createdAt: string;
}

export interface AIAnalysisReport {
  id: string;
  assetSymbol: string;
  trend: "uptrend" | "downtrend" | "sideways";
  sentiment: Sentiment;
  summary: string;
  supportLevels: number[];
  resistanceLevels: number[];
  keyFactors: string[];
  liquidityZones: { price: number; strength: "high" | "medium" | "low" }[];
  prediction?: string;
  confidence: number;
  generatedAt: string;
}

export interface SectorData {
  id: string;
  name: string;
  slug: string;
  change24h: number;
  change7d: number;
  totalMarketCap: number;
  topAssets: Asset[];
  momentum: "gaining" | "losing" | "stable";
}

export interface LiquidationData {
  price: number;
  longLiquidations: number;
  shortLiquidations: number;
  totalValue: number;
}

export interface OrderBookLevel {
  price: number;
  bids: number;
  asks: number;
  imbalance: number;
}

export interface PricingPlan {
  tier: PlanTier;
  name: string;
  price: number;
  period: "month" | "one-time";
  features: string[];
  limits: {
    watchlists: number;
    alerts: number;
    aiAnalyses: number;
    historicalData: string;
  };
}

// ============================================================================
// ATLAS TERMINAL AI - Market Data Service
// Combines multiple API sources into a unified market data engine
// ============================================================================

import { Asset, WhaleTransaction, NewsArticle, SectorData, AIAnalysisReport, LiquidationData } from "@/types";
import { generateSparkline } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Mock Data Generator (replace with real API calls in production)
// ---------------------------------------------------------------------------

const cryptoAssets: Asset[] = [
  {
    id: "btc", symbol: "BTC/USD", name: "Bitcoin", class: "crypto",
    price: 98450, change24h: 2340, changePercent24h: 2.43, volume24h: 48200000000,
    marketCap: 1930000000000, high24h: 99100, low24h: 95800, volatility: 3.2,
    sparkline: generateSparkline(), lastUpdated: new Date().toISOString(),
  },
  {
    id: "eth", symbol: "ETH/USD", name: "Ethereum", class: "crypto",
    price: 3842, change24h: -56, changePercent24h: -1.44, volume24h: 21500000000,
    marketCap: 462000000000, high24h: 3920, low24h: 3780, volatility: 4.1,
    sparkline: generateSparkline(), lastUpdated: new Date().toISOString(),
  },
  {
    id: "sol", symbol: "SOL/USD", name: "Solana", class: "crypto",
    price: 187.5, change24h: 8.3, changePercent24h: 4.63, volume24h: 5800000000,
    marketCap: 86000000000, high24h: 192, low24h: 178, volatility: 6.8,
    sparkline: generateSparkline(), lastUpdated: new Date().toISOString(),
  },
  {
    id: "bnb", symbol: "BNB/USD", name: "BNB", class: "crypto",
    price: 612, change24h: 15.4, changePercent24h: 2.58, volume24h: 2100000000,
    marketCap: 91000000000, high24h: 618, low24h: 594, volatility: 3.5,
    sparkline: generateSparkline(), lastUpdated: new Date().toISOString(),
  },
  {
    id: "xrp", symbol: "XRP/USD", name: "Ripple", class: "crypto",
    price: 2.34, change24h: 0.12, changePercent24h: 5.41, volume24h: 4200000000,
    marketCap: 134000000000, high24h: 2.42, low24h: 2.18, volatility: 7.2,
    sparkline: generateSparkline(), lastUpdated: new Date().toISOString(),
  },
  {
    id: "ada", symbol: "ADA/USD", name: "Cardano", class: "crypto",
    price: 0.78, change24h: -0.02, changePercent24h: -2.50, volume24h: 890000000,
    marketCap: 27500000000, high24h: 0.82, low24h: 0.76, volatility: 5.4,
    sparkline: generateSparkline(), lastUpdated: new Date().toISOString(),
  },
  {
    id: "avax", symbol: "AVAX/USD", name: "Avalanche", class: "crypto",
    price: 42.8, change24h: 1.9, changePercent24h: 4.64, volume24h: 1200000000,
    marketCap: 17200000000, high24h: 43.5, low24h: 40.2, volatility: 6.1,
    sparkline: generateSparkline(), lastUpdated: new Date().toISOString(),
  },
  {
    id: "link", symbol: "LINK/USD", name: "Chainlink", class: "crypto",
    price: 18.45, change24h: 0.65, changePercent24h: 3.65, volume24h: 780000000,
    marketCap: 11500000000, high24h: 18.9, low24h: 17.6, volatility: 5.8,
    sparkline: generateSparkline(), lastUpdated: new Date().toISOString(),
  },
];

const forexAssets: Asset[] = [
  {
    id: "eurusd", symbol: "EUR/USD", name: "Euro / US Dollar", class: "forex",
    price: 1.0842, change24h: 0.0023, changePercent24h: 0.21, volume24h: 720000000000,
    high24h: 1.0867, low24h: 1.0815, volatility: 0.4,
    sparkline: generateSparkline(), lastUpdated: new Date().toISOString(),
  },
  {
    id: "gbpusd", symbol: "GBP/USD", name: "British Pound / US Dollar", class: "forex",
    price: 1.2714, change24h: -0.0031, changePercent24h: -0.24, volume24h: 380000000000,
    high24h: 1.2756, low24h: 1.2698, volatility: 0.5,
    sparkline: generateSparkline(), lastUpdated: new Date().toISOString(),
  },
  {
    id: "usdjpy", symbol: "USD/JPY", name: "US Dollar / Japanese Yen", class: "forex",
    price: 154.32, change24h: 0.78, changePercent24h: 0.51, volume24h: 520000000000,
    high24h: 154.89, low24h: 153.42, volatility: 0.6,
    sparkline: generateSparkline(), lastUpdated: new Date().toISOString(),
  },
  {
    id: "xauusd", symbol: "XAU/USD", name: "Gold / US Dollar", class: "commodity",
    price: 2648.5, change24h: 18.3, changePercent24h: 0.70, volume24h: 182000000000,
    high24h: 2658, low24h: 2625, volatility: 1.2,
    sparkline: generateSparkline(), lastUpdated: new Date().toISOString(),
  },
  {
    id: "audusd", symbol: "AUD/USD", name: "Australian Dollar / US Dollar", class: "forex",
    price: 0.6534, change24h: 0.0012, changePercent24h: 0.18, volume24h: 180000000000,
    high24h: 0.6558, low24h: 0.6518, volatility: 0.5,
    sparkline: generateSparkline(), lastUpdated: new Date().toISOString(),
  },
];

const indexAssets: Asset[] = [
  {
    id: "spx", symbol: "SPX", name: "S&P 500", class: "index",
    price: 5892, change24h: 34, changePercent24h: 0.58, volume24h: 4200000000,
    high24h: 5910, low24h: 5845, volatility: 1.1,
    sparkline: generateSparkline(), lastUpdated: new Date().toISOString(),
  },
  {
    id: "ndx", symbol: "NDX", name: "Nasdaq 100", class: "index",
    price: 20845, change24h: 156, changePercent24h: 0.75, volume24h: 3800000000,
    high24h: 20920, low24h: 20650, volatility: 1.4,
    sparkline: generateSparkline(), lastUpdated: new Date().toISOString(),
  },
  {
    id: "dxy", symbol: "DXY", name: "US Dollar Index", class: "index",
    price: 104.2, change24h: -0.35, changePercent24h: -0.34, volume24h: 0,
    high24h: 104.6, low24h: 104.05, volatility: 0.3,
    sparkline: generateSparkline(), lastUpdated: new Date().toISOString(),
  },
];

export function getAllAssets(): Asset[] {
  return [...cryptoAssets, ...forexAssets, ...indexAssets];
}

export function getAssetsByClass(assetClass: string): Asset[] {
  return getAllAssets().filter((a) => a.class === assetClass);
}

export function getAssetBySymbol(symbol: string): Asset | undefined {
  return getAllAssets().find(
    (a) => a.symbol.toLowerCase() === symbol.toLowerCase() || a.id === symbol.toLowerCase()
  );
}

export function getTopMovers(): { gainers: Asset[]; losers: Asset[] } {
  const sorted = [...getAllAssets()].sort((a, b) => b.changePercent24h - a.changePercent24h);
  return {
    gainers: sorted.slice(0, 5),
    losers: sorted.slice(-5).reverse(),
  };
}

// ---------------------------------------------------------------------------
// Whale Transactions
// ---------------------------------------------------------------------------

export function getWhaleTransactions(): WhaleTransaction[] {
  return [
    {
      id: "wt1", blockchain: "Bitcoin", hash: "0xabc...def1",
      fromAddress: "bc1q...whale1", toAddress: "Binance Hot Wallet",
      amount: 1500, asset: "BTC", usdValue: 147675000,
      timestamp: new Date(Date.now() - 300000).toISOString(),
      type: "exchange_inflow", exchange: "Binance",
    },
    {
      id: "wt2", blockchain: "Ethereum", hash: "0xdef...abc2",
      fromAddress: "Coinbase", toAddress: "0x742...unknown",
      amount: 15000, asset: "ETH", usdValue: 57630000,
      timestamp: new Date(Date.now() - 900000).toISOString(),
      type: "exchange_outflow", exchange: "Coinbase",
    },
    {
      id: "wt3", blockchain: "Bitcoin", hash: "0x123...456",
      fromAddress: "bc1q...whale3", toAddress: "bc1q...whale4",
      amount: 800, asset: "BTC", usdValue: 78760000,
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      type: "transfer",
    },
    {
      id: "wt4", blockchain: "Solana", hash: "0x789...012",
      fromAddress: "Kraken", toAddress: "sol1...unknown",
      amount: 250000, asset: "SOL", usdValue: 46875000,
      timestamp: new Date(Date.now() - 2700000).toISOString(),
      type: "exchange_outflow", exchange: "Kraken",
    },
    {
      id: "wt5", blockchain: "Ethereum", hash: "0xfed...cba",
      fromAddress: "0x456...whale5", toAddress: "OKX",
      amount: 8500, asset: "ETH", usdValue: 32657000,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      type: "exchange_inflow", exchange: "OKX",
    },
    {
      id: "wt6", blockchain: "Bitcoin", hash: "0xaaa...bbb",
      fromAddress: "bc1q...whale6", toAddress: "Cold Storage",
      amount: 2200, asset: "BTC", usdValue: 216590000,
      timestamp: new Date(Date.now() - 5400000).toISOString(),
      type: "transfer",
    },
    {
      id: "wt7", blockchain: "Ethereum", hash: "0xccc...ddd",
      fromAddress: "Binance", toAddress: "0x999...defi",
      amount: 50000, asset: "ETH", usdValue: 192100000,
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      type: "exchange_outflow", exchange: "Binance",
    },
  ];
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

export function getNewsArticles(): NewsArticle[] {
  return [
    {
      id: "n1", title: "Federal Reserve Signals Potential Rate Cut in Q2 2026",
      summary: "The Federal Reserve has indicated a possible rate cut in the upcoming meeting, citing cooling inflation data. This could weaken the USD and support risk assets including crypto and gold.",
      source: "Reuters", url: "#", publishedAt: new Date(Date.now() - 1800000).toISOString(),
      sentiment: "bullish", relatedAssets: ["BTC/USD", "XAU/USD", "EUR/USD"], category: "Macro",
    },
    {
      id: "n2", title: "Bitcoin ETF Inflows Hit $1.2B in Single Day",
      summary: "Spot Bitcoin ETFs recorded their largest single-day inflow of $1.2 billion, led by BlackRock's IBIT fund. This surge in institutional demand suggests growing confidence in the crypto market.",
      source: "Bloomberg", url: "#", publishedAt: new Date(Date.now() - 3600000).toISOString(),
      sentiment: "bullish", relatedAssets: ["BTC/USD", "ETH/USD"], category: "Crypto",
    },
    {
      id: "n3", title: "SEC Approves New Crypto Regulatory Framework",
      summary: "The SEC has approved a comprehensive regulatory framework for cryptocurrency markets. The new rules provide clearer guidelines for token classifications and exchange operations.",
      source: "CoinDesk", url: "#", publishedAt: new Date(Date.now() - 7200000).toISOString(),
      sentiment: "bullish", relatedAssets: ["BTC/USD", "ETH/USD", "SOL/USD"], category: "Regulation",
    },
    {
      id: "n4", title: "Eurozone GDP Growth Misses Expectations",
      summary: "Eurozone GDP growth came in at 0.1% versus the expected 0.3%, signaling economic weakness. EUR may face downward pressure as ECB considers additional stimulus measures.",
      source: "Financial Times", url: "#", publishedAt: new Date(Date.now() - 10800000).toISOString(),
      sentiment: "bearish", relatedAssets: ["EUR/USD", "GBP/USD"], category: "Macro",
    },
    {
      id: "n5", title: "Solana DeFi TVL Reaches New All-Time High of $18B",
      summary: "Total value locked in Solana DeFi protocols has reached $18 billion, driven by new lending and DEX protocols. SOL price reacted positively to the growing ecosystem activity.",
      source: "The Block", url: "#", publishedAt: new Date(Date.now() - 14400000).toISOString(),
      sentiment: "bullish", relatedAssets: ["SOL/USD"], category: "DeFi",
    },
    {
      id: "n6", title: "China Increases Gold Reserves for 8th Consecutive Month",
      summary: "The People's Bank of China added 30 tonnes of gold to its reserves, continuing the de-dollarization trend. Gold prices remain supported near record highs.",
      source: "CNBC", url: "#", publishedAt: new Date(Date.now() - 18000000).toISOString(),
      sentiment: "bullish", relatedAssets: ["XAU/USD", "DXY"], category: "Commodities",
    },
  ];
}

// ---------------------------------------------------------------------------
// Sectors
// ---------------------------------------------------------------------------

export function getSectorData(): SectorData[] {
  return [
    {
      id: "s1", name: "AI Tokens", slug: "ai", change24h: 8.4, change7d: 22.1,
      totalMarketCap: 45000000000, momentum: "gaining",
      topAssets: [
        { id: "rndr", symbol: "RNDR", name: "Render", class: "crypto", price: 11.2, change24h: 0.8, changePercent24h: 7.7, volume24h: 890000000, high24h: 11.5, low24h: 10.2, sparkline: generateSparkline(), lastUpdated: new Date().toISOString() },
        { id: "fet", symbol: "FET", name: "Fetch.AI", class: "crypto", price: 2.85, change24h: 0.25, changePercent24h: 9.6, volume24h: 620000000, high24h: 2.95, low24h: 2.55, sparkline: generateSparkline(), lastUpdated: new Date().toISOString() },
      ],
    },
    {
      id: "s2", name: "DeFi", slug: "defi", change24h: 3.2, change7d: 8.5,
      totalMarketCap: 120000000000, momentum: "gaining",
      topAssets: [
        { id: "uni", symbol: "UNI", name: "Uniswap", class: "crypto", price: 14.8, change24h: 0.4, changePercent24h: 2.8, volume24h: 420000000, high24h: 15.2, low24h: 14.1, sparkline: generateSparkline(), lastUpdated: new Date().toISOString() },
        { id: "aave", symbol: "AAVE", name: "Aave", class: "crypto", price: 312, change24h: 12, changePercent24h: 4.0, volume24h: 380000000, high24h: 318, low24h: 296, sparkline: generateSparkline(), lastUpdated: new Date().toISOString() },
      ],
    },
    {
      id: "s3", name: "Layer 2", slug: "layer2", change24h: 5.1, change7d: 12.3,
      totalMarketCap: 38000000000, momentum: "gaining",
      topAssets: [
        { id: "arb", symbol: "ARB", name: "Arbitrum", class: "crypto", price: 1.42, change24h: 0.08, changePercent24h: 5.9, volume24h: 560000000, high24h: 1.48, low24h: 1.32, sparkline: generateSparkline(), lastUpdated: new Date().toISOString() },
        { id: "op", symbol: "OP", name: "Optimism", class: "crypto", price: 3.15, change24h: 0.12, changePercent24h: 4.0, volume24h: 340000000, high24h: 3.25, low24h: 2.98, sparkline: generateSparkline(), lastUpdated: new Date().toISOString() },
      ],
    },
    {
      id: "s4", name: "Gaming", slug: "gaming", change24h: -1.8, change7d: 3.2,
      totalMarketCap: 22000000000, momentum: "stable",
      topAssets: [
        { id: "imx", symbol: "IMX", name: "Immutable X", class: "crypto", price: 2.45, change24h: -0.05, changePercent24h: -2.0, volume24h: 180000000, high24h: 2.55, low24h: 2.38, sparkline: generateSparkline(), lastUpdated: new Date().toISOString() },
      ],
    },
    {
      id: "s5", name: "Memecoins", slug: "meme", change24h: 12.5, change7d: -5.2,
      totalMarketCap: 68000000000, momentum: "gaining",
      topAssets: [
        { id: "doge", symbol: "DOGE", name: "Dogecoin", class: "crypto", price: 0.182, change24h: 0.022, changePercent24h: 13.8, volume24h: 2800000000, high24h: 0.19, low24h: 0.158, sparkline: generateSparkline(), lastUpdated: new Date().toISOString() },
        { id: "shib", symbol: "SHIB", name: "Shiba Inu", class: "crypto", price: 0.0000285, change24h: 0.0000032, changePercent24h: 12.6, volume24h: 1500000000, high24h: 0.0000295, low24h: 0.0000248, sparkline: generateSparkline(), lastUpdated: new Date().toISOString() },
      ],
    },
    {
      id: "s6", name: "RWA", slug: "rwa", change24h: 2.1, change7d: 15.8,
      totalMarketCap: 18000000000, momentum: "gaining",
      topAssets: [
        { id: "ondo", symbol: "ONDO", name: "Ondo Finance", class: "crypto", price: 1.85, change24h: 0.05, changePercent24h: 2.8, volume24h: 320000000, high24h: 1.92, low24h: 1.78, sparkline: generateSparkline(), lastUpdated: new Date().toISOString() },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// AI Analysis
// ---------------------------------------------------------------------------

export function getAIAnalysis(symbol: string): AIAnalysisReport {
  const asset = getAssetBySymbol(symbol);
  const price = asset?.price || 0;

  const analyses: Record<string, AIAnalysisReport> = {
    btc: {
      id: "ai1", assetSymbol: "BTC/USD", trend: "uptrend", sentiment: "bullish",
      summary: `Bitcoin is currently trading at $${price.toLocaleString()}, above its 30-day moving average, indicating sustained bullish momentum. Institutional inflows through spot ETFs continue to accelerate, with $1.2B recorded in the last 24 hours. On-chain data shows accumulation by long-term holders while exchange reserves decline to multi-year lows. The macro backdrop is supportive with the Fed signaling potential rate cuts. Key risk: a strong DXY rally could temporarily pressure BTC.`,
      supportLevels: [95000, 92500, 88000],
      resistanceLevels: [100000, 105000, 108000],
      keyFactors: [
        "Spot ETF inflows at record levels ($1.2B daily)",
        "Exchange reserves at 5-year lows - supply squeeze forming",
        "Fed pivot narrative supporting risk assets",
        "Whale accumulation detected - 15,000 BTC moved to cold storage",
        "Hash rate at all-time high indicating miner confidence",
      ],
      liquidityZones: [
        { price: 95000, strength: "high" },
        { price: 100000, strength: "high" },
        { price: 92500, strength: "medium" },
        { price: 105000, strength: "medium" },
      ],
      prediction: "BTC likely to test $100,000 resistance within the next 7-14 days. A decisive break above could trigger a move toward $108,000.",
      confidence: 78,
      generatedAt: new Date().toISOString(),
    },
    eth: {
      id: "ai2", assetSymbol: "ETH/USD", trend: "sideways", sentiment: "neutral",
      summary: `Ethereum is trading at $${price.toLocaleString()} in a consolidation range. The ETH/BTC ratio has weakened, suggesting capital rotation into Bitcoin. However, Ethereum's fundamentals remain strong with record DeFi TVL and increasing L2 activity. The upcoming protocol upgrade could serve as a catalyst. Watch the $3,700 support level closely.`,
      supportLevels: [3700, 3500, 3200],
      resistanceLevels: [4000, 4200, 4500],
      keyFactors: [
        "ETH/BTC ratio declining - capital rotating to BTC",
        "DeFi TVL growing steadily across Ethereum ecosystem",
        "Layer 2 activity at all-time highs",
        "Protocol upgrade expected in coming weeks",
        "Staking yields remain attractive at 4.2%",
      ],
      liquidityZones: [
        { price: 3700, strength: "high" },
        { price: 4000, strength: "high" },
        { price: 3500, strength: "medium" },
      ],
      prediction: "ETH likely to remain range-bound between $3,700-$4,000 until a catalyst breaks the range.",
      confidence: 65,
      generatedAt: new Date().toISOString(),
    },
  };

  return analyses[symbol.toLowerCase().replace("/usd", "")] || {
    id: "ai-default", assetSymbol: symbol, trend: "sideways", sentiment: "neutral",
    summary: `${symbol} is trading at $${price.toLocaleString()}. The asset shows mixed signals with no clear directional bias. Monitor key support and resistance levels for potential breakout opportunities.`,
    supportLevels: [price * 0.95, price * 0.9, price * 0.85],
    resistanceLevels: [price * 1.05, price * 1.1, price * 1.15],
    keyFactors: ["Monitor broader market conditions", "Watch for volume confirmation on any breakout", "Key macro events may drive volatility"],
    liquidityZones: [{ price: price * 0.95, strength: "medium" }, { price: price * 1.05, strength: "medium" }],
    confidence: 55,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Liquidation Data
// ---------------------------------------------------------------------------

export function getLiquidationData(): LiquidationData[] {
  const basePrice = 98450;
  const data: LiquidationData[] = [];
  for (let i = -20; i <= 20; i++) {
    const price = basePrice + i * 250;
    const distFromCenter = Math.abs(i);
    data.push({
      price,
      longLiquidations: i < 0 ? Math.max(0, (20 - distFromCenter) * 15 + Math.random() * 50) : 0,
      shortLiquidations: i > 0 ? Math.max(0, (20 - distFromCenter) * 12 + Math.random() * 40) : 0,
      totalValue: Math.random() * 200 + 20,
    });
  }
  return data;
}

// ---------------------------------------------------------------------------
// Market Data API Integration Guide
// ---------------------------------------------------------------------------
// In production, replace mock data with these APIs:
//
// 1. CRYPTO MARKET DATA:
//    - CoinGecko API (free tier: 50 calls/min)
//      GET https://api.coingecko.com/api/v3/coins/markets
//    - Binance WebSocket for real-time prices
//      wss://stream.binance.com:9443/ws/btcusdt@ticker
//
// 2. FOREX DATA:
//    - Polygon.io (from $29/mo)
//      GET https://api.polygon.io/v2/aggs/ticker/C:EURUSD/range/1/day
//    - Alpha Vantage (free: 25 calls/day)
//
// 3. BLOCKCHAIN / WHALE DATA:
//    - Whale Alert API
//      GET https://api.whale-alert.io/v1/transactions
//    - Glassnode (from $29/mo)
//      On-chain metrics, exchange flows
//
// 4. NEWS:
//    - CryptoPanic API (free tier available)
//    - NewsAPI.org (free: 100 calls/day)
//
// 5. MACRO DATA:
//    - FRED API (free)
//    - Trading Economics API
// ---------------------------------------------------------------------------

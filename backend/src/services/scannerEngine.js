const { fetchMultipleQuotes, fetchAllNSEStocks, NIFTY500_SYMBOLS } = require('./dataFetcher');

const SCANNERS = {
  day_high: { name: 'Day High', description: 'Stocks at intraday high', icon: '🔺', category: 'Price Levels',
    filter: q => q.ltp > 0 && q.high > 0 && q.ltp >= q.high * 0.999,
    sort: (a, b) => b.change_pct - a.change_pct },
  day_low: { name: 'Day Low', description: 'Stocks at intraday low', icon: '🔻', category: 'Price Levels',
    filter: q => q.ltp > 0 && q.low > 0 && q.ltp <= q.low * 1.001,
    sort: (a, b) => a.change_pct - b.change_pct },
  near_day_high: { name: 'Near Day High', description: 'Within 1% of day high', icon: '▲', category: 'Price Levels',
    filter: q => q.ltp > 0 && q.high > 0 && q.ltp >= q.high * 0.99,
    sort: (a, b) => b.change_pct - a.change_pct },
  near_day_low: { name: 'Near Day Low', description: 'Within 1% of day low', icon: '▼', category: 'Price Levels',
    filter: q => q.ltp > 0 && q.low > 0 && q.ltp <= q.low * 1.01,
    sort: (a, b) => a.change_pct - b.change_pct },
  week_52_high_breakout: { name: '52W High Breakout', description: 'Near 52-week high', icon: '🏆', category: 'Price Levels',
    filter: q => q.ltp > 0 && q.week_52_high > 0 && q.ltp >= q.week_52_high * 0.98,
    sort: (a, b) => b.change_pct - a.change_pct },
  week_52_low_breakdown: { name: '52W Low Breakdown', description: 'Near 52-week low', icon: '💥', category: 'Price Levels',
    filter: q => q.ltp > 0 && q.week_52_low > 0 && q.ltp <= q.week_52_low * 1.02,
    sort: (a, b) => a.change_pct - b.change_pct },
  high_volume: { name: 'High Volume', description: 'Volume >2x 10d average', icon: '📊', category: 'Volume',
    filter: q => q.volume > 0 && q.avg_volume_10d > 0 && q.volume > q.avg_volume_10d * 2,
    sort: (a, b) => (b.volume / (b.avg_volume_10d || 1)) - (a.volume / (a.avg_volume_10d || 1)) },
  up_5pct_high_vol: { name: 'Up >5% + Volume', description: 'Strong rally with volume', icon: '🚀', category: 'MVP Picks',
    filter: q => q.change_pct >= 5 && q.volume > (q.avg_volume_10d || 0) * 1.5,
    sort: (a, b) => b.change_pct - a.change_pct },
  down_5pct_high_vol: { name: 'Down >5% + Volume', description: 'Heavy sell-off', icon: '💀', category: 'MVP Picks',
    filter: q => q.change_pct <= -5 && q.volume > (q.avg_volume_10d || 0) * 1.5,
    sort: (a, b) => a.change_pct - b.change_pct },
  gap_up: { name: 'Gap Up', description: 'Opened >2% above prev close', icon: '⬆️', category: 'Performance',
    filter: q => q.open > 0 && q.prev_close > 0 && q.open > q.prev_close * 1.02,
    sort: (a, b) => ((b.open - b.prev_close) / b.prev_close) - ((a.open - a.prev_close) / a.prev_close) },
  gap_down: { name: 'Gap Down', description: 'Opened >2% below prev close', icon: '⬇️', category: 'Performance',
    filter: q => q.open > 0 && q.prev_close > 0 && q.open < q.prev_close * 0.98,
    sort: (a, b) => ((a.open - a.prev_close) / a.prev_close) - ((b.open - b.prev_close) / b.prev_close) },
  bullish_candle: { name: 'Strong Bullish', description: 'Wide range bullish bar', icon: '🟢', category: 'Performance',
    filter: q => q.ltp > q.open && q.high > q.low && (q.ltp - q.open) > (q.high - q.low) * 0.6 && q.change_pct > 2,
    sort: (a, b) => b.change_pct - a.change_pct },
  bearish_candle: { name: 'Strong Bearish', description: 'Wide range bearish bar', icon: '🔴', category: 'Performance',
    filter: q => q.ltp < q.open && q.high > q.low && (q.open - q.ltp) > (q.high - q.low) * 0.6 && q.change_pct < -2,
    sort: (a, b) => a.change_pct - b.change_pct },
  opening_range_breakout: { name: 'ORB Breakout', description: 'Above opening range', icon: '🎯', category: 'Performance',
    filter: q => q.ltp > q.open * 1.01 && q.change_pct > 1,
    sort: (a, b) => b.change_pct - a.change_pct },
  top_gainers: { name: 'Top Gainers', description: 'Highest gains today', icon: '📈', category: 'Performance',
    filter: q => q.change_pct > 0 && q.ltp > 0, sort: (a, b) => b.change_pct - a.change_pct, limit: 50 },
  top_losers: { name: 'Top Losers', description: 'Biggest drops today', icon: '📉', category: 'Performance',
    filter: q => q.change_pct < 0 && q.ltp > 0, sort: (a, b) => a.change_pct - b.change_pct, limit: 50 },
  most_active: { name: 'Most Active', description: 'Highest volume', icon: '🔥', category: 'Volume',
    filter: q => q.volume > 0, sort: (a, b) => (b.volume || 0) - (a.volume || 0), limit: 50 },
};

async function runScanner(scannerKey) {
  const scanner = SCANNERS[scannerKey];
  if (!scanner) throw new Error(`Scanner '${scannerKey}' not found`);

  // Get live data — try NSE first, then Yahoo
  let quotes = await fetchAllNSEStocks();
  if (!quotes.length || !quotes[0].ltp) {
    quotes = await fetchMultipleQuotes(NIFTY500_SYMBOLS.slice(0, 50));
  }

  let results = quotes.filter(scanner.filter);
  results.sort(scanner.sort);
  if (scanner.limit) results = results.slice(0, scanner.limit);

  return {
    scanner: scannerKey, name: scanner.name, description: scanner.description,
    icon: scanner.icon, category: scanner.category, count: results.length,
    stocks: results.map(q => ({
      symbol: q.symbol, name: q.name, exchange: q.exchange || 'NSE', sector: q.sector,
      ltp: q.ltp, open: q.open, high: q.high, low: q.low, prev_close: q.prev_close,
      change_pct: q.change_pct, volume: q.volume, avg_volume_10d: q.avg_volume_10d,
      day_high: q.high, day_low: q.low, week_52_high: q.week_52_high, week_52_low: q.week_52_low,
      market_cap: q.market_cap,
      volume_ratio: q.avg_volume_10d > 0 ? (q.volume / q.avg_volume_10d).toFixed(1) : null,
    })),
  };
}

function getAllScanners() {
  return Object.entries(SCANNERS).map(([key, s]) => ({
    key, name: s.name, description: s.description, icon: s.icon, category: s.category,
  }));
}

module.exports = { runScanner, getAllScanners, SCANNERS };

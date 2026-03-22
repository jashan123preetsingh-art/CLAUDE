const { query } = require('../config/database');

// Pre-built scanner definitions
const SCANNERS = {
  day_high: {
    name: 'Day High',
    description: 'Stocks trading at their intraday high right now',
    icon: '🔺',
    category: 'Price Levels',
    sql: `SELECT s.*, p.* FROM stocks s
          JOIN price_data p ON s.id = p.stock_id
          WHERE p.ltp >= p.day_high * 0.999 AND p.ltp > 0
          ORDER BY p.change_pct DESC`,
  },
  day_low: {
    name: 'Day Low',
    description: 'Stocks trading at or near their intraday low',
    icon: '🔻',
    category: 'Price Levels',
    sql: `SELECT s.*, p.* FROM stocks s
          JOIN price_data p ON s.id = p.stock_id
          WHERE p.ltp <= p.day_low * 1.001 AND p.ltp > 0
          ORDER BY p.change_pct ASC`,
  },
  near_day_high: {
    name: 'Near Day High',
    description: 'Within 1% of day high — watch for breakout',
    icon: '▲',
    category: 'Price Levels',
    sql: `SELECT s.*, p.* FROM stocks s
          JOIN price_data p ON s.id = p.stock_id
          WHERE p.ltp >= p.day_high * 0.99 AND p.ltp < p.day_high * 0.999 AND p.ltp > 0
          ORDER BY p.change_pct DESC`,
  },
  near_day_low: {
    name: 'Near Day Low',
    description: 'Within 1% of day low — watch for support',
    icon: '▼',
    category: 'Price Levels',
    sql: `SELECT s.*, p.* FROM stocks s
          JOIN price_data p ON s.id = p.stock_id
          WHERE p.ltp <= p.day_low * 1.01 AND p.ltp > p.day_low * 1.001 AND p.ltp > 0
          ORDER BY p.change_pct ASC`,
  },
  week_52_high_breakout: {
    name: '52W High Breakout',
    description: 'Breaking above 52-week high with volume confirmation',
    icon: '🏆',
    category: 'Price Levels',
    sql: `SELECT s.*, p.* FROM stocks s
          JOIN price_data p ON s.id = p.stock_id
          WHERE p.ltp >= p.week_52_high * 0.99 AND p.ltp > 0
          ORDER BY p.change_pct DESC`,
  },
  week_52_low_breakdown: {
    name: '52W Low Breakdown',
    description: 'Breaking below 52-week low — extreme weakness',
    icon: '💥',
    category: 'Price Levels',
    sql: `SELECT s.*, p.* FROM stocks s
          JOIN price_data p ON s.id = p.stock_id
          WHERE p.ltp <= p.week_52_low * 1.01 AND p.ltp > 0
          ORDER BY p.change_pct ASC`,
  },
  high_volume: {
    name: 'High Volume Stocks',
    description: 'Volume > 2x average — unusual activity',
    icon: '📊',
    category: 'Volume',
    sql: `SELECT s.*, p.* FROM stocks s
          JOIN price_data p ON s.id = p.stock_id
          WHERE p.volume > p.avg_volume_10d * 2 AND p.avg_volume_10d > 0
          ORDER BY (p.volume::float / NULLIF(p.avg_volume_10d, 0)) DESC`,
  },
  up_5pct_high_vol: {
    name: 'Up >5% + 2x Volume',
    description: 'Strong rally with heavy volume confirmation',
    icon: '🚀',
    category: 'MVP Picks',
    sql: `SELECT s.*, p.* FROM stocks s
          JOIN price_data p ON s.id = p.stock_id
          WHERE p.change_pct >= 5 AND p.volume > p.avg_volume_10d * 2 AND p.avg_volume_10d > 0
          ORDER BY p.change_pct DESC`,
  },
  down_5pct_high_vol: {
    name: 'Down >5% + 2x Volume',
    description: 'Sharp sell-off with heavy volume — panic or distribution',
    icon: '💀',
    category: 'MVP Picks',
    sql: `SELECT s.*, p.* FROM stocks s
          JOIN price_data p ON s.id = p.stock_id
          WHERE p.change_pct <= -5 AND p.volume > p.avg_volume_10d * 2 AND p.avg_volume_10d > 0
          ORDER BY p.change_pct ASC`,
  },
  gap_up: {
    name: 'Gap Up Opening',
    description: 'Opened significantly above previous close',
    icon: '⬆️',
    category: 'Performance',
    sql: `SELECT s.*, p.* FROM stocks s
          JOIN price_data p ON s.id = p.stock_id
          WHERE p.open > p.prev_close * 1.02 AND p.prev_close > 0
          ORDER BY ((p.open - p.prev_close) / p.prev_close * 100) DESC`,
  },
  gap_down: {
    name: 'Gap Down Opening',
    description: 'Opened significantly below previous close',
    icon: '⬇️',
    category: 'Performance',
    sql: `SELECT s.*, p.* FROM stocks s
          JOIN price_data p ON s.id = p.stock_id
          WHERE p.open < p.prev_close * 0.98 AND p.prev_close > 0
          ORDER BY ((p.open - p.prev_close) / p.prev_close * 100) ASC`,
  },
  bullish_candle: {
    name: 'Strong Bullish Candle',
    description: 'Wide range bar, closing near high with volume',
    icon: '🟢',
    category: 'Performance',
    sql: `SELECT s.*, p.* FROM stocks s
          JOIN price_data p ON s.id = p.stock_id
          WHERE p.ltp > p.open
            AND (p.ltp - p.open) > (p.high - p.low) * 0.6
            AND p.change_pct > 2
            AND p.high > p.low
          ORDER BY p.change_pct DESC`,
  },
  bearish_candle: {
    name: 'Strong Bearish Candle',
    description: 'Wide range bar, closing near low — selling pressure',
    icon: '🔴',
    category: 'Performance',
    sql: `SELECT s.*, p.* FROM stocks s
          JOIN price_data p ON s.id = p.stock_id
          WHERE p.ltp < p.open
            AND (p.open - p.ltp) > (p.high - p.low) * 0.6
            AND p.change_pct < -2
            AND p.high > p.low
          ORDER BY p.change_pct ASC`,
  },
  opening_range_breakout: {
    name: 'Opening Range Breakout',
    description: 'Price above first 15-min high with volume',
    icon: '🎯',
    category: 'Performance',
    sql: `SELECT s.*, p.* FROM stocks s
          JOIN price_data p ON s.id = p.stock_id
          WHERE p.ltp > p.open * 1.01 AND p.change_pct > 1 AND p.volume > p.avg_volume_10d
          ORDER BY p.change_pct DESC`,
  },
  top_gainers: {
    name: 'Top Gainers',
    description: 'Stocks with highest percentage gains today',
    icon: '📈',
    category: 'Performance',
    sql: `SELECT s.*, p.* FROM stocks s
          JOIN price_data p ON s.id = p.stock_id
          WHERE p.change_pct > 0 AND p.ltp > 0
          ORDER BY p.change_pct DESC
          LIMIT 50`,
  },
  top_losers: {
    name: 'Top Losers',
    description: 'Stocks with highest percentage losses today',
    icon: '📉',
    category: 'Performance',
    sql: `SELECT s.*, p.* FROM stocks s
          JOIN price_data p ON s.id = p.stock_id
          WHERE p.change_pct < 0 AND p.ltp > 0
          ORDER BY p.change_pct ASC
          LIMIT 50`,
  },
  most_active: {
    name: 'Most Active by Volume',
    description: 'Highest traded volume stocks',
    icon: '🔥',
    category: 'Volume',
    sql: `SELECT s.*, p.* FROM stocks s
          JOIN price_data p ON s.id = p.stock_id
          WHERE p.volume > 0
          ORDER BY p.volume DESC
          LIMIT 50`,
  },
};

// Run a pre-built scanner
async function runScanner(scannerKey) {
  const scanner = SCANNERS[scannerKey];
  if (!scanner) throw new Error(`Scanner '${scannerKey}' not found`);

  const result = await query(scanner.sql);
  return {
    scanner: scannerKey,
    name: scanner.name,
    description: scanner.description,
    icon: scanner.icon,
    category: scanner.category,
    count: result.rows.length,
    stocks: result.rows.map(formatStockResult),
  };
}

// Run custom scanner with user-defined conditions
async function runCustomScanner(conditions) {
  let whereClauses = [];
  let params = [];
  let paramIndex = 1;

  for (const cond of conditions) {
    const { field, operator, value } = cond;
    const allowedFields = [
      'p.ltp', 'p.change_pct', 'p.volume', 'p.avg_volume_10d',
      'p.day_high', 'p.day_low', 'p.week_52_high', 'p.week_52_low',
      'p.open', 'p.close', 'p.prev_close', 'p.market_cap',
      'f.pe_ratio', 'f.pb_ratio', 'f.roe', 'f.roce', 'f.eps',
      'f.debt_to_equity', 'f.dividend_yield', 'f.promoter_holding',
      'f.revenue_growth_yoy', 'f.profit_growth_yoy',
      's.market_cap', 's.sector',
    ];
    const allowedOps = ['>', '<', '>=', '<=', '=', '!=', 'LIKE'];

    if (!allowedFields.includes(field)) continue;
    if (!allowedOps.includes(operator.toUpperCase())) continue;

    whereClauses.push(`${field} ${operator} $${paramIndex}`);
    params.push(value);
    paramIndex++;
  }

  if (whereClauses.length === 0) {
    throw new Error('No valid conditions provided');
  }

  const sql = `
    SELECT s.*, p.*, f.pe_ratio, f.pb_ratio, f.roe, f.roce, f.eps, f.debt_to_equity
    FROM stocks s
    JOIN price_data p ON s.id = p.stock_id
    LEFT JOIN fundamentals f ON s.id = f.stock_id
    WHERE ${whereClauses.join(' AND ')} AND p.ltp > 0
    ORDER BY p.change_pct DESC
    LIMIT 200
  `;

  const result = await query(sql, params);
  return {
    scanner: 'custom',
    name: 'Custom Scanner',
    count: result.rows.length,
    stocks: result.rows.map(formatStockResult),
  };
}

function formatStockResult(row) {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    exchange: row.exchange,
    sector: row.sector,
    industry: row.industry,
    ltp: parseFloat(row.ltp) || 0,
    open: parseFloat(row.open) || 0,
    high: parseFloat(row.high) || 0,
    low: parseFloat(row.low) || 0,
    close: parseFloat(row.close) || 0,
    prev_close: parseFloat(row.prev_close) || 0,
    change_pct: parseFloat(row.change_pct) || 0,
    volume: parseInt(row.volume) || 0,
    avg_volume_10d: parseInt(row.avg_volume_10d) || 0,
    day_high: parseFloat(row.day_high) || 0,
    day_low: parseFloat(row.day_low) || 0,
    week_52_high: parseFloat(row.week_52_high) || 0,
    week_52_low: parseFloat(row.week_52_low) || 0,
    market_cap: parseInt(row.market_cap) || 0,
    pe_ratio: parseFloat(row.pe_ratio) || null,
    roe: parseFloat(row.roe) || null,
    roce: parseFloat(row.roce) || null,
    volume_ratio: row.avg_volume_10d > 0
      ? (row.volume / row.avg_volume_10d).toFixed(1)
      : null,
  };
}

function getAllScanners() {
  return Object.entries(SCANNERS).map(([key, scanner]) => ({
    key,
    name: scanner.name,
    description: scanner.description,
    icon: scanner.icon,
    category: scanner.category,
  }));
}

module.exports = { runScanner, runCustomScanner, getAllScanners, SCANNERS };

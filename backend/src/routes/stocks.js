const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { fetchYahooQuote, fetchHistoricalData } = require('../services/dataFetcher');

// GET /api/stocks - List all stocks with pagination and search
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, search, sector, exchange, sort = 'symbol', order = 'ASC' } = req.query;
    const offset = (page - 1) * limit;
    let whereClauses = ['s.active = true'];
    let params = [];
    let paramIndex = 1;

    if (search) {
      whereClauses.push(`(s.symbol ILIKE $${paramIndex} OR s.name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (sector) {
      whereClauses.push(`s.sector = $${paramIndex}`);
      params.push(sector);
      paramIndex++;
    }
    if (exchange) {
      whereClauses.push(`s.exchange = $${paramIndex}`);
      params.push(exchange);
      paramIndex++;
    }

    const allowedSorts = { symbol: 's.symbol', name: 's.name', change_pct: 'p.change_pct', volume: 'p.volume', ltp: 'p.ltp', market_cap: 's.market_cap' };
    const sortCol = allowedSorts[sort] || 's.symbol';
    const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const sql = `
      SELECT s.*, p.ltp, p.change_pct, p.volume, p.day_high, p.day_low, p.week_52_high, p.week_52_low, p.prev_close, p.open, p.high, p.low
      FROM stocks s
      LEFT JOIN price_data p ON s.id = p.stock_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit), parseInt(offset));

    const [result, countResult] = await Promise.all([
      query(sql, params),
      query(`SELECT COUNT(*) FROM stocks s WHERE ${whereClauses.join(' AND ')}`, params.slice(0, -2)),
    ]);

    res.json({
      stocks: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit),
    });
  } catch (err) {
    console.error('Error fetching stocks:', err);
    res.status(500).json({ error: 'Failed to fetch stocks' });
  }
});

// GET /api/stocks/market-overview
router.get('/market-overview', async (req, res) => {
  try {
    const [gainers, losers, active, sectors] = await Promise.all([
      query(`SELECT s.symbol, s.name, p.ltp, p.change_pct, p.volume FROM stocks s JOIN price_data p ON s.id = p.stock_id WHERE p.change_pct > 0 ORDER BY p.change_pct DESC LIMIT 10`),
      query(`SELECT s.symbol, s.name, p.ltp, p.change_pct, p.volume FROM stocks s JOIN price_data p ON s.id = p.stock_id WHERE p.change_pct < 0 ORDER BY p.change_pct ASC LIMIT 10`),
      query(`SELECT s.symbol, s.name, p.ltp, p.change_pct, p.volume FROM stocks s JOIN price_data p ON s.id = p.stock_id WHERE p.volume > 0 ORDER BY p.volume DESC LIMIT 10`),
      query(`SELECT s.sector, COUNT(*) as count, AVG(p.change_pct) as avg_change FROM stocks s JOIN price_data p ON s.id = p.stock_id WHERE s.sector IS NOT NULL GROUP BY s.sector ORDER BY avg_change DESC`),
    ]);

    res.json({
      topGainers: gainers.rows,
      topLosers: losers.rows,
      mostActive: active.rows,
      sectorPerformance: sectors.rows,
    });
  } catch (err) {
    console.error('Error fetching market overview:', err);
    res.status(500).json({ error: 'Failed to fetch market overview' });
  }
});

// GET /api/stocks/:symbol - Stock detail
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const result = await query(
      `SELECT s.*, p.*, f.pe_ratio, f.pb_ratio, f.roe, f.roce, f.eps, f.dividend_yield,
              f.debt_to_equity, f.current_ratio, f.book_value, f.revenue, f.net_profit,
              f.operating_margin, f.net_margin, f.revenue_growth_yoy, f.profit_growth_yoy,
              f.promoter_holding, f.promoter_pledge, f.fii_holding, f.dii_holding, f.public_holding
       FROM stocks s
       LEFT JOIN price_data p ON s.id = p.stock_id
       LEFT JOIN fundamentals f ON s.id = f.stock_id
       WHERE UPPER(s.symbol) = UPPER($1)`,
      [symbol]
    );

    if (result.rows.length === 0) {
      // Try fetching from Yahoo Finance
      const quote = await fetchYahooQuote(symbol);
      if (quote) return res.json({ ...quote, source: 'yahoo' });
      return res.status(404).json({ error: 'Stock not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching stock detail:', err);
    res.status(500).json({ error: 'Failed to fetch stock' });
  }
});

// GET /api/stocks/:symbol/live - Live quote from Yahoo
router.get('/:symbol/live', async (req, res) => {
  try {
    const quote = await fetchYahooQuote(req.params.symbol);
    if (!quote) return res.status(404).json({ error: 'Quote not available' });
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch live quote' });
  }
});

// GET /api/stocks/sectors/list
router.get('/sectors/list', async (req, res) => {
  try {
    const result = await query(`SELECT DISTINCT sector FROM stocks WHERE sector IS NOT NULL ORDER BY sector`);
    res.json(result.rows.map(r => r.sector));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sectors' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { fetchFIIDIIData } = require('../services/dataFetcher');

// GET /api/fii-dii/latest
router.get('/latest', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM fii_dii_data ORDER BY date DESC LIMIT 1`
    );

    if (result.rows.length === 0) {
      // Try live fetch
      const liveData = await fetchFIIDIIData();
      if (liveData) return res.json({ ...liveData, source: 'live' });
      return res.json({ message: 'No FII/DII data available yet' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch FII/DII data' });
  }
});

// GET /api/fii-dii/history
router.get('/history', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const result = await query(
      `SELECT * FROM fii_dii_data ORDER BY date DESC LIMIT $1`,
      [parseInt(days)]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch FII/DII history' });
  }
});

// GET /api/fii-dii/cumulative
router.get('/cumulative', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        SUM(fii_net) as fii_total_net,
        SUM(dii_net) as dii_total_net,
        SUM(CASE WHEN date >= NOW() - INTERVAL '15 days' THEN fii_net ELSE 0 END) as fii_15d_net,
        SUM(CASE WHEN date >= NOW() - INTERVAL '15 days' THEN dii_net ELSE 0 END) as dii_15d_net,
        SUM(CASE WHEN date >= NOW() - INTERVAL '30 days' THEN fii_net ELSE 0 END) as fii_30d_net,
        SUM(CASE WHEN date >= NOW() - INTERVAL '30 days' THEN dii_net ELSE 0 END) as dii_30d_net,
        (SELECT COUNT(*) FROM fii_dii_data WHERE fii_net < 0 AND date >= NOW() - INTERVAL '30 days') as fii_selling_days,
        (SELECT COUNT(*) FROM fii_dii_data WHERE fii_net > 0 AND date >= NOW() - INTERVAL '30 days') as fii_buying_days
      FROM fii_dii_data
      WHERE date >= NOW() - INTERVAL '1 year'
    `);

    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cumulative data' });
  }
});

// GET /api/fii-dii/sector-allocation
router.get('/sector-allocation', async (req, res) => {
  try {
    const result = await query(`
      SELECT s.sector,
        AVG(f.fii_holding) as avg_fii_holding,
        AVG(f.dii_holding) as avg_dii_holding,
        COUNT(*) as stock_count,
        SUM(s.market_cap) as total_market_cap
      FROM stocks s
      JOIN fundamentals f ON s.id = f.stock_id
      WHERE s.sector IS NOT NULL AND f.fii_holding IS NOT NULL
      GROUP BY s.sector
      ORDER BY avg_fii_holding DESC NULLS LAST
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sector allocation' });
  }
});

module.exports = router;

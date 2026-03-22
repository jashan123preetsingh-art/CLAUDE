const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { fetchHistoricalData } = require('../services/dataFetcher');

// GET /api/charts/:symbol - Get chart data
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1D', period = '1y' } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (period) {
      case '1m': startDate.setMonth(startDate.getMonth() - 1); break;
      case '3m': startDate.setMonth(startDate.getMonth() - 3); break;
      case '6m': startDate.setMonth(startDate.getMonth() - 6); break;
      case '1y': startDate.setFullYear(startDate.getFullYear() - 1); break;
      case '3y': startDate.setFullYear(startDate.getFullYear() - 3); break;
      case '5y': startDate.setFullYear(startDate.getFullYear() - 5); break;
      default: startDate.setFullYear(startDate.getFullYear() - 1);
    }

    // Try DB first
    const dbResult = await query(
      `SELECT date, open, high, low, close, volume FROM historical_prices
       WHERE stock_id = (SELECT id FROM stocks WHERE UPPER(symbol) = UPPER($1) LIMIT 1)
       AND timeframe = $2 AND date >= $3 AND date <= $4
       ORDER BY date ASC`,
      [symbol, timeframe, startDate, endDate]
    );

    if (dbResult.rows.length > 10) {
      return res.json({
        symbol,
        timeframe,
        candles: dbResult.rows.map(r => ({
          time: r.date,
          open: parseFloat(r.open),
          high: parseFloat(r.high),
          low: parseFloat(r.low),
          close: parseFloat(r.close),
          volume: parseInt(r.volume),
        })),
      });
    }

    // Fallback to Yahoo Finance
    const interval = timeframe === '1D' ? '1d' : timeframe === '1W' ? '1wk' : '1mo';
    const historical = await fetchHistoricalData(symbol, startDate, endDate, interval);

    const candles = historical.map(d => ({
      time: d.date.toISOString().split('T')[0],
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
    }));

    res.json({ symbol, timeframe, period, candles, source: 'yahoo' });
  } catch (err) {
    console.error('Chart data error:', err);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { fetchHistoricalData, fetchIntradayData } = require('../services/dataFetcher');

// GET /api/charts/:symbol - Chart data with support for 1H, 4H, 1D, 1W, 1M
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1D', period = '1y' } = req.query;

    // For intraday timeframes (1H, 4H), use Yahoo chart API
    if (timeframe === '1H' || timeframe === '4H') {
      const interval = timeframe === '1H' ? '60m' : '60m'; // Yahoo doesn't have 4h natively
      const range = period === '1m' ? '1mo' : period === '3m' ? '3mo' : period === '6m' ? '6mo' : '5d';
      let candles = await fetchIntradayData(symbol, interval, range);

      // For 4H, aggregate 1H candles into 4H
      if (timeframe === '4H' && candles.length > 0) {
        const aggregated = [];
        for (let i = 0; i < candles.length; i += 4) {
          const chunk = candles.slice(i, i + 4);
          if (chunk.length === 0) continue;
          aggregated.push({
            time: chunk[0].time,
            open: chunk[0].open,
            high: Math.max(...chunk.map(c => c.high)),
            low: Math.min(...chunk.map(c => c.low)),
            close: chunk[chunk.length - 1].close,
            volume: chunk.reduce((s, c) => s + (c.volume || 0), 0),
          });
        }
        candles = aggregated;
      }

      return res.json({ symbol, timeframe, period, candles, count: candles.length, isIntraday: true });
    }

    // Daily, Weekly, Monthly
    const endDate = new Date();
    const startDate = new Date();
    switch (period) {
      case '1m': startDate.setMonth(startDate.getMonth() - 1); break;
      case '3m': startDate.setMonth(startDate.getMonth() - 3); break;
      case '6m': startDate.setMonth(startDate.getMonth() - 6); break;
      case '1y': startDate.setFullYear(startDate.getFullYear() - 1); break;
      case '3y': startDate.setFullYear(startDate.getFullYear() - 3); break;
      case '5y': startDate.setFullYear(startDate.getFullYear() - 5); break;
      case '10y': startDate.setFullYear(startDate.getFullYear() - 10); break;
      case 'max': startDate.setFullYear(2000); break;
      default: startDate.setFullYear(startDate.getFullYear() - 1);
    }

    const interval = timeframe === '1W' ? '1wk' : timeframe === '1M' ? '1mo' : '1d';
    const candles = await fetchHistoricalData(symbol, startDate, endDate, interval);

    res.json({ symbol, timeframe, period, candles, count: candles.length, isIntraday: false });
  } catch (err) {
    console.error('Chart error:', err.message);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

module.exports = router;

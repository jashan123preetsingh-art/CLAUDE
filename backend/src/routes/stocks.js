const express = require('express');
const router = express.Router();
const { NIFTY500_SYMBOLS, SECTOR_MAP, fetchAllNSEStocks, fetchYahooQuote, fetchMultipleQuotes, fetchIndexQuote } = require('../services/dataFetcher');

// GET /api/stocks - All stocks with LIVE prices from NSE + Yahoo
router.get('/', async (req, res) => {
  try {
    const { search, sector, limit = 50, page = 1 } = req.query;

    // Try NSE first for instant data
    let stocks = await fetchAllNSEStocks();

    if (search) {
      const s = search.toLowerCase();
      stocks = stocks.filter(st => st.symbol.toLowerCase().includes(s) || (st.name || '').toLowerCase().includes(s));
    }
    if (sector) {
      stocks = stocks.filter(st => st.sector === sector);
    }

    const total = stocks.length;
    const offset = (page - 1) * limit;
    const paged = stocks.slice(offset, offset + parseInt(limit));

    // If NSE data doesn't have prices, enrich with Yahoo
    if (paged.length > 0 && !paged[0].ltp) {
      const symbols = paged.map(s => s.symbol);
      const quotes = await fetchMultipleQuotes(symbols);
      paged.forEach(s => {
        const q = quotes.find(qq => qq.symbol === s.symbol);
        if (q) Object.assign(s, q);
      });
    }

    res.json({
      stocks: paged,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Stocks list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stocks' });
  }
});

// GET /api/stocks/market-overview - LIVE market overview
router.get('/market-overview', async (req, res) => {
  try {
    let stocks = await fetchAllNSEStocks();

    // If NSE returned priced data
    if (stocks.length > 0 && stocks[0].ltp) {
      const sorted = stocks.filter(q => q.ltp > 0);
      const topGainers = [...sorted].sort((a, b) => (b.change_pct || 0) - (a.change_pct || 0)).slice(0, 10);
      const topLosers = [...sorted].sort((a, b) => (a.change_pct || 0) - (b.change_pct || 0)).slice(0, 10);
      const mostActive = [...sorted].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 10);

      const sectorMap = {};
      sorted.forEach(s => {
        const sec = s.sector || 'Others';
        if (!sectorMap[sec]) sectorMap[sec] = { sector: sec, totalChange: 0, count: 0 };
        sectorMap[sec].totalChange += (s.change_pct || 0);
        sectorMap[sec].count++;
      });
      const sectorPerformance = Object.values(sectorMap).map(s => ({
        sector: s.sector, count: s.count,
        avg_change: parseFloat((s.totalChange / s.count).toFixed(2)),
      })).sort((a, b) => b.avg_change - a.avg_change);

      return res.json({ topGainers, topLosers, mostActive, sectorPerformance, totalStocks: stocks.length });
    }

    // Fallback: Yahoo for top 50
    const symbols = NIFTY500_SYMBOLS.slice(0, 50);
    const quotes = await fetchMultipleQuotes(symbols);
    const sorted = quotes.filter(q => q.ltp > 0);

    res.json({
      topGainers: [...sorted].sort((a, b) => b.change_pct - a.change_pct).slice(0, 10),
      topLosers: [...sorted].sort((a, b) => a.change_pct - b.change_pct).slice(0, 10),
      mostActive: [...sorted].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 10),
      sectorPerformance: [],
      totalStocks: quotes.length,
    });
  } catch (err) {
    console.error('Market overview error:', err.message);
    res.status(500).json({ error: 'Failed to fetch market overview' });
  }
});

// GET /api/stocks/indices - Live index data
router.get('/indices', async (req, res) => {
  try {
    const indices = ['NIFTY', 'BANKNIFTY', 'SENSEX'];
    const results = await Promise.allSettled(indices.map(i => fetchIndexQuote(i)));
    const data = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch indices' });
  }
});

// GET /api/stocks/sectors/list
router.get('/sectors/list', (req, res) => {
  const sectors = [...new Set(Object.values(SECTOR_MAP))].sort();
  res.json(sectors);
});

// GET /api/stocks/:symbol - LIVE stock detail
router.get('/:symbol', async (req, res) => {
  try {
    const quote = await fetchYahooQuote(req.params.symbol);
    if (!quote) return res.status(404).json({ error: 'Stock not found' });
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stock' });
  }
});

// GET /api/stocks/:symbol/live
router.get('/:symbol/live', async (req, res) => {
  try {
    const quote = await fetchYahooQuote(req.params.symbol);
    if (!quote) return res.status(404).json({ error: 'Quote not available' });
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch live quote' });
  }
});

module.exports = router;

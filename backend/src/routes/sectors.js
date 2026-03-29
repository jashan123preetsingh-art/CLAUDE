const express = require('express');
const router = express.Router();
const { fetchSectorData, fetchAllNSEStocks, fetchMultipleQuotes, NIFTY500_SYMBOLS, SECTOR_MAP } = require('../services/dataFetcher');

// GET /api/sectors - All sectors with live performance
router.get('/', async (req, res) => {
  try {
    const sectorData = await fetchSectorData();
    res.json(sectorData);
  } catch (err) {
    console.error('Sectors error:', err.message);
    res.status(500).json({ error: 'Failed to fetch sector data' });
  }
});

// GET /api/sectors/heatmap - Heatmap data (stocks grouped by sector with change%)
router.get('/heatmap', async (req, res) => {
  try {
    let stocks = await fetchAllNSEStocks();

    // If NSE has prices, use them
    if (stocks.length > 0 && stocks[0].ltp) {
      const result = stocks
        .filter(s => s.ltp > 0 && s.change_pct !== undefined)
        .map(s => ({
          symbol: s.symbol,
          name: s.name,
          sector: s.sector || 'Others',
          ltp: s.ltp,
          change_pct: s.change_pct || 0,
          volume: s.volume || 0,
          market_cap: s.market_cap || 0,
        }));

      return res.json(result);
    }

    // Fallback: Yahoo
    const symbols = NIFTY500_SYMBOLS.slice(0, 100);
    const quotes = await fetchMultipleQuotes(symbols);
    res.json(quotes.filter(q => q.ltp > 0).map(q => ({
      symbol: q.symbol,
      name: q.name,
      sector: q.sector || 'Others',
      ltp: q.ltp,
      change_pct: q.change_pct || 0,
      volume: q.volume || 0,
      market_cap: q.market_cap || 0,
    })));
  } catch (err) {
    console.error('Heatmap error:', err.message);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

// GET /api/sectors/:sector - Stocks in a specific sector
router.get('/:sector', async (req, res) => {
  try {
    const { sector } = req.params;
    const decodedSector = decodeURIComponent(sector);

    // Get symbols for this sector
    const sectorSymbols = Object.entries(SECTOR_MAP)
      .filter(([, sec]) => sec === decodedSector)
      .map(([sym]) => sym);

    if (sectorSymbols.length === 0) {
      return res.json({ sector: decodedSector, stocks: [] });
    }

    const quotes = await fetchMultipleQuotes(sectorSymbols);
    res.json({
      sector: decodedSector,
      count: quotes.length,
      stocks: quotes.sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0)),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sector stocks' });
  }
});

module.exports = router;

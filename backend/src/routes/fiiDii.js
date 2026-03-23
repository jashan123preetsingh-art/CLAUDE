const express = require('express');
const router = express.Router();
const { fetchFIIDIIData, fetchMultipleQuotes, NIFTY500_SYMBOLS, SECTOR_MAP } = require('../services/dataFetcher');

router.get('/latest', async (req, res) => {
  try {
    const data = await fetchFIIDIIData();
    if (data && Array.isArray(data)) {
      const fii = data.find(d => d.category?.includes('FII'));
      const dii = data.find(d => d.category?.includes('DII'));
      return res.json({
        date: fii?.date || new Date().toISOString().split('T')[0],
        fii_buy: parseFloat(fii?.buyValue?.replace(/,/g, '')) || 0,
        fii_sell: parseFloat(fii?.sellValue?.replace(/,/g, '')) || 0,
        fii_net: parseFloat(fii?.netValue?.replace(/,/g, '')) || 0,
        dii_buy: parseFloat(dii?.buyValue?.replace(/,/g, '')) || 0,
        dii_sell: parseFloat(dii?.sellValue?.replace(/,/g, '')) || 0,
        dii_net: parseFloat(dii?.netValue?.replace(/,/g, '')) || 0,
        source: 'nse_live',
      });
    }
    res.json({ error: 'NSE may be rate-limited. Try again.', source: 'nse_unavailable' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch FII/DII data' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const data = await fetchFIIDIIData();
    res.json(data ? (Array.isArray(data) ? data : [data]) : []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

router.get('/cumulative', async (req, res) => {
  try {
    const data = await fetchFIIDIIData();
    if (data && Array.isArray(data)) {
      const fii = data.find(d => d.category?.includes('FII'));
      const dii = data.find(d => d.category?.includes('DII'));
      return res.json({
        fii_latest_net: parseFloat(fii?.netValue?.replace(/,/g, '')) || 0,
        dii_latest_net: parseFloat(dii?.netValue?.replace(/,/g, '')) || 0,
        source: 'nse_live',
      });
    }
    res.json({});
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/sector-allocation', async (req, res) => {
  try {
    const symbols = NIFTY500_SYMBOLS.slice(0, 50);
    const quotes = await fetchMultipleQuotes(symbols);
    const sectorMap = {};
    quotes.forEach(q => {
      if (!q.sector) return;
      if (!sectorMap[q.sector]) sectorMap[q.sector] = { sector: q.sector, total_mcap: 0, count: 0 };
      sectorMap[q.sector].total_mcap += (q.market_cap || 0);
      sectorMap[q.sector].count++;
    });
    const totalMcap = Object.values(sectorMap).reduce((s, v) => s + v.total_mcap, 0);
    const result = Object.values(sectorMap).map(s => ({
      ...s, pct: totalMcap > 0 ? parseFloat((s.total_mcap / totalMcap * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.pct - a.pct);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sector allocation' });
  }
});

module.exports = router;

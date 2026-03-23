const express = require('express');
const router = express.Router();
const { fetchFundamentals, fetchMultipleQuotes, NIFTY500_SYMBOLS, SECTOR_MAP } = require('../services/dataFetcher');

// GET /api/fundamentals/:symbol
router.get('/:symbol', async (req, res) => {
  try {
    const data = await fetchFundamentals(req.params.symbol);
    if (!data) return res.status(404).json({ error: 'Fundamentals not found' });
    res.json(data);
  } catch (err) {
    console.error('Fundamentals error:', err.message);
    res.status(500).json({ error: 'Failed to fetch fundamentals' });
  }
});

// GET /api/fundamentals/screen/filter
router.get('/screen/filter', async (req, res) => {
  try {
    const { minPE, maxPE, minROE, maxDebt, minDividend, sector } = req.query;

    let symbols = NIFTY500_SYMBOLS.slice(0, 50);
    if (sector) {
      symbols = Object.entries(SECTOR_MAP)
        .filter(([, sec]) => sec.toLowerCase().includes(sector.toLowerCase()))
        .map(([sym]) => sym);
    }

    // Get quotes
    const quotes = await fetchMultipleQuotes(symbols.slice(0, 30));

    // Get fundamentals in parallel
    const fundPromises = symbols.slice(0, 30).map(s => fetchFundamentals(s).catch(() => null));
    const fundResults = await Promise.allSettled(fundPromises);

    const results = [];
    fundResults.forEach((fr, i) => {
      if (fr.status !== 'fulfilled' || !fr.value) return;
      const f = fr.value;
      const q = quotes.find(qq => qq.symbol === symbols[i]) || {};

      if (minPE && (!f.pe_ratio || f.pe_ratio < parseFloat(minPE))) return;
      if (maxPE && f.pe_ratio && f.pe_ratio > parseFloat(maxPE)) return;
      if (minROE && (!f.roe || f.roe < parseFloat(minROE))) return;
      if (maxDebt && f.debt_to_equity && f.debt_to_equity > parseFloat(maxDebt)) return;
      if (minDividend && (!f.dividend_yield || f.dividend_yield < parseFloat(minDividend))) return;

      results.push({
        symbol: symbols[i], name: q.name || symbols[i],
        sector: q.sector || SECTOR_MAP[symbols[i]], ltp: q.ltp,
        change_pct: q.change_pct, market_cap: q.market_cap,
        pe_ratio: f.pe_ratio, pb_ratio: f.pb_ratio, roe: f.roe,
        roce: f.roce, eps: f.eps, debt_to_equity: f.debt_to_equity,
        dividend_yield: f.dividend_yield, promoter_holding: f.promoter_holding,
        revenue_growth_yoy: f.revenue_growth_yoy, profit_growth_yoy: f.profit_growth_yoy,
      });
    });

    res.json(results);
  } catch (err) {
    console.error('Screener error:', err.message);
    res.status(500).json({ error: 'Failed to screen stocks' });
  }
});

module.exports = router;

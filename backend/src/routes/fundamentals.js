const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// GET /api/fundamentals/:symbol
router.get('/:symbol', async (req, res) => {
  try {
    const result = await query(
      `SELECT f.*, s.symbol, s.name, s.sector, s.industry, s.market_cap
       FROM fundamentals f
       JOIN stocks s ON f.stock_id = s.id
       WHERE UPPER(s.symbol) = UPPER($1)`,
      [req.params.symbol]
    );

    if (result.rows.length === 0) {
      // Try Yahoo Finance for fundamentals
      try {
        const yahooFinance = require('yahoo-finance2').default;
        const yahooSymbol = `${req.params.symbol}.NS`;
        const [quoteSummary] = await Promise.all([
          yahooFinance.quoteSummary(yahooSymbol, {
            modules: ['financialData', 'defaultKeyStatistics', 'incomeStatementHistory', 'balanceSheetHistory', 'majorHoldersBreakdown']
          }),
        ]);

        const fd = quoteSummary?.financialData || {};
        const ks = quoteSummary?.defaultKeyStatistics || {};
        const holders = quoteSummary?.majorHoldersBreakdown || {};

        return res.json({
          symbol: req.params.symbol,
          pe_ratio: ks.trailingPE || ks.forwardPE,
          pb_ratio: ks.priceToBook,
          roe: fd.returnOnEquity ? (fd.returnOnEquity * 100).toFixed(2) : null,
          roce: null,
          eps: ks.trailingEps,
          dividend_yield: ks.dividendYield ? (ks.dividendYield * 100).toFixed(2) : null,
          debt_to_equity: fd.debtToEquity,
          current_ratio: fd.currentRatio,
          book_value: ks.bookValue,
          revenue: fd.totalRevenue,
          net_profit: fd.netIncomeToCommon,
          operating_margin: fd.operatingMargins ? (fd.operatingMargins * 100).toFixed(2) : null,
          net_margin: fd.profitMargins ? (fd.profitMargins * 100).toFixed(2) : null,
          promoter_holding: holders.insidersPercentHeld ? (holders.insidersPercentHeld * 100).toFixed(2) : null,
          source: 'yahoo',
        });
      } catch (e) {
        return res.status(404).json({ error: 'Fundamentals not found' });
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching fundamentals:', err);
    res.status(500).json({ error: 'Failed to fetch fundamentals' });
  }
});

// GET /api/fundamentals/:symbol/quarterly
router.get('/:symbol/quarterly', async (req, res) => {
  try {
    const result = await query(
      `SELECT qf.* FROM quarterly_financials qf
       JOIN stocks s ON qf.stock_id = s.id
       WHERE UPPER(s.symbol) = UPPER($1)
       ORDER BY qf.year DESC, qf.quarter DESC
       LIMIT 20`,
      [req.params.symbol]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quarterly data' });
  }
});

// GET /api/fundamentals/screen - Screen stocks by fundamentals
router.get('/screen/filter', async (req, res) => {
  try {
    const { minPE, maxPE, minROE, minROCE, maxDebt, minDividend, sector } = req.query;
    let whereClauses = [];
    let params = [];
    let i = 1;

    if (minPE) { whereClauses.push(`f.pe_ratio >= $${i++}`); params.push(minPE); }
    if (maxPE) { whereClauses.push(`f.pe_ratio <= $${i++}`); params.push(maxPE); }
    if (minROE) { whereClauses.push(`f.roe >= $${i++}`); params.push(minROE); }
    if (minROCE) { whereClauses.push(`f.roce >= $${i++}`); params.push(minROCE); }
    if (maxDebt) { whereClauses.push(`f.debt_to_equity <= $${i++}`); params.push(maxDebt); }
    if (minDividend) { whereClauses.push(`f.dividend_yield >= $${i++}`); params.push(minDividend); }
    if (sector) { whereClauses.push(`s.sector = $${i++}`); params.push(sector); }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const result = await query(
      `SELECT s.symbol, s.name, s.sector, s.market_cap, p.ltp, p.change_pct,
              f.pe_ratio, f.pb_ratio, f.roe, f.roce, f.eps, f.debt_to_equity, f.dividend_yield,
              f.revenue_growth_yoy, f.profit_growth_yoy, f.promoter_holding
       FROM stocks s
       JOIN fundamentals f ON s.id = f.stock_id
       LEFT JOIN price_data p ON s.id = p.stock_id
       ${where}
       ORDER BY s.market_cap DESC NULLS LAST
       LIMIT 100`,
      params
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to screen stocks' });
  }
});

module.exports = router;

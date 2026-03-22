const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { fetchOptionsChain, fetchIndexOptionsChain } = require('../services/dataFetcher');

// GET /api/options/:symbol - Get options chain
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const isIndex = ['NIFTY', 'BANKNIFTY', 'FINNIFTY'].includes(symbol.toUpperCase());

    // Try live NSE data
    let data;
    if (isIndex) {
      data = await fetchIndexOptionsChain(symbol.toUpperCase());
    } else {
      data = await fetchOptionsChain(symbol.toUpperCase());
    }

    if (data && data.records) {
      const { expiryDates, data: optionData, strikePrices } = data.records;
      const underlyingValue = data.records.underlyingValue;

      // Process into structured format
      const chain = {};
      (optionData || []).forEach(item => {
        const strike = item.strikePrice;
        if (!chain[strike]) chain[strike] = { strike };
        if (item.CE) {
          chain[strike].ce = {
            ltp: item.CE.lastPrice,
            oi: item.CE.openInterest,
            change_oi: item.CE.changeinOpenInterest,
            volume: item.CE.totalTradedVolume,
            iv: item.CE.impliedVolatility,
            bid: item.CE.bidprice,
            ask: item.CE.askPrice,
            change_pct: item.CE.pchangeinOpenInterest,
          };
        }
        if (item.PE) {
          chain[strike].pe = {
            ltp: item.PE.lastPrice,
            oi: item.PE.openInterest,
            change_oi: item.PE.changeinOpenInterest,
            volume: item.PE.totalTradedVolume,
            iv: item.PE.impliedVolatility,
            bid: item.PE.bidprice,
            ask: item.PE.askPrice,
            change_pct: item.PE.pchangeinOpenInterest,
          };
        }
      });

      // Calculate max pain
      const strikes = Object.values(chain);
      let maxPain = null;
      let minPainValue = Infinity;
      (strikePrices || []).forEach(sp => {
        let painValue = 0;
        strikes.forEach(s => {
          if (s.ce) painValue += Math.max(0, sp - s.strike) * (s.ce.oi || 0);
          if (s.pe) painValue += Math.max(0, s.strike - sp) * (s.pe.oi || 0);
        });
        if (painValue < minPainValue) {
          minPainValue = painValue;
          maxPain = sp;
        }
      });

      // Calculate PCR
      let totalCallOI = 0, totalPutOI = 0;
      strikes.forEach(s => {
        totalCallOI += (s.ce?.oi || 0);
        totalPutOI += (s.pe?.oi || 0);
      });
      const pcr = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : 0;

      return res.json({
        symbol: symbol.toUpperCase(),
        underlyingValue,
        expiryDates,
        strikePrices,
        chain: Object.values(chain).sort((a, b) => a.strike - b.strike),
        analytics: {
          maxPain,
          pcr: parseFloat(pcr),
          totalCallOI,
          totalPutOI,
          totalCallVolume: strikes.reduce((sum, s) => sum + (s.ce?.volume || 0), 0),
          totalPutVolume: strikes.reduce((sum, s) => sum + (s.pe?.volume || 0), 0),
        },
      });
    }

    // Fallback to DB
    const dbResult = await query(
      `SELECT oc.*, s.symbol FROM options_chain oc
       JOIN stocks s ON oc.stock_id = s.id
       WHERE UPPER(s.symbol) = UPPER($1)
       ORDER BY oc.expiry_date, oc.strike_price`,
      [symbol]
    );

    res.json({ symbol, chain: dbResult.rows, source: 'database' });
  } catch (err) {
    console.error('Options chain error:', err);
    res.status(500).json({ error: 'Failed to fetch options chain' });
  }
});

module.exports = router;

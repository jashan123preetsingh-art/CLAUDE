const express = require('express');
const router = express.Router();
const { fetchOptionsChain } = require('../services/dataFetcher');

router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const data = await fetchOptionsChain(symbol.toUpperCase());

    if (!data || !data.records) {
      return res.json({
        symbol: symbol.toUpperCase(),
        error: 'Options data not available — NSE may be rate-limited',
        chain: [], analytics: {},
      });
    }

    const { expiryDates, data: optionData, strikePrices } = data.records;
    const underlyingValue = data.records.underlyingValue;

    const chain = {};
    (optionData || []).forEach(item => {
      const strike = item.strikePrice;
      if (!chain[strike]) chain[strike] = { strike };
      if (item.CE) chain[strike].ce = {
        ltp: item.CE.lastPrice, oi: item.CE.openInterest,
        change_oi: item.CE.changeinOpenInterest, volume: item.CE.totalTradedVolume,
        iv: item.CE.impliedVolatility, bid: item.CE.bidprice, ask: item.CE.askPrice,
        change_pct: item.CE.pchangeinOpenInterest,
      };
      if (item.PE) chain[strike].pe = {
        ltp: item.PE.lastPrice, oi: item.PE.openInterest,
        change_oi: item.PE.changeinOpenInterest, volume: item.PE.totalTradedVolume,
        iv: item.PE.impliedVolatility, bid: item.PE.bidprice, ask: item.PE.askPrice,
        change_pct: item.PE.pchangeinOpenInterest,
      };
    });

    const strikes = Object.values(chain);
    let maxPain = null, minPainValue = Infinity;
    (strikePrices || []).forEach(sp => {
      let painValue = 0;
      strikes.forEach(s => {
        if (s.ce) painValue += Math.max(0, sp - s.strike) * (s.ce.oi || 0);
        if (s.pe) painValue += Math.max(0, s.strike - sp) * (s.pe.oi || 0);
      });
      if (painValue < minPainValue) { minPainValue = painValue; maxPain = sp; }
    });

    let totalCallOI = 0, totalPutOI = 0, totalCallVol = 0, totalPutVol = 0;
    strikes.forEach(s => {
      totalCallOI += (s.ce?.oi || 0); totalPutOI += (s.pe?.oi || 0);
      totalCallVol += (s.ce?.volume || 0); totalPutVol += (s.pe?.volume || 0);
    });

    res.json({
      symbol: symbol.toUpperCase(), underlyingValue, expiryDates, strikePrices,
      chain: Object.values(chain).sort((a, b) => a.strike - b.strike),
      analytics: {
        maxPain, pcr: totalCallOI > 0 ? parseFloat((totalPutOI / totalCallOI).toFixed(2)) : 0,
        totalCallOI, totalPutOI, totalCallVolume: totalCallVol, totalPutVolume: totalPutVol,
      },
      source: 'nse_live',
    });
  } catch (err) {
    console.error('Options error:', err.message);
    res.status(500).json({ error: 'Failed to fetch options chain' });
  }
});

module.exports = router;

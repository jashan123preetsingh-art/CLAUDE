const express = require('express');
const router = express.Router();
const { fetchMarketNews } = require('../services/dataFetcher');

router.get('/', async (req, res) => {
  try {
    const articles = await fetchMarketNews();
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

router.get('/live', async (req, res) => {
  try {
    const articles = await fetchMarketNews();
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch live news' });
  }
});

module.exports = router;

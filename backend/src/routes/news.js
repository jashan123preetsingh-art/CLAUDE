const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { fetchMarketNews } = require('../services/dataFetcher');

// GET /api/news
router.get('/', async (req, res) => {
  try {
    const { category, limit = 20 } = req.query;

    // Try DB first
    let result;
    if (category) {
      result = await query(
        `SELECT * FROM news WHERE category = $1 ORDER BY published_at DESC LIMIT $2`,
        [category, parseInt(limit)]
      );
    } else {
      result = await query(
        `SELECT * FROM news ORDER BY published_at DESC LIMIT $1`,
        [parseInt(limit)]
      );
    }

    if (result.rows.length > 0) {
      return res.json(result.rows);
    }

    // Fallback to live fetch
    const articles = await fetchMarketNews();
    res.json(articles);
  } catch (err) {
    console.error('Error fetching news:', err);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// GET /api/news/live - Always fetch fresh news
router.get('/live', async (req, res) => {
  try {
    const articles = await fetchMarketNews();
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch live news' });
  }
});

module.exports = router;

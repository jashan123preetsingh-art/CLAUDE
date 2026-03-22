const express = require('express');
const router = express.Router();
const { runScanner, runCustomScanner, getAllScanners } = require('../services/scannerEngine');
const { query } = require('../config/database');

// GET /api/scanners - List all available scanners
router.get('/', (req, res) => {
  const scanners = getAllScanners();
  const grouped = {};
  scanners.forEach(s => {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  });
  res.json({ scanners, grouped });
});

// GET /api/scanners/:key - Run a specific scanner
router.get('/:key', async (req, res) => {
  try {
    const result = await runScanner(req.params.key);
    res.json(result);
  } catch (err) {
    console.error('Scanner error:', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/scanners/custom - Run custom scanner
router.post('/custom', async (req, res) => {
  try {
    const { conditions } = req.body;
    if (!conditions || !Array.isArray(conditions)) {
      return res.status(400).json({ error: 'Conditions array required' });
    }
    const result = await runCustomScanner(conditions);
    res.json(result);
  } catch (err) {
    console.error('Custom scanner error:', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/scanners/save - Save a custom scanner
router.post('/save', async (req, res) => {
  try {
    const { name, conditions, userId = 1 } = req.body;
    const result = await query(
      `INSERT INTO saved_scanners (user_id, name, conditions) VALUES ($1, $2, $3) RETURNING *`,
      [userId, name, JSON.stringify(conditions)]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save scanner' });
  }
});

// GET /api/scanners/saved/list
router.get('/saved/list', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM saved_scanners ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch saved scanners' });
  }
});

module.exports = router;

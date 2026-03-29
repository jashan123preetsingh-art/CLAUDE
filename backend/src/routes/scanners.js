const express = require('express');
const router = express.Router();
const { runScanner, getAllScanners } = require('../services/scannerEngine');

router.get('/', (req, res) => {
  const scanners = getAllScanners();
  const grouped = {};
  scanners.forEach(s => {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  });
  res.json({ scanners, grouped });
});

router.get('/saved/list', (req, res) => {
  res.json([]);
});

router.get('/:key', async (req, res) => {
  try {
    const result = await runScanner(req.params.key);
    res.json(result);
  } catch (err) {
    console.error('Scanner error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// GET /api/alerts
router.get('/', async (req, res) => {
  try {
    const { userId = 1 } = req.query;
    const result = await query(
      `SELECT a.*, s.symbol, s.name FROM alerts a
       JOIN stocks s ON a.stock_id = s.id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// POST /api/alerts
router.post('/', async (req, res) => {
  try {
    const { userId = 1, stockSymbol, alertType, condition } = req.body;
    const stockResult = await query(`SELECT id FROM stocks WHERE UPPER(symbol) = UPPER($1)`, [stockSymbol]);
    if (stockResult.rows.length === 0) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    const result = await query(
      `INSERT INTO alerts (user_id, stock_id, alert_type, condition)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, stockResult.rows[0].id, alertType, JSON.stringify(condition)]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// DELETE /api/alerts/:id
router.delete('/:id', async (req, res) => {
  try {
    await query(`DELETE FROM alerts WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// PUT /api/alerts/:id/toggle
router.put('/:id/toggle', async (req, res) => {
  try {
    const result = await query(
      `UPDATE alerts SET is_active = NOT is_active WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle alert' });
  }
});

module.exports = router;

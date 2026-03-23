const express = require('express');
const router = express.Router();

const alerts = [];
let alertIdCounter = 1;

router.get('/', (req, res) => res.json(alerts));

router.post('/', (req, res) => {
  const { stockSymbol, alertType, condition } = req.body;
  if (!stockSymbol || !alertType || !condition) return res.status(400).json({ error: 'stockSymbol, alertType, and condition required' });
  const alert = { id: alertIdCounter++, symbol: stockSymbol.toUpperCase(), alert_type: alertType, condition, is_active: true, triggered_at: null, created_at: new Date().toISOString() };
  alerts.push(alert);
  res.json(alert);
});

router.delete('/:id', (req, res) => {
  const idx = alerts.findIndex(a => a.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  alerts.splice(idx, 1);
  res.json({ success: true });
});

router.put('/:id/toggle', (req, res) => {
  const alert = alerts.find(a => a.id === parseInt(req.params.id));
  if (!alert) return res.status(404).json({ error: 'Not found' });
  alert.is_active = !alert.is_active;
  res.json(alert);
});

module.exports = router;

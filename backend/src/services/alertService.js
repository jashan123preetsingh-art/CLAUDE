const { query } = require('../config/database');
const axios = require('axios');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function checkAlerts() {
  try {
    const alerts = await query(
      `SELECT a.*, s.symbol, s.name, p.ltp, p.change_pct, p.volume
       FROM alerts a
       JOIN stocks s ON a.stock_id = s.id
       JOIN price_data p ON s.id = p.stock_id
       WHERE a.is_active = true AND a.triggered_at IS NULL`
    );

    for (const alert of alerts.rows) {
      const condition = typeof alert.condition === 'string'
        ? JSON.parse(alert.condition) : alert.condition;
      let triggered = false;

      switch (alert.alert_type) {
        case 'price_above':
          triggered = alert.ltp >= condition.value;
          break;
        case 'price_below':
          triggered = alert.ltp <= condition.value;
          break;
        case 'change_above':
          triggered = alert.change_pct >= condition.value;
          break;
        case 'change_below':
          triggered = alert.change_pct <= condition.value;
          break;
        case 'volume_above':
          triggered = alert.volume >= condition.value;
          break;
      }

      if (triggered) {
        await query(
          `UPDATE alerts SET triggered_at = NOW(), is_active = false WHERE id = $1`,
          [alert.id]
        );

        const message = `🔔 Alert Triggered!\n${alert.symbol} (${alert.name})\nLTP: ₹${alert.ltp}\nChange: ${alert.change_pct}%\nCondition: ${alert.alert_type} ${condition.value}`;

        // Send Telegram notification
        await sendTelegramAlert(alert.user_id, message);

        console.log(`Alert triggered: ${alert.symbol} - ${alert.alert_type}`);
      }
    }
  } catch (err) {
    console.error('Alert check error:', err.message);
  }
}

async function sendTelegramAlert(userId, message) {
  if (!TELEGRAM_TOKEN) return;

  try {
    const user = await query(`SELECT telegram_chat_id FROM users WHERE id = $1`, [userId]);
    const chatId = user.rows[0]?.telegram_chat_id;
    if (!chatId) return;

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    });
  } catch (err) {
    console.error('Telegram notification error:', err.message);
  }
}

module.exports = { checkAlerts, sendTelegramAlert };

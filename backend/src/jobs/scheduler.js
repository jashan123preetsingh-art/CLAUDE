const cron = require('node-cron');
const { query } = require('../config/database');
const { updateStockPrices, fetchMarketNews, fetchFIIDIIData } = require('../services/dataFetcher');
const { broadcast } = require('../services/websocket');

function startScheduler() {
  console.log('Starting scheduled jobs...');

  // Update stock prices every 5 minutes during market hours (9:15 AM - 3:30 PM IST, Mon-Fri)
  cron.schedule('*/5 9-15 * * 1-5', async () => {
    console.log('Running price update job...');
    try {
      const stocks = await query(`SELECT id, symbol FROM stocks WHERE active = true LIMIT 200`);
      if (stocks.rows.length > 0) {
        await updateStockPrices(stocks.rows);
        broadcast({ type: 'data_refresh', message: 'Prices updated' });
      }
    } catch (err) {
      console.error('Price update job error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  // Fetch news every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      const articles = await fetchMarketNews();
      for (const article of articles) {
        await query(
          `INSERT INTO news (title, url, source, category, published_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [article.title, article.url, article.source, article.category, article.published_at]
        ).catch(() => {});
      }
      broadcast({ type: 'news_update', count: articles.length });
    } catch (err) {
      console.error('News fetch job error:', err.message);
    }
  });

  // Fetch FII/DII data daily at 6 PM IST
  cron.schedule('0 18 * * 1-5', async () => {
    try {
      const data = await fetchFIIDIIData();
      if (data) {
        broadcast({ type: 'fii_dii_update', data });
      }
    } catch (err) {
      console.error('FII/DII job error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('Scheduler initialized with market-hours jobs');
}

module.exports = { startScheduler };

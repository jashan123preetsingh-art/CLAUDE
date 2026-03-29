// Database is OPTIONAL — everything works via live Yahoo Finance API
// If DATABASE_URL is set, it uses PostgreSQL for caching
// If not, everything runs purely from live API calls

const USE_DB = !!process.env.DATABASE_URL;
let pool = null;

if (USE_DB) {
  try {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on('error', (err) => console.error('DB pool error:', err.message));
    console.log('PostgreSQL connected');
  } catch (e) {
    console.log('PostgreSQL not available, running in API-only mode');
  }
}

const query = async (text, params) => {
  if (USE_DB && pool) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      console.error('DB query error:', err.message);
    }
  }
  return { rows: [], rowCount: 0 };
};

module.exports = { pool, query, USE_DB };

const { pool } = require('./database');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const migrations = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  telegram_chat_id VARCHAR(50),
  plan VARCHAR(20) DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Stocks master table
CREATE TABLE IF NOT EXISTS stocks (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  name VARCHAR(200) NOT NULL,
  exchange VARCHAR(10) NOT NULL DEFAULT 'NSE',
  sector VARCHAR(100),
  industry VARCHAR(100),
  market_cap BIGINT,
  isin VARCHAR(20),
  series VARCHAR(10) DEFAULT 'EQ',
  lot_size INT DEFAULT 1,
  is_fno BOOLEAN DEFAULT FALSE,
  is_index BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(symbol, exchange)
);

-- Price data (latest snapshot)
CREATE TABLE IF NOT EXISTS price_data (
  id SERIAL PRIMARY KEY,
  stock_id INT REFERENCES stocks(id) ON DELETE CASCADE,
  ltp DECIMAL(12,2),
  open DECIMAL(12,2),
  high DECIMAL(12,2),
  low DECIMAL(12,2),
  close DECIMAL(12,2),
  prev_close DECIMAL(12,2),
  volume BIGINT,
  avg_volume_10d BIGINT,
  change_pct DECIMAL(8,2),
  day_high DECIMAL(12,2),
  day_low DECIMAL(12,2),
  week_52_high DECIMAL(12,2),
  week_52_low DECIMAL(12,2),
  month_high_6 DECIMAL(12,2),
  month_low_6 DECIMAL(12,2),
  vwap DECIMAL(12,2),
  upper_circuit DECIMAL(12,2),
  lower_circuit DECIMAL(12,2),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(stock_id)
);

-- Historical price data (OHLCV candles)
CREATE TABLE IF NOT EXISTS historical_prices (
  id SERIAL PRIMARY KEY,
  stock_id INT REFERENCES stocks(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  timeframe VARCHAR(5) DEFAULT '1D',
  open DECIMAL(12,2),
  high DECIMAL(12,2),
  low DECIMAL(12,2),
  close DECIMAL(12,2),
  volume BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(stock_id, date, timeframe)
);

-- Fundamentals
CREATE TABLE IF NOT EXISTS fundamentals (
  id SERIAL PRIMARY KEY,
  stock_id INT REFERENCES stocks(id) ON DELETE CASCADE,
  pe_ratio DECIMAL(10,2),
  pb_ratio DECIMAL(10,2),
  roe DECIMAL(8,2),
  roce DECIMAL(8,2),
  eps DECIMAL(10,2),
  dividend_yield DECIMAL(6,2),
  debt_to_equity DECIMAL(10,2),
  current_ratio DECIMAL(8,2),
  book_value DECIMAL(12,2),
  face_value DECIMAL(8,2),
  revenue BIGINT,
  net_profit BIGINT,
  operating_margin DECIMAL(8,2),
  net_margin DECIMAL(8,2),
  revenue_growth_yoy DECIMAL(8,2),
  profit_growth_yoy DECIMAL(8,2),
  revenue_growth_3y DECIMAL(8,2),
  profit_growth_3y DECIMAL(8,2),
  promoter_holding DECIMAL(6,2),
  promoter_pledge DECIMAL(6,2),
  fii_holding DECIMAL(6,2),
  dii_holding DECIMAL(6,2),
  public_holding DECIMAL(6,2),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(stock_id)
);

-- Quarterly financials
CREATE TABLE IF NOT EXISTS quarterly_financials (
  id SERIAL PRIMARY KEY,
  stock_id INT REFERENCES stocks(id) ON DELETE CASCADE,
  quarter VARCHAR(10) NOT NULL,
  year INT NOT NULL,
  revenue BIGINT,
  expenses BIGINT,
  net_profit BIGINT,
  eps DECIMAL(10,2),
  operating_margin DECIMAL(8,2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(stock_id, quarter, year)
);

-- Scanner signals
CREATE TABLE IF NOT EXISTS signals (
  id SERIAL PRIMARY KEY,
  stock_id INT REFERENCES stocks(id) ON DELETE CASCADE,
  scanner_type VARCHAR(50) NOT NULL,
  signal_name VARCHAR(100) NOT NULL,
  signal_data JSONB,
  quality_score INT,
  triggered_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_scanner ON signals(scanner_type);
CREATE INDEX IF NOT EXISTS idx_signals_triggered ON signals(triggered_at);

-- FII/DII data
CREATE TABLE IF NOT EXISTS fii_dii_data (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  fii_buy DECIMAL(14,2),
  fii_sell DECIMAL(14,2),
  fii_net DECIMAL(14,2),
  dii_buy DECIMAL(14,2),
  dii_sell DECIMAL(14,2),
  dii_net DECIMAL(14,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- User alerts
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  stock_id INT REFERENCES stocks(id) ON DELETE CASCADE,
  alert_type VARCHAR(30) NOT NULL,
  condition JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  triggered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Saved scanners
CREATE TABLE IF NOT EXISTS saved_scanners (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  conditions JSONB NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Watchlists
CREATE TABLE IF NOT EXISTS watchlists (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  stock_ids INT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Options chain data
CREATE TABLE IF NOT EXISTS options_chain (
  id SERIAL PRIMARY KEY,
  stock_id INT REFERENCES stocks(id) ON DELETE CASCADE,
  expiry_date DATE NOT NULL,
  strike_price DECIMAL(12,2) NOT NULL,
  option_type VARCHAR(2) NOT NULL,
  ltp DECIMAL(12,2),
  open_interest BIGINT,
  change_in_oi BIGINT,
  volume BIGINT,
  iv DECIMAL(8,2),
  bid_price DECIMAL(12,2),
  ask_price DECIMAL(12,2),
  delta DECIMAL(8,4),
  gamma DECIMAL(8,4),
  theta DECIMAL(8,4),
  vega DECIMAL(8,4),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(stock_id, expiry_date, strike_price, option_type)
);

-- News
CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  summary TEXT,
  source VARCHAR(100),
  url TEXT,
  image_url TEXT,
  category VARCHAR(50),
  related_stocks INT[],
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_published ON news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_stock ON price_data(stock_id);
CREATE INDEX IF NOT EXISTS idx_hist_stock_date ON historical_prices(stock_id, date);
CREATE INDEX IF NOT EXISTS idx_fundamentals_stock ON fundamentals(stock_id);
`;

async function migrate() {
  try {
    console.log('Running migrations...');
    await pool.query(migrations);
    console.log('Migrations completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await pool.end();
  }
}

migrate();

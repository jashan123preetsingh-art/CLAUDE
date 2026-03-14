-- ============================================================================
-- ATLAS TERMINAL AI - Database Schema (PostgreSQL)
-- ============================================================================

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    plan VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro', 'lifetime')),
    avatar_url TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assets table
CREATE TABLE assets (
    id VARCHAR(50) PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    asset_class VARCHAR(20) NOT NULL CHECK (asset_class IN ('crypto', 'forex', 'commodity', 'index')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_assets_class ON assets(asset_class);
CREATE INDEX idx_assets_symbol ON assets(symbol);

-- Market data (time-series)
CREATE TABLE market_data (
    id BIGSERIAL PRIMARY KEY,
    asset_id VARCHAR(50) REFERENCES assets(id),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    open DECIMAL(20, 8) NOT NULL,
    high DECIMAL(20, 8) NOT NULL,
    low DECIMAL(20, 8) NOT NULL,
    close DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(20, 2),
    market_cap DECIMAL(20, 2),
    UNIQUE(asset_id, timestamp)
);

CREATE INDEX idx_market_data_asset_time ON market_data(asset_id, timestamp DESC);

-- Whale transactions
CREATE TABLE whale_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blockchain VARCHAR(50) NOT NULL,
    tx_hash VARCHAR(255) NOT NULL,
    from_address VARCHAR(255) NOT NULL,
    to_address VARCHAR(255) NOT NULL,
    amount DECIMAL(30, 8) NOT NULL,
    asset VARCHAR(20) NOT NULL,
    usd_value DECIMAL(20, 2) NOT NULL,
    tx_type VARCHAR(20) NOT NULL CHECK (tx_type IN ('transfer', 'exchange_inflow', 'exchange_outflow')),
    exchange VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_whale_tx_asset ON whale_transactions(asset, timestamp DESC);
CREATE INDEX idx_whale_tx_type ON whale_transactions(tx_type, timestamp DESC);

-- News articles
CREATE TABLE news_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT,
    source VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    sentiment VARCHAR(10) CHECK (sentiment IN ('bullish', 'bearish', 'neutral')),
    category VARCHAR(50),
    image_url TEXT,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_news_published ON news_articles(published_at DESC);
CREATE INDEX idx_news_sentiment ON news_articles(sentiment);

-- News-asset relationship (many-to-many)
CREATE TABLE news_asset_relations (
    news_id UUID REFERENCES news_articles(id) ON DELETE CASCADE,
    asset_symbol VARCHAR(20) NOT NULL,
    PRIMARY KEY (news_id, asset_symbol)
);

-- Alerts
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('price', 'whale', 'sector', 'volatility')),
    asset VARCHAR(20),
    condition VARCHAR(50) NOT NULL,
    value VARCHAR(100) NOT NULL,
    channels JSONB DEFAULT '["email"]',
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON alerts(user_id, is_active);

-- Watchlists
CREATE TABLE watchlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    assets JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_watchlists_user ON watchlists(user_id);

-- AI Analysis Reports
CREATE TABLE ai_analysis_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    asset_symbol VARCHAR(20) NOT NULL,
    trend VARCHAR(20) CHECK (trend IN ('uptrend', 'downtrend', 'sideways')),
    sentiment VARCHAR(10) CHECK (sentiment IN ('bullish', 'bearish', 'neutral')),
    summary TEXT NOT NULL,
    support_levels JSONB,
    resistance_levels JSONB,
    key_factors JSONB,
    liquidity_zones JSONB,
    prediction TEXT,
    confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
    model_used VARCHAR(50),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_reports_asset ON ai_analysis_reports(asset_symbol, generated_at DESC);
CREATE INDEX idx_ai_reports_user ON ai_analysis_reports(user_id, generated_at DESC);

-- Sector data
CREATE TABLE sectors (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(7),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE sector_snapshots (
    id BIGSERIAL PRIMARY KEY,
    sector_id VARCHAR(50) REFERENCES sectors(id),
    change_24h DECIMAL(10, 4),
    change_7d DECIMAL(10, 4),
    total_market_cap DECIMAL(20, 2),
    momentum VARCHAR(20) CHECK (momentum IN ('gaining', 'losing', 'stable')),
    snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sector_snapshots ON sector_snapshots(sector_id, snapshot_at DESC);

-- User sessions / API usage tracking
CREATE TABLE api_usage (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    endpoint VARCHAR(100) NOT NULL,
    request_count INTEGER DEFAULT 1,
    date DATE DEFAULT CURRENT_DATE,
    UNIQUE(user_id, endpoint, date)
);

CREATE INDEX idx_api_usage_user_date ON api_usage(user_id, date);

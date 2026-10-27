-- ============================================================================
-- Scrapling Monitor: Initial PostgreSQL Database Schema & Tables
-- Schema: scrapling
-- Run via: psql $DATABASE_URL -f scripts/schema.sql
-- Or via npm: npm run db:init
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS scrapling;

-- ----------------------------------------------------------------------------
-- 1. Application & Environment Configuration Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  group_name TEXT NOT NULL DEFAULT 'custom',
  description TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default application configuration values
INSERT INTO scrapling.config (key, value, group_name, description, updated_at)
VALUES
  ('SCRAPLING_MCP_URL', '', 'scrapling', 'Streamable HTTP endpoint for the Scrapling MCP server.', NOW()),
  ('SCRAPLING_TIMEOUT_MS', '60000', 'scrapling', 'Request timeout in milliseconds per Scrapling fetch call.', NOW()),
  ('TZ', 'America/Los_Angeles', 'scrapling', 'Server timezone for cron scheduling, logs, and email timestamps.', NOW()),
  ('EMAIL_ENABLED', 'false', 'email', 'Enable or disable sending automated email notifications via Resend.', NOW()),
  ('RESEND_API_KEY', '', 'email', 'Your Resend API key (starts with re_...).', NOW()),
  ('ALERT_EMAIL_FROM', 'Notifications <onboarding@resend.dev>', 'email', 'Verified sender address in Resend (use onboarding@resend.dev for testing).', NOW()),
  ('ALERT_EMAIL_TO', '', 'email', 'Default recipient email address(es) for notifications.', NOW())
ON CONFLICT (key) DO NOTHING;

-- Cleanup legacy CRON keys from config table as schedules are now rows in scrapling.schedulers
DELETE FROM scrapling.config WHERE key IN ('CRON_ENABLED', 'CRON_BASE_TIME', 'CRON_JITTER_MINUTES');

-- Drop legacy table names if present
DROP TABLE IF EXISTS scrapling.scrape_pages;
DROP TABLE IF EXISTS scrapling.schedules;

-- ----------------------------------------------------------------------------
-- 2. Multi-Scheduler Configurations Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.schedulers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_time TEXT NOT NULL DEFAULT '19:00',
  jitter_minutes INTEGER NOT NULL DEFAULT 60,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default primary scheduler
INSERT INTO scrapling.schedulers (id, name, base_time, jitter_minutes, enabled, created_at, updated_at)
VALUES
  ('default', 'Primary Daily Schedule', '19:00', 60, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Monitored Scraping Targets Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.targets (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'eneba',
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  with_offers BOOLEAN NOT NULL DEFAULT true,
  schedule_id TEXT NOT NULL DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default initial target pages
INSERT INTO scrapling.targets (id, category, name, url, enabled, with_offers, schedule_id, created_at, updated_at)
VALUES
  ('playstation-network-psn', 'eneba', 'PlayStation (PSN) Gift Cards', 'https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=playstation_network', true, true, 'default', NOW(), NOW()),
  ('apple-itunes', 'eneba', 'Apple iTunes / App Store Gift Cards', 'https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=apple_itunes', true, true, 'default', NOW(), NOW()),
  ('google-play', 'eneba', 'Google Play Gift Cards', 'https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=google_play', true, true, 'default', NOW(), NOW()),
  ('steam', 'eneba', 'Steam Gift Cards & Wallet Codes', 'https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=steam', true, true, 'default', NOW(), NOW()),
  ('nintendo-eshop', 'eneba', 'Nintendo eShop Cards', 'https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=nintendo_eshop', true, true, 'default', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Store Configuration Table (Eneba Limits & Alert Thresholds)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.eneba_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO scrapling.eneba_config (key, value, description, updated_at)
VALUES
  ('top_deals_limit', '10', 'Number of top ranked deals to pull and persist per Eneba category', NOW()),
  ('alert_discount_threshold_pct', '20', 'Minimum discount % on Eneba to trigger deal alerts', NOW())
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. Normalized Product Catalog (Unique Gift Cards)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.eneba_products (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  region TEXT NOT NULL,
  face_value NUMERIC(10, 2),
  face_value_currency TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. Page-Level Scrape Runs (One record per category page scrape)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.eneba_scrape_runs (
  id BIGSERIAL PRIMARY KEY,
  batch_id UUID NOT NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category TEXT NOT NULL,
  page_url TEXT NOT NULL,
  page_number SMALLINT NOT NULL DEFAULT 1,
  total_listings SMALLINT NOT NULL,
  in_stock_count SMALLINT NOT NULL,
  out_of_stock_count SMALLINT NOT NULL,
  discounted_count SMALLINT NOT NULL,
  avg_discount_pct_on_discounted NUMERIC(6, 2) NOT NULL,
  avg_discount_pct_all_in_stock NUMERIC(6, 2) NOT NULL,
  avg_effective_discount_pct NUMERIC(6, 2) NOT NULL,
  max_discount_pct NUMERIC(6, 2) NOT NULL,
  max_effective_discount_pct NUMERIC(6, 2) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 7. Top Ranked Deals (Rank 1..N per page scrape)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.eneba_top_deals (
  id BIGSERIAL PRIMARY KEY,
  scrape_run_id BIGINT NOT NULL REFERENCES scrapling.eneba_scrape_runs(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES scrapling.eneba_products(id) ON DELETE CASCADE,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rank SMALLINT NOT NULL CHECK (rank >= 1),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  region TEXT NOT NULL,
  selling_price NUMERIC(10, 2),
  original_price NUMERIC(10, 2),
  face_value NUMERIC(10, 2),
  face_value_currency TEXT,
  listed_discount_pct NUMERIC(6, 2),
  cashback_pct NUMERIC(6, 2) NOT NULL DEFAULT 0,
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  discount_pct NUMERIC(6, 2) NOT NULL DEFAULT 0,
  effective_discount_pct NUMERIC(6, 2) NOT NULL DEFAULT 0,
  effective_price NUMERIC(10, 2),
  savings_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  UNIQUE (scrape_run_id, rank)
);

-- ----------------------------------------------------------------------------
-- 8. Merchant / Seller Registry
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.eneba_sellers (
  id BIGSERIAL PRIMARY KEY,
  seller_name TEXT NOT NULL UNIQUE,
  seller_slug TEXT,
  seller_url TEXT,
  rating_pct NUMERIC(5, 2),
  rating_label TEXT,
  rating_count INTEGER,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. Competing Third-Party Seller Offers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.eneba_product_offers (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES scrapling.eneba_products(id) ON DELETE CASCADE,
  seller_id BIGINT REFERENCES scrapling.eneba_sellers(id) ON DELETE SET NULL,
  scrape_run_id BIGINT REFERENCES scrapling.eneba_scrape_runs(id) ON DELETE SET NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  price NUMERIC(10, 2) NOT NULL,
  cashback_pct NUMERIC(6, 2) NOT NULL DEFAULT 0,
  is_lowest_price BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured_offer BOOLEAN NOT NULL DEFAULT FALSE
);

-- ----------------------------------------------------------------------------
-- Performance Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_scrapling_eneba_scrape_runs_scraped_at
  ON scrapling.eneba_scrape_runs (scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrapling_eneba_scrape_runs_category_time
  ON scrapling.eneba_scrape_runs (category, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrapling_eneba_top_deals_scraped_rank
  ON scrapling.eneba_top_deals (category, scraped_at DESC, rank ASC);

CREATE INDEX IF NOT EXISTS idx_scrapling_eneba_top_deals_product_time
  ON scrapling.eneba_top_deals (product_id, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrapling_eneba_product_offers_product_time
  ON scrapling.eneba_product_offers (product_id, scraped_at DESC);

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
  ('top_deals_limit', '10', 'scrapling', 'Number of top ranked deals to pull and persist per category.', NOW()),
  ('alert_discount_threshold_pct', '20', 'scrapling', 'Minimum discount % on gift cards to trigger deal alerts.', NOW()),
  ('EMAIL_ENABLED', 'false', 'email', 'Enable or disable sending automated email notifications via Resend.', NOW()),
  ('RESEND_API_KEY', '', 'email', 'Your Resend API key (starts with re_...).', NOW()),
  ('ALERT_EMAIL_FROM', 'Notifications <onboarding@resend.dev>', 'email', 'Verified sender address in Resend (use onboarding@resend.dev for testing).', NOW()),
  ('ALERT_EMAIL_TO', '', 'email', 'Default recipient email address(es) for notifications.', NOW())
ON CONFLICT (key) DO NOTHING;

-- Cleanup legacy CRON keys from config table as schedules are now rows in scrapling.schedulers
DELETE FROM scrapling.config WHERE key IN ('CRON_ENABLED', 'CRON_BASE_TIME', 'CRON_JITTER_MINUTES');

-- Merge legacy eneba_config into config if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'scrapling' AND table_name = 'eneba_config') THEN
    INSERT INTO scrapling.config (key, value, group_name, description, updated_at)
    SELECT key, value, 'scrapling', description, updated_at
    FROM scrapling.eneba_config
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

    DROP TABLE IF EXISTS scrapling.eneba_config;
  END IF;

  -- Rename legacy eneba_* tables to generic names if present and generic don't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'scrapling' AND table_name = 'eneba_products')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'scrapling' AND table_name = 'products') THEN
    ALTER TABLE scrapling.eneba_products RENAME TO products;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'scrapling' AND table_name = 'eneba_scrape_runs')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'scrapling' AND table_name = 'scrape_runs') THEN
    ALTER TABLE scrapling.eneba_scrape_runs RENAME TO scrape_runs;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'scrapling' AND table_name = 'eneba_top_deals')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'scrapling' AND table_name = 'top_deals') THEN
    ALTER TABLE scrapling.eneba_top_deals RENAME TO top_deals;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'scrapling' AND table_name = 'eneba_sellers')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'scrapling' AND table_name = 'sellers') THEN
    ALTER TABLE scrapling.eneba_sellers RENAME TO sellers;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'scrapling' AND table_name = 'eneba_product_offers')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'scrapling' AND table_name = 'product_offers') THEN
    ALTER TABLE scrapling.eneba_product_offers RENAME TO product_offers;
  END IF;
END $$;

-- Drop legacy table names if present
DROP TABLE IF EXISTS scrapling.scrape_pages CASCADE;
DROP TABLE IF EXISTS scrapling.schedules CASCADE;
DROP TABLE IF EXISTS scrapling.eneba_product_offers CASCADE;
DROP TABLE IF EXISTS scrapling.eneba_top_deals CASCADE;
DROP TABLE IF EXISTS scrapling.eneba_scrape_runs CASCADE;
DROP TABLE IF EXISTS scrapling.eneba_sellers CASCADE;
DROP TABLE IF EXISTS scrapling.eneba_products CASCADE;

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
  ('nintendo-eshop', 'eneba', 'Nintendo eShop Cards', 'https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=nintendo_eshop', true, true, 'default', NOW(), NOW()),
  ('g2a-amazon-gift-cards', 'g2a', 'Amazon Gift Cards (G2A)', 'https://www.g2a.com/category/gift-cards-c6', true, true, 'default', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Normalized Product Catalog (Unique Gift Cards)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.products (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'eneba',
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
-- 5. Page-Level Scrape Runs (One record per category page scrape)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.scrape_runs (
  id BIGSERIAL PRIMARY KEY,
  batch_id UUID NOT NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider TEXT NOT NULL DEFAULT 'eneba',
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
-- 6. Top Ranked Deals (Rank 1..N per page scrape)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.top_deals (
  id BIGSERIAL PRIMARY KEY,
  scrape_run_id BIGINT NOT NULL REFERENCES scrapling.scrape_runs(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES scrapling.products(id) ON DELETE CASCADE,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider TEXT NOT NULL DEFAULT 'eneba',
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
-- 7. Merchant / Seller Registry
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.sellers (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'eneba',
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
-- 8. Competing Third-Party Seller Offers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.product_offers (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES scrapling.products(id) ON DELETE CASCADE,
  seller_id BIGINT REFERENCES scrapling.sellers(id) ON DELETE SET NULL,
  scrape_run_id BIGINT REFERENCES scrapling.scrape_runs(id) ON DELETE SET NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  price NUMERIC(10, 2) NOT NULL,
  cashback_pct NUMERIC(6, 2) NOT NULL DEFAULT 0,
  is_lowest_price BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured_offer BOOLEAN NOT NULL DEFAULT FALSE
);

-- ----------------------------------------------------------------------------
-- Performance Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_scrapling_scrape_runs_scraped_at
  ON scrapling.scrape_runs (scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrapling_scrape_runs_category_time
  ON scrapling.scrape_runs (category, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrapling_top_deals_scraped_rank
  ON scrapling.top_deals (category, scraped_at DESC, rank ASC);

CREATE INDEX IF NOT EXISTS idx_scrapling_top_deals_product_time
  ON scrapling.top_deals (product_id, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrapling_product_offers_product_time
  ON scrapling.product_offers (product_id, scraped_at DESC);

ALTER TABLE scrapling.products ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'eneba';
ALTER TABLE scrapling.scrape_runs ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'eneba';
ALTER TABLE scrapling.top_deals ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'eneba';
ALTER TABLE scrapling.sellers ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'eneba';


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
DROP TABLE IF EXISTS scrapling.eneba_config CASCADE;
DROP TABLE IF EXISTS scrapling.eneba_product_offers CASCADE;
DROP TABLE IF EXISTS scrapling.eneba_top_deals CASCADE;
DROP TABLE IF EXISTS scrapling.eneba_scrape_runs CASCADE;
DROP TABLE IF EXISTS scrapling.eneba_sellers CASCADE;
DROP TABLE IF EXISTS scrapling.eneba_products CASCADE;
DROP TABLE IF EXISTS scrapling.top_deals CASCADE;
DROP TABLE IF EXISTS scrapling.product_offers CASCADE;

-- Drop non-generic columns and standardize provider on existing tables
ALTER TABLE scrapling.sellers DROP COLUMN IF EXISTS is_verified;
ALTER TABLE scrapling.scrape_runs DROP COLUMN IF EXISTS out_of_stock_count;
ALTER TABLE scrapling.scrape_runs DROP COLUMN IF EXISTS target_name;
ALTER TABLE scrapling.records DROP COLUMN IF EXISTS target_name;
ALTER TABLE scrapling.records DROP COLUMN IF EXISTS target_url;
ALTER TABLE scrapling.records DROP COLUMN IF EXISTS cashback_pct;
ALTER TABLE scrapling.records DROP COLUMN IF EXISTS is_featured_offer;
DROP INDEX IF EXISTS scrapling.idx_scrapling_scrape_runs_category_time;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'scrape_runs' AND column_name = 'category') THEN
    UPDATE scrapling.scrape_runs SET provider = category WHERE (provider IS NULL OR provider = '') AND category IS NOT NULL;
    ALTER TABLE scrapling.scrape_runs DROP COLUMN IF EXISTS category;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'products' AND column_name = 'category') THEN
    UPDATE scrapling.products SET provider = category WHERE (provider IS NULL OR provider = '') AND category IS NOT NULL;
    ALTER TABLE scrapling.products DROP COLUMN IF EXISTS category;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'records' AND column_name = 'category')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'records' AND column_name = 'provider') THEN
    ALTER TABLE scrapling.records RENAME COLUMN category TO provider;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'targets' AND column_name = 'category')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'targets' AND column_name = 'provider') THEN
    ALTER TABLE scrapling.targets RENAME COLUMN category TO provider;
  END IF;

  -- Ensure targets.id and foreign keys are UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'scrapling' AND table_name = 'targets' AND column_name = 'id' AND data_type = 'text'
  ) THEN
    ALTER TABLE scrapling.records DROP CONSTRAINT IF EXISTS records_target_id_targets_id_fk;
    ALTER TABLE scrapling.scrape_runs DROP CONSTRAINT IF EXISTS scrape_runs_target_id_targets_id_fk;

    ALTER TABLE scrapling.targets ADD COLUMN IF NOT EXISTS new_id UUID DEFAULT gen_random_uuid();
    UPDATE scrapling.targets SET new_id = 'a1000000-0000-4000-8000-000000000001'::uuid WHERE id = 'playstation-network-psn';
    UPDATE scrapling.targets SET new_id = 'a1000000-0000-4000-8000-000000000002'::uuid WHERE id = 'apple-itunes';
    UPDATE scrapling.targets SET new_id = 'a1000000-0000-4000-8000-000000000003'::uuid WHERE id = 'google-play';
    UPDATE scrapling.targets SET new_id = 'a1000000-0000-4000-8000-000000000004'::uuid WHERE id = 'steam';
    UPDATE scrapling.targets SET new_id = 'a1000000-0000-4000-8000-000000000005'::uuid WHERE id = 'nintendo-eshop';
    UPDATE scrapling.targets SET new_id = 'a1000000-0000-4000-8000-000000000006'::uuid WHERE id = 'eneba-amazon-gift-cards';
    UPDATE scrapling.targets SET new_id = 'a1000000-0000-4000-8000-000000000007'::uuid WHERE id = 'g2a-amazon-gift-cards';
    UPDATE scrapling.targets SET new_id = gen_random_uuid() WHERE new_id IS NULL;

    ALTER TABLE scrapling.scrape_runs ADD COLUMN IF NOT EXISTS new_target_id UUID;
    UPDATE scrapling.scrape_runs r SET new_target_id = t.new_id FROM scrapling.targets t WHERE r.target_id = t.id;
    ALTER TABLE scrapling.scrape_runs DROP COLUMN IF EXISTS target_id;
    ALTER TABLE scrapling.scrape_runs RENAME COLUMN new_target_id TO target_id;

    ALTER TABLE scrapling.records ADD COLUMN IF NOT EXISTS new_target_id UUID;
    UPDATE scrapling.records r SET new_target_id = t.new_id FROM scrapling.targets t WHERE r.target_id = t.id;
    ALTER TABLE scrapling.records DROP COLUMN IF EXISTS target_id;
    ALTER TABLE scrapling.records RENAME COLUMN new_target_id TO target_id;

    ALTER TABLE scrapling.targets DROP CONSTRAINT targets_pkey CASCADE;
    ALTER TABLE scrapling.targets DROP COLUMN id;
    ALTER TABLE scrapling.targets RENAME COLUMN new_id TO id;
    ALTER TABLE scrapling.targets ADD PRIMARY KEY (id);
    ALTER TABLE scrapling.targets ALTER COLUMN id SET DEFAULT gen_random_uuid();

    ALTER TABLE scrapling.scrape_runs
      ADD CONSTRAINT scrape_runs_target_id_targets_id_fk
      FOREIGN KEY (target_id) REFERENCES scrapling.targets(id) ON DELETE SET NULL;

    ALTER TABLE scrapling.records
      ADD CONSTRAINT records_target_id_targets_id_fk
      FOREIGN KEY (target_id) REFERENCES scrapling.targets(id) ON DELETE SET NULL;
  END IF;
END $$;
DROP INDEX IF EXISTS scrapling.idx_scrapling_records_category_time;

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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'eneba',
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  with_offers BOOLEAN NOT NULL DEFAULT true,
  schedule_id TEXT NOT NULL DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default initial target pages
INSERT INTO scrapling.targets (id, provider, name, url, enabled, with_offers, schedule_id, created_at, updated_at)
VALUES
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'eneba', 'PlayStation (PSN) Gift Cards', 'https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=playstation_network', true, true, 'default', NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000002'::uuid, 'eneba', 'Apple iTunes / App Store Gift Cards', 'https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=apple_itunes', true, true, 'default', NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000003'::uuid, 'eneba', 'Google Play Gift Cards', 'https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=google_play', true, true, 'default', NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000004'::uuid, 'eneba', 'Steam Gift Cards & Wallet Codes', 'https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=steam', true, true, 'default', NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000005'::uuid, 'eneba', 'Nintendo eShop Cards', 'https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=nintendo_eshop', true, true, 'default', NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000006'::uuid, 'eneba', 'Amazon Gift Cards', 'https://www.eneba.com/us/store/amazon-gift-cards', true, true, 'default', NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000007'::uuid, 'g2a', 'Amazon Gift Cards (G2A)', 'https://www.g2a.com/category/gift-cards-c6', true, true, 'default', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Normalized Product Catalog (Unique Gift Cards)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.products (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'eneba',
  slug TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL UNIQUE,
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
  target_id UUID REFERENCES scrapling.targets(id) ON DELETE SET NULL,
  page_url TEXT NOT NULL,
  page_number SMALLINT NOT NULL DEFAULT 1,
  total_listings SMALLINT NOT NULL,
  in_stock_count SMALLINT NOT NULL,
  discounted_count SMALLINT NOT NULL,
  avg_discount_pct_on_discounted NUMERIC(6, 2) NOT NULL,
  avg_discount_pct_all_in_stock NUMERIC(6, 2) NOT NULL,
  avg_effective_discount_pct NUMERIC(6, 2) NOT NULL,
  max_discount_pct NUMERIC(6, 2) NOT NULL,
  max_effective_discount_pct NUMERIC(6, 2) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 6. Merchant / Seller Registry
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
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. Consolidated Scraped Records & Listings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.records (
  id BIGSERIAL PRIMARY KEY,
  batch_id UUID NOT NULL,
  scrape_run_id BIGINT REFERENCES scrapling.scrape_runs(id) ON DELETE CASCADE,
  target_id UUID REFERENCES scrapling.targets(id) ON DELETE SET NULL,
  product_id BIGINT REFERENCES scrapling.products(id) ON DELETE SET NULL,
  seller_id BIGINT REFERENCES scrapling.sellers(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'eneba',
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'GLOBAL',
  selling_price NUMERIC(10, 2),
  original_price NUMERIC(10, 2),
  face_value NUMERIC(10, 2),
  face_value_currency TEXT,
  listed_discount_pct NUMERIC(6, 2),
  in_stock BOOLEAN NOT NULL DEFAULT true,
  discount_pct NUMERIC(6, 2) NOT NULL DEFAULT 0,
  effective_discount_pct NUMERIC(6, 2) NOT NULL DEFAULT 0,
  effective_price NUMERIC(10, 2),
  savings_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  rank SMALLINT,
  is_lowest_price BOOLEAN NOT NULL DEFAULT false,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Performance Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_scrapling_scrape_runs_scraped_at
  ON scrapling.scrape_runs (scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrapling_scrape_runs_provider_time
  ON scrapling.scrape_runs (provider, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrapling_scrape_runs_target_time
  ON scrapling.scrape_runs (target_id, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrapling_records_provider_time
  ON scrapling.records (provider, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrapling_records_target_time
  ON scrapling.records (target_id, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrapling_records_batch_id
  ON scrapling.records (batch_id);

CREATE INDEX IF NOT EXISTS idx_scrapling_records_product_time
  ON scrapling.records (product_id, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrapling_records_seller_id
  ON scrapling.records (seller_id);

CREATE INDEX IF NOT EXISTS idx_scrapling_records_discount
  ON scrapling.records (discount_pct DESC, effective_discount_pct DESC);

ALTER TABLE scrapling.products ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'eneba';
ALTER TABLE scrapling.scrape_runs ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'eneba';
ALTER TABLE scrapling.sellers ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'eneba';


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
ALTER TABLE scrapling.sellers DROP COLUMN IF EXISTS seller_slug;
ALTER TABLE scrapling.scrape_runs DROP COLUMN IF EXISTS out_of_stock_count;
ALTER TABLE scrapling.scrape_runs DROP COLUMN IF EXISTS target_name;
ALTER TABLE scrapling.records DROP COLUMN IF EXISTS target_name;
ALTER TABLE scrapling.records DROP COLUMN IF EXISTS target_url;
ALTER TABLE scrapling.records DROP COLUMN IF EXISTS cashback_pct;
ALTER TABLE scrapling.records DROP COLUMN IF EXISTS is_featured_offer;
DROP INDEX IF EXISTS scrapling.idx_scrapling_scrape_runs_category_time;
DO $$
BEGIN
  -- Rename targets / target_pages to scrape_targets if present
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'scrapling' AND table_name = 'targets'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'scrapling' AND table_name = 'scrape_targets'
  ) THEN
    ALTER TABLE scrapling.targets RENAME TO scrape_targets;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'scrapling' AND table_name = 'target_pages'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'scrapling' AND table_name = 'scrape_targets'
  ) THEN
    ALTER TABLE scrapling.target_pages RENAME TO scrape_targets;
  END IF;

  DROP TABLE IF EXISTS scrapling.targets CASCADE;
  DROP TABLE IF EXISTS scrapling.target_pages CASCADE;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'scrapling' AND table_name = 'scrape_targets'
  ) THEN
    ALTER TABLE scrapling.scrape_targets DROP COLUMN IF EXISTS with_offers;
    ALTER TABLE scrapling.scrape_targets ALTER COLUMN name DROP NOT NULL;
    ALTER TABLE scrapling.scrape_targets ALTER COLUMN name SET DEFAULT '';
    ALTER TABLE scrapling.scrape_targets ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES scrapling.products(id) ON DELETE CASCADE;
    ALTER TABLE scrapling.scrape_targets DROP COLUMN IF EXISTS url;
  END IF;
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

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'records' AND column_name = 'target_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'records' AND column_name = 'scrape_target_id') THEN
    ALTER TABLE scrapling.records RENAME COLUMN target_id TO scrape_target_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'scrape_targets' AND column_name = 'category')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'scrape_targets' AND column_name = 'provider') THEN
    ALTER TABLE scrapling.scrape_targets RENAME COLUMN category TO provider;
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

    ALTER TABLE scrapling.records
      ADD CONSTRAINT records_scrape_target_id_scrape_targets_id_fk
      FOREIGN KEY (scrape_target_id) REFERENCES scrapling.scrape_targets(id) ON DELETE SET NULL;
  END IF;

  -- Ensure products.id and records.product_id are UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'scrapling' AND table_name = 'products' AND column_name = 'id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE scrapling.records DROP CONSTRAINT IF EXISTS records_product_id_products_id_fk;
    ALTER TABLE scrapling.records DROP CONSTRAINT IF EXISTS records_product_id_fkey;

    ALTER TABLE scrapling.products ADD COLUMN IF NOT EXISTS new_id UUID DEFAULT gen_random_uuid();
    ALTER TABLE scrapling.records ADD COLUMN IF NOT EXISTS new_product_id UUID;

    UPDATE scrapling.records r
    SET new_product_id = p.new_id
    FROM scrapling.products p
    WHERE r.product_id = p.id;

    ALTER TABLE scrapling.products DROP CONSTRAINT IF EXISTS products_url_key;
    ALTER TABLE scrapling.products DROP CONSTRAINT IF EXISTS eneba_products_url_unique;
    ALTER TABLE scrapling.products DROP CONSTRAINT IF EXISTS eneba_products_url_key;
    ALTER TABLE scrapling.products DROP CONSTRAINT IF EXISTS eneba_products_slug_unique;
    ALTER TABLE scrapling.products DROP CONSTRAINT IF EXISTS eneba_products_slug_key;
    ALTER TABLE scrapling.products DROP CONSTRAINT IF EXISTS products_pkey CASCADE;

    ALTER TABLE scrapling.products DROP COLUMN id CASCADE;
    ALTER TABLE scrapling.products RENAME COLUMN new_id TO id;
    ALTER TABLE scrapling.products ADD PRIMARY KEY (id);
    ALTER TABLE scrapling.products ALTER COLUMN id SET DEFAULT gen_random_uuid();
    ALTER TABLE scrapling.products ALTER COLUMN url DROP NOT NULL;
    ALTER TABLE scrapling.products ALTER COLUMN provider DROP NOT NULL;
    ALTER TABLE scrapling.products ALTER COLUMN provider SET DEFAULT NULL;

    ALTER TABLE scrapling.records DROP COLUMN IF EXISTS product_id;
    ALTER TABLE scrapling.records RENAME COLUMN new_product_id TO product_id;

    ALTER TABLE scrapling.records
      ADD CONSTRAINT records_product_id_products_id_fk
      FOREIGN KEY (product_id) REFERENCES scrapling.products(id) ON DELETE SET NULL;
  END IF;

  -- Drop redundant legacy constraints on products if present
  ALTER TABLE scrapling.products DROP CONSTRAINT IF EXISTS eneba_products_slug_key;
  ALTER TABLE scrapling.products DROP CONSTRAINT IF EXISTS eneba_products_url_key;
  ALTER TABLE scrapling.products DROP CONSTRAINT IF EXISTS eneba_products_slug_unique;
  ALTER TABLE scrapling.products DROP CONSTRAINT IF EXISTS eneba_products_url_unique;

  -- Ensure products.slug is unique
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_slug_key'
  ) THEN
    ALTER TABLE scrapling.products DROP CONSTRAINT IF EXISTS products_slug_unique;
    ALTER TABLE scrapling.products ADD CONSTRAINT products_slug_key UNIQUE (slug);
  END IF;

  -- Ensure scrape_runs.id, records.id, and records.scrape_run_id are UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'scrapling' AND table_name = 'scrape_runs' AND column_name = 'id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE scrapling.scrape_runs ADD COLUMN IF NOT EXISTS new_id UUID DEFAULT gen_random_uuid();
    UPDATE scrapling.scrape_runs SET new_id = gen_random_uuid() WHERE new_id IS NULL;

    ALTER TABLE scrapling.records ADD COLUMN IF NOT EXISTS new_scrape_run_id UUID;
    UPDATE scrapling.records r
    SET new_scrape_run_id = sr.new_id
    FROM scrapling.scrape_runs sr
    WHERE r.scrape_run_id = sr.id;

    ALTER TABLE scrapling.records ADD COLUMN IF NOT EXISTS new_id UUID DEFAULT gen_random_uuid();
    UPDATE scrapling.records SET new_id = gen_random_uuid() WHERE new_id IS NULL;

    ALTER TABLE scrapling.records DROP CONSTRAINT IF EXISTS records_scrape_run_id_scrape_runs_id_fk;
    ALTER TABLE scrapling.records DROP CONSTRAINT IF EXISTS records_scrape_run_id_fkey;

    ALTER TABLE scrapling.scrape_runs DROP CONSTRAINT IF EXISTS scrape_runs_pkey CASCADE;
    ALTER TABLE scrapling.scrape_runs DROP COLUMN IF EXISTS id CASCADE;
    ALTER TABLE scrapling.scrape_runs RENAME COLUMN new_id TO id;
    ALTER TABLE scrapling.scrape_runs ADD PRIMARY KEY (id);
    ALTER TABLE scrapling.scrape_runs ALTER COLUMN id SET DEFAULT gen_random_uuid();

    ALTER TABLE scrapling.records DROP CONSTRAINT IF EXISTS records_pkey CASCADE;
    ALTER TABLE scrapling.records DROP COLUMN IF EXISTS id CASCADE;
    ALTER TABLE scrapling.records RENAME COLUMN new_id TO id;
    ALTER TABLE scrapling.records ADD PRIMARY KEY (id);
    ALTER TABLE scrapling.records ALTER COLUMN id SET DEFAULT gen_random_uuid();

    ALTER TABLE scrapling.records DROP COLUMN IF EXISTS scrape_run_id CASCADE;
    ALTER TABLE scrapling.records RENAME COLUMN new_scrape_run_id TO scrape_run_id;

    ALTER TABLE scrapling.records
      ADD CONSTRAINT records_scrape_run_id_scrape_runs_id_fk
      FOREIGN KEY (scrape_run_id) REFERENCES scrapling.scrape_runs(id) ON DELETE CASCADE;
  END IF;

  -- Drop non-generic & redundant page-level columns from scrape_runs
  ALTER TABLE scrapling.scrape_runs DROP COLUMN IF EXISTS provider CASCADE;
  ALTER TABLE scrapling.scrape_runs DROP COLUMN IF EXISTS target_id CASCADE;
  ALTER TABLE scrapling.scrape_runs DROP COLUMN IF EXISTS target_name CASCADE;
  ALTER TABLE scrapling.scrape_runs DROP COLUMN IF EXISTS page_url CASCADE;
  ALTER TABLE scrapling.scrape_runs DROP COLUMN IF EXISTS page_number CASCADE;
  ALTER TABLE scrapling.scrape_runs DROP COLUMN IF EXISTS total_listings CASCADE;
  ALTER TABLE scrapling.scrape_runs DROP COLUMN IF EXISTS in_stock_count CASCADE;
  ALTER TABLE scrapling.scrape_runs DROP COLUMN IF EXISTS discounted_count CASCADE;

  -- Ensure sellers.id and records.seller_id are UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'scrapling' AND table_name = 'sellers' AND column_name = 'id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE scrapling.sellers ADD COLUMN IF NOT EXISTS new_id UUID DEFAULT gen_random_uuid();
    UPDATE scrapling.sellers SET new_id = gen_random_uuid() WHERE new_id IS NULL;

    ALTER TABLE scrapling.records ADD COLUMN IF NOT EXISTS new_seller_id UUID;
    UPDATE scrapling.records r
    SET new_seller_id = s.new_id
    FROM scrapling.sellers s
    WHERE r.seller_id = s.id;

    ALTER TABLE scrapling.records DROP CONSTRAINT IF EXISTS records_seller_id_fkey;
    ALTER TABLE scrapling.records DROP CONSTRAINT IF EXISTS records_seller_id_sellers_id_fk;
    ALTER TABLE scrapling.sellers DROP CONSTRAINT IF EXISTS sellers_pkey CASCADE;

    ALTER TABLE scrapling.sellers DROP COLUMN id CASCADE;
    ALTER TABLE scrapling.sellers RENAME COLUMN new_id TO id;
    ALTER TABLE scrapling.sellers ADD PRIMARY KEY (id);
    ALTER TABLE scrapling.sellers ALTER COLUMN id SET DEFAULT gen_random_uuid();

    ALTER TABLE scrapling.records DROP COLUMN IF EXISTS seller_id;
    ALTER TABLE scrapling.records RENAME COLUMN new_seller_id TO seller_id;
    ALTER TABLE scrapling.records
      ADD CONSTRAINT records_seller_id_sellers_id_fk
      FOREIGN KEY (seller_id) REFERENCES scrapling.sellers(id) ON DELETE SET NULL;
  END IF;

  -- Drop redundant is_lowest_price column from records (inferable from rank = 1)
  ALTER TABLE scrapling.records DROP COLUMN IF EXISTS is_lowest_price CASCADE;
END $$;
DROP INDEX IF EXISTS scrapling.idx_scrapling_records_category_time;
DROP INDEX IF EXISTS scrapling.idx_scrapling_scrape_runs_provider_time;
DROP INDEX IF EXISTS scrapling.idx_scrapling_scrape_runs_target_time;

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
-- 3. Normalized Product Catalog (Unique Gift Cards)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'GLOBAL',
  face_value NUMERIC(10, 2),
  face_value_currency TEXT,
  url TEXT,
  provider TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial products
INSERT INTO scrapling.products (id, slug, title, region, face_value, face_value_currency, url, provider, first_seen_at, last_seen_at)
VALUES
  ('0cbae1f0-59b3-4ac3-bcd1-3b7bbde05686'::uuid, 'psn-40', 'PlayStation Network Card 40 USD (USA) PSN Key UNITED STATES', 'UNITED STATES', 40.00, 'USD', 'https://www.eneba.com/us/psn-playstation-network-card-40-usd-usa-psn-key-united-states', 'eneba', NOW(), NOW()),
  ('c56cb9eb-0773-472e-a530-ee72d5863c3a'::uuid, 'apple-10', 'Apple Gift Card 10 USD Key UNITED STATES', 'UNITED STATES', 10.00, 'USD', 'https://www.eneba.com/us/other-apple-gift-card-10-usd-key-united-states', 'eneba', NOW(), NOW()),
  ('3a8bd30c-620d-48a3-aa66-f976f9ecaa50'::uuid, 'google-play-10', 'Google Play Gift Card 10 USD Key UNITED STATES', 'UNITED STATES', 10.00, 'USD', 'https://www.eneba.com/us/google-play-google-play-gift-card-10-usd-key-united-states', 'eneba', NOW(), NOW()),
  ('b1000000-0000-4000-8000-000000000004'::uuid, 'steam-20', 'Steam Gift Card 20 USD Key GLOBAL', 'GLOBAL', 20.00, 'USD', 'https://www.eneba.com/us/steam-steam-gift-card-20-usd-key-global', 'eneba', NOW(), NOW()),
  ('f700d89a-919a-4e82-9eb6-c92f7853c2a2'::uuid, 'nintendo-10', 'Nintendo eShop Card 10 USD Key UNITED STATES', 'UNITED STATES', 10.00, 'USD', 'https://www.eneba.com/us/nintendo-eshop-card-10-usd-key-united-states', 'eneba', NOW(), NOW()),
  ('28519d1d-0742-4e92-b28f-f8e34cd60630'::uuid, 'amazon-10', 'Amazon Gift Card 10 USD UNITED STATES', 'UNITED STATES', 10.00, 'USD', 'https://www.eneba.com/us/amazon-amazon-gift-card-10-usd-united-states', 'eneba', NOW(), NOW()),
  ('ad69d4d6-a0fd-49dd-a439-e983f3af32b3'::uuid, 'apple-50', 'Apple iTunes Gift Card 50 USD Key GLOBAL', 'GLOBAL', 50.00, 'USD', 'https://www.g2a.com/apple-itunes-gift-card-50-usd-key-global-i10000000002002', 'g2a', NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET url = EXCLUDED.url;

-- ----------------------------------------------------------------------------
-- 4. Monitored Scraping Targets Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.scrape_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES scrapling.products(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'eneba',
  name TEXT DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  schedule_id TEXT NOT NULL DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scrapling_scrape_targets_product_id ON scrapling.scrape_targets(product_id);

-- Seed default initial scrape targets
INSERT INTO scrapling.scrape_targets (id, product_id, provider, name, enabled, schedule_id, created_at, updated_at)
VALUES
  ('a1000000-0000-4000-8000-000000000001'::uuid, '0cbae1f0-59b3-4ac3-bcd1-3b7bbde05686'::uuid, 'eneba', 'PlayStation (PSN) Gift Cards', true, 'default', NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000002'::uuid, 'c56cb9eb-0773-472e-a530-ee72d5863c3a'::uuid, 'eneba', 'Apple iTunes / App Store Gift Cards', true, 'default', NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000003'::uuid, '3a8bd30c-620d-48a3-aa66-f976f9ecaa50'::uuid, 'eneba', 'Google Play Gift Cards', true, 'default', NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000004'::uuid, 'b1000000-0000-4000-8000-000000000004'::uuid, 'eneba', 'Steam Gift Cards & Wallet Codes', true, 'default', NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000005'::uuid, 'f700d89a-919a-4e82-9eb6-c92f7853c2a2'::uuid, 'eneba', 'Nintendo eShop Cards', true, 'default', NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000006'::uuid, '28519d1d-0742-4e92-b28f-f8e34cd60630'::uuid, 'eneba', 'Amazon Gift Cards', true, 'default', NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000007'::uuid, 'ad69d4d6-a0fd-49dd-a439-e983f3af32b3'::uuid, 'g2a', 'Amazon Gift Cards (G2A)', true, 'default', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  product_id = EXCLUDED.product_id,
  provider = EXCLUDED.provider,
  name = EXCLUDED.name,
  enabled = EXCLUDED.enabled,
  schedule_id = EXCLUDED.schedule_id;

-- ----------------------------------------------------------------------------
-- 5. Page-Level Scrape Runs (One record per category page scrape)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scrapling.scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'eneba',
  seller_name TEXT NOT NULL UNIQUE,
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  scrape_run_id UUID REFERENCES scrapling.scrape_runs(id) ON DELETE CASCADE,
  scrape_target_id UUID REFERENCES scrapling.scrape_targets(id) ON DELETE SET NULL,
  product_id UUID REFERENCES scrapling.products(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES scrapling.sellers(id) ON DELETE SET NULL,
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
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Performance Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_scrapling_scrape_runs_scraped_at
  ON scrapling.scrape_runs (scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrapling_scrape_runs_batch_id
  ON scrapling.scrape_runs (batch_id);

CREATE INDEX IF NOT EXISTS idx_scrapling_records_scrape_run_id
  ON scrapling.records (scrape_run_id);

CREATE INDEX IF NOT EXISTS idx_scrapling_records_provider_time
  ON scrapling.records (provider, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrapling_records_scrape_target_time
  ON scrapling.records (scrape_target_id, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrapling_records_batch_id
  ON scrapling.records (batch_id);

CREATE INDEX IF NOT EXISTS idx_scrapling_records_product_time
  ON scrapling.records (product_id, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrapling_records_seller_id
  ON scrapling.records (seller_id);

CREATE INDEX IF NOT EXISTS idx_scrapling_records_discount
  ON scrapling.records (discount_pct DESC, effective_discount_pct DESC);

ALTER TABLE scrapling.products ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'eneba';
ALTER TABLE scrapling.sellers ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'eneba';


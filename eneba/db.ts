import crypto from "node:crypto";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import type pg from "pg";
import {
  createDrizzleDb,
  createPgPool,
  enebaConfig,
  enebaProducts,
  enebaScrapeRuns,
  enebaSellers,
  scraplingProducts,
  scraplingRecords,
  scraplingScrapeRuns,
  scraplingScrapeTargets,
  scraplingSellers,
  scraplingTargets,
  CANONICAL_TARGET_URLS,
  CANONICAL_CATEGORY_URLS,
  TerminalSpinner,
  type ScraplingDb,
} from "../core/index.js";
import type { SellerOffer } from "./baseScraper.js";
import {
  deduplicatePageDealStatuses,
  deduplicateRankedDeals,
  getCanonicalTargetKey,
  type FaceValueStatItem,
  type PageDealStatus,
  type TargetFaceValueAnalytics,
  type TargetScrapeRunLog,
} from "./pageStats.js";

export const ENEBA_SCHEMA_NAME = "scrapling";

const INIT_ENEBA_SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS scrapling;

-- 1. Merge legacy scrapling.eneba_config into scrapling.config if present
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

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'scrapling' AND table_name = 'eneba_sellers')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'scrapling' AND table_name = 'sellers') THEN
    ALTER TABLE scrapling.eneba_sellers RENAME TO sellers;
  END IF;

  -- Clean up legacy empty tables
  DROP TABLE IF EXISTS scrapling.eneba_product_offers CASCADE;
  DROP TABLE IF EXISTS scrapling.eneba_top_deals CASCADE;
  DROP TABLE IF EXISTS scrapling.eneba_scrape_runs CASCADE;
  DROP TABLE IF EXISTS scrapling.eneba_sellers CASCADE;
  DROP TABLE IF EXISTS scrapling.eneba_products CASCADE;
  DROP TABLE IF EXISTS scrapling.top_deals CASCADE;
  DROP TABLE IF EXISTS scrapling.product_offers CASCADE;

  -- Drop non-generic and redundant columns
  ALTER TABLE scrapling.sellers DROP COLUMN IF EXISTS seller_slug;
  ALTER TABLE scrapling.scrape_runs DROP COLUMN IF EXISTS target_name;
  ALTER TABLE scrapling.records DROP COLUMN IF EXISTS target_name;
  ALTER TABLE scrapling.records DROP COLUMN IF EXISTS target_url;
  ALTER TABLE scrapling.records DROP COLUMN IF EXISTS cashback_pct;
  ALTER TABLE scrapling.records DROP COLUMN IF EXISTS is_featured_offer;

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

-- 2. Generic Products Catalog Table
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

-- 3. Generic Page-Level Scrape Runs Table
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

-- 4. Generic Sellers / Merchants Table
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

-- 5. Consolidated Scraped Records & Listings Table
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
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  discount_pct NUMERIC(6, 2) NOT NULL DEFAULT 0,
  effective_discount_pct NUMERIC(6, 2) NOT NULL DEFAULT 0,
  effective_price NUMERIC(10, 2),
  savings_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  rank SMALLINT,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
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

-- Cleanup non-generic columns and drop legacy category columns
ALTER TABLE scrapling.sellers DROP COLUMN IF EXISTS is_verified;
ALTER TABLE scrapling.sellers DROP COLUMN IF EXISTS seller_slug;
ALTER TABLE scrapling.scrape_runs DROP COLUMN IF EXISTS out_of_stock_count;
DROP INDEX IF EXISTS scrapling.idx_scrapling_scrape_runs_category_time;
DROP INDEX IF EXISTS scrapling.idx_scrapling_records_category_time;
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

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'records' AND column_name = 'target_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'records' AND column_name = 'scrape_target_id') THEN
    ALTER TABLE scrapling.records RENAME COLUMN target_id TO scrape_target_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'scrape_targets' AND column_name = 'category')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'scrape_targets' AND column_name = 'provider') THEN
    ALTER TABLE scrapling.scrape_targets RENAME COLUMN category TO provider;
  END IF;
END $$;
`;

export interface SaveDealsResult {
  batchId: string;
  scrapedAt: string;
  scrapeRunsInserted: number;
  recordsInserted: number;
  topDealsInserted?: number;
}

export interface SaveDealsOptions {
  pool?: pg.Pool;
  batchId?: string;
  scrapedAt?: Date | string;
  maxRank?: number;
}

export interface DbPersistenceStatus {
  saved: boolean;
  skipped: boolean;
  batchId?: string;
  scrapedAt?: string;
  scrapeRunsInserted?: number;
  recordsInserted?: number;
  topDealsInserted?: number;
  sellersUpserted?: number;
  offersInserted?: number;
  error?: string;
}

/**
 * Extracts a normalized product slug from an Eneba product URL.
 */
export function extractProductSlug(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || url;
  } catch {
    return url;
  }
}

/**
 * Builds a canonical product shortcut slug (e.g. 'amazon-10', 'psn-50', 'apple-25')
 * to group identical gift card items across multiple providers.
 */
export function buildProductSlug(item: {
  title: string;
  faceValue?: number | string | null;
  faceValueCurrency?: string | null;
  region?: string | null;
  url?: string;
}): string {
  const t = (item.title || "").toLowerCase();
  let brand = "";
  if (t.includes("playstation") || t.includes("psn")) brand = "psn";
  else if (t.includes("amazon")) brand = "amazon";
  else if (t.includes("apple") || t.includes("itunes")) brand = "apple";
  else if (t.includes("nintendo")) brand = "nintendo";
  else if (
    t.includes("google play") ||
    t.includes("google-play") ||
    t.includes("android")
  )
    brand = "google-play";
  else if (t.includes("steam")) brand = "steam";
  else if (t.includes("xbox")) brand = "xbox";
  else {
    brand =
      t
        .replace(/gift card.*/i, "")
        .replace(/card.*/i, "")
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "card";
  }

  const num = item.faceValue != null ? Number(item.faceValue) : NaN;
  const val = !Number.isNaN(num) && num > 0 ? String(num) : "";
  const curr =
    item.faceValueCurrency && item.faceValueCurrency.toUpperCase() !== "USD"
      ? `-${item.faceValueCurrency.toLowerCase()}`
      : "";

  if (val) {
    return `${brand}-${val}${curr}`.toLowerCase();
  }
  if (item.url) {
    try {
      const parsed = new URL(item.url);
      const parts = parsed.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) return `${brand}-${last.replace(/[^a-z0-9]+/g, "-").slice(0, 30)}`;
    } catch {
      // ignore
    }
  }
  return `${brand}-${t.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30)}`.toLowerCase();
}

/**
 * Ensures the `scrapling` PostgreSQL schema and all relational tables exist.
 */
export async function ensureEnebaSchema(pool: pg.Pool): Promise<void> {
  await pool.query(INIT_ENEBA_SCHEMA_SQL);
}

export interface EnebaConfigOptions {
  pool?: pg.Pool;
}

/**
 * Reads Eneba configuration key-value pairs from `scrapling.config`.
 */
export async function getEnebaConfig(
  options: EnebaConfigOptions = {},
): Promise<Record<string, string>> {
  const ownPool = !options.pool;
  let pool: pg.Pool | null = options.pool ?? null;
  try {
    if (!pool) {
      if (!process.env.DATABASE_URL?.trim()) {
        return {
          top_deals_limit: "10",
          alert_discount_threshold_pct: "20",
        };
      }
      pool = createPgPool();
    }
    await ensureEnebaSchema(pool);
    const db: ScraplingDb = createDrizzleDb(pool);
    const rows = await db
      .select({ key: enebaConfig.key, value: enebaConfig.value })
      .from(enebaConfig)
      .orderBy(asc(enebaConfig.key));

    const config: Record<string, string> = {
      top_deals_limit: "10",
      alert_discount_threshold_pct: "20",
    };
    for (const row of rows) {
      if (row.key === "top_deals_limit") config.top_deals_limit = row.value;
      if (
        row.key === "alert_discount_threshold_pct" ||
        row.key === "ALERT_DISCOUNT_THRESHOLD_PCT"
      ) {
        config.alert_discount_threshold_pct = row.value;
      }
      config[row.key] = row.value;
    }
    return config;
  } catch {
    return {
      top_deals_limit: "10",
      alert_discount_threshold_pct: "20",
    };
  } finally {
    if (ownPool && pool) {
      await pool.end().catch(() => {});
    }
  }
}

/**
 * Returns the configured number of top deals to pull per category (defaults to 10).
 */
export async function getEnebaTopDealsLimit(
  options: EnebaConfigOptions = {},
): Promise<number> {
  const cfg = await getEnebaConfig(options);
  const parsed = parseInt(cfg.top_deals_limit || "10", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

/**
 * Returns the configured Eneba alert discount threshold percentage (defaults to 20).
 */
export async function getEnebaAlertThreshold(
  options: EnebaConfigOptions = {},
): Promise<number> {
  const cfg = await getEnebaConfig(options);
  const parsed = parseFloat(cfg.alert_discount_threshold_pct || "20");
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 20;
}

/**
 * Updates key-value settings in `scrapling.config`.
 */
export async function updateEnebaConfig(
  updates: Record<string, string | number>,
  options: EnebaConfigOptions = {},
): Promise<Record<string, string>> {
  const ownPool = !options.pool;
  const pool = options.pool ?? createPgPool();
  const db: ScraplingDb = createDrizzleDb(pool);
  try {
    await ensureEnebaSchema(pool);
    for (const [rawKey, rawVal] of Object.entries(updates)) {
      const key = rawKey.trim();
      if (!key) continue;
      const strVal = String(rawVal ?? "").trim();
      await db
        .insert(enebaConfig)
        .values({
          key,
          value: strVal,
          groupName: "scrapling",
          description: "Category scrape limit & alert configuration",
        })
        .onConflictDoUpdate({
          target: enebaConfig.key,
          set: {
            value: strVal,
            updatedAt: sql`NOW()`,
          },
        });
    }
    return await getEnebaConfig({ pool });
  } finally {
    if (ownPool) {
      await pool.end();
    }
  }
}

/**
 * Saves page scrape run metadata (`scrapling.scrape_runs`), upserts unique products (`scrapling.products`),
 * upserts merchants (`scrapling.sellers`), and persists all scraped listings and offers into `scrapling.records`.
 */
export async function savePageDealsToDb(
  statuses: PageDealStatus | PageDealStatus[],
  options: SaveDealsOptions = {},
): Promise<SaveDealsResult> {
  const statusList = Array.isArray(statuses) ? statuses : [statuses];
  const ownPool = !options.pool;
  const pool = options.pool ?? createPgPool();
  const db: ScraplingDb = createDrizzleDb(pool);
  const batchId = options.batchId ?? crypto.randomUUID();
  const batchDate =
    options.scrapedAt instanceof Date
      ? options.scrapedAt
      : typeof options.scrapedAt === "string"
        ? new Date(options.scrapedAt)
        : statusList[0]?.scrapedAt
          ? new Date(statusList[0].scrapedAt)
          : new Date();
  const batchTimestamp = batchDate.toISOString();

  try {
    await ensureEnebaSchema(pool);
    let scrapeRunsInserted = 0;
    let recordsInserted = 0;

    await db.transaction(async (tx) => {
      for (const status of statusList) {
        // Find matching target if any
        const targetRes = await tx
          .select()
          .from(scraplingTargets)
          .where(
            status.targetId || (status as any).scrapeTargetId
              ? eq(scraplingTargets.id, (status.targetId || (status as any).scrapeTargetId)!)
              : eq(
                  scraplingTargets.name,
                  status.targetName || status.name || status.category,
                ),
          )
          .limit(1);

        const isValidUuid = (val?: string | null): boolean =>
          Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

        const target = targetRes[0];
        const scrapeTargetId =
          target?.id ??
          (isValidUuid(status.targetId || (status as any).scrapeTargetId)
            ? (status.targetId || (status as any).scrapeTargetId)!
            : null);
        const targetName =
          target?.name ??
          status.targetName ??
          status.name ??
          status.category;
        const siteProvider =
          target?.provider ??
          (status.provider?.toLowerCase() === "g2a" ||
          status.category?.toLowerCase() === "g2a"
            ? "g2a"
            : "eneba");

        // 1. Insert the page-level scrape run into scrapling.scrape_runs
        const runRes = await tx
          .insert(scraplingScrapeRuns)
          .values({
            batchId,
            scrapedAt: batchDate,
            avgDiscountPctOnDiscounted: String(
              status.averageDiscountPctOnDiscounted,
            ),
            avgDiscountPctAllInStock: String(
              status.averageDiscountPctAllInStock,
            ),
            avgEffectiveDiscountPct: String(
              status.averageEffectiveDiscountPct,
            ),
            maxDiscountPct: String(status.maxDiscountPct),
            maxEffectiveDiscountPct: String(status.maxEffectiveDiscountPct),
          })
          .returning({ id: scraplingScrapeRuns.id });

        const scrapeRunId = runRes[0].id;
        scrapeRunsInserted++;

        // 2. Pre-upsert sellers from bestDealOffers or listing offers
        const sellerIdByName = new Map<string, string>();
        const allOffers = [...(status.bestDealOffers || [])];
        for (const deal of status.rankedDeals) {
          if (deal.offers) {
            allOffers.push(...deal.offers);
          }
        }

        for (const offer of allOffers) {
          if (!offer.sellerName) continue;
          if (sellerIdByName.has(offer.sellerName)) continue;

          const sellerRes = await tx
            .insert(scraplingSellers)
            .values({
              provider: siteProvider,
              sellerName: offer.sellerName,
              sellerUrl: offer.sellerUrl || null,
              ratingPct:
                offer.ratingScore != null ? String(offer.ratingScore) : null,
              ratingLabel: offer.ratingLabel || null,
              firstSeenAt: batchDate,
              lastSeenAt: batchDate,
            })
            .onConflictDoUpdate({
              target: scraplingSellers.sellerName,
              set: {
                sellerUrl:
                  offer.sellerUrl ||
                  sql`COALESCE(${scraplingSellers.sellerUrl}, NULL)`,
                ratingPct:
                  offer.ratingScore != null
                    ? String(offer.ratingScore)
                    : sql`COALESCE(${scraplingSellers.ratingPct}, NULL)`,
                ratingLabel:
                  offer.ratingLabel ||
                  sql`COALESCE(${scraplingSellers.ratingLabel}, NULL)`,
                lastSeenAt: batchDate,
              },
            })
            .returning({ id: scraplingSellers.id });

          if (sellerRes[0]?.id) {
            sellerIdByName.set(offer.sellerName, sellerRes[0].id);
          }
        }

        // 3. Upsert products and insert all listings into scrapling.records
        const allDeals = status.rankedDeals;
        for (let i = 0; i < allDeals.length; i++) {
          const deal = allDeals[i];
          const rank = i + 1;
          const slug = buildProductSlug({
            title: deal.title,
            faceValue: deal.faceValue,
            faceValueCurrency: deal.faceValueCurrency,
            region: deal.region,
            url: deal.url,
          });

          const prodRes = await tx
            .insert(scraplingProducts)
            .values({
              provider: siteProvider,
              slug,
              url: deal.url,
              title: deal.title,
              region: deal.region,
              faceValue:
                deal.faceValue != null ? String(deal.faceValue) : null,
              faceValueCurrency: deal.faceValueCurrency,
              firstSeenAt: batchDate,
              lastSeenAt: batchDate,
            })
            .onConflictDoUpdate({
              target: scraplingProducts.slug,
              set: {
                title: sql`COALESCE(${scraplingProducts.title}, EXCLUDED.title)`,
                region: sql`COALESCE(${scraplingProducts.region}, EXCLUDED.region)`,
                faceValue:
                  deal.faceValue != null
                    ? String(deal.faceValue)
                    : sql`COALESCE(${scraplingProducts.faceValue}, NULL)`,
                faceValueCurrency:
                  deal.faceValueCurrency != null
                    ? deal.faceValueCurrency
                    : sql`COALESCE(${scraplingProducts.faceValueCurrency}, NULL)`,
                lastSeenAt: batchDate,
              },
            })
            .returning({ id: scraplingProducts.id });

          const productId = prodRes[0].id;

          const isBestDeal =
            status.bestDeal?.url === deal.url ||
            status.bestEffectiveDeal?.url === deal.url;
          const offersForDeal =
            deal.offers || (isBestDeal ? status.bestDealOffers : []);

          if (offersForDeal && offersForDeal.length > 0) {
            for (const offer of offersForDeal) {
              const sellerId = sellerIdByName.get(offer.sellerName) ?? null;
              await tx.insert(scraplingRecords).values({
                batchId,
                scrapeRunId,
                scrapeTargetId,
                productId,
                sellerId,
                provider: siteProvider,
                title: deal.title,
                url: deal.url,
                region: deal.region,
                sellingPrice: String(offer.price),
                originalPrice:
                  deal.originalPrice != null
                    ? String(deal.originalPrice)
                    : null,
                faceValue:
                  deal.faceValue != null ? String(deal.faceValue) : null,
                faceValueCurrency: deal.faceValueCurrency,
                listedDiscountPct:
                  deal.listedDiscountPct != null
                    ? String(deal.listedDiscountPct)
                    : null,
                inStock: true,
                discountPct: String(deal.discountPct ?? 0),
                effectiveDiscountPct: String(deal.effectiveDiscountPct ?? 0),
                effectivePrice: String(offer.price),
                savingsAmount: String(deal.savingsAmount ?? 0),
                rank,
                scrapedAt: batchDate,
              });
              recordsInserted++;
            }
          } else {
            await tx.insert(scraplingRecords).values({
              batchId,
              scrapeRunId,
              scrapeTargetId,
              productId,
              sellerId: null,
              provider: siteProvider,
              title: deal.title,
              url: deal.url,
              region: deal.region,
              sellingPrice:
                deal.sellingPrice != null ? String(deal.sellingPrice) : null,
              originalPrice:
                deal.originalPrice != null ? String(deal.originalPrice) : null,
              faceValue:
                deal.faceValue != null ? String(deal.faceValue) : null,
              faceValueCurrency: deal.faceValueCurrency,
              listedDiscountPct:
                deal.listedDiscountPct != null
                  ? String(deal.listedDiscountPct)
                  : null,
              inStock: deal.inStock ?? true,
              discountPct: String(deal.discountPct ?? 0),
              effectiveDiscountPct: String(deal.effectiveDiscountPct ?? 0),
              effectivePrice:
                deal.effectivePrice != null
                  ? String(deal.effectivePrice)
                  : null,
              savingsAmount: String(deal.savingsAmount ?? 0),
              rank,
              scrapedAt: batchDate,
            });
            recordsInserted++;
          }
        }
      }
    });

    return {
      batchId,
      scrapedAt: batchTimestamp,
      scrapeRunsInserted,
      recordsInserted,
      topDealsInserted: recordsInserted,
    };
  } finally {
    if (ownPool) {
      await pool.end();
    }
  }
}

export interface SaveProductOffersResult {
  sellersUpserted: number;
  offersInserted: number;
}

/**
 * Persists scraped vendor offers for a given product URL into `scrapling.sellers` and `scrapling.records`.
 */
export async function saveProductOffersToDb(
  productUrl: string,
  offers: SellerOffer[],
  options: {
    pool?: pg.Pool;
    scrapedAt?: Date | string;
  } = {},
): Promise<SaveProductOffersResult> {
  if (!offers.length) {
    return { sellersUpserted: 0, offersInserted: 0 };
  }

  const ownPool = !options.pool;
  const pool = options.pool ?? createPgPool();
  const db: ScraplingDb = createDrizzleDb(pool);
  const scrapedDate =
    options.scrapedAt instanceof Date
      ? options.scrapedAt
      : typeof options.scrapedAt === "string"
        ? new Date(options.scrapedAt)
        : new Date();

  try {
    await ensureEnebaSchema(pool);
    let sellersUpserted = 0;
    let offersInserted = 0;

    await db.transaction(async (tx) => {
      // 1. Locate record or product matching productUrl
      const latestRecordRows = await tx
        .select()
        .from(scraplingRecords)
        .where(eq(scraplingRecords.url, productUrl))
        .orderBy(desc(scraplingRecords.scrapedAt))
        .limit(1);

      let productId: string | null = latestRecordRows[0]?.productId ?? null;
      let siteProvider = latestRecordRows[0]?.provider || "eneba";

      if (!productId) {
        const prodRows = await tx
          .select()
          .from(scraplingProducts)
          .where(
            or(
              eq(scraplingProducts.url, productUrl),
              eq(scraplingProducts.slug, productUrl),
            ),
          )
          .limit(1);

        if (prodRows.length === 0) {
          return;
        }
        productId = prodRows[0].id;
        siteProvider = prodRows[0].provider || "eneba";
      }

      const latestRecord =
        latestRecordRows[0] ||
        (await tx
          .select()
          .from(scraplingRecords)
          .where(eq(scraplingRecords.productId, productId))
          .orderBy(desc(scraplingRecords.scrapedAt))
          .limit(1))[0];

      for (const offer of offers) {
        const sellerRows = await tx
          .insert(scraplingSellers)
          .values({
            provider: siteProvider,
            sellerName: offer.sellerName,
            sellerUrl: offer.sellerUrl,
            ratingPct:
              offer.ratingScore != null ? String(offer.ratingScore) : null,
            ratingLabel: offer.ratingLabel,
            firstSeenAt: scrapedDate,
            lastSeenAt: scrapedDate,
          })
          .onConflictDoUpdate({
            target: scraplingSellers.sellerName,
            set: {
              sellerUrl:
                offer.sellerUrl != null
                  ? offer.sellerUrl
                  : sql`COALESCE(${scraplingSellers.sellerUrl}, NULL)`,
              ratingPct:
                offer.ratingScore != null
                  ? String(offer.ratingScore)
                  : sql`COALESCE(${scraplingSellers.ratingPct}, NULL)`,
              ratingLabel:
                offer.ratingLabel != null
                  ? offer.ratingLabel
                  : sql`COALESCE(${scraplingSellers.ratingLabel}, NULL)`,
              lastSeenAt: scrapedDate,
            },
          })
          .returning({ id: scraplingSellers.id });

        const sellerId = sellerRows[0]?.id;
        sellersUpserted++;

        if (latestRecord) {
          await tx.insert(scraplingRecords).values({
            batchId: latestRecord.batchId,
            scrapeRunId: latestRecord.scrapeRunId,
            scrapeTargetId: latestRecord.scrapeTargetId,
            productId,
            sellerId,
            provider: latestRecord.provider,
            title: latestRecord.title,
            url: latestRecord.url,
            region: latestRecord.region,
            sellingPrice: String(offer.price),
            originalPrice: latestRecord.originalPrice,
            faceValue: latestRecord.faceValue,
            faceValueCurrency: latestRecord.faceValueCurrency,
            listedDiscountPct: latestRecord.listedDiscountPct,
            inStock: true,
            discountPct: latestRecord.discountPct,
            effectiveDiscountPct: latestRecord.effectiveDiscountPct,
            effectivePrice: String(offer.price),
            savingsAmount: latestRecord.savingsAmount,
            rank: latestRecord.rank,
            scrapedAt: scrapedDate,
          });
          offersInserted++;
        }
      }
    });

    return { sellersUpserted, offersInserted };
  } finally {
    if (ownPool) {
      await pool.end();
    }
  }
}

/**
 * Non-blocking, fault-tolerant database persistence helper.
 */
export async function tryPersistScrapeResult(
  statuses: PageDealStatus | PageDealStatus[],
  options: {
    noDb?: boolean;
    maxRank?: number;
    showProgress?: boolean;
    pool?: pg.Pool;
  } = {},
): Promise<DbPersistenceStatus> {
  const statusList = Array.isArray(statuses) ? statuses : [statuses];

  if (options.noDb || !process.env.DATABASE_URL?.trim()) {
    const status: DbPersistenceStatus = {
      saved: false,
      skipped: true,
    };
    for (const st of statusList) {
      st.dbStatus = status;
    }
    return status;
  }

  const spinner = new TerminalSpinner({ silent: options.showProgress === false });
  spinner.start(
    `[PostgreSQL] Saving top deals & seller offers to schema "scrapling"...`,
  );

  let pool: pg.Pool | null = options.pool ?? null;
  const ownPool = !options.pool;
  try {
    if (!pool) {
      pool = createPgPool();
    }
    const maxRank =
      options.maxRank ?? (await getEnebaTopDealsLimit({ pool }));
    const savedDeals = await savePageDealsToDb(statusList, {
      pool,
      maxRank,
    });

    let totalSellers = 0;
    let totalOffers = 0;
    for (const st of statusList) {
      const best = st.bestEffectiveDeal || st.bestDeal;
      if (best && st.bestDealOffers && st.bestDealOffers.length > 0) {
        const offerRes = await saveProductOffersToDb(
          best.url,
          st.bestDealOffers,
          {
            pool,
            scrapedAt: savedDeals.scrapedAt,
          },
        );
        totalSellers += offerRes.sellersUpserted;
        totalOffers += offerRes.offersInserted;
      }
    }

    spinner.succeed(
      `[PostgreSQL] Saved ${savedDeals.recordsInserted} records into schema "scrapling"`,
    );

    const dbStatus: DbPersistenceStatus = {
      saved: true,
      skipped: false,
      batchId: savedDeals.batchId,
      scrapedAt: savedDeals.scrapedAt,
      scrapeRunsInserted: savedDeals.scrapeRunsInserted,
      recordsInserted: savedDeals.recordsInserted,
      topDealsInserted: savedDeals.recordsInserted,
      sellersUpserted: totalSellers,
      offersInserted: totalOffers,
    };
    for (const st of statusList) {
      st.dbStatus = dbStatus;
    }
    return dbStatus;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    spinner.warn(
      `[PostgreSQL Warn] Database persistence failed (continuing without DB): ${message}`,
    );
    const dbStatus: DbPersistenceStatus = {
      saved: false,
      skipped: false,
      error: message,
    };
    for (const st of statusList) {
      st.dbStatus = dbStatus;
    }
    return dbStatus;
  } finally {
    if (ownPool && pool) {
      await pool.end().catch(() => {});
    }
  }
}

/**
 * Loads the most recent `PageDealStatus` for each target from PostgreSQL (`scrapling` schema tables).
 */
export async function fetchLatestEnebaStatusesFromDb(): Promise<
  PageDealStatus[]
> {
  if (!process.env.DATABASE_URL?.trim()) {
    return [];
  }

  let pool: pg.Pool | null = null;
  try {
    pool = createPgPool();
    await ensureEnebaSchema(pool);
    const db: ScraplingDb = createDrizzleDb(pool);

    const runsWithTargets = await db
      .selectDistinctOn([scraplingRecords.scrapeTargetId], {
        run: scraplingScrapeRuns,
        target: scraplingScrapeTargets,
      })
      .from(scraplingRecords)
      .innerJoin(
        scraplingScrapeRuns,
        eq(scraplingRecords.scrapeRunId, scraplingScrapeRuns.id),
      )
      .leftJoin(
        scraplingScrapeTargets,
        eq(scraplingRecords.scrapeTargetId, scraplingScrapeTargets.id),
      )
      .where(sql`${scraplingRecords.scrapeTargetId} IS NOT NULL`)
      .orderBy(scraplingRecords.scrapeTargetId, desc(scraplingRecords.scrapedAt));

    const statuses: PageDealStatus[] = [];

    // Query total scrape runs and recent runs for each scrape target
    const scrapeCountMap = new Map<string, number>();
    const recentRunsMap = new Map<string, TargetScrapeRunLog[]>();

    try {
      const runAggRes = await pool.query<{
        scrape_target_id: string;
        scrape_count: number;
      }>(`
        SELECT 
          scrape_target_id,
          COUNT(DISTINCT batch_id)::int as scrape_count
        FROM scrapling.records
        WHERE scrape_target_id IS NOT NULL
        GROUP BY scrape_target_id
      `);
      for (const row of runAggRes.rows) {
        scrapeCountMap.set(row.scrape_target_id, Number(row.scrape_count));
      }

      const recentRunsRes = await pool.query<{
        scrape_target_id: string;
        batch_id: string;
        run_time: string;
        items_count: number;
        in_stock_count: number;
      }>(`
        SELECT 
          scrape_target_id,
          batch_id,
          MIN(scraped_at) as run_time,
          COUNT(id)::int as items_count,
          COUNT(CASE WHEN in_stock THEN 1 END)::int as in_stock_count
        FROM scrapling.records
        WHERE scrape_target_id IS NOT NULL
        GROUP BY scrape_target_id, batch_id
        ORDER BY run_time DESC
      `);
      for (const row of recentRunsRes.rows) {
        if (!recentRunsMap.has(row.scrape_target_id)) {
          recentRunsMap.set(row.scrape_target_id, []);
        }
        const list = recentRunsMap.get(row.scrape_target_id)!;
        if (list.length < 8) {
          list.push({
            batchId: row.batch_id,
            runTime: new Date(row.run_time).toISOString(),
            itemsCount: Number(row.items_count),
            inStockCount: Number(row.in_stock_count),
            status: Number(row.items_count) > 0 ? "success" : "warning",
          });
        }
      }
    } catch {
      // Ignore if aggregate query fails
    }

    const faceStatsMap = new Map<string, {
      freq_face: number;
      freq_title?: string;
      freq_url?: string;
      freq_currency: string;
      freq_times: number;
      freq_avg_pct: number;
      peak_face: number;
      peak_title?: string;
      peak_url?: string;
      peak_currency: string;
      peak_max_pct: number;
      peak_min_price: number;
    }>();

    try {
      const faceStatsRes = await pool.query<{
        target_id: string;
        freq_face: number;
        freq_title: string | null;
        freq_url: string | null;
        freq_currency: string;
        freq_times: number;
        freq_avg_pct: number;
        peak_face: number;
        peak_title: string | null;
        peak_url: string | null;
        peak_currency: string;
        peak_max_pct: number;
        peak_min_price: number;
      }>(`
        WITH face_stats AS (
          SELECT 
            st.id as target_id,
            r.face_value::float as face_value,
            COALESCE(r.face_value_currency, 'USD') as currency,
            (ARRAY_AGG(r.title ORDER BY r.scraped_at DESC))[1] as title,
            (ARRAY_AGG(r.url ORDER BY r.scraped_at DESC))[1] as url,
            COUNT(*)::int as total_seen,
            COUNT(CASE WHEN r.discount_pct > 0 THEN 1 END)::int as times_discounted,
            ROUND(AVG(r.discount_pct)::numeric, 1)::float as avg_discount,
            MAX(r.discount_pct)::float as max_discount,
            MIN(r.selling_price)::float as min_price,
            ROUND(AVG(r.savings_amount)::numeric, 2)::float as avg_savings
          FROM scrapling.records r
          JOIN scrapling.scrape_targets st ON r.scrape_target_id = st.id
          WHERE r.face_value IS NOT NULL AND r.face_value > 0
          GROUP BY st.id, r.face_value, r.face_value_currency
        ),
        ranked_stats AS (
          SELECT *,
            ROW_NUMBER() OVER(PARTITION BY target_id ORDER BY times_discounted DESC, total_seen DESC) as rn_freq,
            ROW_NUMBER() OVER(PARTITION BY target_id ORDER BY max_discount DESC) as rn_peak
          FROM face_stats
        )
        SELECT 
          f.target_id,
          f.face_value as freq_face,
          f.title as freq_title,
          f.url as freq_url,
          f.currency as freq_currency,
          f.times_discounted as freq_times,
          f.avg_discount as freq_avg_pct,
          p.face_value as peak_face,
          p.title as peak_title,
          p.url as peak_url,
          p.currency as peak_currency,
          p.max_discount as peak_max_pct,
          p.min_price as peak_min_price
        FROM ranked_stats f
        JOIN ranked_stats p ON f.target_id = p.target_id AND p.rn_peak = 1
        WHERE f.rn_freq = 1;
      `);
      for (const row of faceStatsRes.rows) {
        faceStatsMap.set(row.target_id, {
          freq_face: Number(row.freq_face),
          freq_title: row.freq_title || undefined,
          freq_url: row.freq_url || undefined,
          freq_currency: row.freq_currency || "USD",
          freq_times: Number(row.freq_times),
          freq_avg_pct: Number(row.freq_avg_pct),
          peak_face: Number(row.peak_face),
          peak_title: row.peak_title || undefined,
          peak_url: row.peak_url || undefined,
          peak_currency: row.peak_currency || "USD",
          peak_max_pct: Number(row.peak_max_pct),
          peak_min_price: Number(row.peak_min_price),
        });
      }
    } catch {
      // Ignore if query fails
    }

    for (const { run, target } of runsWithTargets) {
      const records = await db
        .select({
          record: scraplingRecords,
          seller: scraplingSellers,
        })
        .from(scraplingRecords)
        .leftJoin(scraplingSellers, eq(scraplingRecords.sellerId, scraplingSellers.id))
        .where(
          and(
            eq(scraplingRecords.scrapeRunId, run.id),
            target?.id ? eq(scraplingRecords.scrapeTargetId, target.id) : sql`true`,
          ),
        )
        .orderBy(asc(scraplingRecords.rank));

      const provider = target?.provider || records[0]?.record.provider || "eneba";
      const targetTitle = target?.name || provider;
      const targetKey = getCanonicalTargetKey({
        scrapeTargetId: target?.id,
        targetName: target?.name,
        provider,
      });
      const targetUrl =
        (target?.id && CANONICAL_TARGET_URLS[target.id]) ||
        CANONICAL_CATEGORY_URLS[targetKey] ||
        records[0]?.record.url ||
        "";
      const totalListings = records.length;
      const inStockCount = records.filter(({ record: r }) => r.inStock).length;
      const discountedCount = records.filter(
        ({ record: r }) => Number(r.discountPct) > 0,
      ).length;

      const rankedDeals = deduplicateRankedDeals(
        records.map(({ record: d }) => ({
          rank: Number(d.rank ?? 1),
          category: d.provider,
          scrapeTargetId: d.scrapeTargetId ?? target?.id ?? undefined,
          targetId: d.scrapeTargetId ?? target?.id ?? undefined,
          targetName: targetTitle,
          title: d.title,
          url: d.url,
          region: d.region,
          sellingPrice:
            d.sellingPrice !== null ? Number(d.sellingPrice) : null,
          originalPrice:
            d.originalPrice !== null ? Number(d.originalPrice) : null,
          faceValue: d.faceValue !== null ? Number(d.faceValue) : null,
          faceValueCurrency: d.faceValueCurrency,
          listedDiscountPct:
            d.listedDiscountPct !== null ? Number(d.listedDiscountPct) : null,
          cashbackPct: 0,
          inStock: d.inStock,
          discountPct: Number(d.discountPct),
          effectiveDiscountPct: Number(d.effectiveDiscountPct),
          effectivePrice:
            d.effectivePrice !== null ? Number(d.effectivePrice) : null,
          savingsAmount: Number(d.savingsAmount),
        })),
      );

      const bestDealOffers: SellerOffer[] = records
        .filter(({ record: r, seller: s }) => s != null && (Number(r.rank) === 1 || r.sellerId != null))
        .map(({ record: r, seller: s }) => ({
          sellerName: s!.sellerName,
          sellerSlug: s!.sellerName,
          sellerUrl: s!.sellerUrl ?? "",
          ratingScore: s!.ratingPct !== null ? Number(s!.ratingPct) : null,
          ratingLabel: s!.ratingLabel,
          price: Number(r.sellingPrice ?? 0),
          cashbackPct: 0,
          isLowestPrice: Number(r.rank) === 1,
          isFeaturedOffer: false,
        }));

      const bestEffectiveDeal = rankedDeals[0] ?? null;
      const bestDirectDeal =
        [...rankedDeals].sort((a, b) => b.discountPct - a.discountPct)[0] ??
        null;

      const faceMap = new Map<number, FaceValueStatItem>();
      for (const { record: r } of records) {
        if (r.faceValue && Number(r.faceValue) > 0) {
          const fv = Number(r.faceValue);
          const current = faceMap.get(fv);
          const rDiscount = Number(r.discountPct || 0);
          if (!current || rDiscount > current.discountPct) {
            faceMap.set(fv, {
              faceValue: fv,
              title: r.title || undefined,
              url: r.url || undefined,
              currency: r.faceValueCurrency || "USD",
              discountPct: rDiscount,
              sellingPrice: Number(r.sellingPrice || 0),
              savingsAmount: Number(r.savingsAmount || 0),
            });
          }
        }
      }
      const faceValues = Array.from(faceMap.values()).sort((a, b) => a.faceValue - b.faceValue);

      const targetId = target?.id;
      const scrapeCount = targetId ? (scrapeCountMap.get(targetId) ?? 1) : 1;
      const recentRuns = targetId ? (recentRunsMap.get(targetId) ?? []) : [];
      const fs = targetId ? faceStatsMap.get(targetId) : undefined;

      const faceAnalytics: TargetFaceValueAnalytics = {
        mostFrequentFace: fs?.freq_face ? {
          faceValue: fs.freq_face,
          title: fs.freq_title,
          url: fs.freq_url,
          currency: fs.freq_currency,
          timesDiscounted: fs.freq_times,
          avgDiscountPct: fs.freq_avg_pct,
        } : (faceValues.length > 0 ? {
          faceValue: faceValues[0].faceValue,
          title: faceValues[0].title,
          url: faceValues[0].url,
          currency: faceValues[0].currency,
          timesDiscounted: 1,
          avgDiscountPct: faceValues[0].discountPct,
        } : undefined),
        peakDiscountFace: fs?.peak_face ? {
          faceValue: fs.peak_face,
          title: fs.peak_title,
          url: fs.peak_url,
          currency: fs.peak_currency,
          maxDiscountPct: fs.peak_max_pct,
          minPrice: fs.peak_min_price,
          savingsAmount: Number((fs.peak_face - fs.peak_min_price).toFixed(2)),
        } : (bestDirectDeal && bestDirectDeal.faceValue ? {
          faceValue: bestDirectDeal.faceValue,
          title: bestDirectDeal.title,
          url: bestDirectDeal.url,
          currency: bestDirectDeal.faceValueCurrency || "USD",
          maxDiscountPct: bestDirectDeal.discountPct,
          minPrice: bestDirectDeal.sellingPrice || 0,
          savingsAmount: bestDirectDeal.savingsAmount || 0,
        } : undefined),
        faceValues,
      };

      statuses.push({
        category: provider,
        scrapeTargetId: target?.id ?? undefined,
        targetId: target?.id ?? undefined,
        targetName: targetTitle,
        name: targetTitle,
        pageUrl: targetUrl,
        pageNumber: 1,
        scrapedAt: new Date(run.scrapedAt).toISOString(),
        totalListings,
        inStockCount,
        outOfStockCount: totalListings - inStockCount,
        discountedCount,
        scrapeCount,
        runStatus: totalListings > 0 ? "success" : "warning",
        faceAnalytics,
        recentRuns,
        averageDiscountPctOnDiscounted: Number(
          run.avgDiscountPctOnDiscounted,
        ),
        averageDiscountPctAllInStock: Number(run.avgDiscountPctAllInStock),
        averageEffectiveDiscountPct: Number(run.avgEffectiveDiscountPct),
        maxDiscountPct: Number(run.maxDiscountPct),
        maxEffectiveDiscountPct: Number(run.maxEffectiveDiscountPct),
        bestDeal: bestDirectDeal,
        bestEffectiveDeal,
        bestDealOffers,
        topDeals: rankedDeals.slice(0, 10),
        rankedDeals,
      });
    }

    return deduplicatePageDealStatuses(statuses);
  } catch {
    return [];
  } finally {
    if (pool) {
      await pool.end().catch(() => {});
    }
  }
}

/**
 * Loads scraping history and success rate records aggregated by batch_id from PostgreSQL.
 */
export async function fetchScrapeHistoryFromDb(
  poolOrLimit?: pg.Pool | number,
  limitOrPool?: number | pg.Pool,
): Promise<Array<{
  id: string;
  timestamp: string;
  totalPages: number;
  successfulPages: number;
  successRate: number;
  totalListings: number;
  inStockCount: number;
  bestDeal?: {
    title: string;
    category: string;
    sellerName: string;
    cost: number;
    faceValue: number;
    discountPct: number;
    url?: string;
  };
}>> {
  if (!process.env.DATABASE_URL?.trim()) {
    return [];
  }

  const pool =
    typeof poolOrLimit === "object" && poolOrLimit !== null && "query" in poolOrLimit
      ? (poolOrLimit as pg.Pool)
      : typeof limitOrPool === "object" && limitOrPool !== null && "query" in limitOrPool
        ? (limitOrPool as pg.Pool)
        : undefined;

  const limit =
    typeof poolOrLimit === "number"
      ? poolOrLimit
      : typeof limitOrPool === "number"
        ? limitOrPool
        : 30;

  const ownPool = !pool;
  const p = pool || createPgPool();
  try {
    const db: ScraplingDb = createDrizzleDb(p);
    const res = await db
      .select({
        batchId: enebaScrapeRuns.batchId,
        scrapedAt: sql<Date>`MIN(${enebaScrapeRuns.scrapedAt})`,
        totalPages: sql<number>`COUNT(DISTINCT ${enebaScrapeRuns.id})::int`,
        successfulPages: sql<number>`COUNT(DISTINCT ${scraplingRecords.scrapeRunId})::int`,
        totalListings: sql<number>`COUNT(${scraplingRecords.id})::int`,
        inStockCount: sql<number>`COUNT(CASE WHEN ${scraplingRecords.inStock} THEN 1 END)::int`,
      })
      .from(enebaScrapeRuns)
      .leftJoin(
        scraplingRecords,
        eq(scraplingRecords.scrapeRunId, enebaScrapeRuns.id),
      )
      .groupBy(enebaScrapeRuns.batchId)
      .orderBy(asc(sql`MIN(${enebaScrapeRuns.scrapedAt})`))
      .limit(limit);

    const batchIds = res.map((r) => r.batchId).filter(Boolean);
    const dealsByBatch = new Map<
      string,
      {
        title: string;
        category: string;
        provider?: string;
        sellerName: string;
        cost: number;
        faceValue: number;
        discountPct: number;
        url?: string;
      }
    >();
    const dealsByBatchAndProvider = new Map<
      string,
      Record<
        string,
        {
          title: string;
          category: string;
          provider?: string;
          sellerName: string;
          cost: number;
          faceValue: number;
          discountPct: number;
          url?: string;
        }
      >
    >();

    if (batchIds.length > 0) {
      try {
        const topDealsRes = await db
          .selectDistinctOn([scraplingRecords.batchId, scraplingRecords.provider], {
            batchId: scraplingRecords.batchId,
            provider: scraplingRecords.provider,
            title: scraplingRecords.title,
            category: scraplingRecords.provider,
            targetName: sql<string>`COALESCE(${scraplingTargets.name}, ${scraplingRecords.provider})`,
            sellingPrice: scraplingRecords.sellingPrice,
            faceValue: scraplingRecords.faceValue,
            originalPrice: scraplingRecords.originalPrice,
            discountPct: scraplingRecords.discountPct,
            url: scraplingRecords.url,
            sellerName: sql<string>`COALESCE(${scraplingSellers.sellerName}, 'Top Merchant')`,
          })
          .from(scraplingRecords)
          .leftJoin(
            scraplingSellers,
            eq(scraplingRecords.sellerId, scraplingSellers.id),
          )
          .leftJoin(
            scraplingScrapeTargets,
            eq(scraplingRecords.scrapeTargetId, scraplingScrapeTargets.id),
          )
          .where(inArray(scraplingRecords.batchId, batchIds))
          .orderBy(
            scraplingRecords.batchId,
            scraplingRecords.provider,
            desc(scraplingRecords.discountPct),
          );

        for (const dr of topDealsRes) {
          const prov = (dr.provider || "eneba").toLowerCase().trim();
          const dealItem = {
            title: dr.title,
            category: dr.targetName || dr.category,
            provider: prov,
            sellerName: dr.sellerName || "Top Merchant",
            cost: Number(dr.sellingPrice) || 0,
            faceValue: Number(dr.faceValue) || Number(dr.originalPrice) || 0,
            discountPct: Number(dr.discountPct) || 0,
            url: dr.url,
          };

          if (!dealsByBatchAndProvider.has(dr.batchId)) {
            dealsByBatchAndProvider.set(dr.batchId, {});
          }
          dealsByBatchAndProvider.get(dr.batchId)![prov] = dealItem;

          const currentBest = dealsByBatch.get(dr.batchId);
          if (!currentBest || dealItem.discountPct > currentBest.discountPct) {
            dealsByBatch.set(dr.batchId, dealItem);
          }
        }
      } catch {
        // Fallback gracefully without deals join
      }
    }

    const lastKnownByProvider = new Map<
      string,
      {
        title: string;
        category: string;
        provider?: string;
        sellerName: string;
        cost: number;
        faceValue: number;
        discountPct: number;
        url?: string;
      }
    >();

    return res.map((r) => {
      const totalPages = Number(r.totalPages) || 1;
      const successfulPages = Number(r.successfulPages) || 0;
      const successRate = Number(
        ((successfulPages / totalPages) * 100).toFixed(1),
      );

      const batchDeals = dealsByBatchAndProvider.get(r.batchId) || {};
      for (const [prov, deal] of Object.entries(batchDeals)) {
        if (deal && deal.discountPct > 0) {
          lastKnownByProvider.set(prov, deal);
        }
      }

      const mergedDealsByProvider: Record<string, any> = { ...batchDeals };
      for (const [prov, lastDeal] of lastKnownByProvider.entries()) {
        if (!mergedDealsByProvider[prov]) {
          mergedDealsByProvider[prov] = lastDeal;
        }
      }

      return {
        id: r.batchId,
        timestamp: new Date(r.scrapedAt).toISOString(),
        totalPages,
        successfulPages,
        successRate,
        totalListings: Number(r.totalListings) || 0,
        inStockCount: Number(r.inStockCount) || 0,
        bestDeal: dealsByBatch.get(r.batchId) || Object.values(mergedDealsByProvider)[0],
        bestDealsByProvider: mergedDealsByProvider,
      };
    });
  } catch {
    return [];
  } finally {
    if (ownPool) {
      await p.end().catch(() => {});
    }
  }
}

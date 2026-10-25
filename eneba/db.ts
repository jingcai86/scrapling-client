import crypto from "node:crypto";
import type pg from "pg";
import { createPgPool } from "../core/index.js";
import type { PageDealStatus } from "./pageStats.js";

export const ENEBA_SCHEMA_NAME = "eneba";

const INIT_ENEBA_SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS eneba;

-- 1. Normalized catalog of unique Eneba gift card products
CREATE TABLE IF NOT EXISTS eneba.products (
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

-- 2. Page-level scrape runs (one row per category page scrape)
CREATE TABLE IF NOT EXISTS eneba.scrape_runs (
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

-- 3. Top 10 ranked deals (rank 1-10) per page scrape
CREATE TABLE IF NOT EXISTS eneba.top_deals (
  id BIGSERIAL PRIMARY KEY,
  scrape_run_id BIGINT NOT NULL REFERENCES eneba.scrape_runs(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES eneba.products(id) ON DELETE CASCADE,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rank SMALLINT NOT NULL CHECK (rank BETWEEN 1 AND 10),
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

-- 4. Sellers / merchants table (for product-level seller relationships)
CREATE TABLE IF NOT EXISTS eneba.sellers (
  id BIGSERIAL PRIMARY KEY,
  seller_name TEXT NOT NULL UNIQUE,
  rating_pct NUMERIC(5, 2),
  rating_count INTEGER,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Individual seller offers for a product at a point in time
CREATE TABLE IF NOT EXISTS eneba.product_offers (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES eneba.products(id) ON DELETE CASCADE,
  seller_id BIGINT REFERENCES eneba.sellers(id) ON DELETE SET NULL,
  scrape_run_id BIGINT REFERENCES eneba.scrape_runs(id) ON DELETE SET NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  price NUMERIC(10, 2) NOT NULL,
  cashback_pct NUMERIC(6, 2) NOT NULL DEFAULT 0,
  is_featured_offer BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_eneba_scrape_runs_scraped_at
  ON eneba.scrape_runs (scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_eneba_scrape_runs_category_time
  ON eneba.scrape_runs (category, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_eneba_top_deals_scraped_rank
  ON eneba.top_deals (category, scraped_at DESC, rank ASC);

CREATE INDEX IF NOT EXISTS idx_eneba_top_deals_product_time
  ON eneba.top_deals (product_id, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_eneba_product_offers_product_time
  ON eneba.product_offers (product_id, scraped_at DESC);
`;

export interface SaveDealsResult {
  batchId: string;
  scrapedAt: string;
  scrapeRunsInserted: number;
  topDealsInserted: number;
}

export interface SaveDealsOptions {
  pool?: pg.Pool;
  batchId?: string;
  scrapedAt?: Date | string;
  maxRank?: number;
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
 * Ensures the `eneba` PostgreSQL schema and all relational tables exist.
 */
export async function ensureEnebaSchema(pool: pg.Pool): Promise<void> {
  await pool.query(INIT_ENEBA_SCHEMA_SQL);
}

/**
 * Saves page scrape run metadata (`eneba.scrape_runs`), upserts unique products (`eneba.products`),
 * and inserts the top 10 ranked deals (`rank` 1..10) into `eneba.top_deals`.
 */
export async function savePageDealsToDb(
  statuses: PageDealStatus | PageDealStatus[],
  options: SaveDealsOptions = {},
): Promise<SaveDealsResult> {
  const statusList = Array.isArray(statuses) ? statuses : [statuses];
  const ownPool = !options.pool;
  const pool = options.pool ?? createPgPool();
  const batchId = options.batchId ?? crypto.randomUUID();
  const maxRank = Math.min(10, Math.max(1, options.maxRank ?? 10));
  const batchTimestamp =
    options.scrapedAt instanceof Date
      ? options.scrapedAt.toISOString()
      : typeof options.scrapedAt === "string"
        ? new Date(options.scrapedAt).toISOString()
        : statusList[0]?.scrapedAt ?? new Date().toISOString();

  try {
    await ensureEnebaSchema(pool);
    const client = await pool.connect();
    let scrapeRunsInserted = 0;
    let topDealsInserted = 0;

    try {
      await client.query("BEGIN");

      for (const status of statusList) {
        // 1. Insert the page-level scrape run into eneba.scrape_runs
        const runRes = await client.query<{ id: string }>(
          `
          INSERT INTO eneba.scrape_runs (
            batch_id,
            scraped_at,
            category,
            page_url,
            page_number,
            total_listings,
            in_stock_count,
            out_of_stock_count,
            discounted_count,
            avg_discount_pct_on_discounted,
            avg_discount_pct_all_in_stock,
            avg_effective_discount_pct,
            max_discount_pct,
            max_effective_discount_pct
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
          )
          RETURNING id
          `,
          [
            batchId,
            batchTimestamp,
            status.category,
            status.pageUrl,
            status.pageNumber ?? 1,
            status.totalListings,
            status.inStockCount,
            status.outOfStockCount,
            status.discountedCount,
            status.averageDiscountPctOnDiscounted,
            status.averageDiscountPctAllInStock,
            status.averageEffectiveDiscountPct,
            status.maxDiscountPct,
            status.maxEffectiveDiscountPct,
          ],
        );
        const scrapeRunId = runRes.rows[0].id;
        scrapeRunsInserted++;

        // 2. Upsert each top 1..10 product into eneba.products and insert the ranked deal into eneba.top_deals
        const topDeals = status.rankedDeals.slice(0, maxRank);
        for (let i = 0; i < topDeals.length; i++) {
          const deal = topDeals[i];
          const rank = i + 1;
          const slug = extractProductSlug(deal.url);

          const prodRes = await client.query<{ id: string }>(
            `
            INSERT INTO eneba.products (
              slug,
              url,
              category,
              title,
              region,
              face_value,
              face_value_currency,
              first_seen_at,
              last_seen_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
            ON CONFLICT (url) DO UPDATE SET
              title = EXCLUDED.title,
              region = EXCLUDED.region,
              face_value = COALESCE(EXCLUDED.face_value, eneba.products.face_value),
              face_value_currency = COALESCE(EXCLUDED.face_value_currency, eneba.products.face_value_currency),
              last_seen_at = EXCLUDED.last_seen_at
            RETURNING id
            `,
            [
              slug,
              deal.url,
              status.category,
              deal.title,
              deal.region,
              deal.faceValue,
              deal.faceValueCurrency,
              batchTimestamp,
            ],
          );
          const productId = prodRes.rows[0].id;

          await client.query(
            `
            INSERT INTO eneba.top_deals (
              scrape_run_id,
              product_id,
              scraped_at,
              rank,
              category,
              title,
              url,
              region,
              selling_price,
              original_price,
              face_value,
              face_value_currency,
              listed_discount_pct,
              cashback_pct,
              in_stock,
              discount_pct,
              effective_discount_pct,
              effective_price,
              savings_amount
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16, $17, $18, $19
            )
            `,
            [
              scrapeRunId,
              productId,
              batchTimestamp,
              rank,
              status.category,
              deal.title,
              deal.url,
              deal.region,
              deal.sellingPrice,
              deal.originalPrice,
              deal.faceValue,
              deal.faceValueCurrency,
              deal.listedDiscountPct,
              deal.cashbackPct,
              deal.inStock,
              deal.discountPct,
              deal.effectiveDiscountPct,
              deal.effectivePrice,
              deal.savingsAmount,
            ],
          );
          topDealsInserted++;
        }
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return {
      batchId,
      scrapedAt: batchTimestamp,
      scrapeRunsInserted,
      topDealsInserted,
    };
  } finally {
    if (ownPool) {
      await pool.end();
    }
  }
}

import crypto from "node:crypto";
import type pg from "pg";
import { createPgPool, TerminalSpinner } from "../core/index.js";
import type { SellerOffer } from "./baseScraper.js";
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
  seller_slug TEXT,
  seller_url TEXT,
  rating_pct NUMERIC(5, 2),
  rating_label TEXT,
  rating_count INTEGER,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE eneba.sellers ADD COLUMN IF NOT EXISTS seller_slug TEXT;
ALTER TABLE eneba.sellers ADD COLUMN IF NOT EXISTS seller_url TEXT;
ALTER TABLE eneba.sellers ADD COLUMN IF NOT EXISTS rating_label TEXT;

-- 5. Individual seller offers for a product at a point in time
CREATE TABLE IF NOT EXISTS eneba.product_offers (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES eneba.products(id) ON DELETE CASCADE,
  seller_id BIGINT REFERENCES eneba.sellers(id) ON DELETE SET NULL,
  scrape_run_id BIGINT REFERENCES eneba.scrape_runs(id) ON DELETE SET NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  price NUMERIC(10, 2) NOT NULL,
  cashback_pct NUMERIC(6, 2) NOT NULL DEFAULT 0,
  is_lowest_price BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured_offer BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE eneba.product_offers ADD COLUMN IF NOT EXISTS is_lowest_price BOOLEAN NOT NULL DEFAULT FALSE;

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

export interface DbPersistenceStatus {
  saved: boolean;
  skipped: boolean;
  batchId?: string;
  scrapedAt?: string;
  scrapeRunsInserted?: number;
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

export interface SaveProductOffersResult {
  sellersUpserted: number;
  offersInserted: number;
}

/**
 * Persists scraped vendor offers for a given product URL into `eneba.sellers` and `eneba.product_offers`.
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
  const scrapedAtIso =
    options.scrapedAt instanceof Date
      ? options.scrapedAt.toISOString()
      : typeof options.scrapedAt === "string"
        ? new Date(options.scrapedAt).toISOString()
        : new Date().toISOString();

  try {
    await ensureEnebaSchema(pool);
    const client = await pool.connect();
    let sellersUpserted = 0;
    let offersInserted = 0;

    try {
      await client.query("BEGIN");

      const prodRes = await client.query<{ id: string }>(
        `SELECT id FROM eneba.products WHERE url = $1 LIMIT 1`,
        [productUrl],
      );
      if (prodRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return { sellersUpserted: 0, offersInserted: 0 };
      }
      const productId = prodRes.rows[0].id;

      const latestDealRes = await client.query<{ scrape_run_id: string }>(
        `SELECT scrape_run_id FROM eneba.top_deals WHERE product_id = $1 ORDER BY scraped_at DESC LIMIT 1`,
        [productId],
      );
      const scrapeRunId = latestDealRes.rows[0]?.scrape_run_id ?? null;

      for (const offer of offers) {
        const sellerRes = await client.query<{ id: string }>(
          `
          INSERT INTO eneba.sellers (
            seller_name,
            seller_slug,
            seller_url,
            rating_pct,
            rating_label,
            first_seen_at,
            last_seen_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $6)
          ON CONFLICT (seller_name) DO UPDATE SET
            seller_slug = COALESCE(EXCLUDED.seller_slug, eneba.sellers.seller_slug),
            seller_url = COALESCE(EXCLUDED.seller_url, eneba.sellers.seller_url),
            rating_pct = COALESCE(EXCLUDED.rating_pct, eneba.sellers.rating_pct),
            rating_label = COALESCE(EXCLUDED.rating_label, eneba.sellers.rating_label),
            last_seen_at = EXCLUDED.last_seen_at
          RETURNING id
          `,
          [
            offer.sellerName,
            offer.sellerSlug,
            offer.sellerUrl,
            offer.ratingScore,
            offer.ratingLabel,
            scrapedAtIso,
          ],
        );
        const sellerId = sellerRes.rows[0].id;
        sellersUpserted++;

        await client.query(
          `
          INSERT INTO eneba.product_offers (
            product_id,
            seller_id,
            scrape_run_id,
            scraped_at,
            price,
            cashback_pct,
            is_lowest_price,
            is_featured_offer
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            productId,
            sellerId,
            scrapeRunId,
            scrapedAtIso,
            offer.price,
            offer.cashbackPct,
            offer.isLowestPrice,
            offer.isFeaturedOffer,
          ],
        );
        offersInserted++;
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return { sellersUpserted, offersInserted };
  } finally {
    if (ownPool) {
      await pool.end();
    }
  }
}

/**
 * Non-blocking, fault-tolerant database persistence helper.
 * If `DATABASE_URL` is missing, `--no-db` is passed, or PostgreSQL connection/insert fails for ANY reason,
 * this catches the error, logs a warning to `stderr`, and returns a status object so the scraper
 * always returns its full JSON/CLI results without crashing.
 */
export async function tryPersistScrapeResult(
  statuses: PageDealStatus | PageDealStatus[],
  options: {
    noDb?: boolean;
    maxRank?: number;
    showProgress?: boolean;
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
    `[PostgreSQL] Saving top deals & seller offers to schema "eneba"...`,
  );

  let pool: pg.Pool | null = null;
  try {
    pool = createPgPool();
    const savedDeals = await savePageDealsToDb(statusList, {
      pool,
      maxRank: options.maxRank ?? 10,
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
      `[PostgreSQL] Saved ${savedDeals.topDealsInserted} top deals & ${totalOffers} seller offers into schema "eneba"`,
    );

    const dbStatus: DbPersistenceStatus = {
      saved: true,
      skipped: false,
      batchId: savedDeals.batchId,
      scrapedAt: savedDeals.scrapedAt,
      scrapeRunsInserted: savedDeals.scrapeRunsInserted,
      topDealsInserted: savedDeals.topDealsInserted,
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
    if (pool) {
      await pool.end().catch(() => {});
    }
  }
}

/**
 * Loads the most recent `PageDealStatus` for each category from PostgreSQL (`eneba.*` schema).
 * Fault-tolerant: returns `[]` if `DATABASE_URL` is not configured or PostgreSQL is unreachable.
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

    // Get latest scrape_run per category
    const runsRes = await pool.query<{
      id: string;
      batch_id: string;
      scraped_at: Date;
      category: string;
      page_url: string;
      page_number: number;
      total_listings: number;
      in_stock_count: number;
      out_of_stock_count: number;
      discounted_count: number;
      avg_discount_pct_on_discounted: string;
      avg_discount_pct_all_in_stock: string;
      avg_effective_discount_pct: string;
      max_discount_pct: string;
      max_effective_discount_pct: string;
    }>(`
      SELECT DISTINCT ON (category)
        id,
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
      FROM eneba.scrape_runs
      ORDER BY category, scraped_at DESC
    `);

    const statuses: PageDealStatus[] = [];

    for (const run of runsRes.rows) {
      const dealsRes = await pool.query<{
        rank: number;
        category: string;
        title: string;
        url: string;
        region: string;
        selling_price: string | null;
        original_price: string | null;
        face_value: string | null;
        face_value_currency: string | null;
        listed_discount_pct: string | null;
        cashback_pct: string;
        in_stock: boolean;
        discount_pct: string;
        effective_discount_pct: string;
        effective_price: string | null;
        savings_amount: string;
      }>(
        `
        SELECT
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
        FROM eneba.top_deals
        WHERE scrape_run_id = $1
        ORDER BY rank ASC
        `,
        [run.id],
      );

      const rankedDeals = dealsRes.rows.map((d) => ({
        rank: Number(d.rank),
        category: d.category,
        title: d.title,
        url: d.url,
        region: d.region,
        sellingPrice:
          d.selling_price !== null ? Number(d.selling_price) : null,
        originalPrice:
          d.original_price !== null ? Number(d.original_price) : null,
        faceValue: d.face_value !== null ? Number(d.face_value) : null,
        faceValueCurrency: d.face_value_currency,
        listedDiscountPct:
          d.listed_discount_pct !== null ? Number(d.listed_discount_pct) : null,
        cashbackPct: Number(d.cashback_pct),
        inStock: d.in_stock,
        discountPct: Number(d.discount_pct),
        effectiveDiscountPct: Number(d.effective_discount_pct),
        effectivePrice:
          d.effective_price !== null ? Number(d.effective_price) : null,
        savingsAmount: Number(d.savings_amount),
      }));

      // Fetch competing seller offers for this scrape run
      const offersRes = await pool.query<{
        seller_name: string;
        seller_slug: string | null;
        seller_url: string | null;
        rating_pct: string | null;
        rating_label: string | null;
        price: string;
        cashback_pct: string;
        is_lowest_price: boolean;
        is_featured_offer: boolean;
      }>(
        `
        SELECT
          s.seller_name,
          s.seller_slug,
          s.seller_url,
          s.rating_pct,
          s.rating_label,
          po.price,
          po.cashback_pct,
          po.is_lowest_price,
          po.is_featured_offer
        FROM eneba.product_offers po
        JOIN eneba.sellers s ON s.id = po.seller_id
        WHERE po.scrape_run_id = $1
        ORDER BY po.price ASC
        `,
        [run.id],
      );

      const bestDealOffers: SellerOffer[] = offersRes.rows.map((o) => ({
        sellerName: o.seller_name,
        sellerSlug: o.seller_slug ?? o.seller_name,
        sellerUrl: o.seller_url ?? "",
        ratingScore: o.rating_pct !== null ? Number(o.rating_pct) : null,
        ratingLabel: o.rating_label,
        price: Number(o.price),
        cashbackPct: Number(o.cashback_pct),
        isLowestPrice: o.is_lowest_price,
        isFeaturedOffer: o.is_featured_offer,
      }));

      const bestEffectiveDeal = rankedDeals[0] ?? null;
      const bestDirectDeal =
        [...rankedDeals].sort((a, b) => b.discountPct - a.discountPct)[0] ??
        null;

      statuses.push({
        category: run.category,
        pageUrl: run.page_url,
        pageNumber: run.page_number,
        scrapedAt: new Date(run.scraped_at).toISOString(),
        totalListings: run.total_listings,
        inStockCount: run.in_stock_count,
        outOfStockCount: run.out_of_stock_count,
        discountedCount: run.discounted_count,
        averageDiscountPctOnDiscounted: Number(
          run.avg_discount_pct_on_discounted,
        ),
        averageDiscountPctAllInStock: Number(run.avg_discount_pct_all_in_stock),
        averageEffectiveDiscountPct: Number(run.avg_effective_discount_pct),
        maxDiscountPct: Number(run.max_discount_pct),
        maxEffectiveDiscountPct: Number(run.max_effective_discount_pct),
        bestDeal: bestDirectDeal,
        bestEffectiveDeal,
        bestDealOffers,
        topDeals: rankedDeals,
        rankedDeals,
      });
    }

    return statuses;
  } catch {
    return [];
  } finally {
    if (pool) {
      await pool.end().catch(() => {});
    }
  }
}

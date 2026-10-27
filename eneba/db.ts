import crypto from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type pg from "pg";
import {
  createDrizzleDb,
  createPgPool,
  enebaConfig,
  enebaProductOffers,
  enebaProducts,
  enebaScrapeRuns,
  enebaSellers,
  enebaTopDeals,
  TerminalSpinner,
  type ScraplingDb,
} from "../core/index.js";
import type { SellerOffer } from "./baseScraper.js";
import type { PageDealStatus } from "./pageStats.js";

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

  -- Clean up empty legacy eneba_* tables
  DROP TABLE IF EXISTS scrapling.eneba_product_offers CASCADE;
  DROP TABLE IF EXISTS scrapling.eneba_top_deals CASCADE;
  DROP TABLE IF EXISTS scrapling.eneba_scrape_runs CASCADE;
  DROP TABLE IF EXISTS scrapling.eneba_sellers CASCADE;
  DROP TABLE IF EXISTS scrapling.eneba_products CASCADE;
END $$;

-- 2. Generic Products Catalog Table
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

-- 3. Generic Page-Level Scrape Runs Table
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

-- 4. Generic Top Ranked Deals Table
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

-- 5. Generic Sellers / Merchants Table
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

-- 6. Generic Product Offers Table
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

-- Performance Indexes
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

-- Ensure provider columns exist on upgraded tables
ALTER TABLE scrapling.products ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'eneba';
ALTER TABLE scrapling.scrape_runs ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'eneba';
ALTER TABLE scrapling.top_deals ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'eneba';
ALTER TABLE scrapling.sellers ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'eneba';
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
 * Saves page scrape run metadata (`scrapling.eneba_scrape_runs`), upserts unique products (`scrapling.eneba_products`),
 * and inserts the top ranked deals (`rank` 1..N) into `scrapling.eneba_top_deals`.
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
  const maxRank = Math.min(100, Math.max(1, options.maxRank ?? 10));
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
    let topDealsInserted = 0;

    await db.transaction(async (tx) => {
      for (const status of statusList) {
        // 1. Insert the page-level scrape run into scrapling.eneba_scrape_runs
        const runRes = await tx
          .insert(enebaScrapeRuns)
          .values({
            batchId,
            scrapedAt: batchDate,
            category: status.category,
            pageUrl: status.pageUrl,
            pageNumber: status.pageNumber ?? 1,
            totalListings: status.totalListings,
            inStockCount: status.inStockCount,
            outOfStockCount: status.outOfStockCount,
            discountedCount: status.discountedCount,
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
          .returning({ id: enebaScrapeRuns.id });

        const scrapeRunId = runRes[0].id;
        scrapeRunsInserted++;

        // 2. Upsert each top 1..N product into scrapling.eneba_products and insert the ranked deal into scrapling.eneba_top_deals
        const topDeals = status.rankedDeals.slice(0, maxRank);
        for (let i = 0; i < topDeals.length; i++) {
          const deal = topDeals[i];
          const rank = i + 1;
          const slug = extractProductSlug(deal.url);

          const prodRes = await tx
            .insert(enebaProducts)
            .values({
              slug,
              url: deal.url,
              category: status.category,
              title: deal.title,
              region: deal.region,
              faceValue:
                deal.faceValue != null ? String(deal.faceValue) : null,
              faceValueCurrency: deal.faceValueCurrency,
              firstSeenAt: batchDate,
              lastSeenAt: batchDate,
            })
            .onConflictDoUpdate({
              target: enebaProducts.url,
              set: {
                title: deal.title,
                region: deal.region,
                faceValue:
                  deal.faceValue != null
                    ? String(deal.faceValue)
                    : sql`COALESCE(${enebaProducts.faceValue}, NULL)`,
                faceValueCurrency:
                  deal.faceValueCurrency != null
                    ? deal.faceValueCurrency
                    : sql`COALESCE(${enebaProducts.faceValueCurrency}, NULL)`,
                lastSeenAt: batchDate,
              },
            })
            .returning({ id: enebaProducts.id });

          const productId = prodRes[0].id;

          await tx.insert(enebaTopDeals).values({
            scrapeRunId,
            productId,
            scrapedAt: batchDate,
            rank,
            category: status.category,
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
            cashbackPct: String(deal.cashbackPct ?? 0),
            inStock: deal.inStock ?? true,
            discountPct: String(deal.discountPct ?? 0),
            effectiveDiscountPct: String(deal.effectiveDiscountPct ?? 0),
            effectivePrice:
              deal.effectivePrice != null ? String(deal.effectivePrice) : null,
            savingsAmount: String(deal.savingsAmount ?? 0),
          });
          topDealsInserted++;
        }
      }
    });

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
 * Persists scraped vendor offers for a given product URL into `scrapling.eneba_sellers` and `scrapling.eneba_product_offers`.
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
      const prodRows = await tx
        .select({ id: enebaProducts.id })
        .from(enebaProducts)
        .where(eq(enebaProducts.url, productUrl))
        .limit(1);

      if (prodRows.length === 0) {
        return;
      }
      const productId = prodRows[0].id;

      const latestDealRows = await tx
        .select({ scrapeRunId: enebaTopDeals.scrapeRunId })
        .from(enebaTopDeals)
        .where(eq(enebaTopDeals.productId, productId))
        .orderBy(desc(enebaTopDeals.scrapedAt))
        .limit(1);

      const scrapeRunId = latestDealRows[0]?.scrapeRunId ?? null;

      for (const offer of offers) {
        const sellerRows = await tx
          .insert(enebaSellers)
          .values({
            sellerName: offer.sellerName,
            sellerSlug: offer.sellerSlug,
            sellerUrl: offer.sellerUrl,
            ratingPct:
              offer.ratingScore != null ? String(offer.ratingScore) : null,
            ratingLabel: offer.ratingLabel,
            firstSeenAt: scrapedDate,
            lastSeenAt: scrapedDate,
          })
          .onConflictDoUpdate({
            target: enebaSellers.sellerName,
            set: {
              sellerSlug:
                offer.sellerSlug != null
                  ? offer.sellerSlug
                  : sql`COALESCE(${enebaSellers.sellerSlug}, NULL)`,
              sellerUrl:
                offer.sellerUrl != null
                  ? offer.sellerUrl
                  : sql`COALESCE(${enebaSellers.sellerUrl}, NULL)`,
              ratingPct:
                offer.ratingScore != null
                  ? String(offer.ratingScore)
                  : sql`COALESCE(${enebaSellers.ratingPct}, NULL)`,
              ratingLabel:
                offer.ratingLabel != null
                  ? offer.ratingLabel
                  : sql`COALESCE(${enebaSellers.ratingLabel}, NULL)`,
              lastSeenAt: scrapedDate,
            },
          })
          .returning({ id: enebaSellers.id });

        const sellerId = sellerRows[0].id;
        sellersUpserted++;

        await tx.insert(enebaProductOffers).values({
          productId,
          sellerId,
          scrapeRunId,
          scrapedAt: scrapedDate,
          price: String(offer.price),
          cashbackPct: String(offer.cashbackPct ?? 0),
          isLowestPrice: offer.isLowestPrice ?? false,
          isFeaturedOffer: offer.isFeaturedOffer ?? false,
        });
        offersInserted++;
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
      `[PostgreSQL] Saved ${savedDeals.topDealsInserted} top deals & ${totalOffers} seller offers into schema "scrapling"`,
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
    if (ownPool && pool) {
      await pool.end().catch(() => {});
    }
  }
}

/**
 * Loads the most recent `PageDealStatus` for each category from PostgreSQL (`scrapling` schema tables).
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

    const runs = await db
      .selectDistinctOn([enebaScrapeRuns.category])
      .from(enebaScrapeRuns)
      .orderBy(enebaScrapeRuns.category, desc(enebaScrapeRuns.scrapedAt));

    const statuses: PageDealStatus[] = [];

    for (const run of runs) {
      const deals = await db
        .select()
        .from(enebaTopDeals)
        .where(eq(enebaTopDeals.scrapeRunId, run.id))
        .orderBy(asc(enebaTopDeals.rank));

      const rankedDeals = deals.map((d) => ({
        rank: Number(d.rank),
        category: d.category,
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
        cashbackPct: Number(d.cashbackPct),
        inStock: d.inStock,
        discountPct: Number(d.discountPct),
        effectiveDiscountPct: Number(d.effectiveDiscountPct),
        effectivePrice:
          d.effectivePrice !== null ? Number(d.effectivePrice) : null,
        savingsAmount: Number(d.savingsAmount),
      }));

      const offers = await db
        .select({
          sellerName: enebaSellers.sellerName,
          sellerSlug: enebaSellers.sellerSlug,
          sellerUrl: enebaSellers.sellerUrl,
          ratingPct: enebaSellers.ratingPct,
          ratingLabel: enebaSellers.ratingLabel,
          price: enebaProductOffers.price,
          cashbackPct: enebaProductOffers.cashbackPct,
          isLowestPrice: enebaProductOffers.isLowestPrice,
          isFeaturedOffer: enebaProductOffers.isFeaturedOffer,
        })
        .from(enebaProductOffers)
        .innerJoin(
          enebaSellers,
          eq(enebaSellers.id, enebaProductOffers.sellerId),
        )
        .where(eq(enebaProductOffers.scrapeRunId, run.id))
        .orderBy(asc(enebaProductOffers.price));

      const bestDealOffers: SellerOffer[] = offers.map((o) => ({
        sellerName: o.sellerName,
        sellerSlug: o.sellerSlug ?? o.sellerName,
        sellerUrl: o.sellerUrl ?? "",
        ratingScore: o.ratingPct !== null ? Number(o.ratingPct) : null,
        ratingLabel: o.ratingLabel,
        price: Number(o.price),
        cashbackPct: Number(o.cashbackPct),
        isLowestPrice: o.isLowestPrice,
        isFeaturedOffer: o.isFeaturedOffer,
      }));

      const bestEffectiveDeal = rankedDeals[0] ?? null;
      const bestDirectDeal =
        [...rankedDeals].sort((a, b) => b.discountPct - a.discountPct)[0] ??
        null;

      statuses.push({
        category: run.category,
        pageUrl: run.pageUrl,
        pageNumber: run.pageNumber,
        scrapedAt: new Date(run.scrapedAt).toISOString(),
        totalListings: run.totalListings,
        inStockCount: run.inStockCount,
        outOfStockCount: run.outOfStockCount,
        discountedCount: run.discountedCount,
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

/**
 * Loads scraping history and success rate records aggregated by batch_id from PostgreSQL.
 */
export async function fetchScrapeHistoryFromDb(
  pool?: pg.Pool,
  limit = 30,
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

  const ownPool = !pool;
  const p = pool || createPgPool();
  try {
    const db: ScraplingDb = createDrizzleDb(p);
    const res = await db
      .select({
        batchId: enebaScrapeRuns.batchId,
        scrapedAt: sql<Date>`MIN(${enebaScrapeRuns.scrapedAt})`,
        totalPages: sql<number>`COUNT(*)::int`,
        successfulPages: sql<number>`COUNT(CASE WHEN ${enebaScrapeRuns.totalListings} > 0 THEN 1 END)::int`,
        totalListings: sql<number>`COALESCE(SUM(${enebaScrapeRuns.totalListings}), 0)::int`,
        inStockCount: sql<number>`COALESCE(SUM(${enebaScrapeRuns.inStockCount}), 0)::int`,
      })
      .from(enebaScrapeRuns)
      .groupBy(enebaScrapeRuns.batchId)
      .orderBy(asc(sql`MIN(${enebaScrapeRuns.scrapedAt})`))
      .limit(limit);

    const batchIds = res.map((r) => r.batchId).filter(Boolean);
    const dealsByBatch = new Map<
      string,
      {
        title: string;
        category: string;
        sellerName: string;
        cost: number;
        faceValue: number;
        discountPct: number;
        url?: string;
      }
    >();

    if (batchIds.length > 0) {
      try {
        const topDealsRes = await db
          .selectDistinctOn([enebaScrapeRuns.batchId], {
            batchId: enebaScrapeRuns.batchId,
            title: enebaTopDeals.title,
            category: enebaTopDeals.category,
            sellingPrice: enebaTopDeals.sellingPrice,
            faceValue: enebaTopDeals.faceValue,
            originalPrice: enebaTopDeals.originalPrice,
            discountPct: enebaTopDeals.discountPct,
            url: enebaTopDeals.url,
            sellerName: sql<string>`COALESCE(${enebaSellers.sellerName}, 'Top Merchant')`,
          })
          .from(enebaTopDeals)
          .innerJoin(
            enebaScrapeRuns,
            eq(enebaTopDeals.scrapeRunId, enebaScrapeRuns.id),
          )
          .leftJoin(
            enebaProductOffers,
            and(
              eq(enebaProductOffers.productId, enebaTopDeals.productId),
              eq(enebaProductOffers.isLowestPrice, true),
            ),
          )
          .leftJoin(
            enebaSellers,
            eq(enebaProductOffers.sellerId, enebaSellers.id),
          )
          .where(inArray(enebaScrapeRuns.batchId, batchIds))
          .orderBy(enebaScrapeRuns.batchId, desc(enebaTopDeals.discountPct));

        for (const dr of topDealsRes) {
          dealsByBatch.set(dr.batchId, {
            title: dr.title,
            category: dr.category,
            sellerName: dr.sellerName || "Top Merchant",
            cost: Number(dr.sellingPrice) || 0,
            faceValue: Number(dr.faceValue) || Number(dr.originalPrice) || 0,
            discountPct: Number(dr.discountPct) || 0,
            url: dr.url,
          });
        }
      } catch {
        // Fallback gracefully without deals join
      }
    }

    return res.map((r) => {
      const totalPages = Number(r.totalPages) || 1;
      const successfulPages = Number(r.successfulPages) || 0;
      const successRate = Number(
        ((successfulPages / totalPages) * 100).toFixed(1),
      );
      return {
        id: r.batchId,
        timestamp: new Date(r.scrapedAt).toISOString(),
        totalPages,
        successfulPages,
        successRate,
        totalListings: Number(r.totalListings) || 0,
        inStockCount: Number(r.inStockCount) || 0,
        bestDeal: dealsByBatch.get(r.batchId),
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

import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  numeric,
  pgSchema,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type pg from "pg";

export const scraplingSchema = pgSchema("scrapling");

/**
 * 1. Application & System Configuration (`scrapling.config`)
 */
export const scraplingConfig = scraplingSchema.table("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  groupName: text("group_name").notNull().default("custom"),
  description: text("description").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Backward-compatibility alias: eneba_config has been merged into config
export const enebaConfig = scraplingConfig;

/**
 * 2b. Multi-Scheduler Configurations (`scrapling.schedulers`)
 */
export const scraplingSchedulers = scraplingSchema.table("schedulers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  baseTime: text("base_time").notNull().default("19:00"),
  jitterMinutes: integer("jitter_minutes").notNull().default(60),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * 2c. Monitored Scraping Targets and Provider Mappings (`scrapling.targets`)
 */
export const scraplingTargets = scraplingSchema.table("targets", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull().default("eneba"), // scraper provider (e.g. 'eneba', 'g2a')
  name: text("name").notNull(), // display title (e.g. 'PlayStation (PSN) Gift Cards')
  url: text("url").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  withOffers: boolean("with_offers").notNull().default(true),
  scheduleId: text("schedule_id").notNull().default("default"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * 3. Normalized Catalog of Unique Gift Card Products (`scrapling.products`)
 */
export const scraplingProducts = scraplingSchema.table("products", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  provider: text("provider").notNull().default("eneba"),
  slug: text("slug").notNull().unique(),
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  region: text("region").notNull(),
  faceValue: numeric("face_value", { precision: 10, scale: 2 }),
  faceValueCurrency: text("face_value_currency"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const enebaProducts = scraplingProducts;

/**
 * 4. Page-Level Scrape Runs (`scrapling.scrape_runs`)
 */
export const scraplingScrapeRuns = scraplingSchema.table(
  "scrape_runs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    batchId: uuid("batch_id").notNull(),
    scrapedAt: timestamp("scraped_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    provider: text("provider").notNull().default("eneba"),
    targetId: text("target_id").references(() => scraplingTargets.id, {
      onDelete: "set null",
    }),
    targetName: text("target_name").notNull().default(""),
    pageUrl: text("page_url").notNull(),
    pageNumber: smallint("page_number").notNull().default(1),
    totalListings: smallint("total_listings").notNull(),
    inStockCount: smallint("in_stock_count").notNull(),
    discountedCount: smallint("discounted_count").notNull(),
    avgDiscountPctOnDiscounted: numeric("avg_discount_pct_on_discounted", {
      precision: 6,
      scale: 2,
    }).notNull(),
    avgDiscountPctAllInStock: numeric("avg_discount_pct_all_in_stock", {
      precision: 6,
      scale: 2,
    }).notNull(),
    avgEffectiveDiscountPct: numeric("avg_effective_discount_pct", {
      precision: 6,
      scale: 2,
    }).notNull(),
    maxDiscountPct: numeric("max_discount_pct", {
      precision: 6,
      scale: 2,
    }).notNull(),
    maxEffectiveDiscountPct: numeric("max_effective_discount_pct", {
      precision: 6,
      scale: 2,
    }).notNull(),
  },
  (table) => [
    index("idx_scrapling_scrape_runs_scraped_at").on(table.scrapedAt),
    index("idx_scrapling_scrape_runs_provider_time").on(
      table.provider,
      table.scrapedAt,
    ),
    index("idx_scrapling_scrape_runs_target_time").on(
      table.targetId,
      table.scrapedAt,
    ),
  ],
);

export const enebaScrapeRuns = scraplingScrapeRuns;

/**
 * 5. Sellers / Merchants (`scrapling.sellers`)
 */
export const scraplingSellers = scraplingSchema.table("sellers", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  provider: text("provider").notNull().default("eneba"),
  sellerName: text("seller_name").notNull().unique(),
  sellerSlug: text("seller_slug"),
  sellerUrl: text("seller_url"),
  ratingPct: numeric("rating_pct", { precision: 5, scale: 2 }),
  ratingLabel: text("rating_label"),
  ratingCount: integer("rating_count"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const enebaSellers = scraplingSellers;

/**
 * 6. Consolidated Scraped Records & Listings (`scrapling.records`)
 * Stores all scraped listings, deals, and seller offers with batch, target, seller, and price details.
 */
export const scraplingRecords = scraplingSchema.table(
  "records",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    batchId: uuid("batch_id").notNull(),
    scrapeRunId: bigint("scrape_run_id", { mode: "number" }).references(
      () => scraplingScrapeRuns.id,
      { onDelete: "cascade" },
    ),
    targetId: text("target_id").references(() => scraplingTargets.id, {
      onDelete: "set null",
    }),
    targetName: text("target_name").notNull().default(""),
    targetUrl: text("target_url").notNull().default(""),
    productId: bigint("product_id", { mode: "number" }).references(
      () => scraplingProducts.id,
      { onDelete: "set null" },
    ),
    sellerId: bigint("seller_id", { mode: "number" }).references(
      () => scraplingSellers.id,
      { onDelete: "set null" },
    ),
    provider: text("provider").notNull().default("eneba"), // scraper provider: 'eneba', 'g2a'
    title: text("title").notNull(),
    url: text("url").notNull(),
    region: text("region").notNull().default("GLOBAL"),
    sellingPrice: numeric("selling_price", { precision: 10, scale: 2 }),
    originalPrice: numeric("original_price", { precision: 10, scale: 2 }),
    faceValue: numeric("face_value", { precision: 10, scale: 2 }),
    faceValueCurrency: text("face_value_currency"),
    listedDiscountPct: numeric("listed_discount_pct", {
      precision: 6,
      scale: 2,
    }),
    cashbackPct: numeric("cashback_pct", { precision: 6, scale: 2 })
      .notNull()
      .default("0"),
    inStock: boolean("in_stock").notNull().default(true),
    discountPct: numeric("discount_pct", { precision: 6, scale: 2 })
      .notNull()
      .default("0"),
    effectiveDiscountPct: numeric("effective_discount_pct", {
      precision: 6,
      scale: 2,
    })
      .notNull()
      .default("0"),
    effectivePrice: numeric("effective_price", { precision: 10, scale: 2 }),
    savingsAmount: numeric("savings_amount", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    rank: smallint("rank"),
    isLowestPrice: boolean("is_lowest_price").notNull().default(false),
    isFeaturedOffer: boolean("is_featured_offer").notNull().default(false),
    scrapedAt: timestamp("scraped_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_scrapling_records_provider_time").on(
      table.provider,
      table.scrapedAt,
    ),
    index("idx_scrapling_records_target_time").on(
      table.targetId,
      table.scrapedAt,
    ),
    index("idx_scrapling_records_batch_id").on(table.batchId),
    index("idx_scrapling_records_product_time").on(
      table.productId,
      table.scrapedAt,
    ),
    index("idx_scrapling_records_seller_id").on(table.sellerId),
    index("idx_scrapling_records_discount").on(
      table.discountPct,
      table.effectiveDiscountPct,
    ),
  ],
);

// Backward-compatibility aliases mapping to records
export const scraplingTopDeals = scraplingRecords;
export const enebaTopDeals = scraplingRecords;
export const scraplingProductOffers = scraplingRecords;
export const enebaProductOffers = scraplingRecords;

/**
 * Relational definitions for Drizzle relational query builder
 */
export const scraplingScrapeRunsRelations = relations(
  scraplingScrapeRuns,
  ({ many, one }) => ({
    records: many(scraplingRecords),
    target: one(scraplingTargets, {
      fields: [scraplingScrapeRuns.targetId],
      references: [scraplingTargets.id],
    }),
  }),
);

export const enebaScrapeRunsRelations = scraplingScrapeRunsRelations;

export const scraplingProductsRelations = relations(
  scraplingProducts,
  ({ many }) => ({
    records: many(scraplingRecords),
  }),
);

export const enebaProductsRelations = scraplingProductsRelations;

export const scraplingRecordsRelations = relations(
  scraplingRecords,
  ({ one }) => ({
    scrapeRun: one(scraplingScrapeRuns, {
      fields: [scraplingRecords.scrapeRunId],
      references: [scraplingScrapeRuns.id],
    }),
    product: one(scraplingProducts, {
      fields: [scraplingRecords.productId],
      references: [scraplingProducts.id],
    }),
    seller: one(scraplingSellers, {
      fields: [scraplingRecords.sellerId],
      references: [scraplingSellers.id],
    }),
    target: one(scraplingTargets, {
      fields: [scraplingRecords.targetId],
      references: [scraplingTargets.id],
    }),
  }),
);

export const scraplingTopDealsRelations = scraplingRecordsRelations;
export const enebaTopDealsRelations = scraplingRecordsRelations;
export const scraplingProductOffersRelations = scraplingRecordsRelations;
export const enebaProductOffersRelations = scraplingRecordsRelations;

export const scraplingSellersRelations = relations(
  scraplingSellers,
  ({ many }) => ({
    records: many(scraplingRecords),
  }),
);

export const enebaSellersRelations = scraplingSellersRelations;

export const schema = {
  scraplingConfig,
  scraplingSchedulers,
  scraplingTargets,
  scraplingProducts,
  scraplingScrapeRuns,
  scraplingRecords,
  scraplingTopDeals,
  scraplingSellers,
  scraplingProductOffers,
  scraplingScrapeRunsRelations,
  scraplingProductsRelations,
  scraplingRecordsRelations,
  scraplingTopDealsRelations,
  scraplingSellersRelations,
  scraplingProductOffersRelations,
  // Backward compatibility
  enebaConfig,
  enebaProducts,
  enebaScrapeRuns,
  enebaTopDeals,
  enebaSellers,
  enebaProductOffers,
  enebaScrapeRunsRelations,
  enebaProductsRelations,
  enebaTopDealsRelations,
  enebaSellersRelations,
  enebaProductOffersRelations,
};

export type ScraplingDb = NodePgDatabase<typeof schema>;

/**
 * Wraps a `pg.Pool` or `pg.PoolClient` in a typed Drizzle ORM database instance.
 */
export function createDrizzleDb(client: pg.Pool | pg.PoolClient): ScraplingDb {
  return drizzle(client, { schema });
}

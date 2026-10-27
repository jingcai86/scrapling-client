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
 * 2c. Monitored Scraping Targets and Category Mappings (`scrapling.targets`)
 */
export const scraplingTargets = scraplingSchema.table("targets", {
  id: text("id").primaryKey(),
  category: text("category").notNull().default("eneba"), // scraper type / site category (e.g. 'eneba', 'g2a')
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
  category: text("category").notNull(),
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
    category: text("category").notNull(),
    pageUrl: text("page_url").notNull(),
    pageNumber: smallint("page_number").notNull().default(1),
    totalListings: smallint("total_listings").notNull(),
    inStockCount: smallint("in_stock_count").notNull(),
    outOfStockCount: smallint("out_of_stock_count").notNull(),
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
    index("idx_scrapling_scrape_runs_category_time").on(
      table.category,
      table.scrapedAt,
    ),
  ],
);

export const enebaScrapeRuns = scraplingScrapeRuns;

/**
 * 5. Top Ranked Deals per Scrape Run (`scrapling.top_deals`)
 */
export const scraplingTopDeals = scraplingSchema.table(
  "top_deals",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    scrapeRunId: bigint("scrape_run_id", { mode: "number" })
      .notNull()
      .references(() => scraplingScrapeRuns.id, { onDelete: "cascade" }),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => scraplingProducts.id, { onDelete: "cascade" }),
    scrapedAt: timestamp("scraped_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    provider: text("provider").notNull().default("eneba"),
    rank: smallint("rank").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    region: text("region").notNull(),
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
  },
  (table) => [
    unique("top_deals_scrape_run_id_rank_key").on(
      table.scrapeRunId,
      table.rank,
    ),
    index("idx_scrapling_top_deals_scraped_rank").on(
      table.category,
      table.scrapedAt,
      table.rank,
    ),
    index("idx_scrapling_top_deals_product_time").on(
      table.productId,
      table.scrapedAt,
    ),
  ],
);

export const enebaTopDeals = scraplingTopDeals;

/**
 * 6. Sellers / Merchants (`scrapling.sellers`)
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
  isVerified: boolean("is_verified").notNull().default(false),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const enebaSellers = scraplingSellers;

/**
 * 7. Individual Seller Offers for a Product (`scrapling.product_offers`)
 */
export const scraplingProductOffers = scraplingSchema.table(
  "product_offers",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => scraplingProducts.id, { onDelete: "cascade" }),
    sellerId: bigint("seller_id", { mode: "number" }).references(
      () => scraplingSellers.id,
      { onDelete: "set null" },
    ),
    scrapeRunId: bigint("scrape_run_id", { mode: "number" }).references(
      () => scraplingScrapeRuns.id,
      { onDelete: "set null" },
    ),
    scrapedAt: timestamp("scraped_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    cashbackPct: numeric("cashback_pct", { precision: 6, scale: 2 })
      .notNull()
      .default("0"),
    isLowestPrice: boolean("is_lowest_price").notNull().default(false),
    isFeaturedOffer: boolean("is_featured_offer").notNull().default(false),
  },
  (table) => [
    index("idx_scrapling_product_offers_product_time").on(
      table.productId,
      table.scrapedAt,
    ),
  ],
);

export const enebaProductOffers = scraplingProductOffers;

/**
 * Relational definitions for Drizzle relational query builder
 */
export const scraplingScrapeRunsRelations = relations(
  scraplingScrapeRuns,
  ({ many }) => ({
    topDeals: many(scraplingTopDeals),
    productOffers: many(scraplingProductOffers),
  }),
);

export const enebaScrapeRunsRelations = scraplingScrapeRunsRelations;

export const scraplingProductsRelations = relations(
  scraplingProducts,
  ({ many }) => ({
    topDeals: many(scraplingTopDeals),
    productOffers: many(scraplingProductOffers),
  }),
);

export const enebaProductsRelations = scraplingProductsRelations;

export const scraplingTopDealsRelations = relations(
  scraplingTopDeals,
  ({ one }) => ({
    scrapeRun: one(scraplingScrapeRuns, {
      fields: [scraplingTopDeals.scrapeRunId],
      references: [scraplingScrapeRuns.id],
    }),
    product: one(scraplingProducts, {
      fields: [scraplingTopDeals.productId],
      references: [scraplingProducts.id],
    }),
  }),
);

export const enebaTopDealsRelations = scraplingTopDealsRelations;

export const scraplingSellersRelations = relations(
  scraplingSellers,
  ({ many }) => ({
    productOffers: many(scraplingProductOffers),
  }),
);

export const enebaSellersRelations = scraplingSellersRelations;

export const scraplingProductOffersRelations = relations(
  scraplingProductOffers,
  ({ one }) => ({
    product: one(scraplingProducts, {
      fields: [scraplingProductOffers.productId],
      references: [scraplingProducts.id],
    }),
    seller: one(scraplingSellers, {
      fields: [scraplingProductOffers.sellerId],
      references: [scraplingSellers.id],
    }),
    scrapeRun: one(scraplingScrapeRuns, {
      fields: [scraplingProductOffers.scrapeRunId],
      references: [scraplingScrapeRuns.id],
    }),
  }),
);

export const enebaProductOffersRelations = scraplingProductOffersRelations;

export const schema = {
  scraplingConfig,
  scraplingSchedulers,
  scraplingTargets,
  scraplingProducts,
  scraplingScrapeRuns,
  scraplingTopDeals,
  scraplingSellers,
  scraplingProductOffers,
  scraplingScrapeRunsRelations,
  scraplingProductsRelations,
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

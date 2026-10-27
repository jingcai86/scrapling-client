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
 * 1. System & Application Runtime Configuration (`scrapling.config`)
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

/**
 * 2. Eneba Provider Configuration (`scrapling.eneba_config`)
 */
export const enebaConfig = scraplingSchema.table("eneba_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
 * 3. Normalized Catalog of Unique Eneba Gift Card Products (`scrapling.eneba_products`)
 */
export const enebaProducts = scraplingSchema.table("eneba_products", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
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

/**
 * 4. Page-Level Scrape Runs (`scrapling.eneba_scrape_runs`)
 */
export const enebaScrapeRuns = scraplingSchema.table(
  "eneba_scrape_runs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    batchId: uuid("batch_id").notNull(),
    scrapedAt: timestamp("scraped_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    index("idx_scrapling_eneba_scrape_runs_scraped_at").on(table.scrapedAt),
    index("idx_scrapling_eneba_scrape_runs_category_time").on(
      table.category,
      table.scrapedAt,
    ),
  ],
);

/**
 * 5. Top Ranked Deals per Scrape Run (`scrapling.eneba_top_deals`)
 */
export const enebaTopDeals = scraplingSchema.table(
  "eneba_top_deals",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    scrapeRunId: bigint("scrape_run_id", { mode: "number" })
      .notNull()
      .references(() => enebaScrapeRuns.id, { onDelete: "cascade" }),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => enebaProducts.id, { onDelete: "cascade" }),
    scrapedAt: timestamp("scraped_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    unique("eneba_top_deals_scrape_run_id_rank_key").on(
      table.scrapeRunId,
      table.rank,
    ),
    index("idx_scrapling_eneba_top_deals_scraped_rank").on(
      table.category,
      table.scrapedAt,
      table.rank,
    ),
    index("idx_scrapling_eneba_top_deals_product_time").on(
      table.productId,
      table.scrapedAt,
    ),
  ],
);

/**
 * 6. Sellers / Merchants (`scrapling.eneba_sellers`)
 */
export const enebaSellers = scraplingSchema.table("eneba_sellers", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
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

/**
 * 7. Individual Seller Offers for a Product (`scrapling.eneba_product_offers`)
 */
export const enebaProductOffers = scraplingSchema.table(
  "eneba_product_offers",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => enebaProducts.id, { onDelete: "cascade" }),
    sellerId: bigint("seller_id", { mode: "number" }).references(
      () => enebaSellers.id,
      { onDelete: "set null" },
    ),
    scrapeRunId: bigint("scrape_run_id", { mode: "number" }).references(
      () => enebaScrapeRuns.id,
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
    index("idx_scrapling_eneba_product_offers_product_time").on(
      table.productId,
      table.scrapedAt,
    ),
  ],
);

/**
 * Relational definitions for Drizzle relational query builder
 */
export const enebaScrapeRunsRelations = relations(
  enebaScrapeRuns,
  ({ many }) => ({
    topDeals: many(enebaTopDeals),
    productOffers: many(enebaProductOffers),
  }),
);

export const enebaProductsRelations = relations(enebaProducts, ({ many }) => ({
  topDeals: many(enebaTopDeals),
  productOffers: many(enebaProductOffers),
}));

export const enebaTopDealsRelations = relations(enebaTopDeals, ({ one }) => ({
  scrapeRun: one(enebaScrapeRuns, {
    fields: [enebaTopDeals.scrapeRunId],
    references: [enebaScrapeRuns.id],
  }),
  product: one(enebaProducts, {
    fields: [enebaTopDeals.productId],
    references: [enebaProducts.id],
  }),
}));

export const enebaSellersRelations = relations(enebaSellers, ({ many }) => ({
  productOffers: many(enebaProductOffers),
}));

export const enebaProductOffersRelations = relations(
  enebaProductOffers,
  ({ one }) => ({
    product: one(enebaProducts, {
      fields: [enebaProductOffers.productId],
      references: [enebaProducts.id],
    }),
    seller: one(enebaSellers, {
      fields: [enebaProductOffers.sellerId],
      references: [enebaSellers.id],
    }),
    scrapeRun: one(enebaScrapeRuns, {
      fields: [enebaProductOffers.scrapeRunId],
      references: [enebaScrapeRuns.id],
    }),
  }),
);

export const schema = {
  scraplingConfig,
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

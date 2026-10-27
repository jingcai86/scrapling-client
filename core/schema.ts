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
 * 2c. Monitored Scraping Targets and Provider Mappings (`scrapling.scrape_targets`)
 */
export const scraplingScrapeTargets = scraplingSchema.table(
  "scrape_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").references(() => scraplingProducts.id, {
      onDelete: "cascade",
    }),
    provider: text("provider").notNull().default("eneba"), // scraper provider (e.g. 'eneba', 'g2a')
    name: text("name").default(""), // display title (e.g. 'PlayStation (PSN) Gift Cards')
    enabled: boolean("enabled").notNull().default(true),
    scheduleId: text("schedule_id").notNull().default("default"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_scrapling_scrape_targets_product_id").on(table.productId),
  ],
);

export const scraplingTargetPages = scraplingScrapeTargets; // backward-compatibility alias
export const scraplingTargets = scraplingScrapeTargets; // backward-compatibility alias

/**
 * 3. Normalized Catalog of Unique Gift Card Products (`scrapling.products`)
 */
export const scraplingProducts = scraplingSchema.table("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(), // canonical shortcut (e.g. 'amazon-10', 'psn-50')
  title: text("title").notNull(),
  region: text("region").notNull().default("GLOBAL"),
  faceValue: numeric("face_value", { precision: 10, scale: 2 }),
  faceValueCurrency: text("face_value_currency"),
  url: text("url"), // optional reference URL
  provider: text("provider"), // optional representative provider
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
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id").notNull(),
    scrapedAt: timestamp("scraped_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    index("idx_scrapling_scrape_runs_batch_id").on(table.batchId),
  ],
);

export const enebaScrapeRuns = scraplingScrapeRuns;

/**
 * 5. Sellers / Merchants (`scrapling.sellers`)
 */
export const scraplingSellers = scraplingSchema.table("sellers", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull().default("eneba"),
  sellerName: text("seller_name").notNull().unique(),
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
    id: uuid("id").primaryKey().defaultRandom(),
    batchId: uuid("batch_id").notNull(),
    scrapeRunId: uuid("scrape_run_id").references(
      () => scraplingScrapeRuns.id,
      { onDelete: "cascade" },
    ),
    scrapeTargetId: uuid("scrape_target_id").references(
      () => scraplingScrapeTargets.id,
      { onDelete: "set null" },
    ),
    productId: uuid("product_id").references(
      () => scraplingProducts.id,
      { onDelete: "set null" },
    ),
    sellerId: uuid("seller_id").references(
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
    index("idx_scrapling_records_scrape_target_time").on(
      table.scrapeTargetId,
      table.scrapedAt,
    ),
    index("idx_scrapling_records_batch_id").on(table.batchId),
    index("idx_scrapling_records_product_time").on(
      table.productId,
      table.scrapedAt,
    ),
    index("idx_scrapling_records_seller_id").on(table.sellerId),
    index("idx_scrapling_records_scrape_run_id").on(table.scrapeRunId),
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
 * 7. System Users & Notification Recipients (`scrapling.users`)
 */
export const scraplingUsers = scraplingSchema.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  tz: text("tz").notNull().default("America/Los_Angeles"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const scraplingUser = scraplingUsers; // alias for singular user table reference

/**
 * 8. Notification Content & History (`scrapling.notifications`)
 * Primary key is UUID `id`. Stores HTML string in `content`.
 */
export const scraplingNotifications = scraplingSchema.table(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    content: text("content").notNull(),
    subject: text("subject").default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_scrapling_notifications_created_at").on(table.createdAt),
  ],
);

/**
 * 9. Many-to-Many Junction: Notifications <-> Users (`scrapling.notification_users`)
 * Links notifications to recipients with delivery and read statuses.
 */
export const scraplingNotificationUsers = scraplingSchema.table(
  "notification_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => scraplingNotifications.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => scraplingUsers.id, { onDelete: "cascade" }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_notification_users").on(table.notificationId, table.userId),
    index("idx_notification_users_user_id").on(table.userId),
    index("idx_notification_users_notification_id").on(table.notificationId),
  ],
);

/**
 * 10. Many-to-Many Junction: Notifications <-> Records (`scrapling.notification_records`)
 * Links notifications to specific scraped listing records included in the alert.
 */
export const scraplingNotificationRecords = scraplingSchema.table(
  "notification_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => scraplingNotifications.id, { onDelete: "cascade" }),
    recordId: uuid("record_id")
      .notNull()
      .references(() => scraplingRecords.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_notification_records").on(table.notificationId, table.recordId),
    index("idx_notification_records_record_id").on(table.recordId),
    index("idx_notification_records_notification_id").on(
      table.notificationId,
    ),
  ],
);

/**
 * Relational definitions for Drizzle relational query builder
 */
export const scraplingScrapeRunsRelations = relations(
  scraplingScrapeRuns,
  ({ many }) => ({
    records: many(scraplingRecords),
  }),
);

export const enebaScrapeRunsRelations = scraplingScrapeRunsRelations;

export const scraplingProductsRelations = relations(
  scraplingProducts,
  ({ many }) => ({
    records: many(scraplingRecords),
    targets: many(scraplingScrapeTargets),
  }),
);

export const enebaProductsRelations = scraplingProductsRelations;

export const scraplingScrapeTargetsRelations = relations(
  scraplingScrapeTargets,
  ({ one, many }) => ({
    product: one(scraplingProducts, {
      fields: [scraplingScrapeTargets.productId],
      references: [scraplingProducts.id],
    }),
    records: many(scraplingRecords),
  }),
);

export const scraplingTargetsRelations = scraplingScrapeTargetsRelations;

export const scraplingRecordsRelations = relations(
  scraplingRecords,
  ({ one, many }) => ({
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
    target: one(scraplingScrapeTargets, {
      fields: [scraplingRecords.scrapeTargetId],
      references: [scraplingScrapeTargets.id],
    }),
    notificationRecords: many(scraplingNotificationRecords),
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

export const scraplingUsersRelations = relations(scraplingUsers, ({ many }) => ({
  notificationUsers: many(scraplingNotificationUsers),
}));

export const scraplingNotificationsRelations = relations(
  scraplingNotifications,
  ({ many }) => ({
    notificationUsers: many(scraplingNotificationUsers),
    notificationRecords: many(scraplingNotificationRecords),
  }),
);

export const scraplingNotificationUsersRelations = relations(
  scraplingNotificationUsers,
  ({ one }) => ({
    notification: one(scraplingNotifications, {
      fields: [scraplingNotificationUsers.notificationId],
      references: [scraplingNotifications.id],
    }),
    user: one(scraplingUsers, {
      fields: [scraplingNotificationUsers.userId],
      references: [scraplingUsers.id],
    }),
  }),
);

export const scraplingNotificationRecordsRelations = relations(
  scraplingNotificationRecords,
  ({ one }) => ({
    notification: one(scraplingNotifications, {
      fields: [scraplingNotificationRecords.notificationId],
      references: [scraplingNotifications.id],
    }),
    record: one(scraplingRecords, {
      fields: [scraplingNotificationRecords.recordId],
      references: [scraplingRecords.id],
    }),
  }),
);

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
  scraplingUsers,
  scraplingUser,
  scraplingNotifications,
  scraplingNotificationUsers,
  scraplingNotificationRecords,
  scraplingScrapeRunsRelations,
  scraplingProductsRelations,
  scraplingScrapeTargetsRelations,
  scraplingTargetsRelations,
  scraplingRecordsRelations,
  scraplingTopDealsRelations,
  scraplingSellersRelations,
  scraplingProductOffersRelations,
  scraplingUsersRelations,
  scraplingNotificationsRelations,
  scraplingNotificationUsersRelations,
  scraplingNotificationRecordsRelations,
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

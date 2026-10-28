import fs from "node:fs";
import { asc, eq, sql } from "drizzle-orm";
import pg from "pg";
import {
  ENV_ONLY_KEYS,
  ENV_SCHEMA,
  loadEnv,
  parseEnvContent,
  resolveEnvFilePath,
} from "./env.js";
import {
  createDrizzleDb,
  scraplingConfig,
  type ScraplingDb,
} from "./schema.js";

loadEnv();

const { Pool } = pg;

export const SCRAPLING_SCHEMA_NAME = "scrapling";

export interface DbPoolOptions {
  connectionString?: string;
  connectionTimeoutMillis?: number;
}

const INIT_SCRAPLING_CONFIG_SQL = `
CREATE SCHEMA IF NOT EXISTS scrapling;

CREATE TABLE IF NOT EXISTS scrapling.config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  group_name TEXT NOT NULL DEFAULT 'custom',
  description TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deprecate and remove CRON keys from scrapling.config as schedules are now stored as first-class rows in scrapling.schedulers
DELETE FROM scrapling.config WHERE key IN ('CRON_ENABLED', 'CRON_BASE_TIME', 'CRON_JITTER_MINUTES');

-- Merge legacy scrapling.eneba_config into scrapling.config if present
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

INSERT INTO scrapling.config (key, value, group_name, description, updated_at)
VALUES
  ('top_deals_limit', '10', 'scrapling', 'Number of top ranked deals to pull and persist per category', NOW()),
  ('alert_discount_threshold_pct', '20', 'scrapling', 'Minimum direct or effective discount % to trigger deal alerts', NOW())
ON CONFLICT (key) DO NOTHING;

-- Drop legacy table names if present
DROP TABLE IF EXISTS scrapling.scrape_pages CASCADE;
DROP TABLE IF EXISTS scrapling.schedules CASCADE;
DROP TABLE IF EXISTS scrapling.eneba_config CASCADE;
DROP TABLE IF EXISTS scrapling.eneba_product_offers CASCADE;
DROP TABLE IF EXISTS scrapling.eneba_top_deals CASCADE;
DROP TABLE IF EXISTS scrapling.eneba_scrape_runs CASCADE;
DROP TABLE IF EXISTS scrapling.eneba_sellers CASCADE;
DROP TABLE IF EXISTS scrapling.eneba_products CASCADE;

CREATE TABLE IF NOT EXISTS scrapling.schedulers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_time TEXT NOT NULL DEFAULT '19:00',
  jitter_minutes INTEGER NOT NULL DEFAULT 60,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS scrapling.scrape_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES scrapling.products(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'eneba',
  name TEXT DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  schedule_id TEXT NOT NULL DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scrapling_scrape_targets_product_id ON scrapling.scrape_targets(product_id);

DO $$
BEGIN
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

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'scrape_targets' AND column_name = 'category')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'scrape_targets' AND column_name = 'provider') THEN
    ALTER TABLE scrapling.scrape_targets RENAME COLUMN category TO provider;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS scrapling.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  tz TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE scrapling.users ADD COLUMN IF NOT EXISTS tz TEXT NOT NULL DEFAULT 'America/Los_Angeles';
CREATE OR REPLACE VIEW scrapling."user" AS SELECT * FROM scrapling.users;

CREATE TABLE IF NOT EXISTS scrapling.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  subject TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scrapling.notification_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES scrapling.notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES scrapling.users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_notification_users UNIQUE (notification_id, user_id)
);

CREATE TABLE IF NOT EXISTS scrapling.notification_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES scrapling.notifications(id) ON DELETE CASCADE,
  record_id UUID NOT NULL REFERENCES scrapling.records(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_notification_records UNIQUE (notification_id, record_id)
);

CREATE INDEX IF NOT EXISTS idx_scrapling_notifications_created_at ON scrapling.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_users_user_id ON scrapling.notification_users(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_users_notification_id ON scrapling.notification_users(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_records_record_id ON scrapling.notification_records(record_id);
CREATE INDEX IF NOT EXISTS idx_notification_records_notification_id ON scrapling.notification_records(notification_id);
`;

/**
 * Creates a PostgreSQL connection pool using `DATABASE_URL` from `.env` or environment variables.
 */
export function createPgPool(options: DbPoolOptions = {}): pg.Pool {
  loadEnv();
  const connectionString =
    options.connectionString ?? process.env.DATABASE_URL ?? "";

  if (!connectionString || !connectionString.trim()) {
    throw new Error(
      "Missing PostgreSQL connection string. Set DATABASE_URL in your local .env file or pass { connectionString }.",
    );
  }

  return new Pool({
    connectionString: connectionString.trim(),
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? 5000,
  });
}

/**
 * Ensures the `scrapling` schema and `scrapling.config` table exist.
 */
export async function ensureScraplingConfigTable(pool: pg.Pool): Promise<void> {
  await pool.query(INIT_SCRAPLING_CONFIG_SQL);
}

/**
 * Verifies PostgreSQL connectivity on startup, ensures `scrapling.config` exists,
 * seeds any missing non-envOnly keys from `.env` (or with `""` empty string if not in `.env`),
 * and loads all `scrapling.config` values into `process.env`.
 * Throws if the database is not configured or unreachable.
 */
export async function initScraplingConfigOnStartup(
  options: {
    pool?: pg.Pool;
    envPath?: string;
  } = {},
): Promise<Record<string, string>> {
  loadEnv(options.envPath);
  const ownPool = !options.pool;
  const pool = options.pool ?? createPgPool();
  const db: ScraplingDb = createDrizzleDb(pool);

  try {
    // 1. Verify DB connectivity and create scrapling.config table
    await ensureScraplingConfigTable(pool);

    // 2. Read raw .env values so we know what was explicitly set in .env
    const envFilePath = resolveEnvFilePath(options.envPath);
    const fileEnvValues: Record<string, string> = fs.existsSync(envFilePath)
      ? parseEnvContent(fs.readFileSync(envFilePath, "utf8"))
      : {};

    // 3. Seed every non-envOnly key into scrapling.config if not already present.
    //    If .env doesn't have the key, create the row with an empty string "".
    for (const field of ENV_SCHEMA) {
      if (field.envOnly || ENV_ONLY_KEYS.has(field.key)) continue;

      const initialVal =
        fileEnvValues[field.key] !== undefined ? fileEnvValues[field.key] : "";

      await db
        .insert(scraplingConfig)
        .values({
          key: field.key,
          value: initialVal,
          groupName: field.group,
          description: field.description,
        })
        .onConflictDoNothing({ target: scraplingConfig.key });
    }

    // 4. Also seed any custom keys found in .env (excluding PORT, DATABASE_URL, and legacy ALERT_DISCOUNT_THRESHOLD_PCT)
    const schemaKeySet = new Set(ENV_SCHEMA.map((f) => f.key));
    for (const [k, v] of Object.entries(fileEnvValues)) {
      if (
        ENV_ONLY_KEYS.has(k) ||
        schemaKeySet.has(k) ||
        k === "ALERT_DISCOUNT_THRESHOLD_PCT"
      )
        continue;
      await db
        .insert(scraplingConfig)
        .values({
          key: k,
          value: v ?? "",
          groupName: "custom",
          description: "Custom configuration variable",
        })
        .onConflictDoNothing({ target: scraplingConfig.key });
    }

    return await readAllConfigValues({ pool, envPath: options.envPath });
  } finally {
    if (ownPool) {
      await pool.end();
    }
  }
}

/**
 * Reads all configuration values:
 * - `PORT` and `DATABASE_URL` come strictly from `.env` / `process.env` (read-only in UI)
 * - All other settings come from `scrapling.config` in PostgreSQL (and are synced to `process.env`).
 */
export async function readAllConfigValues(
  options: {
    pool?: pg.Pool;
    envPath?: string;
  } = {},
): Promise<Record<string, string>> {
  loadEnv(options.envPath);
  const envFilePath = resolveEnvFilePath(options.envPath);
  const fileEnvValues: Record<string, string> = fs.existsSync(envFilePath)
    ? parseEnvContent(fs.readFileSync(envFilePath, "utf8"))
    : {};

  const merged: Record<string, string> = {
    PORT: fileEnvValues.PORT ?? process.env.PORT ?? "80",
    DATABASE_URL:
      fileEnvValues.DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  };

  const ownPool = !options.pool;
  const pool = options.pool ?? createPgPool();
  const db: ScraplingDb = createDrizzleDb(pool);

  try {
    await ensureScraplingConfigTable(pool);
    const rows = await db
      .select({ key: scraplingConfig.key, value: scraplingConfig.value })
      .from(scraplingConfig)
      .orderBy(asc(scraplingConfig.key));

    for (const row of rows) {
      if (ENV_ONLY_KEYS.has(row.key)) continue;
      merged[row.key] = row.value ?? "";
      if (row.value !== "") {
        process.env[row.key] = row.value;
      } else if (row.key === "TZ") {
        process.env.TZ = "America/Los_Angeles";
      } else {
        process.env[row.key] = "";
      }
    }

    for (const field of ENV_SCHEMA) {
      if (field.envOnly) continue;
      if (merged[field.key] === undefined) {
        merged[field.key] = "";
      }
    }

    return merged;
  } finally {
    if (ownPool) {
      await pool.end();
    }
  }
}

/**
 * Updates configuration values in `scrapling.config` (ignoring read-only `.env` keys `PORT` and `DATABASE_URL`)
 * and syncs them into `process.env`.
 */
export async function updateDbConfigValues(
  updates: Record<string, string>,
  options: {
    pool?: pg.Pool;
    envPath?: string;
  } = {},
): Promise<Record<string, string>> {
  const ownPool = !options.pool;
  const pool = options.pool ?? createPgPool();
  const db: ScraplingDb = createDrizzleDb(pool);
  const schemaByKey = new Map(ENV_SCHEMA.map((f) => [f.key, f]));

  try {
    await ensureScraplingConfigTable(pool);
    for (const [rawKey, rawVal] of Object.entries(updates)) {
      const key = rawKey.trim();
      if (!key || ENV_ONLY_KEYS.has(key)) {
        // PORT and DATABASE_URL are strictly .env-only and cannot be changed via UI/DB
        continue;
      }
      const val = String(rawVal ?? "");
      const meta = schemaByKey.get(key);
      const groupName = meta?.group ?? "custom";
      const description = meta?.description ?? "Custom configuration variable";

      await db
        .insert(scraplingConfig)
        .values({
          key,
          value: val,
          groupName,
          description,
        })
        .onConflictDoUpdate({
          target: scraplingConfig.key,
          set: {
            value: val,
            updatedAt: sql`NOW()`,
          },
        });

      process.env[key] = val;
    }

    return await readAllConfigValues({ pool, envPath: options.envPath });
  } finally {
    if (ownPool) {
      await pool.end();
    }
  }
}

/**
 * Deletes a custom key from `scrapling.config` (or resets a schema key to empty string `""`).
 */
export async function deleteDbConfigKey(
  keyToRemove: string,
  options: {
    pool?: pg.Pool;
    envPath?: string;
  } = {},
): Promise<Record<string, string>> {
  if (ENV_ONLY_KEYS.has(keyToRemove)) {
    throw new Error(`${keyToRemove} is a read-only .env variable.`);
  }

  const ownPool = !options.pool;
  const pool = options.pool ?? createPgPool();
  const db: ScraplingDb = createDrizzleDb(pool);
  const isSchemaKey = ENV_SCHEMA.some((f) => f.key === keyToRemove);

  try {
    await ensureScraplingConfigTable(pool);
    if (isSchemaKey) {
      await db
        .update(scraplingConfig)
        .set({ value: "", updatedAt: sql`NOW()` })
        .where(eq(scraplingConfig.key, keyToRemove));
      process.env[keyToRemove] = "";
    } else {
      await db
        .delete(scraplingConfig)
        .where(eq(scraplingConfig.key, keyToRemove));
      delete process.env[keyToRemove];
    }

    return await readAllConfigValues({ pool, envPath: options.envPath });
  } finally {
    if (ownPool) {
      await pool.end();
    }
  }
}

export interface ScheduleDbItem {
  id: string;
  name: string;
  baseTime: string;
  jitterMinutes: number;
  enabled: boolean;
  createdAt?: string;
}

export interface TargetDbItem {
  id: string;
  productId?: string | null;
  productSlug?: string | null;
  productTitle?: string | null;
  provider?: string;
  category?: string; // backward-compat alias
  name?: string;
  url?: string; // derived from products.url
  enabled: boolean;
  withOffers?: boolean;
  scheduleId?: string;
  createdAt?: string;
}

// Backward-compatible alias
export type ScrapePageDbItem = TargetDbItem;
export type TargetPageDbItem = TargetDbItem;

/**
 * Loads all configured schedules from `scrapling.schedulers`.
 */
export async function getDbSchedulers(pool?: pg.Pool): Promise<ScheduleDbItem[]> {
  const ownPool = !pool;
  const p = pool ?? createPgPool();
  try {
    await ensureScraplingConfigTable(p);
    const res = await p.query<{
      id: string;
      name: string;
      base_time: string;
      jitter_minutes: number;
      enabled: boolean;
      created_at: Date;
    }>("SELECT id, name, base_time, jitter_minutes, enabled, created_at FROM scrapling.schedulers ORDER BY created_at ASC");
    return res.rows.map((r) => ({
      id: r.id,
      name: r.name,
      baseTime: r.base_time,
      jitterMinutes: Number(r.jitter_minutes) || 0,
      enabled: Boolean(r.enabled),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
    }));
  } finally {
    if (ownPool) await p.end();
  }
}

/**
 * Upserts a schedule into `scrapling.schedulers`.
 */
export async function upsertDbScheduler(
  item: ScheduleDbItem,
  pool?: pg.Pool,
): Promise<void> {
  const ownPool = !pool;
  const p = pool ?? createPgPool();
  try {
    await ensureScraplingConfigTable(p);
    await p.query(
      `INSERT INTO scrapling.schedulers (id, name, base_time, jitter_minutes, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()), NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         base_time = EXCLUDED.base_time,
         jitter_minutes = EXCLUDED.jitter_minutes,
         enabled = EXCLUDED.enabled,
         updated_at = NOW()`,
      [
        item.id,
        item.name,
        item.baseTime,
        item.jitterMinutes,
        item.enabled,
        item.createdAt || new Date().toISOString(),
      ],
    );
  } finally {
    if (ownPool) await p.end();
  }
}

/**
 * Deletes a schedule from `scrapling.schedulers` and reassigns any orphaned targets to 'default'.
 */
export async function deleteDbScheduler(
  id: string,
  pool?: pg.Pool,
): Promise<void> {
  if (id === "default") return;
  const ownPool = !pool;
  const p = pool ?? createPgPool();
  try {
    await ensureScraplingConfigTable(p);
    await p.query("DELETE FROM scrapling.schedulers WHERE id = $1", [id]);
    await p.query(
      "UPDATE scrapling.scrape_targets SET schedule_id = 'default', updated_at = NOW() WHERE schedule_id = $1",
      [id],
    );
  } finally {
    if (ownPool) await p.end();
  }
}

export const CANONICAL_TARGET_URLS: Record<string, string> = {
  "a1000000-0000-4000-8000-000000000001": "https://www.eneba.com/us/store/psn-gift-cards",
  "a1000000-0000-4000-8000-000000000002": "https://www.eneba.com/us/store/apple-gift-cards",
  "a1000000-0000-4000-8000-000000000003": "https://www.eneba.com/us/store/google-play-gift-cards",
  "a1000000-0000-4000-8000-000000000004": "https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=steam",
  "a1000000-0000-4000-8000-000000000005": "https://www.eneba.com/us/store/nintendo-gift-cards",
  "a1000000-0000-4000-8000-000000000006": "https://www.eneba.com/us/store/amazon-gift-cards",
  "a1000000-0000-4000-8000-000000000008": "https://www.g2a.com/search?query=google%20play",
  "a1000000-0000-4000-8000-000000000009": "https://www.g2a.com/category/psn-c1567",
};

export const CANONICAL_CATEGORY_URLS: Record<string, string> = {
  "eneba:psn": "https://www.eneba.com/us/store/psn-gift-cards",
  "eneba:apple": "https://www.eneba.com/us/store/apple-gift-cards",
  "eneba:google-play": "https://www.eneba.com/us/store/google-play-gift-cards",
  "eneba:steam": "https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=steam",
  "eneba:nintendo": "https://www.eneba.com/us/store/nintendo-gift-cards",
  "eneba:amazon": "https://www.eneba.com/us/store/amazon-gift-cards",
  "g2a:google-play": "https://www.g2a.com/search?query=google%20play",
  "g2a:psn": "https://www.g2a.com/category/psn-c1567",
};

/**
 * Loads all configured scrape target pages from `scrapling.scrape_targets`.
 */
export async function getDbTargets(pool?: pg.Pool): Promise<TargetDbItem[]> {
  const ownPool = !pool;
  const p = pool ?? createPgPool();
  try {
    await ensureScraplingConfigTable(p);
    const res = await p.query<{
      id: string;
      product_id: string | null;
      product_slug: string | null;
      product_title: string | null;
      product_url: string | null;
      provider: string;
      name: string | null;
      enabled: boolean;
      schedule_id: string;
      created_at: Date;
    }>(`
      SELECT 
        t.id, 
        t.product_id,
        p.slug AS product_slug,
        p.title AS product_title,
        p.url AS product_url,
        t.provider, 
        t.name, 
        t.enabled, 
        t.schedule_id, 
        t.created_at 
      FROM scrapling.scrape_targets t
      LEFT JOIN scrapling.products p ON p.id = t.product_id
      ORDER BY t.created_at ASC
    `);
    return res.rows.map((r) => ({
      id: r.id,
      productId: r.product_id,
      productSlug: r.product_slug,
      productTitle: r.product_title,
      provider: r.provider || "eneba",
      category: r.provider || "eneba",
      name: r.name || r.product_title || "",
      url: CANONICAL_TARGET_URLS[r.id] || r.product_url || "",
      enabled: Boolean(r.enabled),
      withOffers: true,
      scheduleId: r.schedule_id || "default",
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));
  } finally {
    if (ownPool) await p.end();
  }
}
export const getDbTargetPages = getDbTargets;

/**
 * Upserts a scrape target into `scrapling.scrape_targets`.
 */
export async function upsertDbTarget(
  target: TargetDbItem,
  pool?: pg.Pool,
): Promise<void> {
  const ownPool = !pool;
  const p = pool ?? createPgPool();
  try {
    await ensureScraplingConfigTable(p);
    const provider = target.provider || target.category || "eneba";
    let productId = target.productId || null;

    // If productId wasn't provided, try to find product by url or name
    if (!productId && target.url) {
      const prodRes = await p.query<{ id: string }>(
        "SELECT id FROM scrapling.products WHERE url = $1 LIMIT 1",
        [target.url],
      );
      if (prodRes.rows.length > 0) {
        productId = prodRes.rows[0].id;
      }
    }

    if (productId && (target.url || target.productSlug || target.name)) {
      await p.query(
        `INSERT INTO scrapling.products (id, slug, title, url, provider, first_seen_at, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           url = COALESCE(EXCLUDED.url, scrapling.products.url),
           title = COALESCE(EXCLUDED.title, scrapling.products.title),
           provider = COALESCE(EXCLUDED.provider, scrapling.products.provider)
         ON CONFLICT (slug) DO UPDATE SET
           url = COALESCE(EXCLUDED.url, scrapling.products.url),
           provider = COALESCE(EXCLUDED.provider, scrapling.products.provider)`,
        [
          productId,
          target.productSlug || `product-${productId.slice(0, 8)}`,
          target.productTitle || target.name || "Monitored Gift Card",
          target.url || null,
          provider,
        ],
      );
    }

    await p.query(
      `INSERT INTO scrapling.scrape_targets (id, product_id, provider, name, enabled, schedule_id, created_at, updated_at)
       VALUES (COALESCE(NULLIF($1, '')::uuid, gen_random_uuid()), $2, $3, COALESCE($4, ''), $5, $6, COALESCE($7::timestamptz, NOW()), NOW())
       ON CONFLICT (id) DO UPDATE SET
         product_id = COALESCE(EXCLUDED.product_id, scrapling.scrape_targets.product_id),
         provider = EXCLUDED.provider,
         name = EXCLUDED.name,
         enabled = EXCLUDED.enabled,
         schedule_id = EXCLUDED.schedule_id,
         updated_at = NOW()`,
      [
        target.id,
        productId,
        provider,
        target.name || "",
        target.enabled,
        target.scheduleId || "default",
        target.createdAt || new Date().toISOString(),
      ],
    );
  } finally {
    if (ownPool) await p.end();
  }
}
export const upsertDbTargetPage = upsertDbTarget;

/**
 * Deletes a scrape target page from `scrapling.scrape_targets`.
 */
export async function deleteDbTarget(
  id: string,
  pool?: pg.Pool,
): Promise<void> {
  const ownPool = !pool;
  const p = pool ?? createPgPool();
  try {
    await ensureScraplingConfigTable(p);
    await p.query("DELETE FROM scrapling.scrape_targets WHERE id = $1", [id]);
  } finally {
    if (ownPool) await p.end();
  }
}
export const deleteDbTargetPage = deleteDbTarget;

const DEFAULT_INITIAL_TARGETS: TargetDbItem[] = [
  {
    id: "a1000000-0000-4000-8000-000000000001",
    productId: "0cbae1f0-59b3-4ac3-bcd1-3b7bbde05686",
    provider: "eneba",
    category: "eneba",
    name: "PlayStation (PSN) Gift Cards",
    enabled: true,
    scheduleId: "default",
  },
  {
    id: "a1000000-0000-4000-8000-000000000002",
    productId: "c56cb9eb-0773-472e-a530-ee72d5863c3a",
    provider: "eneba",
    category: "eneba",
    name: "Apple iTunes / App Store Gift Cards",
    enabled: true,
    scheduleId: "default",
  },
  {
    id: "a1000000-0000-4000-8000-000000000003",
    productId: "3a8bd30c-620d-48a3-aa66-f976f9ecaa50",
    provider: "eneba",
    category: "eneba",
    name: "Google Play Gift Cards",
    enabled: true,
    scheduleId: "default",
  },
  {
    id: "a1000000-0000-4000-8000-000000000004",
    productId: "b1000000-0000-4000-8000-000000000004",
    provider: "eneba",
    category: "eneba",
    name: "Steam Gift Cards & Wallet Codes",
    enabled: true,
    scheduleId: "default",
  },
  {
    id: "a1000000-0000-4000-8000-000000000005",
    productId: "f700d89a-919a-4e82-9eb6-c92f7853c2a2",
    provider: "eneba",
    category: "eneba",
    name: "Nintendo eShop Gift Cards",
    enabled: true,
    scheduleId: "default",
  },
  {
    id: "a1000000-0000-4000-8000-000000000006",
    productId: "28519d1d-0742-4e92-b28f-f8e34cd60630",
    provider: "eneba",
    category: "eneba",
    name: "Amazon Gift Cards",
    enabled: true,
    scheduleId: "default",
  },
  {
    id: "a1000000-0000-4000-8000-000000000008",
    productId: "ad69d4d6-a0fd-49dd-a439-e983f3af32b4",
    productSlug: "g2a-google-play",
    productTitle: "Google Play Gift Cards (G2A)",
    provider: "g2a",
    category: "g2a",
    name: "Google Play Gift Cards (G2A)",
    url: "https://www.g2a.com/search?query=google%20play",
    enabled: true,
    scheduleId: "default",
  },
  {
    id: "a1000000-0000-4000-8000-000000000009",
    productId: "ad69d4d6-a0fd-49dd-a439-e983f3af32b5",
    productSlug: "g2a-psn",
    productTitle: "PlayStation (PSN) Gift Cards (G2A)",
    provider: "g2a",
    category: "g2a",
    name: "PlayStation (PSN) Gift Cards (G2A)",
    url: "https://www.g2a.com/category/psn-c1567",
    enabled: true,
    scheduleId: "default",
  },
];
export const DEFAULT_INITIAL_TARGET_PAGES = DEFAULT_INITIAL_TARGETS;

const DEFAULT_INITIAL_SCHEDULERS: ScheduleDbItem[] = [
  {
    id: "default",
    name: "Primary Daily Schedule",
    baseTime: "19:00",
    jitterMinutes: 60,
    enabled: true,
  },
];

/**
 * Synchronizes schedulers and scrape targets between PostgreSQL and disk fallback on server boot.
 */
export async function syncSchedulersAndTargetsOnStartup(options: {
  pool?: pg.Pool;
  initialSchedulers?: ScheduleDbItem[];
  initialTargets?: TargetDbItem[];
} = {}): Promise<{
  schedulers: ScheduleDbItem[];
  targets: TargetDbItem[];
}> {
  const ownPool = !options.pool;
  const pool = options.pool ?? createPgPool();
  const initialSchedulers =
    options.initialSchedulers && options.initialSchedulers.length > 0
      ? options.initialSchedulers
      : DEFAULT_INITIAL_SCHEDULERS;
  const initialTargets =
    options.initialTargets && options.initialTargets.length > 0
      ? options.initialTargets
      : DEFAULT_INITIAL_TARGETS;

  try {
    await ensureScraplingConfigTable(pool);

    // 1. Sync Schedulers
    let dbSchedulers = await getDbSchedulers(pool);
    if (dbSchedulers.length === 0) {
      for (const sch of initialSchedulers) {
        await upsertDbScheduler(sch, pool);
      }
      dbSchedulers = await getDbSchedulers(pool);
      if (dbSchedulers.length === 0) {
        dbSchedulers = [...initialSchedulers];
      }
    } else {
      if (!dbSchedulers.some((s) => s.id === "default")) {
        const def = initialSchedulers.find((s) => s.id === "default") || {
          id: "default",
          name: "Primary Daily Schedule",
          baseTime: "19:00",
          jitterMinutes: 60,
          enabled: true,
        };
        await upsertDbScheduler(def, pool);
        dbSchedulers = await getDbSchedulers(pool);
        if (!dbSchedulers.some((s) => s.id === "default")) {
          dbSchedulers.unshift(def);
        }
      }
    }

    // 2. Sync Targets
    let dbTargets = await getDbTargets(pool);
    if (dbTargets.length === 0) {
      for (const target of initialTargets) {
        await upsertDbTarget(target, pool);
      }
      dbTargets = await getDbTargets(pool);
      if (dbTargets.length === 0) {
        dbTargets = [...initialTargets];
      }
    } else {
      for (const target of initialTargets) {
        if (!dbTargets.some((t) => t.id === target.id)) {
          await upsertDbTarget(target, pool);
        }
      }
      dbTargets = await getDbTargets(pool);
    }

    return { schedulers: dbSchedulers, targets: dbTargets };
  } finally {
    if (ownPool) {
      await pool.end();
    }
  }
}

// Backward compatibility re-exports
export const getDbSchedules = getDbSchedulers;
export const upsertDbSchedule = upsertDbScheduler;
export const deleteDbSchedule = deleteDbScheduler;
export const getDbPages = getDbTargets;
export const upsertDbPage = upsertDbTarget;
export const deleteDbPage = deleteDbTarget;
export const syncSchedulesAndPagesOnStartup = syncSchedulersAndTargetsOnStartup;

export interface UserDbItem {
  id: string;
  email: string;
  name?: string | null;
  tz: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDbItem {
  id: string;
  content: string;
  subject?: string | null;
  createdAt: string;
}

/**
 * Loads all configured notification users/recipients from `scrapling.users`.
 */
export async function getDbUsers(pool?: pg.Pool): Promise<UserDbItem[]> {
  const ownPool = !pool;
  const p = pool ?? createPgPool();
  try {
    await ensureScraplingConfigTable(p);
    const res = await p.query<{
      id: string;
      email: string;
      name: string | null;
      tz: string | null;
      enabled: boolean;
      created_at: Date;
      updated_at: Date;
    }>(`
      SELECT id, email, name, tz, enabled, created_at, updated_at
      FROM scrapling.users
      ORDER BY created_at ASC
    `);
    return res.rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      tz: r.tz || "America/Los_Angeles",
      enabled: Boolean(r.enabled),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    }));
  } finally {
    if (ownPool) await p.end();
  }
}

/**
 * Creates or updates a user in `scrapling.users`.
 */
export async function upsertDbUser(
  user: {
    id?: string;
    email: string;
    name?: string | null;
    tz?: string;
    enabled?: boolean;
  },
  pool?: pg.Pool,
): Promise<UserDbItem> {
  const ownPool = !pool;
  const p = pool ?? createPgPool();
  try {
    await ensureScraplingConfigTable(p);
    const enabled = user.enabled ?? true;
    const name = user.name ?? null;
    const tz = user.tz?.trim() || "America/Los_Angeles";
    const res = await p.query<{
      id: string;
      email: string;
      name: string | null;
      tz: string | null;
      enabled: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `
      INSERT INTO scrapling.users (id, email, name, tz, enabled, updated_at)
      VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, NOW())
      ON CONFLICT (email) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, scrapling.users.name),
        tz = COALESCE(EXCLUDED.tz, scrapling.users.tz),
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
      RETURNING id, email, name, tz, enabled, created_at, updated_at
    `,
      [user.id ?? null, user.email.trim(), name, tz, enabled],
    );
    const r = res.rows[0];
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      tz: r.tz || tz,
      enabled: Boolean(r.enabled),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    };
  } finally {
    if (ownPool) await p.end();
  }
}

/**
 * Creates a notification with its HTML content and links it to multiple users and records (M:N).
 */
export async function createDbNotification(
  options: {
    content: string;
    subject?: string;
    userIds?: string[];
    recordIds?: string[];
    sentAt?: Date;
  },
  pool?: pg.Pool,
): Promise<{
  id: string;
  content: string;
  subject: string;
  createdAt: string;
  userIds: string[];
  recordIds: string[];
}> {
  const ownPool = !pool;
  const p = pool ?? createPgPool();
  try {
    await ensureScraplingConfigTable(p);
    const client = await p.connect();
    try {
      await client.query("BEGIN");
      const notifRes = await client.query<{
        id: string;
        content: string;
        subject: string | null;
        created_at: Date;
      }>(
        `INSERT INTO scrapling.notifications (content, subject)
         VALUES ($1, $2)
         RETURNING id, content, subject, created_at`,
        [options.content, options.subject ?? ""],
      );
      const notif = notifRes.rows[0];

      // Link users (Many-to-Many, sorted to prevent deadlock)
      const linkedUserIds: string[] = [];
      if (options.userIds && options.userIds.length > 0) {
        const sortedUserIds = [...new Set(options.userIds)].sort();
        for (const uId of sortedUserIds) {
          await client.query(
            `INSERT INTO scrapling.notification_users (notification_id, user_id, sent_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (notification_id, user_id) DO NOTHING`,
            [notif.id, uId, options.sentAt ?? new Date()],
          );
          linkedUserIds.push(uId);
        }
      }

      // Link records (Many-to-Many, sorted to prevent deadlock)
      const linkedRecordIds: string[] = [];
      if (options.recordIds && options.recordIds.length > 0) {
        const sortedRecordIds = [...new Set(options.recordIds)].sort();
        for (const rId of sortedRecordIds) {
          await client.query(
            `INSERT INTO scrapling.notification_records (notification_id, record_id)
             VALUES ($1, $2)
             ON CONFLICT (notification_id, record_id) DO NOTHING`,
            [notif.id, rId],
          );
          linkedRecordIds.push(rId);
        }
      }

      await client.query("COMMIT");
      return {
        id: notif.id,
        content: notif.content,
        subject: notif.subject ?? "",
        createdAt: notif.created_at ? new Date(notif.created_at).toISOString() : new Date().toISOString(),
        userIds: linkedUserIds,
        recordIds: linkedRecordIds,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } finally {
    if (ownPool) await p.end();
  }
}

/**
 * Retrieves notifications along with linked user IDs and record IDs.
 */
export async function getDbNotifications(
  options: { limit?: number; offset?: number } = {},
  pool?: pg.Pool,
): Promise<
  Array<{
    id: string;
    content: string;
    subject: string;
    createdAt: string;
    userIds: string[];
    recordIds: string[];
  }>
> {
  const ownPool = !pool;
  const p = pool ?? createPgPool();
  try {
    await ensureScraplingConfigTable(p);
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const offset = Math.max(options.offset ?? 0, 0);

    const res = await p.query<{
      id: string;
      content: string;
      subject: string | null;
      created_at: Date;
      user_ids: string[] | null;
      record_ids: string[] | null;
    }>(
      `
      SELECT 
        n.id,
        n.content,
        n.subject,
        n.created_at,
        COALESCE(
          ARRAY_AGG(DISTINCT nu.user_id::text) FILTER (WHERE nu.user_id IS NOT NULL),
          '{}'
        ) AS user_ids,
        COALESCE(
          ARRAY_AGG(DISTINCT nr.record_id::text) FILTER (WHERE nr.record_id IS NOT NULL),
          '{}'
        ) AS record_ids
      FROM scrapling.notifications n
      LEFT JOIN scrapling.notification_users nu ON nu.notification_id = n.id
      LEFT JOIN scrapling.notification_records nr ON nr.notification_id = n.id
      GROUP BY n.id, n.content, n.subject, n.created_at
      ORDER BY n.created_at DESC
      LIMIT $1 OFFSET $2
    `,
      [limit, offset],
    );

    return res.rows.map((r) => ({
      id: r.id,
      content: r.content,
      subject: r.subject ?? "",
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      userIds: r.user_ids ?? [],
      recordIds: r.record_ids ?? [],
    }));
  } finally {
    if (ownPool) await p.end();
  }
}

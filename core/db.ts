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

CREATE TABLE IF NOT EXISTS scrapling.scrape_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'eneba',
  name TEXT DEFAULT '',
  url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  schedule_id TEXT NOT NULL DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'scrape_targets' AND column_name = 'category')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'scrape_targets' AND column_name = 'provider') THEN
    ALTER TABLE scrapling.scrape_targets RENAME COLUMN category TO provider;
  END IF;
END $$;
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
  provider?: string;
  category?: string; // backward-compat alias
  name?: string;
  url: string;
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
      provider: string;
      name: string | null;
      url: string;
      enabled: boolean;
      schedule_id: string;
      created_at: Date;
    }>("SELECT id, provider, name, url, enabled, schedule_id, created_at FROM scrapling.scrape_targets ORDER BY created_at ASC");
    return res.rows.map((r) => ({
      id: r.id,
      provider: r.provider || "eneba",
      category: r.provider || "eneba",
      name: r.name || "",
      url: r.url,
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
 * Upserts a scrape target page into `scrapling.scrape_targets`.
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
    await p.query(
      `INSERT INTO scrapling.scrape_targets (id, provider, name, url, enabled, schedule_id, created_at, updated_at)
       VALUES (COALESCE(NULLIF($1, '')::uuid, gen_random_uuid()), $2, COALESCE($3, ''), $4, $5, $6, COALESCE($7::timestamptz, NOW()), NOW())
       ON CONFLICT (id) DO UPDATE SET
         provider = EXCLUDED.provider,
         name = EXCLUDED.name,
         url = EXCLUDED.url,
         enabled = EXCLUDED.enabled,
         schedule_id = EXCLUDED.schedule_id,
         updated_at = NOW()`,
      [
        target.id,
        provider,
        target.name || "",
        target.url,
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
    provider: "eneba",
    category: "eneba",
    name: "PlayStation (PSN) Gift Cards",
    url: "https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=playstation_network",
    enabled: true,
    scheduleId: "default",
  },
  {
    id: "a1000000-0000-4000-8000-000000000002",
    provider: "eneba",
    category: "eneba",
    name: "Apple iTunes / App Store Gift Cards",
    url: "https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=apple_itunes",
    enabled: true,
    scheduleId: "default",
  },
  {
    id: "a1000000-0000-4000-8000-000000000003",
    provider: "eneba",
    category: "eneba",
    name: "Google Play Gift Cards",
    url: "https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=google_play",
    enabled: true,
    scheduleId: "default",
  },
  {
    id: "a1000000-0000-4000-8000-000000000004",
    provider: "eneba",
    category: "eneba",
    name: "Steam Gift Cards & Wallet Codes",
    url: "https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=steam",
    enabled: true,
    scheduleId: "default",
  },
  {
    id: "a1000000-0000-4000-8000-000000000005",
    provider: "eneba",
    category: "eneba",
    name: "Nintendo eShop Cards",
    url: "https://www.eneba.com/store/gift-cards?regions[]=united_states&types[]=gift_card&platforms[]=nintendo_eshop",
    enabled: true,
    scheduleId: "default",
  },
  {
    id: "a1000000-0000-4000-8000-000000000006",
    provider: "eneba",
    category: "eneba",
    name: "Amazon Gift Cards",
    url: "https://www.eneba.com/us/store/amazon-gift-cards",
    enabled: true,
    scheduleId: "default",
  },
  {
    id: "a1000000-0000-4000-8000-000000000007",
    provider: "g2a",
    category: "g2a",
    name: "Amazon Gift Cards (G2A)",
    url: "https://www.g2a.com/category/gift-cards-c6",
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

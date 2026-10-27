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

CREATE TABLE IF NOT EXISTS scrapling.schedules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_time TEXT NOT NULL DEFAULT '19:00',
  jitter_minutes INTEGER NOT NULL DEFAULT 60,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scrapling.scrape_pages (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'eneba',
  category_name TEXT NOT NULL,
  url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  with_offers BOOLEAN NOT NULL DEFAULT TRUE,
  schedule_id TEXT NOT NULL DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
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

export interface ScrapePageDbItem {
  id: string;
  provider: string;
  categoryName: string;
  url: string;
  enabled: boolean;
  withOffers: boolean;
  scheduleId?: string;
  createdAt: string;
}

/**
 * Loads all configured schedules from `scrapling.schedules`.
 */
export async function getDbSchedules(pool?: pg.Pool): Promise<ScheduleDbItem[]> {
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
    }>("SELECT id, name, base_time, jitter_minutes, enabled, created_at FROM scrapling.schedules ORDER BY created_at ASC");
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
 * Upserts a schedule into `scrapling.schedules`.
 */
export async function upsertDbSchedule(
  item: ScheduleDbItem,
  pool?: pg.Pool,
): Promise<void> {
  const ownPool = !pool;
  const p = pool ?? createPgPool();
  try {
    await ensureScraplingConfigTable(p);
    await p.query(
      `INSERT INTO scrapling.schedules (id, name, base_time, jitter_minutes, enabled, created_at, updated_at)
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
 * Deletes a schedule from `scrapling.schedules` and reassigns any orphaned pages to 'default'.
 */
export async function deleteDbSchedule(
  id: string,
  pool?: pg.Pool,
): Promise<void> {
  if (id === "default") return;
  const ownPool = !pool;
  const p = pool ?? createPgPool();
  try {
    await ensureScraplingConfigTable(p);
    await p.query("DELETE FROM scrapling.schedules WHERE id = $1", [id]);
    await p.query(
      "UPDATE scrapling.scrape_pages SET schedule_id = 'default', updated_at = NOW() WHERE schedule_id = $1",
      [id],
    );
  } finally {
    if (ownPool) await p.end();
  }
}

/**
 * Loads all configured scrape pages from `scrapling.scrape_pages`.
 */
export async function getDbPages(pool?: pg.Pool): Promise<ScrapePageDbItem[]> {
  const ownPool = !pool;
  const p = pool ?? createPgPool();
  try {
    await ensureScraplingConfigTable(p);
    const res = await p.query<{
      id: string;
      provider: string;
      category_name: string;
      url: string;
      enabled: boolean;
      with_offers: boolean;
      schedule_id: string;
      created_at: Date;
    }>("SELECT id, provider, category_name, url, enabled, with_offers, schedule_id, created_at FROM scrapling.scrape_pages ORDER BY created_at ASC");
    return res.rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      categoryName: r.category_name,
      url: r.url,
      enabled: Boolean(r.enabled),
      withOffers: Boolean(r.with_offers),
      scheduleId: r.schedule_id || "default",
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));
  } finally {
    if (ownPool) await p.end();
  }
}

/**
 * Upserts a scrape page target into `scrapling.scrape_pages`.
 */
export async function upsertDbPage(
  page: ScrapePageDbItem,
  pool?: pg.Pool,
): Promise<void> {
  const ownPool = !pool;
  const p = pool ?? createPgPool();
  try {
    await ensureScraplingConfigTable(p);
    await p.query(
      `INSERT INTO scrapling.scrape_pages (id, provider, category_name, url, enabled, with_offers, schedule_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, NOW()), NOW())
       ON CONFLICT (id) DO UPDATE SET
         provider = EXCLUDED.provider,
         category_name = EXCLUDED.category_name,
         url = EXCLUDED.url,
         enabled = EXCLUDED.enabled,
         with_offers = EXCLUDED.with_offers,
         schedule_id = EXCLUDED.schedule_id,
         updated_at = NOW()`,
      [
        page.id,
        page.provider,
        page.categoryName,
        page.url,
        page.enabled,
        page.withOffers,
        page.scheduleId || "default",
        page.createdAt || new Date().toISOString(),
      ],
    );
  } finally {
    if (ownPool) await p.end();
  }
}

/**
 * Deletes a scrape page target from `scrapling.scrape_pages`.
 */
export async function deleteDbPage(
  id: string,
  pool?: pg.Pool,
): Promise<void> {
  const ownPool = !pool;
  const p = pool ?? createPgPool();
  try {
    await ensureScraplingConfigTable(p);
    await p.query("DELETE FROM scrapling.scrape_pages WHERE id = $1", [id]);
  } finally {
    if (ownPool) await p.end();
  }
}

/**
 * Synchronizes schedules and pages between PostgreSQL and disk fallback on server boot.
 */
export async function syncSchedulesAndPagesOnStartup(options: {
  pool?: pg.Pool;
  initialSchedules: ScheduleDbItem[];
  initialPages: ScrapePageDbItem[];
}): Promise<{
  schedules: ScheduleDbItem[];
  pages: ScrapePageDbItem[];
}> {
  const ownPool = !options.pool;
  const pool = options.pool ?? createPgPool();

  try {
    await ensureScraplingConfigTable(pool);

    // 1. Sync Schedules
    let dbSchedules = await getDbSchedules(pool);
    if (dbSchedules.length === 0) {
      for (const sch of options.initialSchedules) {
        await upsertDbSchedule(sch, pool);
      }
      dbSchedules = await getDbSchedules(pool);
      if (dbSchedules.length === 0) {
        dbSchedules = [...options.initialSchedules];
      }
    } else {
      if (!dbSchedules.some((s) => s.id === "default")) {
        const def = options.initialSchedules.find((s) => s.id === "default") || {
          id: "default",
          name: "Primary Daily Schedule",
          baseTime: "19:00",
          jitterMinutes: 60,
          enabled: true,
        };
        await upsertDbSchedule(def, pool);
        dbSchedules = await getDbSchedules(pool);
        if (!dbSchedules.some((s) => s.id === "default")) {
          dbSchedules.unshift(def);
        }
      }
    }

    // 2. Sync Pages
    let dbPages = await getDbPages(pool);
    if (dbPages.length === 0) {
      for (const page of options.initialPages) {
        await upsertDbPage(page, pool);
      }
      dbPages = await getDbPages(pool);
      if (dbPages.length === 0) {
        dbPages = [...options.initialPages];
      }
    }

    return { schedules: dbSchedules, pages: dbPages };
  } finally {
    if (ownPool) {
      await pool.end();
    }
  }
}

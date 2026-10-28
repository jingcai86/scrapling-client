import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  DEFAULT_SCHEDULER_ID,
  isDefaultSchedulerId,
} from "./scheduler.js";
import {
  createDrizzleDb,
  scraplingConfig,
  type ScraplingDb,
} from "./schema.js";

loadEnv();

const { Pool } = pg;

export const SCRAPLING_SCHEMA_NAME = "scrapling";
export { DEFAULT_SCHEDULER_ID, isDefaultSchedulerId };

export function resolveSchedulerId(id?: string | null): string {
  if (!id || id === "default") return DEFAULT_SCHEDULER_ID;
  return id;
}

export interface DbPoolOptions {
  connectionString?: string;
  connectionTimeoutMillis?: number;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cachedSchemaSql: string | null = null;

/**
 * Returns PostgreSQL schema DDL, loading from scripts/schema.sql with minimal fallback.
 */
export function getSchemaSql(): string {
  if (cachedSchemaSql) return cachedSchemaSql;
  const candidates = [
    path.resolve(process.cwd(), "scripts/schema.sql"),
    path.resolve(__dirname, "../../scripts/schema.sql"),
    path.resolve(__dirname, "../scripts/schema.sql"),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      cachedSchemaSql = fs.readFileSync(cand, "utf8");
      return cachedSchemaSql;
    }
  }
  return "CREATE SCHEMA IF NOT EXISTS scrapling;";
}

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

let schemaEnsured = false;

/**
 * Ensures the `scrapling` schema and `scrapling.config` table exist.
 */
export async function ensureScraplingConfigTable(pool: pg.Pool): Promise<void> {
  if (schemaEnsured) return;
  await pool.query(getSchemaSql());
  schemaEnsured = true;
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
    const resolvedId = resolveSchedulerId(item.id);
    await p.query(
      `INSERT INTO scrapling.schedulers (id, name, base_time, jitter_minutes, enabled, created_at, updated_at)
       VALUES (COALESCE(NULLIF($1, '')::uuid, gen_random_uuid()), $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()), NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         base_time = EXCLUDED.base_time,
         jitter_minutes = EXCLUDED.jitter_minutes,
         enabled = EXCLUDED.enabled,
         updated_at = NOW()`,
      [
        resolvedId,
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
 * Deletes a schedule from `scrapling.schedulers` and reassigns any orphaned targets to the default schedule.
 */
export async function deleteDbScheduler(
  id: string,
  pool?: pg.Pool,
): Promise<void> {
  const resolvedId = resolveSchedulerId(id);
  if (resolvedId === DEFAULT_SCHEDULER_ID) return;
  const ownPool = !pool;
  const p = pool ?? createPgPool();
  try {
    await ensureScraplingConfigTable(p);
    await p.query("DELETE FROM scrapling.schedulers WHERE id = $1::uuid", [resolvedId]);
    await p.query(
      "UPDATE scrapling.scrape_targets SET schedule_id = $1::uuid, updated_at = NOW() WHERE schedule_id = $2::uuid",
      [DEFAULT_SCHEDULER_ID, resolvedId],
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
       VALUES (COALESCE(NULLIF($1, '')::uuid, gen_random_uuid()), $2, $3, COALESCE($4, ''), $5, $6::uuid, COALESCE($7::timestamptz, NOW()), NOW())
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
        resolveSchedulerId(target.scheduleId),
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
    scheduleId: DEFAULT_SCHEDULER_ID,
  },
  {
    id: "a1000000-0000-4000-8000-000000000002",
    productId: "c56cb9eb-0773-472e-a530-ee72d5863c3a",
    provider: "eneba",
    category: "eneba",
    name: "Apple iTunes / App Store Gift Cards",
    enabled: true,
    scheduleId: DEFAULT_SCHEDULER_ID,
  },
  {
    id: "a1000000-0000-4000-8000-000000000003",
    productId: "3a8bd30c-620d-48a3-aa66-f976f9ecaa50",
    provider: "eneba",
    category: "eneba",
    name: "Google Play Gift Cards",
    enabled: true,
    scheduleId: DEFAULT_SCHEDULER_ID,
  },
  {
    id: "a1000000-0000-4000-8000-000000000004",
    productId: "b1000000-0000-4000-8000-000000000004",
    provider: "eneba",
    category: "eneba",
    name: "Steam Gift Cards & Wallet Codes",
    enabled: true,
    scheduleId: DEFAULT_SCHEDULER_ID,
  },
  {
    id: "a1000000-0000-4000-8000-000000000005",
    productId: "f700d89a-919a-4e82-9eb6-c92f7853c2a2",
    provider: "eneba",
    category: "eneba",
    name: "Nintendo eShop Gift Cards",
    enabled: true,
    scheduleId: DEFAULT_SCHEDULER_ID,
  },
  {
    id: "a1000000-0000-4000-8000-000000000006",
    productId: "28519d1d-0742-4e92-b28f-f8e34cd60630",
    provider: "eneba",
    category: "eneba",
    name: "Amazon Gift Cards",
    enabled: true,
    scheduleId: DEFAULT_SCHEDULER_ID,
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
    scheduleId: DEFAULT_SCHEDULER_ID,
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
    scheduleId: DEFAULT_SCHEDULER_ID,
  },
];
export const DEFAULT_INITIAL_TARGET_PAGES = DEFAULT_INITIAL_TARGETS;

const DEFAULT_INITIAL_SCHEDULERS: ScheduleDbItem[] = [
  {
    id: DEFAULT_SCHEDULER_ID,
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
      for (const sch of initialSchedulers) {
        const resolvedId = resolveSchedulerId(sch.id);
        if (!dbSchedulers.some((s) => s.id === resolvedId || (isDefaultSchedulerId(s.id) && isDefaultSchedulerId(sch.id)))) {
          await upsertDbScheduler(sch, pool);
        }
      }
      dbSchedulers = await getDbSchedulers(pool);
      if (!dbSchedulers.some((s) => isDefaultSchedulerId(s.id))) {
        const def = initialSchedulers.find((s) => isDefaultSchedulerId(s.id)) || {
          id: DEFAULT_SCHEDULER_ID,
          name: "Primary Daily Schedule",
          baseTime: "19:00",
          jitterMinutes: 60,
          enabled: true,
        };
        await upsertDbScheduler(def, pool);
        dbSchedulers = await getDbSchedulers(pool);
        if (!dbSchedulers.some((s) => isDefaultSchedulerId(s.id))) {
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

export interface DbScrapeHistoryItem {
  id: string;
  provider?: string;
  timestamp: string;
  totalPages: number;
  successfulPages: number;
  successRate: number;
  totalListings: number;
  inStockCount: number;
  bestDeal?: {
    title: string;
    category: string;
    provider?: string;
    sellerName: string;
    cost: number;
    faceValue: number;
    discountPct: number;
    url?: string;
  };
  bestDealsByProvider?: Record<
    string,
    {
      title: string;
      category: string;
      provider?: string;
      sellerName: string;
      cost: number;
      faceValue: number;
      discountPct: number;
      url?: string;
    }
  >;
}

/**
 * Loads aggregated scrape run history and summary rates directly from PostgreSQL `scrapling.scrape_runs`.
 */
export async function getDbScrapeHistory(
  pool?: pg.Pool,
  limit = 60,
): Promise<DbScrapeHistoryItem[]> {
  const ownPool = !pool;
  const p = pool ?? createPgPool();
  try {
    await ensureScraplingConfigTable(p);
    const safeLimit = Math.min(Math.max(limit, 1), 200);

    const res = await p.query<{
      batch_id: string;
      scraped_at: Date;
      provider: string | null;
      total_pages: number | null;
      successful_pages: number | null;
      success_rate: string | null;
      total_listings: number | null;
      in_stock_count: number | null;
      best_deals_by_provider: any;
      best_deal_provider: string | null;
      best_deal_title: string | null;
      best_deal_price: string | null;
      best_deal_discount_pct: string | null;
      best_deal_url: string | null;
    }>(
      `
      SELECT
        batch_id,
        MIN(scraped_at) AS scraped_at,
        COALESCE(MAX(provider), 'eneba') AS provider,
        COALESCE(MAX(total_pages), COUNT(*)::int) AS total_pages,
        COALESCE(MAX(successful_pages), COUNT(CASE WHEN COALESCE(total_listings, 0) > 0 THEN 1 END)::int) AS successful_pages,
        COALESCE(
          MAX(success_rate),
          ROUND((COUNT(CASE WHEN COALESCE(total_listings, 0) > 0 THEN 1 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 1)
        )::text AS success_rate,
        COALESCE(
          NULLIF(SUM(total_listings), 0),
          (SELECT COUNT(*)::int FROM scrapling.records r JOIN scrapling.scrape_runs sr ON r.scrape_run_id = sr.id WHERE sr.batch_id = scrapling.scrape_runs.batch_id),
          0
        )::int AS total_listings,
        COALESCE(
          NULLIF(SUM(in_stock_count), 0),
          (SELECT COUNT(*)::int FROM scrapling.records r JOIN scrapling.scrape_runs sr ON r.scrape_run_id = sr.id WHERE sr.batch_id = scrapling.scrape_runs.batch_id AND r.in_stock),
          0
        )::int AS in_stock_count,
        (ARRAY_AGG(best_deals_by_provider) FILTER (WHERE best_deals_by_provider IS NOT NULL))[1] AS best_deals_by_provider,
        (ARRAY_AGG(provider ORDER BY max_discount_pct DESC NULLS LAST) FILTER (WHERE best_deal_title IS NOT NULL))[1] AS best_deal_provider,
        (ARRAY_AGG(best_deal_title ORDER BY max_discount_pct DESC NULLS LAST) FILTER (WHERE best_deal_title IS NOT NULL))[1] AS best_deal_title,
        (ARRAY_AGG(best_deal_price ORDER BY max_discount_pct DESC NULLS LAST) FILTER (WHERE best_deal_title IS NOT NULL))[1] AS best_deal_price,
        (ARRAY_AGG(best_deal_discount_pct ORDER BY max_discount_pct DESC NULLS LAST) FILTER (WHERE best_deal_title IS NOT NULL))[1] AS best_deal_discount_pct,
        (ARRAY_AGG(best_deal_url ORDER BY max_discount_pct DESC NULLS LAST) FILTER (WHERE best_deal_title IS NOT NULL))[1] AS best_deal_url
      FROM scrapling.scrape_runs
      GROUP BY batch_id
      ORDER BY MIN(scraped_at) DESC
      LIMIT $1
    `,
      [safeLimit],
    );

    const batchIds = res.rows.map((r) => r.batch_id).filter(Boolean);
    const dealsByBatch = new Map<string, Record<string, any>>();

    if (batchIds.length > 0) {
      try {
        const provDealsRes = await p.query<{
          batch_id: string;
          provider: string;
          best_deal_title: string;
          best_deal_price: string | null;
          best_deal_discount_pct: string | null;
          best_deal_url: string | null;
        }>(
          `
          SELECT DISTINCT ON (batch_id, provider)
            batch_id,
            provider,
            best_deal_title,
            best_deal_price,
            best_deal_discount_pct,
            best_deal_url
          FROM scrapling.scrape_runs
          WHERE batch_id = ANY($1::uuid[]) AND best_deal_title IS NOT NULL
          ORDER BY batch_id, provider, best_deal_discount_pct DESC NULLS LAST
        `,
          [batchIds],
        );

        for (const dr of provDealsRes.rows) {
          if (!dealsByBatch.has(dr.batch_id)) {
            dealsByBatch.set(dr.batch_id, {});
          }
          const prov = (dr.provider || "eneba").toLowerCase().trim();
          dealsByBatch.get(dr.batch_id)![prov] = {
            title: dr.best_deal_title,
            category: prov === "g2a" ? "G2A" : "Eneba",
            provider: prov,
            sellerName: "Top Merchant",
            cost: dr.best_deal_price ? Number(dr.best_deal_price) : 0,
            faceValue: 0,
            discountPct: dr.best_deal_discount_pct ? Number(dr.best_deal_discount_pct) : 0,
            url: dr.best_deal_url || undefined,
          };
        }
      } catch {
        // Fallback gracefully without prov deals join
      }
    }

    return res.rows.map((r) => {
      const batchDeals = dealsByBatch.get(r.batch_id) || {};
      const bestDealsByProvider = Object.keys(batchDeals).length > 0
        ? batchDeals
        : (r.best_deals_by_provider || undefined);

      let bestDeal: DbScrapeHistoryItem["bestDeal"] = undefined;

      if (r.best_deal_title) {
        const prov = (r.best_deal_provider || r.provider || "eneba").toLowerCase().trim();
        bestDeal = {
          title: r.best_deal_title,
          category: prov === "g2a" ? "G2A" : "Eneba",
          provider: prov,
          sellerName: "Top Merchant",
          cost: r.best_deal_price ? Number(r.best_deal_price) : 0,
          faceValue: 0,
          discountPct: r.best_deal_discount_pct ? Number(r.best_deal_discount_pct) : 0,
          url: r.best_deal_url || undefined,
        };
      } else if (bestDealsByProvider && typeof bestDealsByProvider === "object") {
        const topProv = Object.values(bestDealsByProvider)[0] as any;
        if (topProv) {
          bestDeal = topProv;
        }
      }

      return {
        id: r.batch_id,
        provider: r.provider || "eneba",
        timestamp: new Date(r.scraped_at).toISOString(),
        totalPages: Number(r.total_pages ?? 1),
        successfulPages: Number(r.successful_pages ?? 1),
        successRate: Number(r.success_rate ?? 100),
        totalListings: Number(r.total_listings ?? 0),
        inStockCount: Number(r.in_stock_count ?? 0),
        bestDeal,
        bestDealsByProvider,
      };
    });
  } catch (err) {
    console.warn("[PostgreSQL Warn] Could not fetch scrape history from database:", err);
    return [];
  } finally {
    if (ownPool) await p.end().catch(() => {});
  }
}

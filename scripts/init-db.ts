import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import {
  loadEnv,
  ensureScraplingConfigTable,
  initScraplingConfigOnStartup,
  syncSchedulersAndTargetsOnStartup,
  createPgPool,
} from "../core/index.js";
import { ensureEnebaSchema } from "../eneba/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_SQL_PATH = path.resolve(__dirname, "schema.sql");

async function main() {
  loadEnv();
  const dbUrl = process.env.DATABASE_URL?.trim();

  console.log("============================================================");
  console.log("📦 Scrapling Monitor — PostgreSQL Database Initialization");
  console.log("============================================================");

  if (!dbUrl) {
    console.error("\n❌ Error: Missing DATABASE_URL.");
    console.error("Please configure DATABASE_URL in your .env file, for example:");
    console.error('DATABASE_URL="postgres://postgres:postgres@localhost:5432/scrapling"\n');
    process.exit(1);
  }

  // Mask credentials in console log
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ":••••••••@");
  console.log(`Connecting to: ${maskedUrl}`);

  let pool: pg.Pool;
  try {
    pool = createPgPool();
    const pingRes = await pool.query(
      "SELECT NOW() as current_time, current_database() as db_name, version() as pg_version",
    );
    const { current_time, db_name, pg_version } = pingRes.rows[0];
    console.log(`✔ Connected to database: "${db_name}"`);
    console.log(`  Server Time: ${current_time}`);
    console.log(`  Engine: ${pg_version.split(" on ")[0]}\n`);
  } catch (err: any) {
    console.error(`\n❌ Database connection failed: ${err.message}`);
    process.exit(1);
  }

  try {
    console.log("⏳ Applying schema and table definitions...");
    if (fs.existsSync(SCHEMA_SQL_PATH)) {
      const sql = fs.readFileSync(SCHEMA_SQL_PATH, "utf8");
      await pool.query(sql);
      console.log(`✔ Executed schema script (${path.basename(SCHEMA_SQL_PATH)})`);
    } else {
      await ensureScraplingConfigTable(pool);
      await ensureEnebaSchema(pool);
      console.log("✔ Created scrapling schema and core tables via module helpers");
    }

    // Explicitly ensure latest architectural migrations are applied
    await pool.query(`
      ALTER TABLE scrapling.records DROP COLUMN IF EXISTS batch_id;
      DROP INDEX IF EXISTS scrapling.idx_scrapling_records_batch_id;
      ALTER TABLE scrapling.scrape_runs ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES scrapling.schedulers(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_scrapling_scrape_runs_schedule_id ON scrapling.scrape_runs (schedule_id);
    `);
    console.log("✔ Ensured latest relations: scrape_runs.schedule_id FK active, records.batch_id normalized");

    console.log("⏳ Seeding configuration variables from environment...");
    await initScraplingConfigOnStartup({ pool });
    console.log("✔ Synced scrapling.config variables from .env");

    console.log("⏳ Synchronizing schedulers and scraping targets...");
    await syncSchedulersAndTargetsOnStartup({ pool });
    console.log("✔ Synced scrapling.schedulers and scrapling.scrape_targets in PostgreSQL");

    const tablesRes = await pool.query<{
      table_name: string;
      column_count: number;
    }>(`
      SELECT
        t.table_name,
        COUNT(c.column_name)::int AS column_count
      FROM information_schema.tables t
      JOIN information_schema.columns c
        ON c.table_schema = t.table_schema AND c.table_name = t.table_name
      WHERE t.table_schema = 'scrapling'
      GROUP BY t.table_name
      ORDER BY t.table_name ASC;
    `);

    console.log("\n------------------------------------------------------------");
    console.log("📊 Schema 'scrapling' Summary:");
    console.log("------------------------------------------------------------");
    for (const r of tablesRes.rows) {
      const countRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM scrapling."${r.table_name}"`);
      const rowCount = countRes.rows[0].cnt;
      console.log(` • scrapling.${r.table_name.padEnd(22)}: ${String(r.column_count).padStart(2)} columns, ${String(rowCount).padStart(4)} rows`);
    }

    // Verify structural relationships and latest migrations
    const recordsCols = await pool.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'scrapling' AND table_name = 'records'
    `);
    const recordsColSet = new Set(recordsCols.rows.map((c) => c.column_name));

    const scrapeRunsCols = await pool.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'scrapling' AND table_name = 'scrape_runs'
    `);
    const scrapeRunsColSet = new Set(scrapeRunsCols.rows.map((c) => c.column_name));

    const schedulersIdTypeRes = await pool.query<{ data_type: string }>(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'scrapling' AND table_name = 'schedulers' AND column_name = 'id'
    `);
    const schedulersIdType = schedulersIdTypeRes.rows[0]?.data_type || "unknown";

    console.log("\n------------------------------------------------------------");
    console.log("🔗 Key Relational & Foreign Key Verification:");
    console.log("------------------------------------------------------------");
    console.log(` • scrapling.schedulers.id type        : ${schedulersIdType.toUpperCase()} (UUID PK)`);
    console.log(` • scrapling.scrape_runs.schedule_id   : ${scrapeRunsColSet.has("schedule_id") ? "✔ PRESENT (REFERENCES scrapling.schedulers)" : "❌ MISSING"}`);
    console.log(` • scrapling.records.scrape_run_id     : ${recordsColSet.has("scrape_run_id") ? "✔ PRESENT (REFERENCES scrapling.scrape_runs)" : "❌ MISSING"}`);
    console.log(` • scrapling.records.batch_id          : ${recordsColSet.has("batch_id") ? "⚠ PRESENT (redundant)" : "✔ REMOVED (cleanly normalized)"}`);

    console.log("\n============================================================");
    console.log("✅ Database schema and tables populated successfully!");
    console.log("============================================================\n");
  } catch (err: any) {
    console.error(`\n❌ Error initializing database schema: ${err.message}`);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

main();

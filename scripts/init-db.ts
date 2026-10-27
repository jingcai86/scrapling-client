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

    console.log("⏳ Seeding configuration variables from environment...");
    await initScraplingConfigOnStartup({ pool });
    console.log("✔ Synced scrapling.config variables from .env");

    console.log("⏳ Synchronizing schedulers and scraping targets...");
    await syncSchedulersAndTargetsOnStartup({ pool });
    console.log("✔ Synced scrapling.schedulers and scrapling.target_pages in PostgreSQL");

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
      console.log(` • scrapling.${r.table_name.padEnd(20)}: ${String(r.column_count).padStart(2)} columns, ${String(rowCount).padStart(4)} rows`);
    }

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

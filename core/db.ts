import pg from "pg";
import { loadEnv } from "./env.js";

loadEnv();

const { Pool } = pg;

export interface DbPoolOptions {
  connectionString?: string;
  connectionTimeoutMillis?: number;
}

/**
 * Creates a PostgreSQL connection pool using `DATABASE_URL` from `.env` or environment variables.
 * Uses a short connection timeout by default so unreachable databases fail fast without blocking scrapers.
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

-- 1. Migrate scrape_runs.id and records.id / records.scrape_run_id to UUID
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'scrapling' AND table_name = 'scrape_runs' AND column_name = 'id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE "scrapling"."scrape_runs" ADD COLUMN IF NOT EXISTS "new_id" UUID DEFAULT gen_random_uuid();
    UPDATE "scrapling"."scrape_runs" SET "new_id" = gen_random_uuid() WHERE "new_id" IS NULL;

    ALTER TABLE "scrapling"."records" ADD COLUMN IF NOT EXISTS "new_scrape_run_id" UUID;
    UPDATE "scrapling"."records" r
    SET "new_scrape_run_id" = sr."new_id"
    FROM "scrapling"."scrape_runs" sr
    WHERE r."scrape_run_id" = sr."id";

    ALTER TABLE "scrapling"."records" ADD COLUMN IF NOT EXISTS "new_id" UUID DEFAULT gen_random_uuid();
    UPDATE "scrapling"."records" SET "new_id" = gen_random_uuid() WHERE "new_id" IS NULL;

    ALTER TABLE "scrapling"."records" DROP CONSTRAINT IF EXISTS "records_scrape_run_id_scrape_runs_id_fk";
    ALTER TABLE "scrapling"."records" DROP CONSTRAINT IF EXISTS "records_scrape_run_id_fkey";

    ALTER TABLE "scrapling"."scrape_runs" DROP CONSTRAINT IF EXISTS "scrape_runs_pkey" CASCADE;
    ALTER TABLE "scrapling"."scrape_runs" DROP COLUMN IF EXISTS "id" CASCADE;
    ALTER TABLE "scrapling"."scrape_runs" RENAME COLUMN "new_id" TO "id";
    ALTER TABLE "scrapling"."scrape_runs" ADD PRIMARY KEY ("id");
    ALTER TABLE "scrapling"."scrape_runs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

    ALTER TABLE "scrapling"."records" DROP CONSTRAINT IF EXISTS "records_pkey" CASCADE;
    ALTER TABLE "scrapling"."records" DROP COLUMN IF EXISTS "id" CASCADE;
    ALTER TABLE "scrapling"."records" RENAME COLUMN "new_id" TO "id";
    ALTER TABLE "scrapling"."records" ADD PRIMARY KEY ("id");
    ALTER TABLE "scrapling"."records" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

    ALTER TABLE "scrapling"."records" DROP COLUMN IF EXISTS "scrape_run_id" CASCADE;
    ALTER TABLE "scrapling"."records" RENAME COLUMN "new_scrape_run_id" TO "scrape_run_id";

    ALTER TABLE "scrapling"."records"
      ADD CONSTRAINT "records_scrape_run_id_scrape_runs_id_fk"
      FOREIGN KEY ("scrape_run_id") REFERENCES "scrapling"."scrape_runs"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint

-- 2. Drop non-generic & redundant page-level columns from scrape_runs
ALTER TABLE "scrapling"."scrape_runs" DROP COLUMN IF EXISTS "provider" CASCADE;
--> statement-breakpoint
ALTER TABLE "scrapling"."scrape_runs" DROP COLUMN IF EXISTS "target_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "scrapling"."scrape_runs" DROP COLUMN IF EXISTS "target_name" CASCADE;
--> statement-breakpoint
ALTER TABLE "scrapling"."scrape_runs" DROP COLUMN IF EXISTS "page_url" CASCADE;
--> statement-breakpoint
ALTER TABLE "scrapling"."scrape_runs" DROP COLUMN IF EXISTS "page_number" CASCADE;
--> statement-breakpoint
ALTER TABLE "scrapling"."scrape_runs" DROP COLUMN IF EXISTS "total_listings" CASCADE;
--> statement-breakpoint
ALTER TABLE "scrapling"."scrape_runs" DROP COLUMN IF EXISTS "in_stock_count" CASCADE;
--> statement-breakpoint
ALTER TABLE "scrapling"."scrape_runs" DROP COLUMN IF EXISTS "discounted_count" CASCADE;
--> statement-breakpoint

-- 3. Update Indexes
DROP INDEX IF EXISTS "scrapling"."idx_scrapling_scrape_runs_provider_time";
--> statement-breakpoint
DROP INDEX IF EXISTS "scrapling"."idx_scrapling_scrape_runs_target_time";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scrapling_scrape_runs_batch_id" ON "scrapling"."scrape_runs" ("batch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scrapling_records_scrape_run_id" ON "scrapling"."records" ("scrape_run_id");

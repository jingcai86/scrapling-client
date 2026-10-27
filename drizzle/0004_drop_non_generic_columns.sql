-- 1. scrapling.sellers: Drop non-generic column is_verified
ALTER TABLE "scrapling"."sellers" DROP COLUMN IF EXISTS "is_verified";
--> statement-breakpoint

-- 2. scrapling.scrape_runs: Drop out_of_stock_count and redundant category column
ALTER TABLE "scrapling"."scrape_runs" DROP COLUMN IF EXISTS "out_of_stock_count";
--> statement-breakpoint
DROP INDEX IF EXISTS "scrapling"."idx_scrapling_scrape_runs_category_time";
--> statement-breakpoint
UPDATE "scrapling"."scrape_runs" SET "provider" = "category" WHERE ("provider" IS NULL OR "provider" = '') AND "category" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "scrapling"."scrape_runs" DROP COLUMN IF EXISTS "category";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scrapling_scrape_runs_provider_time" ON "scrapling"."scrape_runs" ("provider", "scraped_at" DESC);
--> statement-breakpoint

-- 3. scrapling.products: Drop redundant category column
UPDATE "scrapling"."products" SET "provider" = "category" WHERE ("provider" IS NULL OR "provider" = '') AND "category" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "scrapling"."products" DROP COLUMN IF EXISTS "category";
--> statement-breakpoint

-- 4. scrapling.records: Replace category column with provider
DROP INDEX IF EXISTS "scrapling"."idx_scrapling_records_category_time";
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'records' AND column_name = 'category')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'records' AND column_name = 'provider') THEN
    ALTER TABLE "scrapling"."records" RENAME COLUMN "category" TO "provider";
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scrapling_records_provider_time" ON "scrapling"."records" ("provider", "scraped_at" DESC);
--> statement-breakpoint

-- 5. scrapling.targets: Standardize category column to provider
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'targets' AND column_name = 'category')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'scrapling' AND table_name = 'targets' AND column_name = 'provider') THEN
    ALTER TABLE "scrapling"."targets" RENAME COLUMN "category" TO "provider";
  END IF;
END $$;

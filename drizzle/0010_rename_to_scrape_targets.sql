-- 1. Rename table target_pages to scrape_targets
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'scrapling' AND table_name = 'target_pages'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'scrapling' AND table_name = 'scrape_targets'
  ) THEN
    ALTER TABLE "scrapling"."target_pages" RENAME TO "scrape_targets";
  END IF;
END $$;
--> statement-breakpoint

-- 2. Rename records.target_id to scrape_target_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'scrapling' AND table_name = 'records' AND column_name = 'target_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'scrapling' AND table_name = 'records' AND column_name = 'scrape_target_id'
  ) THEN
    ALTER TABLE "scrapling"."records" RENAME COLUMN "target_id" TO "scrape_target_id";
  END IF;
END $$;
--> statement-breakpoint

-- 3. Update foreign key constraints and indexes
ALTER TABLE "scrapling"."records" DROP CONSTRAINT IF EXISTS "records_target_id_target_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "scrapling"."records" DROP CONSTRAINT IF EXISTS "records_target_id_targets_id_fk";
--> statement-breakpoint
ALTER TABLE "scrapling"."records" DROP CONSTRAINT IF EXISTS "records_scrape_target_id_scrape_targets_id_fk";
--> statement-breakpoint
ALTER TABLE "scrapling"."records"
  ADD CONSTRAINT "records_scrape_target_id_scrape_targets_id_fk"
  FOREIGN KEY ("scrape_target_id") REFERENCES "scrapling"."scrape_targets"("id") ON DELETE SET NULL;
--> statement-breakpoint

DROP INDEX IF EXISTS "scrapling"."idx_scrapling_records_target_time";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scrapling_records_scrape_target_time"
  ON "scrapling"."records" ("scrape_target_id", "scraped_at" DESC);

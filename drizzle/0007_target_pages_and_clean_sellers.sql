-- 1. Drop seller_slug from sellers
ALTER TABLE "scrapling"."sellers" DROP COLUMN IF EXISTS "seller_slug";
--> statement-breakpoint

-- 2. Rename targets to target_pages and clean columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'scrapling' AND table_name = 'targets'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'scrapling' AND table_name = 'target_pages'
  ) THEN
    ALTER TABLE "scrapling"."targets" RENAME TO "target_pages";
  END IF;

  DROP TABLE IF EXISTS "scrapling"."targets" CASCADE;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'scrapling' AND table_name = 'target_pages'
  ) THEN
    ALTER TABLE "scrapling"."target_pages" DROP COLUMN IF EXISTS "with_offers";
    ALTER TABLE "scrapling"."target_pages" ALTER COLUMN "name" DROP NOT NULL;
    ALTER TABLE "scrapling"."target_pages" ALTER COLUMN "name" SET DEFAULT '';
  END IF;
END $$;
--> statement-breakpoint

-- 3. Update foreign key constraints to target_pages
ALTER TABLE "scrapling"."scrape_runs" DROP CONSTRAINT IF EXISTS "scrape_runs_target_id_targets_id_fk";
--> statement-breakpoint
ALTER TABLE "scrapling"."records" DROP CONSTRAINT IF EXISTS "records_target_id_targets_id_fk";
--> statement-breakpoint
ALTER TABLE "scrapling"."scrape_runs" DROP CONSTRAINT IF EXISTS "scrape_runs_target_id_target_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "scrapling"."records" DROP CONSTRAINT IF EXISTS "records_target_id_target_pages_id_fk";
--> statement-breakpoint

ALTER TABLE "scrapling"."scrape_runs"
  ADD CONSTRAINT "scrape_runs_target_id_target_pages_id_fk"
  FOREIGN KEY ("target_id") REFERENCES "scrapling"."target_pages"("id") ON DELETE SET NULL;
--> statement-breakpoint

ALTER TABLE "scrapling"."records"
  ADD CONSTRAINT "records_target_id_target_pages_id_fk"
  FOREIGN KEY ("target_id") REFERENCES "scrapling"."target_pages"("id") ON DELETE SET NULL;

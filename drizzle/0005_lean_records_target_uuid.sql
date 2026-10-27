-- 1. Drop existing foreign keys
ALTER TABLE "scrapling"."records" DROP CONSTRAINT IF EXISTS "records_target_id_targets_id_fk";
--> statement-breakpoint
ALTER TABLE "scrapling"."scrape_runs" DROP CONSTRAINT IF EXISTS "scrape_runs_target_id_targets_id_fk";
--> statement-breakpoint

-- 2. Add temporary new_id column to targets if text
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'scrapling' AND table_name = 'targets' AND column_name = 'id' AND data_type = 'text'
  ) THEN
    ALTER TABLE "scrapling"."targets" ADD COLUMN IF NOT EXISTS "new_id" UUID DEFAULT gen_random_uuid();

    UPDATE "scrapling"."targets" SET "new_id" = 'a1000000-0000-4000-8000-000000000001'::uuid WHERE "id" = 'playstation-network-psn';
    UPDATE "scrapling"."targets" SET "new_id" = 'a1000000-0000-4000-8000-000000000002'::uuid WHERE "id" = 'apple-itunes';
    UPDATE "scrapling"."targets" SET "new_id" = 'a1000000-0000-4000-8000-000000000003'::uuid WHERE "id" = 'google-play';
    UPDATE "scrapling"."targets" SET "new_id" = 'a1000000-0000-4000-8000-000000000004'::uuid WHERE "id" = 'steam';
    UPDATE "scrapling"."targets" SET "new_id" = 'a1000000-0000-4000-8000-000000000005'::uuid WHERE "id" = 'nintendo-eshop';
    UPDATE "scrapling"."targets" SET "new_id" = 'a1000000-0000-4000-8000-000000000006'::uuid WHERE "id" = 'eneba-amazon-gift-cards';
    UPDATE "scrapling"."targets" SET "new_id" = 'a1000000-0000-4000-8000-000000000007'::uuid WHERE "id" = 'g2a-amazon-gift-cards';
    UPDATE "scrapling"."targets" SET "new_id" = gen_random_uuid() WHERE "new_id" IS NULL;

    -- Update scrape_runs
    ALTER TABLE "scrapling"."scrape_runs" ADD COLUMN IF NOT EXISTS "new_target_id" UUID;
    UPDATE "scrapling"."scrape_runs" r SET "new_target_id" = t."new_id" FROM "scrapling"."targets" t WHERE r."target_id" = t."id";
    ALTER TABLE "scrapling"."scrape_runs" DROP COLUMN IF EXISTS "target_id";
    ALTER TABLE "scrapling"."scrape_runs" RENAME COLUMN "new_target_id" TO "target_id";

    -- Update records
    ALTER TABLE "scrapling"."records" ADD COLUMN IF NOT EXISTS "new_target_id" UUID;
    UPDATE "scrapling"."records" r SET "new_target_id" = t."new_id" FROM "scrapling"."targets" t WHERE r."target_id" = t."id";
    ALTER TABLE "scrapling"."records" DROP COLUMN IF EXISTS "target_id";
    ALTER TABLE "scrapling"."records" RENAME COLUMN "new_target_id" TO "target_id";

    -- Switch targets.id to UUID
    ALTER TABLE "scrapling"."targets" DROP CONSTRAINT "targets_pkey" CASCADE;
    ALTER TABLE "scrapling"."targets" DROP COLUMN "id";
    ALTER TABLE "scrapling"."targets" RENAME COLUMN "new_id" TO "id";
    ALTER TABLE "scrapling"."targets" ADD PRIMARY KEY ("id");
    ALTER TABLE "scrapling"."targets" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
  END IF;
END $$;
--> statement-breakpoint

-- 3. Drop non-generic and redundant columns from records & scrape_runs
ALTER TABLE "scrapling"."scrape_runs" DROP COLUMN IF EXISTS "target_name";
--> statement-breakpoint
ALTER TABLE "scrapling"."records" DROP COLUMN IF EXISTS "target_name";
--> statement-breakpoint
ALTER TABLE "scrapling"."records" DROP COLUMN IF EXISTS "target_url";
--> statement-breakpoint
ALTER TABLE "scrapling"."records" DROP COLUMN IF EXISTS "cashback_pct";
--> statement-breakpoint
ALTER TABLE "scrapling"."records" DROP COLUMN IF EXISTS "is_featured_offer";
--> statement-breakpoint

-- 4. Recreate foreign key constraints with UUID target_id
ALTER TABLE "scrapling"."scrape_runs"
  ADD CONSTRAINT "scrape_runs_target_id_targets_id_fk"
  FOREIGN KEY ("target_id") REFERENCES "scrapling"."targets"("id") ON DELETE SET NULL;
--> statement-breakpoint

ALTER TABLE "scrapling"."records"
  ADD CONSTRAINT "records_target_id_targets_id_fk"
  FOREIGN KEY ("target_id") REFERENCES "scrapling"."targets"("id") ON DELETE SET NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_scrapling_records_target_time"
  ON "scrapling"."records" ("target_id", "scraped_at" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_scrapling_scrape_runs_target_time"
  ON "scrapling"."scrape_runs" ("target_id", "scraped_at" DESC);

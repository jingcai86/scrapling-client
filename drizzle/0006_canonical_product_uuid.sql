-- 1. Drop existing foreign key constraints on product_id
ALTER TABLE "scrapling"."records" DROP CONSTRAINT IF EXISTS "records_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "scrapling"."records" DROP CONSTRAINT IF EXISTS "records_product_id_fkey";
--> statement-breakpoint

-- 2. Migrate products.id and records.product_id to UUID if not already UUID
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'scrapling' AND table_name = 'products' AND column_name = 'id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE "scrapling"."products" ADD COLUMN IF NOT EXISTS "new_id" UUID DEFAULT gen_random_uuid();
    ALTER TABLE "scrapling"."records" ADD COLUMN IF NOT EXISTS "new_product_id" UUID;

    -- Update records.new_product_id
    UPDATE "scrapling"."records" r
    SET "new_product_id" = p."new_id"
    FROM "scrapling"."products" p
    WHERE r."product_id" = p."id";

    -- Drop old constraints and swap products.id
    ALTER TABLE "scrapling"."products" DROP CONSTRAINT IF EXISTS "products_url_key";
    ALTER TABLE "scrapling"."products" DROP CONSTRAINT IF EXISTS "eneba_products_url_unique";
    ALTER TABLE "scrapling"."products" DROP CONSTRAINT IF EXISTS "eneba_products_slug_unique";
    ALTER TABLE "scrapling"."products" DROP CONSTRAINT IF EXISTS "products_pkey" CASCADE;

    ALTER TABLE "scrapling"."products" DROP COLUMN "id" CASCADE;
    ALTER TABLE "scrapling"."products" RENAME COLUMN "new_id" TO "id";
    ALTER TABLE "scrapling"."products" ADD PRIMARY KEY ("id");
    ALTER TABLE "scrapling"."products" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
    ALTER TABLE "scrapling"."products" ALTER COLUMN "url" DROP NOT NULL;
    ALTER TABLE "scrapling"."products" ALTER COLUMN "provider" DROP NOT NULL;
    ALTER TABLE "scrapling"."products" ALTER COLUMN "provider" SET DEFAULT NULL;

    -- Swap records.product_id
    ALTER TABLE "scrapling"."records" DROP COLUMN IF EXISTS "product_id";
    ALTER TABLE "scrapling"."records" RENAME COLUMN "new_product_id" TO "product_id";
  END IF;

  -- Ensure products.slug is unique
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_slug_key'
  ) THEN
    ALTER TABLE "scrapling"."products" DROP CONSTRAINT IF EXISTS "products_slug_unique";
    ALTER TABLE "scrapling"."products" ADD CONSTRAINT "products_slug_key" UNIQUE ("slug");
  END IF;
END $$;
--> statement-breakpoint

-- 3. Re-add foreign key constraint with UUID
ALTER TABLE "scrapling"."records"
  ADD CONSTRAINT "records_product_id_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "scrapling"."products"("id") ON DELETE SET NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_scrapling_records_product_time"
  ON "scrapling"."records" ("product_id", "scraped_at" DESC);

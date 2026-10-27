-- 1. Add product_id to scrape_targets referencing products(id)
ALTER TABLE "scrapling"."scrape_targets"
  ADD COLUMN IF NOT EXISTS "product_id" UUID;
--> statement-breakpoint

-- 2. Drop existing foreign key if any and re-add constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scrape_targets_product_id_products_id_fk'
  ) THEN
    ALTER TABLE "scrapling"."scrape_targets"
      ADD CONSTRAINT "scrape_targets_product_id_products_id_fk"
      FOREIGN KEY ("product_id") REFERENCES "scrapling"."products"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint

-- 3. Drop column url from scrape_targets
ALTER TABLE "scrapling"."scrape_targets" DROP COLUMN IF EXISTS "url";
--> statement-breakpoint

-- 4. Create index on product_id
CREATE INDEX IF NOT EXISTS "idx_scrapling_scrape_targets_product_id"
  ON "scrapling"."scrape_targets" ("product_id");

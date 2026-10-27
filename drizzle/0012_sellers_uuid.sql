-- 1. Ensure sellers.id and records.seller_id are UUID
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'scrapling' AND table_name = 'sellers' AND column_name = 'id' AND data_type != 'uuid'
  ) THEN
    ALTER TABLE "scrapling"."sellers" ADD COLUMN IF NOT EXISTS "new_id" UUID DEFAULT gen_random_uuid();
    UPDATE "scrapling"."sellers" SET "new_id" = gen_random_uuid() WHERE "new_id" IS NULL;

    ALTER TABLE "scrapling"."records" ADD COLUMN IF NOT EXISTS "new_seller_id" UUID;
    UPDATE "scrapling"."records" r
    SET "new_seller_id" = s."new_id"
    FROM "scrapling"."sellers" s
    WHERE r."seller_id" = s."id";

    ALTER TABLE "scrapling"."records" DROP CONSTRAINT IF EXISTS "records_seller_id_fkey";
    ALTER TABLE "scrapling"."records" DROP CONSTRAINT IF EXISTS "records_seller_id_sellers_id_fk";
    ALTER TABLE "scrapling"."sellers" DROP CONSTRAINT IF EXISTS "sellers_pkey" CASCADE;

    ALTER TABLE "scrapling"."sellers" DROP COLUMN "id" CASCADE;
    ALTER TABLE "scrapling"."sellers" RENAME COLUMN "new_id" TO "id";
    ALTER TABLE "scrapling"."sellers" ADD PRIMARY KEY ("id");
    ALTER TABLE "scrapling"."sellers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

    ALTER TABLE "scrapling"."records" DROP COLUMN IF EXISTS "seller_id";
    ALTER TABLE "scrapling"."records" RENAME COLUMN "new_seller_id" TO "seller_id";
    ALTER TABLE "scrapling"."records"
      ADD CONSTRAINT "records_seller_id_sellers_id_fk"
      FOREIGN KEY ("seller_id") REFERENCES "scrapling"."sellers"("id") ON DELETE SET NULL;

    DROP INDEX IF EXISTS "scrapling"."idx_scrapling_records_seller_id";
    CREATE INDEX IF NOT EXISTS "idx_scrapling_records_seller_id"
      ON "scrapling"."records" ("seller_id");
  END IF;
END $$;

ALTER TABLE "scrapling"."scrape_runs" ADD COLUMN IF NOT EXISTS "target_id" text;
--> statement-breakpoint
ALTER TABLE "scrapling"."scrape_runs" ADD COLUMN IF NOT EXISTS "target_name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scrapling"."records" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"scrape_run_id" bigint,
	"target_id" text,
	"target_name" text DEFAULT '' NOT NULL,
	"target_url" text DEFAULT '' NOT NULL,
	"product_id" bigint,
	"seller_id" bigint,
	"category" text DEFAULT 'eneba' NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"region" text DEFAULT 'GLOBAL' NOT NULL,
	"selling_price" numeric(10, 2),
	"original_price" numeric(10, 2),
	"face_value" numeric(10, 2),
	"face_value_currency" text,
	"listed_discount_pct" numeric(6, 2),
	"cashback_pct" numeric(6, 2) DEFAULT '0' NOT NULL,
	"in_stock" boolean DEFAULT true NOT NULL,
	"discount_pct" numeric(6, 2) DEFAULT '0' NOT NULL,
	"effective_discount_pct" numeric(6, 2) DEFAULT '0' NOT NULL,
	"effective_price" numeric(10, 2),
	"savings_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"rank" smallint,
	"is_lowest_price" boolean DEFAULT false NOT NULL,
	"is_featured_offer" boolean DEFAULT false NOT NULL,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scrapling"."records" ADD CONSTRAINT "records_scrape_run_id_scrape_runs_id_fk" FOREIGN KEY ("scrape_run_id") REFERENCES "scrapling"."scrape_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scrapling"."records" ADD CONSTRAINT "records_target_id_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "scrapling"."targets"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scrapling"."records" ADD CONSTRAINT "records_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "scrapling"."products"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scrapling"."records" ADD CONSTRAINT "records_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "scrapling"."sellers"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
DROP TABLE IF EXISTS "scrapling"."top_deals" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "scrapling"."product_offers" CASCADE;

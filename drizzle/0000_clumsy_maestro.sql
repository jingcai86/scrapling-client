CREATE SCHEMA "scrapling";
--> statement-breakpoint
CREATE TABLE "scrapling"."eneba_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrapling"."eneba_product_offers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"product_id" bigint NOT NULL,
	"seller_id" bigint,
	"scrape_run_id" bigint,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"cashback_pct" numeric(6, 2) DEFAULT '0' NOT NULL,
	"is_lowest_price" boolean DEFAULT false NOT NULL,
	"is_featured_offer" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrapling"."eneba_products" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"url" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"region" text NOT NULL,
	"face_value" numeric(10, 2),
	"face_value_currency" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eneba_products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "eneba_products_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "scrapling"."eneba_scrape_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"category" text NOT NULL,
	"page_url" text NOT NULL,
	"page_number" smallint DEFAULT 1 NOT NULL,
	"total_listings" smallint NOT NULL,
	"in_stock_count" smallint NOT NULL,
	"out_of_stock_count" smallint NOT NULL,
	"discounted_count" smallint NOT NULL,
	"avg_discount_pct_on_discounted" numeric(6, 2) NOT NULL,
	"avg_discount_pct_all_in_stock" numeric(6, 2) NOT NULL,
	"avg_effective_discount_pct" numeric(6, 2) NOT NULL,
	"max_discount_pct" numeric(6, 2) NOT NULL,
	"max_effective_discount_pct" numeric(6, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrapling"."eneba_sellers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"seller_name" text NOT NULL,
	"seller_slug" text,
	"seller_url" text,
	"rating_pct" numeric(5, 2),
	"rating_label" text,
	"rating_count" integer,
	"is_verified" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eneba_sellers_seller_name_unique" UNIQUE("seller_name")
);
--> statement-breakpoint
CREATE TABLE "scrapling"."eneba_top_deals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"scrape_run_id" bigint NOT NULL,
	"product_id" bigint NOT NULL,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rank" smallint NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"region" text NOT NULL,
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
	CONSTRAINT "eneba_top_deals_scrape_run_id_rank_key" UNIQUE("scrape_run_id","rank")
);
--> statement-breakpoint
CREATE TABLE "scrapling"."config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"group_name" text DEFAULT 'custom' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scrapling"."eneba_product_offers" ADD CONSTRAINT "eneba_product_offers_product_id_eneba_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "scrapling"."eneba_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrapling"."eneba_product_offers" ADD CONSTRAINT "eneba_product_offers_seller_id_eneba_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "scrapling"."eneba_sellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrapling"."eneba_product_offers" ADD CONSTRAINT "eneba_product_offers_scrape_run_id_eneba_scrape_runs_id_fk" FOREIGN KEY ("scrape_run_id") REFERENCES "scrapling"."eneba_scrape_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrapling"."eneba_top_deals" ADD CONSTRAINT "eneba_top_deals_scrape_run_id_eneba_scrape_runs_id_fk" FOREIGN KEY ("scrape_run_id") REFERENCES "scrapling"."eneba_scrape_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrapling"."eneba_top_deals" ADD CONSTRAINT "eneba_top_deals_product_id_eneba_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "scrapling"."eneba_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_scrapling_eneba_product_offers_product_time" ON "scrapling"."eneba_product_offers" USING btree ("product_id","scraped_at");--> statement-breakpoint
CREATE INDEX "idx_scrapling_eneba_scrape_runs_scraped_at" ON "scrapling"."eneba_scrape_runs" USING btree ("scraped_at");--> statement-breakpoint
CREATE INDEX "idx_scrapling_eneba_scrape_runs_category_time" ON "scrapling"."eneba_scrape_runs" USING btree ("category","scraped_at");--> statement-breakpoint
CREATE INDEX "idx_scrapling_eneba_top_deals_scraped_rank" ON "scrapling"."eneba_top_deals" USING btree ("category","scraped_at","rank");--> statement-breakpoint
CREATE INDEX "idx_scrapling_eneba_top_deals_product_time" ON "scrapling"."eneba_top_deals" USING btree ("product_id","scraped_at");
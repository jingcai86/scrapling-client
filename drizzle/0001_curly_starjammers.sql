CREATE TABLE "scrapling"."schedulers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"base_time" text DEFAULT '19:00' NOT NULL,
	"jitter_minutes" integer DEFAULT 60 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrapling"."targets" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text DEFAULT 'eneba' NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"with_offers" boolean DEFAULT true NOT NULL,
	"schedule_id" text DEFAULT 'default' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================================
-- Migration 0013: Notifications, Users, and Many-to-Many Junction Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS "scrapling"."users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "scrapling"."notifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "content" TEXT NOT NULL,
  "subject" TEXT DEFAULT '',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "scrapling"."notification_users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "notification_id" UUID NOT NULL REFERENCES "scrapling"."notifications"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "scrapling"."users"("id") ON DELETE CASCADE,
  "sent_at" TIMESTAMPTZ,
  "read_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_notification_users" UNIQUE ("notification_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "scrapling"."notification_records" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "notification_id" UUID NOT NULL REFERENCES "scrapling"."notifications"("id") ON DELETE CASCADE,
  "record_id" UUID NOT NULL REFERENCES "scrapling"."records"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_notification_records" UNIQUE ("notification_id", "record_id")
);

CREATE INDEX IF NOT EXISTS "idx_scrapling_notifications_created_at"
  ON "scrapling"."notifications" ("created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_notification_users_user_id"
  ON "scrapling"."notification_users" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_notification_users_notification_id"
  ON "scrapling"."notification_users" ("notification_id");

CREATE INDEX IF NOT EXISTS "idx_notification_records_record_id"
  ON "scrapling"."notification_records" ("record_id");

CREATE INDEX IF NOT EXISTS "idx_notification_records_notification_id"
  ON "scrapling"."notification_records" ("notification_id");

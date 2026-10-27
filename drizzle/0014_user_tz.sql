-- ============================================================================
-- Migration 0014: Add tz column to users and create user view
-- ============================================================================

ALTER TABLE "scrapling"."users"
  ADD COLUMN IF NOT EXISTS "tz" TEXT NOT NULL DEFAULT 'America/Los_Angeles';

CREATE OR REPLACE VIEW "scrapling"."user" AS
  SELECT * FROM "scrapling"."users";

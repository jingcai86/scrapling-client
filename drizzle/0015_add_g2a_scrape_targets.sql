-- ============================================================================
-- Migration 0015: Add G2A Google Play & PSN Scrape Targets and Products
-- ============================================================================

INSERT INTO "scrapling"."products" ("id", "slug", "title", "region", "face_value", "face_value_currency", "url", "provider", "first_seen_at", "last_seen_at")
VALUES
  ('ad69d4d6-a0fd-49dd-a439-e983f3af32b4'::uuid, 'g2a-google-play', 'Google Play Gift Cards (G2A)', 'GLOBAL', NULL, 'USD', 'https://www.g2a.com/search?query=google%20play', 'g2a', NOW(), NOW()),
  ('ad69d4d6-a0fd-49dd-a439-e983f3af32b5'::uuid, 'g2a-psn', 'PlayStation (PSN) Gift Cards (G2A)', 'GLOBAL', NULL, 'USD', 'https://www.g2a.com/category/psn-c1567', 'g2a', NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET "url" = EXCLUDED."url";

INSERT INTO "scrapling"."scrape_targets" ("id", "product_id", "provider", "name", "enabled", "schedule_id", "created_at", "updated_at")
VALUES
  ('a1000000-0000-4000-8000-000000000008'::uuid, 'ad69d4d6-a0fd-49dd-a439-e983f3af32b4'::uuid, 'g2a', 'Google Play Gift Cards (G2A)', true, 'default', NOW(), NOW()),
  ('a1000000-0000-4000-8000-000000000009'::uuid, 'ad69d4d6-a0fd-49dd-a439-e983f3af32b5'::uuid, 'g2a', 'PlayStation (PSN) Gift Cards (G2A)', true, 'default', NOW(), NOW())
ON CONFLICT ("id") DO UPDATE SET
  "product_id" = EXCLUDED."product_id",
  "provider" = EXCLUDED."provider",
  "name" = EXCLUDED."name",
  "enabled" = EXCLUDED."enabled",
  "schedule_id" = EXCLUDED."schedule_id";

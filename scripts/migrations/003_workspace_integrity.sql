BEGIN;

ALTER TABLE "company_profiles"
  ADD COLUMN IF NOT EXISTS "normalizedDomain" text;

UPDATE "company_profiles"
SET "normalizedDomain" = regexp_replace(
  regexp_replace(
    lower(split_part(split_part("websiteUrl", '://', 2), '/', 1)),
    '^www\.',
    ''
  ),
  ':[0-9]+$',
  ''
)
WHERE "normalizedDomain" IS NULL;

ALTER TABLE "company_profiles"
  ALTER COLUMN "normalizedDomain" SET NOT NULL;

COMMIT;

-- Each statement after this marker is executed separately because PostgreSQL
-- does not allow CREATE INDEX CONCURRENTLY inside a transaction block.
-- migrate:concurrent
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "company_profiles_user_domain_uidx"
  ON "company_profiles" ("userId", "normalizedDomain");

-- migrate:concurrent
CREATE INDEX CONCURRENTLY IF NOT EXISTS "artifacts_company_updated_idx"
  ON "artifacts" ("companyProfileId", "updatedAt" DESC);

-- migrate:concurrent
CREATE INDEX CONCURRENTLY IF NOT EXISTS "agent_threads_company_updated_idx"
  ON "agent_threads" ("companyProfileId", "updatedAt" DESC);

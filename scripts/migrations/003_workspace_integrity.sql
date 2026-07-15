BEGIN;

ALTER TABLE "company_profiles"
  ADD COLUMN IF NOT EXISTS "normalizedDomain" text;

COMMIT;

-- The migration runner backfills normalizedDomain with the same WHATWG URL
-- parser used by the application, audits canonical duplicates, and finalizes
-- the NOT NULL constraint before creating the unique index below.

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

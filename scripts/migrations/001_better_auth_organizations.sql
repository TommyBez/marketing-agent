BEGIN;

CREATE TABLE IF NOT EXISTS "organization" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "logo" text,
  "metadata" text,
  "createdAt" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "member" (
  "id" text PRIMARY KEY,
  "organizationId" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "invitation" (
  "id" text PRIMARY KEY,
  "organizationId" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "inviterId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "activeOrganizationId" text;
ALTER TABLE "company_profiles" ADD COLUMN IF NOT EXISTS "organizationId" text;

CREATE UNIQUE INDEX IF NOT EXISTS "organization_slug_uidx"
  ON "organization" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "member_organization_user_uidx"
  ON "member" ("organizationId", "userId");
CREATE INDEX IF NOT EXISTS "member_user_organization_idx"
  ON "member" ("userId", "organizationId");
CREATE INDEX IF NOT EXISTS "invitation_organization_status_idx"
  ON "invitation" ("organizationId", "status");
CREATE INDEX IF NOT EXISTS "invitation_email_status_idx"
  ON "invitation" ("email", "status");

-- Existing private workspaces become organizations without changing their URLs.
INSERT INTO "organization" ("id", "name", "slug", "createdAt")
SELECT
  workspace."id"::text,
  workspace."name",
  'workspace-' || workspace."id"::text,
  workspace."createdAt"
FROM "company_profiles" AS workspace
ON CONFLICT DO NOTHING;

INSERT INTO "member" ("id", "organizationId", "userId", "role", "createdAt")
SELECT
  'legacy-owner-' || workspace."id"::text,
  workspace."id"::text,
  workspace."userId",
  'owner',
  workspace."createdAt"
FROM "company_profiles" AS workspace
INNER JOIN "user" AS workspace_owner
  ON workspace_owner."id" = workspace."userId"
ON CONFLICT DO NOTHING;

UPDATE "company_profiles"
SET "organizationId" = "id"::text
WHERE "organizationId" IS NULL;

ALTER TABLE "company_profiles" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "company_profiles_organization_uidx"
  ON "company_profiles" ("organizationId");

UPDATE "session" AS active_session
SET "activeOrganizationId" = (
  SELECT workspace."organizationId"
  FROM "company_profiles" AS workspace
  INNER JOIN "member" AS workspace_member
    ON workspace_member."organizationId" = workspace."organizationId"
  WHERE workspace_member."userId" = active_session."userId"
  ORDER BY workspace."updatedAt" DESC
  LIMIT 1
)
WHERE active_session."activeOrganizationId" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_active_organization_fk') THEN
    ALTER TABLE "session"
      ADD CONSTRAINT "session_active_organization_fk"
      FOREIGN KEY ("activeOrganizationId") REFERENCES "organization"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_profiles_organization_fk') THEN
    ALTER TABLE "company_profiles"
      ADD CONSTRAINT "company_profiles_organization_fk"
      FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_threads_company_profile_fk') THEN
    ALTER TABLE "agent_threads"
      ADD CONSTRAINT "agent_threads_company_profile_fk"
      FOREIGN KEY ("companyProfileId") REFERENCES "company_profiles"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'artifacts_company_profile_fk') THEN
    ALTER TABLE "artifacts"
      ADD CONSTRAINT "artifacts_company_profile_fk"
      FOREIGN KEY ("companyProfileId") REFERENCES "company_profiles"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'artifacts_thread_fk') THEN
    ALTER TABLE "artifacts"
      ADD CONSTRAINT "artifacts_thread_fk"
      FOREIGN KEY ("threadId") REFERENCES "agent_threads"("id") ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS "public_shares" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "publicId" text NOT NULL,
  "companyProfileId" uuid NOT NULL REFERENCES "company_profiles"("id") ON DELETE CASCADE,
  "createdByUserId" text REFERENCES "user"("id") ON DELETE SET NULL,
  "resourceType" text NOT NULL,
  "artifactId" uuid REFERENCES "artifacts"("id") ON DELETE CASCADE,
  "threadId" uuid REFERENCES "agent_threads"("id") ON DELETE CASCADE,
  "snapshot" jsonb NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "public_shares_public_id_uidx"
  ON "public_shares" ("publicId");
CREATE UNIQUE INDEX IF NOT EXISTS "public_shares_artifact_uidx"
  ON "public_shares" ("artifactId");
CREATE UNIQUE INDEX IF NOT EXISTS "public_shares_thread_uidx"
  ON "public_shares" ("threadId");
CREATE INDEX IF NOT EXISTS "public_shares_company_created_idx"
  ON "public_shares" ("companyProfileId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'public_shares_resource_check'
  ) THEN
    ALTER TABLE "public_shares"
      ADD CONSTRAINT "public_shares_resource_check"
      CHECK (
        ("resourceType" = 'artifact' AND "artifactId" IS NOT NULL AND "threadId" IS NULL)
        OR
        ("resourceType" = 'conversation' AND "threadId" IS NOT NULL AND "artifactId" IS NULL)
      );
  END IF;
END $$;

COMMIT;

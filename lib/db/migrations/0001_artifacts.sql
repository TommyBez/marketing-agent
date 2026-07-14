-- Artifacts saved from agent output. Run this against the app database once.
CREATE TABLE IF NOT EXISTS "artifacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" text NOT NULL,
  "companyProfileId" uuid NOT NULL,
  "threadId" uuid,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "artifacts_user_company_updated_idx"
  ON "artifacts" ("userId", "companyProfileId", "updatedAt");

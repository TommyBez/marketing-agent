CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"companyProfileId" uuid NOT NULL,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"eveSessionId" text,
	"continuationToken" text,
	"streamIndex" integer DEFAULT 0 NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"channel" text DEFAULT 'web' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"companyProfileId" uuid NOT NULL,
	"threadId" uuid,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizationId" text NOT NULL,
	"userId" text NOT NULL,
	"websiteUrl" text NOT NULL,
	"normalizedDomain" text NOT NULL,
	"name" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"audience" text DEFAULT '' NOT NULL,
	"offering" text DEFAULT '' NOT NULL,
	"voice" text DEFAULT '' NOT NULL,
	"rawContext" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"inviterId" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"userId" text NOT NULL,
	"role" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publicId" text NOT NULL,
	"companyProfileId" uuid NOT NULL,
	"createdByUserId" text,
	"resourceType" text NOT NULL,
	"artifactId" uuid,
	"threadId" uuid,
	"snapshot" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_shares_resource_check" CHECK ((
    ("public_shares"."resourceType" = 'artifact' AND "public_shares"."artifactId" IS NOT NULL AND "public_shares"."threadId" IS NULL)
    OR
    ("public_shares"."resourceType" = 'conversation' AND "public_shares"."threadId" IS NOT NULL AND "public_shares"."artifactId" IS NULL)
  ))
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	"activeOrganizationId" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_threads" ADD CONSTRAINT "agent_threads_companyProfileId_company_profiles_id_fk" FOREIGN KEY ("companyProfileId") REFERENCES "public"."company_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_companyProfileId_company_profiles_id_fk" FOREIGN KEY ("companyProfileId") REFERENCES "public"."company_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_threadId_agent_threads_id_fk" FOREIGN KEY ("threadId") REFERENCES "public"."agent_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_user_id_fk" FOREIGN KEY ("inviterId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_shares" ADD CONSTRAINT "public_shares_companyProfileId_company_profiles_id_fk" FOREIGN KEY ("companyProfileId") REFERENCES "public"."company_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_shares" ADD CONSTRAINT "public_shares_createdByUserId_user_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_shares" ADD CONSTRAINT "public_shares_artifactId_artifacts_id_fk" FOREIGN KEY ("artifactId") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_shares" ADD CONSTRAINT "public_shares_threadId_agent_threads_id_fk" FOREIGN KEY ("threadId") REFERENCES "public"."agent_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_activeOrganizationId_organization_id_fk" FOREIGN KEY ("activeOrganizationId") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_threads_user_company_updated_idx" ON "agent_threads" USING btree ("userId","companyProfileId","updatedAt");--> statement-breakpoint
CREATE INDEX "agent_threads_company_updated_idx" ON "agent_threads" USING btree ("companyProfileId","updatedAt" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "artifacts_user_company_updated_idx" ON "artifacts" USING btree ("userId","companyProfileId","updatedAt");--> statement-breakpoint
CREATE INDEX "artifacts_company_updated_idx" ON "artifacts" USING btree ("companyProfileId","updatedAt" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "company_profiles_user_updated_idx" ON "company_profiles" USING btree ("userId","updatedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "company_profiles_organization_uidx" ON "company_profiles" USING btree ("organizationId");--> statement-breakpoint
CREATE UNIQUE INDEX "company_profiles_user_domain_uidx" ON "company_profiles" USING btree ("userId","normalizedDomain");--> statement-breakpoint
CREATE INDEX "invitation_organization_status_idx" ON "invitation" USING btree ("organizationId","status");--> statement-breakpoint
CREATE INDEX "invitation_email_status_idx" ON "invitation" USING btree ("email","status");--> statement-breakpoint
CREATE UNIQUE INDEX "member_organization_user_uidx" ON "member" USING btree ("organizationId","userId");--> statement-breakpoint
CREATE INDEX "member_user_organization_idx" ON "member" USING btree ("userId","organizationId");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "public_shares_public_id_uidx" ON "public_shares" USING btree ("publicId");--> statement-breakpoint
CREATE UNIQUE INDEX "public_shares_artifact_uidx" ON "public_shares" USING btree ("artifactId");--> statement-breakpoint
CREATE UNIQUE INDEX "public_shares_thread_uidx" ON "public_shares" USING btree ("threadId");--> statement-breakpoint
CREATE INDEX "public_shares_company_created_idx" ON "public_shares" USING btree ("companyProfileId","createdAt");
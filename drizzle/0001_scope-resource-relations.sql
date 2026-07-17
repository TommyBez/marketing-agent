ALTER TABLE "agent_threads" ADD CONSTRAINT "agent_threads_company_id_unique" UNIQUE("companyProfileId","id");--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_company_id_unique" UNIQUE("companyProfileId","id");--> statement-breakpoint
ALTER TABLE "public_shares" DROP CONSTRAINT "public_shares_artifactId_artifacts_id_fk";
--> statement-breakpoint
ALTER TABLE "public_shares" DROP CONSTRAINT "public_shares_threadId_agent_threads_id_fk";
--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_company_thread_fk" FOREIGN KEY ("companyProfileId","threadId") REFERENCES "public"."agent_threads"("companyProfileId","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_shares" ADD CONSTRAINT "public_shares_company_artifact_fk" FOREIGN KEY ("companyProfileId","artifactId") REFERENCES "public"."artifacts"("companyProfileId","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_shares" ADD CONSTRAINT "public_shares_company_thread_fk" FOREIGN KEY ("companyProfileId","threadId") REFERENCES "public"."agent_threads"("companyProfileId","id") ON DELETE cascade ON UPDATE no action;

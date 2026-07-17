CREATE TABLE "agent_execution_sessions" (
	"sessionId" text PRIMARY KEY NOT NULL,
	"rootSessionId" text NOT NULL,
	"parentSessionId" text,
	"parentTurnId" text,
	"workspaceId" uuid NOT NULL,
	"organizationId" text NOT NULL,
	"userId" text NOT NULL,
	"conversationId" uuid,
	"kind" text NOT NULL,
	"agentId" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"startedAt" timestamp with time zone NOT NULL,
	"lastSeenAt" timestamp with time zone NOT NULL,
	"terminalAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_execution_sessions_kind_check" CHECK ("agent_execution_sessions"."kind" IN ('root', 'subagent')),
	CONSTRAINT "agent_execution_sessions_status_check" CHECK ("agent_execution_sessions"."status" IN ('running', 'waiting', 'completed', 'failed')),
	CONSTRAINT "agent_execution_sessions_lineage_check" CHECK ((
    ("agent_execution_sessions"."kind" = 'root' AND "agent_execution_sessions"."rootSessionId" = "agent_execution_sessions"."sessionId" AND "agent_execution_sessions"."parentSessionId" IS NULL)
    OR
    ("agent_execution_sessions"."kind" = 'subagent' AND "agent_execution_sessions"."parentSessionId" IS NOT NULL)
  )),
	CONSTRAINT "agent_execution_sessions_terminal_check" CHECK ((
    ("agent_execution_sessions"."status" IN ('running', 'waiting') AND "agent_execution_sessions"."terminalAt" IS NULL)
    OR
    ("agent_execution_sessions"."status" IN ('completed', 'failed') AND "agent_execution_sessions"."terminalAt" IS NOT NULL)
  ))
);
--> statement-breakpoint
CREATE TABLE "ai_credit_accounts" (
	"workspaceId" uuid PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"balanceMicrousd" bigint DEFAULT 0 NOT NULL,
	"archivedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_credit_accounts_currency_check" CHECK ("ai_credit_accounts"."currency" = 'USD')
);
--> statement-breakpoint
CREATE TABLE "ai_credit_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspaceId" uuid NOT NULL,
	"userId" text,
	"modelCallId" uuid,
	"kind" text NOT NULL,
	"amountMicrousd" bigint NOT NULL,
	"balanceAfterMicrousd" bigint NOT NULL,
	"idempotencyKey" text NOT NULL,
	"reason" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurredAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_credit_ledger_entries_kind_check" CHECK ("ai_credit_ledger_entries"."kind" IN (
    'pilot_grant',
    'usage',
    'reconciliation_adjustment',
    'manual_adjustment',
    'refund',
    'topup'
  )),
	CONSTRAINT "ai_credit_ledger_entries_amount_check" CHECK ((
    ("ai_credit_ledger_entries"."kind" IN ('pilot_grant', 'refund', 'topup') AND "ai_credit_ledger_entries"."amountMicrousd" > 0)
    OR
    ("ai_credit_ledger_entries"."kind" = 'usage' AND "ai_credit_ledger_entries"."amountMicrousd" < 0)
    OR
    ("ai_credit_ledger_entries"."kind" IN ('reconciliation_adjustment', 'manual_adjustment') AND "ai_credit_ledger_entries"."amountMicrousd" <> 0)
  ))
);
--> statement-breakpoint
CREATE TABLE "ai_model_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"callId" text NOT NULL,
	"gatewayGenerationId" text,
	"aiTurnId" uuid,
	"sessionId" text NOT NULL,
	"rootSessionId" text NOT NULL,
	"eveTurnId" text,
	"workspaceId" uuid NOT NULL,
	"organizationId" text NOT NULL,
	"userId" text NOT NULL,
	"conversationId" uuid,
	"agentId" text NOT NULL,
	"callKind" text NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"stepIndex" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"modelRequested" text NOT NULL,
	"modelServed" text,
	"provider" text,
	"inputTokens" bigint,
	"outputTokens" bigint,
	"reasoningTokens" bigint,
	"cacheReadTokens" bigint,
	"cacheWriteTokens" bigint,
	"provisionalCostUsd" numeric(28, 12),
	"reconciledCostUsd" numeric(28, 12),
	"costCurrency" text DEFAULT 'USD' NOT NULL,
	"pricingVersion" text,
	"rawUsage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"startedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"completedAt" timestamp with time zone,
	"reconciledAt" timestamp with time zone,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_model_calls_kind_check" CHECK ("ai_model_calls"."callKind" IN ('step', 'retry', 'compaction', 'other')),
	CONSTRAINT "ai_model_calls_status_check" CHECK ("ai_model_calls"."status" IN ('pending', 'completed', 'aborted', 'error', 'reconciled')),
	CONSTRAINT "ai_model_calls_attempt_check" CHECK ("ai_model_calls"."attempt" >= 0),
	CONSTRAINT "ai_model_calls_step_check" CHECK ("ai_model_calls"."stepIndex" IS NULL OR "ai_model_calls"."stepIndex" >= 0),
	CONSTRAINT "ai_model_calls_tokens_check" CHECK ((
    ("ai_model_calls"."inputTokens" IS NULL OR "ai_model_calls"."inputTokens" >= 0)
    AND ("ai_model_calls"."outputTokens" IS NULL OR "ai_model_calls"."outputTokens" >= 0)
    AND ("ai_model_calls"."reasoningTokens" IS NULL OR "ai_model_calls"."reasoningTokens" >= 0)
    AND ("ai_model_calls"."cacheReadTokens" IS NULL OR "ai_model_calls"."cacheReadTokens" >= 0)
    AND ("ai_model_calls"."cacheWriteTokens" IS NULL OR "ai_model_calls"."cacheWriteTokens" >= 0)
  )),
	CONSTRAINT "ai_model_calls_cost_check" CHECK ((
    ("ai_model_calls"."provisionalCostUsd" IS NULL OR "ai_model_calls"."provisionalCostUsd" >= 0)
    AND ("ai_model_calls"."reconciledCostUsd" IS NULL OR "ai_model_calls"."reconciledCostUsd" >= 0)
    AND "ai_model_calls"."costCurrency" = 'USD'
  ))
);
--> statement-breakpoint
CREATE TABLE "ai_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionId" text NOT NULL,
	"eveTurnId" text NOT NULL,
	"sequence" integer NOT NULL,
	"workspaceId" uuid NOT NULL,
	"organizationId" text NOT NULL,
	"userId" text NOT NULL,
	"conversationId" uuid,
	"status" text DEFAULT 'running' NOT NULL,
	"failure" jsonb,
	"startedAt" timestamp with time zone NOT NULL,
	"completedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_turns_sequence_check" CHECK ("ai_turns"."sequence" >= 0),
	CONSTRAINT "ai_turns_status_check" CHECK ("ai_turns"."status" IN ('running', 'completed', 'failed')),
	CONSTRAINT "ai_turns_completed_check" CHECK ((
    ("ai_turns"."status" = 'running' AND "ai_turns"."completedAt" IS NULL)
    OR
    ("ai_turns"."status" IN ('completed', 'failed') AND "ai_turns"."completedAt" IS NOT NULL)
  ))
);
--> statement-breakpoint
CREATE TABLE "cost_reconciliation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"runKey" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"windowStart" timestamp with time zone NOT NULL,
	"windowEnd" timestamp with time zone NOT NULL,
	"billingSnapshotComplete" boolean DEFAULT false NOT NULL,
	"sourceStatuses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" jsonb,
	"startedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"completedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cost_reconciliation_runs_trigger_check" CHECK ("cost_reconciliation_runs"."trigger" IN ('scheduled', 'manual')),
	CONSTRAINT "cost_reconciliation_runs_status_check" CHECK ("cost_reconciliation_runs"."status" IN ('running', 'complete', 'partial', 'failed')),
	CONSTRAINT "cost_reconciliation_runs_window_check" CHECK ("cost_reconciliation_runs"."windowEnd" > "cost_reconciliation_runs"."windowStart"),
	CONSTRAINT "cost_reconciliation_runs_completed_check" CHECK ((
    ("cost_reconciliation_runs"."status" = 'running' AND "cost_reconciliation_runs"."completedAt" IS NULL)
    OR
    ("cost_reconciliation_runs"."status" IN ('complete', 'partial', 'failed') AND "cost_reconciliation_runs"."completedAt" IS NOT NULL)
  ))
);
--> statement-breakpoint
CREATE TABLE "infrastructure_cost_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reconciliationRunId" uuid NOT NULL,
	"billingChargeId" uuid NOT NULL,
	"usageFactId" uuid,
	"allocationKey" text NOT NULL,
	"scope" text NOT NULL,
	"workspaceId" uuid,
	"method" text NOT NULL,
	"weight" numeric(28, 12) NOT NULL,
	"billedCostUsd" numeric(28, 12) NOT NULL,
	"effectiveCostUsd" numeric(28, 12) NOT NULL,
	"periodStart" timestamp with time zone NOT NULL,
	"periodEnd" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "infrastructure_cost_allocations_scope_check" CHECK ((
    ("infrastructure_cost_allocations"."scope" = 'workspace' AND "infrastructure_cost_allocations"."workspaceId" IS NOT NULL)
    OR
    ("infrastructure_cost_allocations"."scope" = 'platform_shared' AND "infrastructure_cost_allocations"."workspaceId" IS NULL)
  )),
	CONSTRAINT "infrastructure_cost_allocations_method_check" CHECK ("infrastructure_cost_allocations"."method" IN ('direct', 'weighted', 'shared')),
	CONSTRAINT "infrastructure_cost_allocations_weight_check" CHECK ("infrastructure_cost_allocations"."weight" >= 0 AND "infrastructure_cost_allocations"."weight" <= 1),
	CONSTRAINT "infrastructure_cost_allocations_period_check" CHECK ("infrastructure_cost_allocations"."periodEnd" > "infrastructure_cost_allocations"."periodStart")
);
--> statement-breakpoint
CREATE TABLE "pilot_cost_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reportKey" text NOT NULL,
	"generatedFromRunId" uuid NOT NULL,
	"periodStart" timestamp with time zone NOT NULL,
	"periodEnd" timestamp with time zone NOT NULL,
	"timezone" text DEFAULT 'Europe/Rome' NOT NULL,
	"status" text DEFAULT 'provisional' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"report" jsonb NOT NULL,
	"generatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"finalizedAt" timestamp with time zone,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pilot_cost_reports_status_check" CHECK ("pilot_cost_reports"."status" IN ('provisional', 'complete', 'failed')),
	CONSTRAINT "pilot_cost_reports_period_check" CHECK ("pilot_cost_reports"."periodEnd" > "pilot_cost_reports"."periodStart"),
	CONSTRAINT "pilot_cost_reports_version_check" CHECK ("pilot_cost_reports"."version" > 0),
	CONSTRAINT "pilot_cost_reports_finalized_check" CHECK ((
    ("pilot_cost_reports"."status" = 'complete' AND "pilot_cost_reports"."finalizedAt" IS NOT NULL)
    OR
    ("pilot_cost_reports"."status" IN ('provisional', 'failed'))
  ))
);
--> statement-breakpoint
CREATE TABLE "platform_resource_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service" text NOT NULL,
	"resourceType" text NOT NULL,
	"resourceId" text NOT NULL,
	"sourceParentId" text,
	"sourceStatus" text NOT NULL,
	"workspaceId" uuid,
	"userId" text,
	"sessionId" text,
	"rootSessionId" text,
	"firstSeenAt" timestamp with time zone NOT NULL,
	"lastSeenAt" timestamp with time zone NOT NULL,
	"terminalAt" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_resource_inventory_service_check" CHECK ("platform_resource_inventory"."service" IN ('sandbox', 'workflow', 'functions', 'queues')),
	CONSTRAINT "platform_resource_inventory_seen_check" CHECK ("platform_resource_inventory"."lastSeenAt" >= "platform_resource_inventory"."firstSeenAt")
);
--> statement-breakpoint
CREATE TABLE "platform_usage_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reconciliationRunId" uuid NOT NULL,
	"resourceInventoryId" uuid,
	"idempotencyKey" text NOT NULL,
	"service" text NOT NULL,
	"metric" text NOT NULL,
	"resourceType" text NOT NULL,
	"resourceId" text NOT NULL,
	"workspaceId" uuid,
	"userId" text,
	"sessionId" text,
	"rootSessionId" text,
	"periodStart" timestamp with time zone NOT NULL,
	"periodEnd" timestamp with time zone,
	"quantity" numeric(28, 12),
	"unit" text NOT NULL,
	"quality" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rateUsd" numeric(28, 12),
	"rateUnit" text,
	"pricingVersion" text,
	"standardCostUsd" numeric(28, 12),
	"rawData" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"observedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"finalizedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_usage_facts_service_check" CHECK ("platform_usage_facts"."service" IN ('sandbox', 'workflow', 'functions', 'queues')),
	CONSTRAINT "platform_usage_facts_quality_check" CHECK ("platform_usage_facts"."quality" IN ('exact', 'derived', 'experimental', 'estimated')),
	CONSTRAINT "platform_usage_facts_status_check" CHECK ("platform_usage_facts"."status" IN ('pending', 'final')),
	CONSTRAINT "platform_usage_facts_period_check" CHECK ("platform_usage_facts"."periodEnd" IS NULL OR "platform_usage_facts"."periodEnd" > "platform_usage_facts"."periodStart"),
	CONSTRAINT "platform_usage_facts_quantity_check" CHECK ("platform_usage_facts"."quantity" IS NULL OR "platform_usage_facts"."quantity" >= 0),
	CONSTRAINT "platform_usage_facts_cost_check" CHECK ((
    ("platform_usage_facts"."rateUsd" IS NULL OR "platform_usage_facts"."rateUsd" >= 0)
    AND ("platform_usage_facts"."standardCostUsd" IS NULL OR "platform_usage_facts"."standardCostUsd" >= 0)
  )),
	CONSTRAINT "platform_usage_facts_final_check" CHECK ((
    "platform_usage_facts"."status" = 'pending'
    OR
    (
      "platform_usage_facts"."periodEnd" IS NOT NULL
      AND "platform_usage_facts"."quantity" IS NOT NULL
      AND "platform_usage_facts"."standardCostUsd" IS NOT NULL
      AND "platform_usage_facts"."finalizedAt" IS NOT NULL
    )
  ))
);
--> statement-breakpoint
CREATE TABLE "vercel_billing_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reconciliationRunId" uuid NOT NULL,
	"sourceChargeKey" text NOT NULL,
	"serviceName" text NOT NULL,
	"skuId" text,
	"skuName" text,
	"chargeCategory" text,
	"chargePeriodStart" timestamp with time zone NOT NULL,
	"chargePeriodEnd" timestamp with time zone NOT NULL,
	"usageQuantity" numeric(28, 12),
	"usageUnit" text,
	"listCostUsd" numeric(28, 12),
	"billedCostUsd" numeric(28, 12) NOT NULL,
	"effectiveCostUsd" numeric(28, 12) NOT NULL,
	"currency" text NOT NULL,
	"rawCharge" jsonb NOT NULL,
	"importedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vercel_billing_charges_period_check" CHECK ("vercel_billing_charges"."chargePeriodEnd" > "vercel_billing_charges"."chargePeriodStart"),
	CONSTRAINT "vercel_billing_charges_currency_check" CHECK (char_length("vercel_billing_charges"."currency") = 3)
);
--> statement-breakpoint
ALTER TABLE "agent_execution_sessions" ADD CONSTRAINT "agent_execution_sessions_workspaceId_ai_credit_accounts_workspaceId_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."ai_credit_accounts"("workspaceId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_credit_ledger_entries" ADD CONSTRAINT "ai_credit_ledger_entries_workspaceId_ai_credit_accounts_workspaceId_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."ai_credit_accounts"("workspaceId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_credit_ledger_entries" ADD CONSTRAINT "ai_credit_ledger_entries_modelCallId_ai_model_calls_id_fk" FOREIGN KEY ("modelCallId") REFERENCES "public"."ai_model_calls"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_model_calls" ADD CONSTRAINT "ai_model_calls_aiTurnId_ai_turns_id_fk" FOREIGN KEY ("aiTurnId") REFERENCES "public"."ai_turns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_model_calls" ADD CONSTRAINT "ai_model_calls_sessionId_agent_execution_sessions_sessionId_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."agent_execution_sessions"("sessionId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_model_calls" ADD CONSTRAINT "ai_model_calls_workspaceId_ai_credit_accounts_workspaceId_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."ai_credit_accounts"("workspaceId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_turns" ADD CONSTRAINT "ai_turns_sessionId_agent_execution_sessions_sessionId_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."agent_execution_sessions"("sessionId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_turns" ADD CONSTRAINT "ai_turns_workspaceId_ai_credit_accounts_workspaceId_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."ai_credit_accounts"("workspaceId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "infrastructure_cost_allocations" ADD CONSTRAINT "infrastructure_cost_allocations_reconciliationRunId_cost_reconciliation_runs_id_fk" FOREIGN KEY ("reconciliationRunId") REFERENCES "public"."cost_reconciliation_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "infrastructure_cost_allocations" ADD CONSTRAINT "infrastructure_cost_allocations_billingChargeId_vercel_billing_charges_id_fk" FOREIGN KEY ("billingChargeId") REFERENCES "public"."vercel_billing_charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "infrastructure_cost_allocations" ADD CONSTRAINT "infrastructure_cost_allocations_usageFactId_platform_usage_facts_id_fk" FOREIGN KEY ("usageFactId") REFERENCES "public"."platform_usage_facts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "infrastructure_cost_allocations" ADD CONSTRAINT "infrastructure_cost_allocations_workspaceId_ai_credit_accounts_workspaceId_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."ai_credit_accounts"("workspaceId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilot_cost_reports" ADD CONSTRAINT "pilot_cost_reports_generatedFromRunId_cost_reconciliation_runs_id_fk" FOREIGN KEY ("generatedFromRunId") REFERENCES "public"."cost_reconciliation_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_resource_inventory" ADD CONSTRAINT "platform_resource_inventory_workspaceId_ai_credit_accounts_workspaceId_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."ai_credit_accounts"("workspaceId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_usage_facts" ADD CONSTRAINT "platform_usage_facts_reconciliationRunId_cost_reconciliation_runs_id_fk" FOREIGN KEY ("reconciliationRunId") REFERENCES "public"."cost_reconciliation_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_usage_facts" ADD CONSTRAINT "platform_usage_facts_resourceInventoryId_platform_resource_inventory_id_fk" FOREIGN KEY ("resourceInventoryId") REFERENCES "public"."platform_resource_inventory"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_usage_facts" ADD CONSTRAINT "platform_usage_facts_workspaceId_ai_credit_accounts_workspaceId_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."ai_credit_accounts"("workspaceId") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vercel_billing_charges" ADD CONSTRAINT "vercel_billing_charges_reconciliationRunId_cost_reconciliation_runs_id_fk" FOREIGN KEY ("reconciliationRunId") REFERENCES "public"."cost_reconciliation_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_execution_sessions_root_conversation_uidx" ON "agent_execution_sessions" USING btree ("conversationId") WHERE "agent_execution_sessions"."kind" = 'root' AND "agent_execution_sessions"."conversationId" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "agent_execution_sessions_root_idx" ON "agent_execution_sessions" USING btree ("rootSessionId");--> statement-breakpoint
CREATE INDEX "agent_execution_sessions_workspace_started_idx" ON "agent_execution_sessions" USING btree ("workspaceId","startedAt");--> statement-breakpoint
CREATE INDEX "agent_execution_sessions_conversation_idx" ON "agent_execution_sessions" USING btree ("conversationId");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_credit_accounts_organization_uidx" ON "ai_credit_accounts" USING btree ("organizationId");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_credit_ledger_entries_idempotency_uidx" ON "ai_credit_ledger_entries" USING btree ("idempotencyKey");--> statement-breakpoint
CREATE INDEX "ai_credit_ledger_entries_workspace_created_idx" ON "ai_credit_ledger_entries" USING btree ("workspaceId","createdAt" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "ai_credit_ledger_entries_model_call_idx" ON "ai_credit_ledger_entries" USING btree ("modelCallId");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_model_calls_call_uidx" ON "ai_model_calls" USING btree ("callId");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_model_calls_gateway_generation_uidx" ON "ai_model_calls" USING btree ("gatewayGenerationId");--> statement-breakpoint
CREATE INDEX "ai_model_calls_status_started_idx" ON "ai_model_calls" USING btree ("status","startedAt");--> statement-breakpoint
CREATE INDEX "ai_model_calls_workspace_started_idx" ON "ai_model_calls" USING btree ("workspaceId","startedAt");--> statement-breakpoint
CREATE INDEX "ai_model_calls_user_started_idx" ON "ai_model_calls" USING btree ("userId","startedAt");--> statement-breakpoint
CREATE INDEX "ai_model_calls_root_session_idx" ON "ai_model_calls" USING btree ("rootSessionId");--> statement-breakpoint
CREATE INDEX "ai_model_calls_turn_idx" ON "ai_model_calls" USING btree ("aiTurnId");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_turns_session_turn_uidx" ON "ai_turns" USING btree ("sessionId","eveTurnId");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_turns_session_sequence_uidx" ON "ai_turns" USING btree ("sessionId","sequence");--> statement-breakpoint
CREATE INDEX "ai_turns_workspace_started_idx" ON "ai_turns" USING btree ("workspaceId","startedAt");--> statement-breakpoint
CREATE INDEX "ai_turns_user_started_idx" ON "ai_turns" USING btree ("userId","startedAt");--> statement-breakpoint
CREATE INDEX "ai_turns_status_started_idx" ON "ai_turns" USING btree ("status","startedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "cost_reconciliation_runs_key_uidx" ON "cost_reconciliation_runs" USING btree ("runKey");--> statement-breakpoint
CREATE INDEX "cost_reconciliation_runs_status_started_idx" ON "cost_reconciliation_runs" USING btree ("status","startedAt");--> statement-breakpoint
CREATE INDEX "cost_reconciliation_runs_window_idx" ON "cost_reconciliation_runs" USING btree ("windowStart","windowEnd");--> statement-breakpoint
CREATE UNIQUE INDEX "infrastructure_cost_allocations_key_uidx" ON "infrastructure_cost_allocations" USING btree ("allocationKey");--> statement-breakpoint
CREATE INDEX "infrastructure_cost_allocations_run_idx" ON "infrastructure_cost_allocations" USING btree ("reconciliationRunId");--> statement-breakpoint
CREATE INDEX "infrastructure_cost_allocations_charge_idx" ON "infrastructure_cost_allocations" USING btree ("billingChargeId");--> statement-breakpoint
CREATE INDEX "infrastructure_cost_allocations_workspace_period_idx" ON "infrastructure_cost_allocations" USING btree ("workspaceId","periodStart");--> statement-breakpoint
CREATE UNIQUE INDEX "pilot_cost_reports_key_uidx" ON "pilot_cost_reports" USING btree ("reportKey");--> statement-breakpoint
CREATE UNIQUE INDEX "pilot_cost_reports_period_uidx" ON "pilot_cost_reports" USING btree ("periodStart","periodEnd","timezone");--> statement-breakpoint
CREATE INDEX "pilot_cost_reports_status_period_idx" ON "pilot_cost_reports" USING btree ("status","periodStart");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_resource_inventory_resource_uidx" ON "platform_resource_inventory" USING btree ("service","resourceType","resourceId");--> statement-breakpoint
CREATE INDEX "platform_resource_inventory_status_seen_idx" ON "platform_resource_inventory" USING btree ("service","resourceType","sourceStatus","lastSeenAt");--> statement-breakpoint
CREATE INDEX "platform_resource_inventory_workspace_seen_idx" ON "platform_resource_inventory" USING btree ("workspaceId","lastSeenAt");--> statement-breakpoint
CREATE INDEX "platform_resource_inventory_session_idx" ON "platform_resource_inventory" USING btree ("sessionId");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_usage_facts_idempotency_uidx" ON "platform_usage_facts" USING btree ("idempotencyKey");--> statement-breakpoint
CREATE INDEX "platform_usage_facts_service_status_idx" ON "platform_usage_facts" USING btree ("service","status","observedAt");--> statement-breakpoint
CREATE INDEX "platform_usage_facts_workspace_period_idx" ON "platform_usage_facts" USING btree ("workspaceId","periodStart");--> statement-breakpoint
CREATE INDEX "platform_usage_facts_root_session_idx" ON "platform_usage_facts" USING btree ("rootSessionId");--> statement-breakpoint
CREATE INDEX "platform_usage_facts_run_idx" ON "platform_usage_facts" USING btree ("reconciliationRunId");--> statement-breakpoint
CREATE UNIQUE INDEX "vercel_billing_charges_run_source_uidx" ON "vercel_billing_charges" USING btree ("reconciliationRunId","sourceChargeKey");--> statement-breakpoint
CREATE INDEX "vercel_billing_charges_service_period_idx" ON "vercel_billing_charges" USING btree ("serviceName","chargePeriodStart");--> statement-breakpoint
CREATE INDEX "vercel_billing_charges_run_idx" ON "vercel_billing_charges" USING btree ("reconciliationRunId");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_threads_eve_session_uidx" ON "agent_threads" USING btree ("eveSessionId");
DROP TABLE "infrastructure_cost_allocations" CASCADE;--> statement-breakpoint
DROP TABLE "pilot_cost_reports" CASCADE;--> statement-breakpoint
DROP TABLE "platform_resource_inventory" CASCADE;--> statement-breakpoint
DROP TABLE "platform_usage_facts" CASCADE;--> statement-breakpoint
DROP TABLE "vercel_billing_charges" CASCADE;--> statement-breakpoint
ALTER TABLE "cost_reconciliation_runs" DROP COLUMN "billingSnapshotComplete";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { costReconciliationRuns } from "@/lib/db/schema";
import { allocateFocusCharges } from "@/lib/cost-accounting/allocations";
import { collectAiGatewayUsage } from "@/lib/cost-accounting/collectors/ai-gateway";
import { collectFocusCharges } from "@/lib/cost-accounting/collectors/focus";
import { collectSandboxUsage } from "@/lib/cost-accounting/collectors/sandbox";
import { collectWorkflowUsage } from "@/lib/cost-accounting/collectors/workflow";
import { reconciliationWindows, startOfUtcDay, utcDateKey } from "@/lib/cost-accounting/time";

type SourceResult = {
  status: "complete" | "partial" | "failed";
  result?: unknown;
  error?: Record<string, unknown>;
};

export async function runCostReconciliation(input?: {
  now?: Date;
  trigger?: "scheduled" | "manual";
}): Promise<{
  runId: string;
  status: "complete" | "partial" | "failed";
  sources: Record<string, SourceResult>;
}> {
  const now = input?.now ?? new Date();
  const trigger = input?.trigger ?? "scheduled";
  const windows = reconciliationWindows(now);
  const runKey = `cost-reconciliation:v1:${utcDateKey(startOfUtcDay(now))}`;
  const [run] = await db
    .insert(costReconciliationRuns)
    .values({
      runKey,
      trigger,
      status: "running",
      windowStart: windows.aiGateway.start,
      windowEnd: now,
    })
    .onConflictDoUpdate({
      target: costReconciliationRuns.runKey,
      set: {
        trigger,
        status: "running",
        windowStart: windows.aiGateway.start,
        windowEnd: now,
        billingSnapshotComplete: false,
        sourceStatuses: {},
        error: null,
        startedAt: now,
        completedAt: null,
        updatedAt: now,
      },
    })
    .returning({ id: costReconciliationRuns.id });

  if (!run) {
    throw new Error("Unable to create reconciliation run");
  }

  const workflowApiConfig = {
    token: process.env.VERCEL_BILLING_TOKEN,
    projectConfig: {
      projectId: process.env.VERCEL_PROJECT_ID,
      teamId: process.env.VERCEL_TEAM_ID,
      environment: "production",
    },
  };
  const collectors = {
    aiGateway: () => collectAiGatewayUsage({ window: windows.aiGateway }),
    sandbox: () => collectSandboxUsage({
      reconciliationRunId: run.id,
      window: windows.sandbox,
      observedAt: now,
    }),
    workflow: () => collectWorkflowUsage({
      reconciliationRunId: run.id,
      window: windows.workflow,
      observedAt: now,
      apiConfig: workflowApiConfig,
    }),
    focus: () => collectFocusCharges({
      reconciliationRunId: run.id,
      window: windows.focus,
    }),
  } as const;

  const entries = Object.entries(collectors);
  const settled = await Promise.allSettled(entries.map(([, collect]) => collect()));
  const sources: Record<string, SourceResult> = {};

  settled.forEach((outcome, index) => {
    const sourceName = entries[index]?.[0] ?? `unknown-${index}`;
    if (outcome.status === "rejected") {
      sources[sourceName] = {
        status: "failed",
        error: safeError(outcome.reason),
      };
      return;
    }

    const result = outcome.value as { status?: string };
    sources[sourceName] = {
      status: result.status === "partial" ? "partial" : "complete",
      result,
    };
  });

  try {
    const allocationResult = await allocateFocusCharges(run.id);
    sources.allocations = { status: "complete", result: allocationResult };
  } catch (error) {
    sources.allocations = { status: "failed", error: safeError(error) };
  }

  const sourceValues = Object.values(sources);
  const failedCount = sourceValues.filter((source) => source.status === "failed").length;
  const partialCount = sourceValues.filter((source) => source.status === "partial").length;
  const status = failedCount === sourceValues.length
    ? "failed"
    : failedCount > 0 || partialCount > 0
      ? "partial"
      : "complete";
  const completedAt = new Date();

  await db
    .update(costReconciliationRuns)
    .set({
      status,
      billingSnapshotComplete: sources.focus?.status === "complete",
      sourceStatuses: sources,
      error:
        status === "complete"
          ? null
          : {
              failedSources: Object.entries(sources)
                .filter(([, source]) => source.status === "failed")
                .map(([name]) => name),
            },
      completedAt,
      updatedAt: completedAt,
    })
    .where(eq(costReconciliationRuns.id, run.id));

  console.info(JSON.stringify({
    event: "cost_reconciliation_completed",
    runId: run.id,
    runKey,
    status,
    sources,
  }));

  return { runId: run.id, status, sources };
}

function safeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      cause: error.cause ? String(error.cause) : undefined,
    };
  }
  return { message: String(error), errorId: randomUUID() };
}


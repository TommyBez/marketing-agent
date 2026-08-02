import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { costReconciliationRuns } from "@/lib/db/schema";
import { collectAiGatewayUsage } from "@/lib/cost-accounting/collectors/ai-gateway";
import { reconciliationWindows, startOfUtcDay, utcDateKey } from "@/lib/cost-accounting/time";

// Below the route's 300-second maxDuration so a hung collector still reaches
// the failed-run update instead of leaving the row in "running" forever.
const RECONCILIATION_TIMEOUT_MS = 4 * 60 * 1_000;

type SourceResult = {
  status: "complete" | "partial" | "failed";
  window?: { start: string; end: string };
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

  const serializedWindow = {
    start: windows.aiGateway.start.toISOString(),
    end: windows.aiGateway.end.toISOString(),
  };
  const sources: Record<string, SourceResult> = {};

  try {
    const result = await withDeadline(
      collectAiGatewayUsage({ window: windows.aiGateway }),
      RECONCILIATION_TIMEOUT_MS,
    );
    sources.aiGateway = {
      status: result.status === "partial" ? "partial" : "complete",
      window: serializedWindow,
      result,
    };
  } catch (error) {
    sources.aiGateway = {
      status: "failed",
      window: serializedWindow,
      error: safeError(error),
    };
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

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Reconciliation exceeded ${ms}ms`)),
        ms,
      );
      timer.unref?.();
    }),
  ]);
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

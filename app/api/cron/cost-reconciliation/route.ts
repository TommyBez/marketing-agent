import {
  acquireAccountingCronLock,
  CronLockUnavailableError,
  isAccountingCronEnabled,
  isAuthorizedCronRequest,
} from "@/lib/cost-accounting/cron-lock";
import { runCostReconciliation } from "@/lib/cost-accounting/reconcile";

export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  if (!isAccountingCronEnabled()) {
    return new Response(null, { status: 404 });
  }

  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let lock;
  try {
    lock = await acquireAccountingCronLock();
  } catch (error) {
    if (error instanceof CronLockUnavailableError) {
      return Response.json(
        { error: "Cost-accounting lock unavailable" },
        { status: 503 },
      );
    }
    throw error;
  }

  if (!lock) {
    return new Response(null, { status: 204 });
  }

  try {
    const result = await runCostReconciliation({ trigger: "scheduled" });
    return Response.json(result, {
      status: result.status === "failed" ? 500 : 200,
    });
  } catch (error) {
    console.error("[cost-accounting] reconciliation cron failed", {
      runId: lock.runId,
      error,
    });
    return Response.json(
      { error: "Cost reconciliation failed", runId: lock.runId },
      { status: 500 },
    );
  } finally {
    await lock.release();
  }
}

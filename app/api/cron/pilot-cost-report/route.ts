import {
  acquireAccountingCronLock,
  CronLockUnavailableError,
  isAccountingCronEnabled,
  isAuthorizedCronRequest,
} from "@/lib/cost-accounting/cron-lock";
import { generatePilotCostReports } from "@/lib/cost-accounting/report";

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
    const reports = await generatePilotCostReports();
    return Response.json({ reportsGenerated: reports.length, reports });
  } catch (error) {
    console.error("[cost-accounting] pilot report cron failed", {
      runId: lock.runId,
      error,
    });
    return Response.json(
      { error: "Pilot cost report failed", runId: lock.runId },
      { status: 500 },
    );
  } finally {
    await lock.release();
  }
}

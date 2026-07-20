import assert from "node:assert/strict";
import test from "node:test";
import {
  pilotReportCoverage,
  pilotReportStatus,
  type PilotCoverageRun,
} from "./report";

const period = {
  start: new Date("2026-07-06T00:00:00.000Z"),
  end: new Date("2026-07-13T00:00:00.000Z"),
};
const afterSettlement = new Date("2026-07-16T03:00:00.000Z");

test("pilot report completes only after settlement and complete per-source coverage", () => {
  assert.equal(pilotReportStatus({
    now: afterSettlement,
    periodEnd: period.end,
    sourceCoverageComplete: true,
  }), "complete");
  assert.equal(pilotReportStatus({
    now: new Date("2026-07-15T23:59:59.999Z"),
    periodEnd: period.end,
    sourceCoverageComplete: true,
  }), "provisional");
  assert.equal(pilotReportStatus({
    now: afterSettlement,
    periodEnd: period.end,
    sourceCoverageComplete: false,
  }), "provisional");
});

test("per-source coverage requires gap-free platform runs and late full snapshots", () => {
  const runs = completeDailyRuns();
  const coverage = pilotReportCoverage({ period, runs });

  assert.equal(coverage.complete, true);
  assert.equal(coverage.sources.workflow.coveredPeriod, true);
  assert.equal(coverage.sources.focus.refreshedAfterSettlement, true);
  assert.equal(coverage.allocationsCompleteAfterSettlement, true);
});

test("a failed Workflow day leaves the historical report provisional", () => {
  const runs = completeDailyRuns().map((run) =>
    run.id === "run-10" ? runWithFailedSources(10, ["workflow"]) : run
  );
  const coverage = pilotReportCoverage({ period, runs });

  assert.equal(coverage.complete, false);
  assert.equal(coverage.sources.workflow.coveredPeriod, false);
});

test("a pre-settlement FOCUS snapshot cannot finalize the report", () => {
  const runs = completeDailyRuns().map((run) =>
    run.id === "run-16" ? runWithFailedSources(16, ["focus", "allocations"]) : run
  );
  const coverage = pilotReportCoverage({ period, runs });

  assert.equal(coverage.complete, false);
  assert.equal(coverage.sources.focus.coveredPeriod, true);
  assert.equal(coverage.sources.focus.refreshedAfterSettlement, false);
  assert.equal(coverage.allocationsCompleteAfterSettlement, false);
});

function completeDailyRuns(): PilotCoverageRun[] {
  return Array.from({ length: 11 }, (_, index) => runWithFailedSources(6 + index));
}

function runWithFailedSources(
  day: number,
  failedSources: string[] = [],
): PilotCoverageRun {
  const completedAt = new Date(Date.UTC(2026, 6, day, 3));
  const end = completedAt.toISOString();
  const longStart = new Date(Date.UTC(2026, 6, day - 14)).toISOString();
  const sandboxStart = new Date(Date.UTC(2026, 6, day - 2)).toISOString();
  const workflowStart = new Date(
    completedAt.getTime() - 30 * 60 * 60 * 1_000,
  ).toISOString();
  const source = (name: string, start: string) => ({
    status: failedSources.includes(name) ? "failed" : "complete",
    window: { start, end },
  });

  return {
    id: `run-${day}`,
    completedAt,
    sourceStatuses: {
      aiGateway: source("aiGateway", longStart),
      sandbox: source("sandbox", sandboxStart),
      workflow: source("workflow", workflowStart),
      focus: source("focus", longStart),
      allocations: source("allocations", longStart),
    },
  };
}

import assert from "node:assert/strict";
import test from "node:test";
import { metricsForCharge, weightsByWorkspace } from "./allocations";
import { overlapShare } from "./usage-proration";

test("keeps Workflow Data Written shared instead of proxying retained bytes", () => {
  assert.deepEqual(
    metricsForCharge("workflow", {
      serviceName: "Workflow",
      skuName: "Data Written",
      usageUnit: "GB-month",
      chargeCategory: "Usage",
    }),
    [],
  );

  assert.deepEqual(
    metricsForCharge("workflow", {
      serviceName: "Workflow",
      skuName: "Data Retained",
      usageUnit: "GB-month",
      chargeCategory: "Usage",
    }),
    ["data_retained"],
  );
});

test("weights ignore facts outside the charge and aggregate each workspace", () => {
  const chargeStart = new Date("2026-07-01T00:00:00.000Z");
  const chargeEnd = new Date("2026-07-02T00:00:00.000Z");
  const facts = [
    {
      id: "workspace-1-first",
      workspaceId: "workspace-1",
      metric: "active_cpu",
      periodStart: chargeStart,
      periodEnd: new Date("2026-07-01T12:00:00.000Z"),
      observedAt: chargeEnd,
      standardCostUsd: "2",
    },
    {
      id: "workspace-1-second",
      workspaceId: "workspace-1",
      metric: "active_cpu",
      periodStart: new Date("2026-07-01T12:00:00.000Z"),
      periodEnd: chargeEnd,
      observedAt: chargeEnd,
      standardCostUsd: "2",
    },
    {
      id: "workspace-2-only",
      workspaceId: "workspace-2",
      metric: "active_cpu",
      periodStart: chargeStart,
      periodEnd: chargeEnd,
      observedAt: chargeEnd,
      standardCostUsd: "4",
    },
    {
      id: "outside-window",
      workspaceId: "workspace-3",
      metric: "active_cpu",
      periodStart: new Date("2026-06-29T00:00:00.000Z"),
      periodEnd: new Date("2026-06-30T00:00:00.000Z"),
      observedAt: new Date("2026-06-30T00:00:00.000Z"),
      standardCostUsd: "100",
    },
  ];

  const weights = weightsByWorkspace(facts, chargeStart, chargeEnd);
  assert.deepEqual(weights, [
    { workspaceId: "workspace-1", usageFactId: null, weight: 0.5 },
    {
      workspaceId: "workspace-2",
      usageFactId: "workspace-2-only",
      weight: 0.5,
    },
  ]);
});

test("pending facts are weighted only through their observed interval", () => {
  const chargeStart = new Date("2026-07-01T00:00:00.000Z");
  const chargeEnd = new Date("2026-07-02T00:00:00.000Z");
  const weights = weightsByWorkspace(
    [
      {
        id: "current",
        workspaceId: "workspace-1",
        metric: "provisioned_memory",
        periodStart: chargeStart,
        periodEnd: null,
        observedAt: new Date("2026-07-01T12:00:00.000Z"),
        standardCostUsd: "4",
      },
      {
        id: "stale",
        workspaceId: "workspace-2",
        metric: "provisioned_memory",
        periodStart: new Date("2026-06-29T00:00:00.000Z"),
        periodEnd: null,
        observedAt: new Date("2026-06-30T00:00:00.000Z"),
        standardCostUsd: "100",
      },
    ],
    chargeStart,
    chargeEnd,
  );

  assert.deepEqual(weights, [
    { workspaceId: "workspace-1", usageFactId: "current", weight: 1 },
  ]);
});

test("prorates continuous facts across a bounded window", () => {
  const fact = {
    metric: "active_cpu",
    periodStart: new Date("2026-07-01T00:00:00.000Z"),
    periodEnd: new Date("2026-07-03T00:00:00.000Z"),
    observedAt: new Date("2026-07-03T00:00:00.000Z"),
  };

  assert.equal(
    overlapShare(
      fact,
      new Date("2026-07-02T00:00:00.000Z"),
      new Date("2026-07-03T00:00:00.000Z"),
    ),
    0.5,
  );
});

test("treats discrete metrics as half-open point events", () => {
  const windowStart = new Date("2026-07-01T00:00:00.000Z");
  const windowEnd = new Date("2026-07-02T00:00:00.000Z");
  const fact = (periodStart: Date) => ({
    metric: "event",
    periodStart,
    periodEnd: periodStart,
    observedAt: periodStart,
  });

  assert.equal(overlapShare(fact(windowStart), windowStart, windowEnd), 1);
  assert.equal(overlapShare(fact(windowEnd), windowStart, windowEnd), 0);
});

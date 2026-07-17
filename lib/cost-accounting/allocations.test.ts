import assert from "node:assert/strict";
import test from "node:test";
import { metricsForCharge } from "./allocations";

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

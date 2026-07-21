import assert from "node:assert/strict";
import test from "node:test";
import { hasGatewayReportingTag } from "./ai-gateway";

test("Gateway spend reconciliation compares only locally tagged calls", () => {
  assert.equal(hasGatewayReportingTag({
    gatewayReportingTag: "branderize:production",
  }, "branderize:production"), true);
  assert.equal(hasGatewayReportingTag({}, "branderize:production"), false);
  assert.equal(hasGatewayReportingTag({
    gatewayReportingTag: "branderize:preview",
  }, "branderize:production"), false);
});

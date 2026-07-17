import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gatewayUserIdForIdentity } from "./gateway-identity";

describe("AI Gateway user identity", () => {
  it("is stable, scoped to workspace and opaque", () => {
    const first = gatewayUserIdForIdentity("workspace-a", "user-a");

    assert.equal(first, gatewayUserIdForIdentity("workspace-a", "user-a"));
    assert.notEqual(first, gatewayUserIdForIdentity("workspace-b", "user-a"));
    assert.notEqual(first, gatewayUserIdForIdentity("workspace-a", "user-b"));
    assert.match(first, /^brz_[A-Za-z0-9_-]{43}$/u);
    assert.equal(first.includes("workspace-a"), false);
    assert.equal(first.includes("user-a"), false);
  });
});

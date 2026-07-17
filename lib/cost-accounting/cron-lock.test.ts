import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  COST_ACCOUNTING_LOCK_KEY,
  COST_ACCOUNTING_LOCK_TTL_MS,
  isAuthorizedCronRequest,
} from "./cron-lock";

const originalCronSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalCronSecret;
  }
});

describe("cost-accounting cron guard", () => {
  it("pins one shared lock beyond the maximum cron duration", () => {
    assert.equal(
      COST_ACCOUNTING_LOCK_KEY,
      "branderize:production:cron:cost-accounting:v1",
    );
    assert.equal(COST_ACCOUNTING_LOCK_TTL_MS, 330_000);
  });

  it("accepts only the exact bearer secret", () => {
    process.env.CRON_SECRET = "correct-secret";

    assert.equal(
      isAuthorizedCronRequest(new Request("https://example.test", {
        headers: { authorization: "Bearer correct-secret" },
      })),
      true,
    );
    assert.equal(
      isAuthorizedCronRequest(new Request("https://example.test", {
        headers: { authorization: "Bearer incorrect-secret" },
      })),
      false,
    );
    assert.equal(
      isAuthorizedCronRequest(new Request("https://example.test")),
      false,
    );
  });
});

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  COST_ACCOUNTING_LOCK_TTL_MS,
  costAccountingLockKey,
  hasRedisEnvironment,
  isAccountingCronEnabled,
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
      costAccountingLockKey({ VERCEL_ENV: "production" }),
      "branderize:production:cron:cost-accounting:v1",
    );
    assert.equal(
      costAccountingLockKey({ VERCEL_ENV: "preview" }),
      "branderize:preview:cron:cost-accounting:v1",
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

  it("accepts both native Upstash and Vercel Marketplace Redis variables", () => {
    assert.equal(hasRedisEnvironment({
      UPSTASH_REDIS_REST_URL: "https://redis.example.test",
      UPSTASH_REDIS_REST_TOKEN: "token",
    }), true);
    assert.equal(hasRedisEnvironment({
      KV_REST_API_URL: "https://redis.example.test",
      KV_REST_API_TOKEN: "token",
    }), true);
    assert.equal(hasRedisEnvironment({ KV_REST_API_URL: "https://redis.example.test" }), false);
    assert.equal(hasRedisEnvironment({}), false);
  });

  it("disables accounting cron routes only in Preview", () => {
    assert.equal(isAccountingCronEnabled({ VERCEL_ENV: "preview" }), false);
    assert.equal(isAccountingCronEnabled({ VERCEL_ENV: "production" }), true);
    assert.equal(isAccountingCronEnabled({ VERCEL_ENV: "development" }), true);
    assert.equal(isAccountingCronEnabled({}), true);
  });
});

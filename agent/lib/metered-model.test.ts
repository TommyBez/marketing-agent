import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateGatewayCost,
  gatewayUsageFromStreamPart,
  unattributedCallGuard,
} from "./metered-model";

test("the unattributed production guard rejects before calling the provider", async () => {
  const middleware = unattributedCallGuard();
  const wrapGenerate = middleware.wrapGenerate as unknown as (input: {
    doGenerate: () => Promise<unknown>;
  }) => Promise<unknown>;
  const wrapStream = middleware.wrapStream as unknown as (input: {
    doStream: () => Promise<unknown>;
  }) => Promise<unknown>;
  let providerCalls = 0;

  await assert.rejects(
    () => wrapGenerate({
      doGenerate: async () => {
        providerCalls += 1;
        return {};
      },
    }),
    /cannot attribute this model call/u,
  );
  await assert.rejects(
    () => wrapStream({
      doStream: async () => {
        providerCalls += 1;
        return {};
      },
    }),
    /cannot attribute this model call/u,
  );

  assert.equal(providerCalls, 0);
});

test("catalog fallback prices uncached, cache-read, cache-write, and output tokens", () => {
  const cost = estimateGatewayCost(
    {
      inputTokens: 1_000,
      outputTokens: 200,
      cacheReadTokens: 300,
      cacheWriteTokens: 100,
    },
    {
      input: "0.000001",
      output: "0.000004",
      cachedInputTokens: "0.0000001",
      cacheCreationInputTokens: "0.00000125",
    },
  );

  assert.equal(cost, 0.001555);
});

test("captures Gateway generation and cost metadata from an early stream chunk", () => {
  assert.deepEqual(
    gatewayUsageFromStreamPart({
      type: "text-delta",
      providerMetadata: {
        gateway: {
          generationId: "gen_01",
          cost: "0.00849",
        },
      },
    }),
    {
      generationId: "gen_01",
      costUsd: 0.00849,
    },
  );
});

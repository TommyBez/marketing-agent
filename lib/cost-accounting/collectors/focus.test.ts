import assert from "node:assert/strict";
import test from "node:test";
import {
  belongsToProjectOrSharedCharge,
  focusUpsertBatches,
  normalizeFocusRow,
  parseFocusJsonLines,
} from "./focus";

test("FOCUS normalization preserves decimals and prefers the readable SKU name", () => {
  const normalized = normalizeFocusRow({
    ChargeId: "charge-1",
    ChargePeriodStart: "2026-07-01T00:00:00.000Z",
    ChargePeriodEnd: "2026-07-02T00:00:00.000Z",
    BillingCurrency: "USD",
    ServiceName: "Workflow",
    SkuPriceId: "sku_price_opaque",
    SkuName: "Data Written",
    ConsumedQuantity: "0.123456789012345678",
    ConsumedUnit: "GB-month",
    ListCost: "0.061728394506172839",
    BilledCost: "0.061728394506172839",
    EffectiveCost: "0.050000000000000001",
  });

  assert.equal(normalized.skuId, "sku_price_opaque");
  assert.equal(normalized.skuName, "Data Written");
  assert.equal(normalized.usageQuantity, "0.123456789012345678");
  assert.equal(normalized.billedCostUsd, "0.061728394506172839");
  assert.equal(normalized.effectiveCostUsd, "0.050000000000000001");
});

test("FOCUS upserts are chunked and deduplicate conflicts globally", () => {
  const rows = Array.from({ length: 501 }, (_, index) => ({
    sourceChargeKey: `charge-${index}`,
    value: index,
  }));

  assert.deepEqual(
    focusUpsertBatches(rows).map((batch) => batch.length),
    [250, 250, 1],
  );

  const [batch] = focusUpsertBatches([
    { sourceChargeKey: "duplicate", value: 1 },
    { sourceChargeKey: "duplicate", value: 2 },
  ]);
  assert.deepEqual(batch, [{ sourceChargeKey: "duplicate", value: 2 }]);

  const crossBatchDuplicate = [
    ...Array.from({ length: 251 }, (_, index) => ({
      sourceChargeKey: `cross-batch-${index}`,
      value: index,
    })),
    { sourceChargeKey: "cross-batch-0", value: 999 },
  ];
  const crossBatchResult = focusUpsertBatches(crossBatchDuplicate);
  assert.deepEqual(crossBatchResult.map((items) => items.length), [250, 1]);
  assert.equal(crossBatchResult.flat()[0]?.value, 999);
});

test("FOCUS project matching requires an exact ID or a delimited token", () => {
  const projectId = "prj_abc123";

  assert.equal(
    belongsToProjectOrSharedCharge({ x_Vercel_ProjectId: projectId }, projectId),
    true,
  );
  assert.equal(
    belongsToProjectOrSharedCharge(
      { ResourceId: `project/${projectId}/sandbox/sbx_1` },
      projectId,
    ),
    true,
  );
  assert.equal(
    belongsToProjectOrSharedCharge(
      { Tags: { project: `owner:${projectId}` } },
      projectId,
    ),
    true,
  );
  assert.equal(
    belongsToProjectOrSharedCharge(
      { x_Vercel_ProjectId: `${projectId}extra` },
      projectId,
    ),
    false,
  );
  assert.equal(
    belongsToProjectOrSharedCharge(
      { ResourceId: `project/${projectId}extra/sandbox/sbx_1` },
      projectId,
    ),
    false,
  );
  assert.equal(
    belongsToProjectOrSharedCharge({ ChargeCategory: "credit" }, projectId),
    true,
  );
  assert.equal(
    belongsToProjectOrSharedCharge(
      {
        x_Vercel_ProjectId: "prj_other",
        ChargeCategory: "credit",
      },
      projectId,
    ),
    false,
  );
  assert.equal(
    belongsToProjectOrSharedCharge(
      {
        Tags: { ProjectId: "prj_other" },
        ChargeCategory: "adjustment",
      },
      projectId,
    ),
    false,
  );
  assert.equal(
    belongsToProjectOrSharedCharge(
      {
        ResourceId: "project/prj_other/sandbox/sbx_1",
        ChargeCategory: "credit",
      },
      projectId,
    ),
    false,
  );
  assert.equal(
    belongsToProjectOrSharedCharge({ ChargeCategory: "usage" }, projectId),
    false,
  );
});

test("FOCUS NDJSON parsing warns and continues after malformed records", async () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('{"ChargeId":"valid-1"}\n{"Charge'));
      controller.enqueue(encoder.encode('Id":\n{"ChargeId":"valid-2"}\n42\n{"ChargeId":'));
      controller.close();
    },
  });
  const parsed = [];

  for await (const line of parseFocusJsonLines(stream)) {
    parsed.push(line);
  }

  assert.deepEqual(
    parsed.filter((line) => line.kind === "row").map((line) => line.row.ChargeId),
    ["valid-1", "valid-2"],
  );
  assert.deepEqual(
    parsed.filter((line) => line.kind === "warning"),
    [
      { kind: "warning", lineNumber: 2, message: "Malformed JSON record" },
      { kind: "warning", lineNumber: 4, message: "Expected a JSON object" },
      { kind: "warning", lineNumber: 5, message: "Malformed JSON record" },
    ],
  );
});

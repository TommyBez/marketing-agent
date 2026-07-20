import assert from "node:assert/strict";
import test from "node:test";
import { focusUpsertBatches, normalizeFocusRow } from "./focus";

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

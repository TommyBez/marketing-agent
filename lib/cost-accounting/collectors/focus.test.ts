import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFocusRow } from "./focus";

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

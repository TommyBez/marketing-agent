import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ledgerAdjustmentToTarget } from "./ledger-math";

describe("append-only ledger projection", () => {
  it("returns to an earlier target without losing the A-B-A correction", () => {
    let ledgerTotal = BigInt(0);
    const targetA = BigInt(-1_000_000);
    const targetB = BigInt(-1_750_000);

    for (const target of [targetA, targetB, targetA]) {
      const adjustment = ledgerAdjustmentToTarget(ledgerTotal, target);
      ledgerTotal += adjustment;
      assert.equal(ledgerTotal, target);
    }
  });

  it("is a no-op when the materialized ledger already equals the target", () => {
    assert.equal(
      ledgerAdjustmentToTarget(BigInt(-25_000), BigInt(-25_000)),
      BigInt(0),
    );
  });
});

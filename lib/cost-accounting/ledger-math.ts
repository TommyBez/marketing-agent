export function ledgerAdjustmentToTarget(
  priorLedgerAmount: bigint,
  targetLedgerAmount: bigint,
): bigint {
  return targetLedgerAmount - priorLedgerAmount;
}

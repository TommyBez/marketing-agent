export const DISCRETE_METRICS: ReadonlySet<string> = new Set([
  "creation",
  "event",
]);

export type ProratableUsageFact = {
  metric: string;
  periodStart: Date;
  periodEnd: Date | null;
  observedAt: Date;
};

export function overlapShare(
  fact: ProratableUsageFact,
  windowStart: Date,
  windowEnd: Date,
): number {
  if (DISCRETE_METRICS.has(fact.metric)) {
    return fact.periodStart >= windowStart && fact.periodStart < windowEnd
      ? 1
      : 0;
  }

  // Pending facts have no periodEnd; their measured interval ends at observedAt.
  const factEnd = fact.periodEnd ?? fact.observedAt;
  const durationMs = factEnd.getTime() - fact.periodStart.getTime();
  if (!(durationMs > 0)) return 0;

  const overlapStartMs = Math.max(
    fact.periodStart.getTime(),
    windowStart.getTime(),
  );
  const overlapEndMs = Math.min(factEnd.getTime(), windowEnd.getTime());
  const overlapMs = Math.max(0, overlapEndMs - overlapStartMs);

  return Math.min(1, overlapMs / durationMs);
}

import {
  and,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  or,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  infrastructureCostAllocations,
  platformUsageFacts,
  vercelBillingCharges,
} from "@/lib/db/schema";
import { usdDecimal } from "@/lib/cost-accounting/money";

export type AllocatableService =
  | "sandbox"
  | "workflow"
  | "functions"
  | "queues";

export async function allocateFocusCharges(
  reconciliationRunId: string,
): Promise<{
  charges: number;
  allocations: number;
  sharedCharges: number;
  unmappedCharges: number;
}> {
  const charges = await db
    .select()
    .from(vercelBillingCharges)
    .where(eq(vercelBillingCharges.reconciliationRunId, reconciliationRunId));
  let allocations = 0;
  let sharedCharges = 0;
  let unmappedCharges = 0;
  const plans: Array<{
    charge: (typeof charges)[number];
    service: AllocatableService | null;
    metrics: string[];
    weights: Array<{
      workspaceId: string | null;
      usageFactId: string | null;
      weight: number;
    }>;
  }> = [];

  for (const charge of charges) {
    const service = normalizeService(charge.serviceName, charge.skuName);
    const metrics = metricsForCharge(service, charge);
    if (!service || metrics.length === 0) {
      unmappedCharges += 1;
    }
    const facts = service && metrics.length > 0
      ? await db
          .select({
            id: platformUsageFacts.id,
            workspaceId: platformUsageFacts.workspaceId,
            metric: platformUsageFacts.metric,
            periodStart: platformUsageFacts.periodStart,
            periodEnd: platformUsageFacts.periodEnd,
            observedAt: platformUsageFacts.observedAt,
            standardCostUsd: platformUsageFacts.standardCostUsd,
          })
          .from(platformUsageFacts)
          .where(
            and(
              eq(platformUsageFacts.service, service),
              inArray(platformUsageFacts.metric, metrics),
              lt(platformUsageFacts.periodStart, charge.chargePeriodEnd),
              or(
                isNull(platformUsageFacts.periodEnd),
                gt(platformUsageFacts.periodEnd, charge.chargePeriodStart),
              ),
            ),
          )
      : [];

    const weights = weightsByWorkspace(
      facts,
      charge.chargePeriodStart,
      charge.chargePeriodEnd,
    );
    if (weights.length === 0) {
      weights.push({ workspaceId: null, usageFactId: null, weight: 1 });
      sharedCharges += 1;
    }

    plans.push({ charge, service, metrics, weights });
    allocations += weights.length;
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(infrastructureCostAllocations)
      .where(
        eq(
          infrastructureCostAllocations.reconciliationRunId,
          reconciliationRunId,
        ),
      );

    for (const { charge, service, metrics, weights } of plans) {
      for (const weighted of weights) {
        const scope = weighted.workspaceId ? "workspace" : "platform_shared";
        const allocationKey = [
          reconciliationRunId,
          charge.sourceChargeKey,
          weighted.workspaceId ?? "platform_shared",
        ].join(":");
        const billed = Number(charge.billedCostUsd) * weighted.weight;
        const effective = Number(charge.effectiveCostUsd) * weighted.weight;

        await tx
          .insert(infrastructureCostAllocations)
          .values({
            reconciliationRunId,
            billingChargeId: charge.id,
            usageFactId: weighted.usageFactId,
            allocationKey,
            scope,
            workspaceId: weighted.workspaceId,
            method:
              weights.length === 1 && weighted.workspaceId ? "direct" :
                weighted.workspaceId ? "weighted" : "shared",
            weight: weighted.weight.toFixed(12),
            billedCostUsd: usdDecimal(billed),
            effectiveCostUsd: usdDecimal(effective),
            periodStart: charge.chargePeriodStart,
            periodEnd: charge.chargePeriodEnd,
            metadata: {
              service: service ?? "unclassified",
              serviceName: charge.serviceName,
              skuName: charge.skuName,
              metrics,
            },
          })
          .onConflictDoUpdate({
            target: infrastructureCostAllocations.allocationKey,
            set: {
              weight: weighted.weight.toFixed(12),
              billedCostUsd: usdDecimal(billed),
              effectiveCostUsd: usdDecimal(effective),
              metadata: {
                service: service ?? "unclassified",
                serviceName: charge.serviceName,
                skuName: charge.skuName,
                metrics,
              },
            },
          });
      }
    }
  });

  return {
    charges: charges.length,
    allocations,
    sharedCharges,
    unmappedCharges,
  };
}

function weightsByWorkspace(
  facts: Array<{
    id: string;
    workspaceId: string | null;
    metric: string;
    periodStart: Date;
    periodEnd: Date | null;
    observedAt: Date;
    standardCostUsd: string | null;
  }>,
  chargePeriodStart: Date,
  chargePeriodEnd: Date,
): Array<{ workspaceId: string | null; usageFactId: string | null; weight: number }> {
  const totals = new Map<
    string,
    { workspaceId: string | null; usageFactId: string | null; cost: number }
  >();
  let totalCost = 0;

  for (const fact of facts) {
    const cost = costInsideChargePeriod(
      fact,
      chargePeriodStart,
      chargePeriodEnd,
    );
    if (!(cost > 0)) continue;
    const key = fact.workspaceId ?? "platform_shared";
    const existing = totals.get(key);
    if (existing) {
      existing.cost += cost;
      existing.usageFactId = null;
    } else {
      totals.set(key, {
        workspaceId: fact.workspaceId,
        usageFactId: fact.id,
        cost,
      });
    }
    totalCost += cost;
  }

  if (!(totalCost > 0)) return [];
  return [...totals.values()].map((entry) => ({
    workspaceId: entry.workspaceId,
    usageFactId: entry.usageFactId,
    weight: entry.cost / totalCost,
  }));
}

const DISCRETE_METRICS = new Set(["creation", "event"]);

function costInsideChargePeriod(
  fact: {
    metric: string;
    periodStart: Date;
    periodEnd: Date | null;
    observedAt: Date;
    standardCostUsd: string | null;
  },
  chargePeriodStart: Date,
  chargePeriodEnd: Date,
): number {
  const cost = Number(fact.standardCostUsd ?? 0);
  if (!(cost > 0)) return 0;

  if (DISCRETE_METRICS.has(fact.metric)) {
    return fact.periodStart >= chargePeriodStart &&
      fact.periodStart < chargePeriodEnd
      ? cost
      : 0;
  }

  // Pending facts have no periodEnd, but their quantity and standard cost are
  // measured through observedAt. Prorating the measured interval prevents a
  // long-lived resource's full lifetime cost from weighting every daily
  // billing charge it happens to overlap.
  const factEnd = fact.periodEnd ?? fact.observedAt;
  const factDurationMs = factEnd.getTime() - fact.periodStart.getTime();
  if (!(factDurationMs > 0)) return 0;

  const overlapStartMs = Math.max(
    fact.periodStart.getTime(),
    chargePeriodStart.getTime(),
  );
  const overlapEndMs = Math.min(
    factEnd.getTime(),
    chargePeriodEnd.getTime(),
  );
  const overlapMs = Math.max(0, overlapEndMs - overlapStartMs);

  return cost * Math.min(1, overlapMs / factDurationMs);
}

function normalizeService(
  serviceName: string,
  skuName: string | null,
): AllocatableService | null {
  const value = `${serviceName} ${skuName ?? ""}`.toLowerCase();
  if (value.includes("sandbox")) return "sandbox";
  if (value.includes("workflow")) return "workflow";
  if (value.includes("queue")) return "queues";
  if (value.includes("function") || value.includes("fluid compute")) {
    return "functions";
  }
  return null;
}

export function metricsForCharge(
  service: AllocatableService | null,
  charge: {
    skuName: string | null;
    serviceName: string;
    usageUnit: string | null;
    chargeCategory: string | null;
  },
): string[] {
  const category = charge.chargeCategory?.toLowerCase() ?? "";
  if (category === "credit" || category === "adjustment") return [];

  const value = [charge.serviceName, charge.skuName, charge.usageUnit]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (service === "sandbox") {
    if (value.includes("snapshot")) return ["snapshot_storage"];
    if (value.includes("active cpu") || value.includes("cpu-hour")) {
      return ["active_cpu"];
    }
    if (value.includes("memory") || value.includes("gb-hour")) {
      return ["provisioned_memory"];
    }
    if (
      value.includes("transfer") ||
      value.includes("network") ||
      value.includes("egress") ||
      value.includes("ingress")
    ) {
      return ["data_transfer"];
    }
    if (value.includes("creation")) return ["creation"];
  }

  if (service === "workflow") {
    if (value.includes("event")) return ["event"];
    // Data Written and Data Retained use similar storage units, but the read
    // API exposes only retained bytes. Never use retention as a proxy for the
    // distinct Data Written FOCUS SKU.
    if (value.includes("written") || value.includes("write")) return [];
    if (value.includes("retained") || value.includes("gb-month")) {
      return ["data_retained"];
    }
    // The provider API currently exposes retained bytes but not the distinct
    // Data Written counter. That SKU intentionally stays platform_shared.
    return [];
  }

  return [];
}

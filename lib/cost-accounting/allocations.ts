import {
  and,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  infrastructureCostAllocations,
  platformUsageFacts,
  vercelBillingCharges,
} from "@/lib/db/schema";
import { usdDecimal } from "@/lib/cost-accounting/money";
import { overlapShare } from "@/lib/cost-accounting/usage-proration";

export type AllocatableService =
  | "sandbox"
  | "workflow"
  | "functions"
  | "queues";

type AllocationWeight = {
  workspaceId: string | null;
  usageFactId: string | null;
  weight: number;
};

const ALLOCATION_WRITE_BATCH_SIZE = 250;

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export async function allocateFocusCharges(
  reconciliationRunId: string,
): Promise<{
  charges: number;
  allocations: number;
  sharedCharges: number;
  unmappedCharges: number;
}> {
  const charges = await db
    .select({
      id: vercelBillingCharges.id,
      sourceChargeKey: vercelBillingCharges.sourceChargeKey,
      serviceName: vercelBillingCharges.serviceName,
      skuName: vercelBillingCharges.skuName,
      chargeCategory: vercelBillingCharges.chargeCategory,
      chargePeriodStart: vercelBillingCharges.chargePeriodStart,
      chargePeriodEnd: vercelBillingCharges.chargePeriodEnd,
      usageUnit: vercelBillingCharges.usageUnit,
      billedCostUsd: vercelBillingCharges.billedCostUsd,
      effectiveCostUsd: vercelBillingCharges.effectiveCostUsd,
    })
    .from(vercelBillingCharges)
    .where(eq(vercelBillingCharges.reconciliationRunId, reconciliationRunId));
  let allocations = 0;
  let sharedCharges = 0;
  let unmappedCharges = 0;

  const chargeDescriptors = charges.map((charge) => {
    const service = normalizeService(charge.serviceName, charge.skuName);
    const metrics = metricsForCharge(service, charge);
    if (!service || metrics.length === 0) {
      unmappedCharges += 1;
    }
    return { charge, service, metrics };
  });

  const mappedDescriptors = chargeDescriptors.filter(
    (
      descriptor,
    ): descriptor is (typeof chargeDescriptors)[number] & {
      service: AllocatableService;
    } =>
      descriptor.service !== null && descriptor.metrics.length > 0,
  );
  const services = [...new Set(mappedDescriptors.map(({ service }) => service))];
  const metrics = [
    ...new Set(mappedDescriptors.flatMap((descriptor) => descriptor.metrics)),
  ];
  const earliestChargeStart = mappedDescriptors.length > 0
    ? new Date(
        Math.min(
          ...mappedDescriptors.map(({ charge }) =>
            charge.chargePeriodStart.getTime()
          ),
        ),
      )
    : null;
  const latestChargeEnd = mappedDescriptors.length > 0
    ? new Date(
        Math.max(
          ...mappedDescriptors.map(({ charge }) =>
            charge.chargePeriodEnd.getTime()
          ),
        ),
      )
    : null;

  const facts = earliestChargeStart && latestChargeEnd
    ? await db
        .select({
          id: platformUsageFacts.id,
          service: platformUsageFacts.service,
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
            inArray(platformUsageFacts.service, services),
            inArray(platformUsageFacts.metric, metrics),
            lt(platformUsageFacts.periodStart, latestChargeEnd),
            or(
              isNull(platformUsageFacts.periodEnd),
              gt(platformUsageFacts.periodEnd, earliestChargeStart),
            ),
          ),
        )
    : [];

  const factsByServiceMetric = new Map<
    string,
    (typeof facts)[number][]
  >();
  for (const fact of facts) {
    const key = serviceMetricKey(fact.service, fact.metric);
    const bucket = factsByServiceMetric.get(key);
    if (bucket) {
      bucket.push(fact);
    } else {
      factsByServiceMetric.set(key, [fact]);
    }
  }

  const weightCache = new Map<string, AllocationWeight[]>();
  const plans = chargeDescriptors.map(({ charge, service, metrics }) => {
    let computedWeights: AllocationWeight[] = [];
    if (service && metrics.length > 0) {
      const cacheKey = JSON.stringify([
        service,
        metrics,
        charge.chargePeriodStart.toISOString(),
        charge.chargePeriodEnd.toISOString(),
      ]);
      const cached = weightCache.get(cacheKey);
      if (cached) {
        computedWeights = cached;
      } else {
        const matchingFacts = metrics.flatMap(
          (metric) =>
            factsByServiceMetric.get(serviceMetricKey(service, metric)) ?? [],
        );
        computedWeights = weightsByWorkspace(
          matchingFacts,
          charge.chargePeriodStart,
          charge.chargePeriodEnd,
        );
        weightCache.set(cacheKey, computedWeights);
      }
    }

    const weights = computedWeights.length > 0
      ? computedWeights
      : [{ workspaceId: null, usageFactId: null, weight: 1 }];
    if (computedWeights.length === 0) sharedCharges += 1;
    allocations += weights.length;
    return { charge, service, metrics, weights };
  });

  const allocationRows: Array<
    typeof infrastructureCostAllocations.$inferInsert
  > = [];
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

      allocationRows.push({
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
      });
    }
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

    for (const batch of chunks(allocationRows, ALLOCATION_WRITE_BATCH_SIZE)) {
      await tx
        .insert(infrastructureCostAllocations)
        .values(batch)
        .onConflictDoUpdate({
          target: infrastructureCostAllocations.allocationKey,
          set: {
            weight: sql`excluded."weight"`,
            billedCostUsd: sql`excluded."billedCostUsd"`,
            effectiveCostUsd: sql`excluded."effectiveCostUsd"`,
            metadata: sql`excluded."metadata"`,
          },
        });
    }
  });

  return {
    charges: charges.length,
    allocations,
    sharedCharges,
    unmappedCharges,
  };
}

function serviceMetricKey(service: string, metric: string): string {
  return `${service}\0${metric}`;
}

export function weightsByWorkspace(
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
): AllocationWeight[] {
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

  return cost * overlapShare(fact, chargePeriodStart, chargePeriodEnd);
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

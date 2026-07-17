import {
  and,
  desc,
  eq,
  gt,
  gte,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  aiCreditAccounts,
  aiCreditLedgerEntries,
  aiModelCalls,
  costReconciliationRuns,
  pilotCostReports,
  platformUsageFacts,
} from "@/lib/db/schema";
import {
  microusdToUsd,
  pricingFloorForMargin,
} from "@/lib/cost-accounting/money";
import {
  previousFullUtcWeek,
  type TimeWindow,
  utcDateKey,
} from "@/lib/cost-accounting/time";

type WorkspaceSummary = {
  workspaceId: string;
  modelCostUsd: number;
  creditsDebitedUsd: number;
  balanceUsd?: number;
  sandboxStandardCostUsd: number;
  workflowStandardCostUsd: number;
  billedInfrastructureCostUsd: number;
  effectiveInfrastructureCostUsd: number;
};

type ActualAllocationRow = {
  workspaceId: string | null;
  scope: string;
  service: string | null;
  billedCostUsd: string;
  effectiveCostUsd: string;
};

export async function generatePilotCostReports(
  now = new Date(),
): Promise<Array<Record<string, unknown>>> {
  const [latestRun] = await db
    .select({ id: costReconciliationRuns.id })
    .from(costReconciliationRuns)
    .where(
      or(
        eq(costReconciliationRuns.status, "complete"),
        eq(costReconciliationRuns.status, "partial"),
      ),
    )
    .orderBy(desc(costReconciliationRuns.completedAt))
    .limit(1);

  if (!latestRun) {
    throw new Error("A completed or partial reconciliation run is required");
  }

  const reports: Array<Record<string, unknown>> = [];
  for (const weeksAgo of [1, 2]) {
    const period = previousFullUtcWeek(now, weeksAgo);
    const report = await buildPilotCostReport(period, now);
    const complete = now.getTime() >= period.end.getTime() + 72 * 60 * 60 * 1_000;
    const reportKey = `pilot-cost:v1:${utcDateKey(period.start)}:${utcDateKey(period.end)}`;

    await db
      .insert(pilotCostReports)
      .values({
        reportKey,
        generatedFromRunId: latestRun.id,
        periodStart: period.start,
        periodEnd: period.end,
        status: complete ? "complete" : "provisional",
        report,
        finalizedAt: complete ? now : null,
      })
      .onConflictDoUpdate({
        target: pilotCostReports.reportKey,
        set: {
          generatedFromRunId: latestRun.id,
          status: complete ? "complete" : "provisional",
          version: sql`${pilotCostReports.version} + 1`,
          report,
          generatedAt: now,
          finalizedAt: complete ? now : null,
          updatedAt: now,
        },
      });

    console.info(JSON.stringify({
      event: "pilot_cost_report_generated",
      reportKey,
      status: complete ? "complete" : "provisional",
      report,
    }));
    reports.push(report);
  }

  return reports;
}

async function buildPilotCostReport(
  period: TimeWindow,
  generatedAt: Date,
): Promise<Record<string, unknown>> {
  const [calls, ledger, balances, facts, actualAllocations] = await Promise.all([
    db
      .select({
        workspaceId: aiModelCalls.workspaceId,
        userId: aiModelCalls.userId,
        model: aiModelCalls.modelRequested,
        callKind: aiModelCalls.callKind,
        costUsd: sql<string>`coalesce(${aiModelCalls.reconciledCostUsd}, ${aiModelCalls.provisionalCostUsd}, 0)`,
        inputTokens: aiModelCalls.inputTokens,
        outputTokens: aiModelCalls.outputTokens,
      })
      .from(aiModelCalls)
      .where(
        and(
          gte(aiModelCalls.startedAt, period.start),
          lt(aiModelCalls.startedAt, period.end),
        ),
      ),
    db
      .select({
        workspaceId: aiCreditLedgerEntries.workspaceId,
        userId: aiCreditLedgerEntries.userId,
        modelCallId: aiCreditLedgerEntries.modelCallId,
        kind: aiCreditLedgerEntries.kind,
        amountMicrousd: aiCreditLedgerEntries.amountMicrousd,
      })
      .from(aiCreditLedgerEntries)
      .where(
        and(
          gte(aiCreditLedgerEntries.occurredAt, period.start),
          lt(aiCreditLedgerEntries.occurredAt, period.end),
        ),
      ),
    db
      .select({
        workspaceId: aiCreditAccounts.workspaceId,
        balanceMicrousd: aiCreditAccounts.balanceMicrousd,
      })
      .from(aiCreditAccounts),
    db
      .select({
        workspaceId: platformUsageFacts.workspaceId,
        service: platformUsageFacts.service,
        quality: platformUsageFacts.quality,
        status: platformUsageFacts.status,
        metric: platformUsageFacts.metric,
        quantity: platformUsageFacts.quantity,
        unit: platformUsageFacts.unit,
        standardCostUsd: platformUsageFacts.standardCostUsd,
        rootSessionId: platformUsageFacts.rootSessionId,
        periodStart: platformUsageFacts.periodStart,
        periodEnd: platformUsageFacts.periodEnd,
        observedAt: platformUsageFacts.observedAt,
      })
      .from(platformUsageFacts)
      .where(
        and(
          lt(platformUsageFacts.periodStart, period.end),
          or(
            isNull(platformUsageFacts.periodEnd),
            gt(platformUsageFacts.periodEnd, period.start),
          ),
        ),
      ),
    loadLatestActualAllocations(period),
  ]);

  const workspaces = new Map<string, WorkspaceSummary>();
  const users = new Map<
    string,
    { workspaceId: string; userId: string; modelCostUsd: number; calls: number }
  >();
  const models = new Map<
    string,
    { model: string; costUsd: number; calls: number; inputTokens: number; outputTokens: number }
  >();
  const callKinds = new Map<
    string,
    { callKind: string; costUsd: number; calls: number }
  >();

  const workspace = (workspaceId: string) => {
    const existing = workspaces.get(workspaceId);
    if (existing) return existing;
    const created: WorkspaceSummary = {
      workspaceId,
      modelCostUsd: 0,
      creditsDebitedUsd: 0,
      sandboxStandardCostUsd: 0,
      workflowStandardCostUsd: 0,
      billedInfrastructureCostUsd: 0,
      effectiveInfrastructureCostUsd: 0,
    };
    workspaces.set(workspaceId, created);
    return created;
  };

  for (const call of calls) {
    const costUsd = Number(call.costUsd);
    workspace(call.workspaceId).modelCostUsd += costUsd;
    const userKey = `${call.workspaceId}:${call.userId}`;
    const user = users.get(userKey) ?? {
      workspaceId: call.workspaceId,
      userId: call.userId,
      modelCostUsd: 0,
      calls: 0,
    };
    user.modelCostUsd += costUsd;
    user.calls += 1;
    users.set(userKey, user);

    const model = models.get(call.model) ?? {
      model: call.model,
      costUsd: 0,
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
    model.costUsd += costUsd;
    model.calls += 1;
    model.inputTokens += Number(call.inputTokens ?? 0);
    model.outputTokens += Number(call.outputTokens ?? 0);
    models.set(call.model, model);

    const callKind = callKinds.get(call.callKind) ?? {
      callKind: call.callKind,
      costUsd: 0,
      calls: 0,
    };
    callKind.costUsd += costUsd;
    callKind.calls += 1;
    callKinds.set(call.callKind, callKind);
  }

  for (const entry of ledger) {
    if (entry.kind !== "usage" && entry.kind !== "reconciliation_adjustment") {
      continue;
    }
    const costUsd = -microusdToUsd(entry.amountMicrousd);
    const targetWorkspace = workspace(entry.workspaceId);
    targetWorkspace.creditsDebitedUsd += costUsd;

    if (!entry.modelCallId && entry.kind === "reconciliation_adjustment") {
      targetWorkspace.modelCostUsd += costUsd;
      if (entry.userId) {
        const userKey = `${entry.workspaceId}:${entry.userId}`;
        const user = users.get(userKey) ?? {
          workspaceId: entry.workspaceId,
          userId: entry.userId,
          modelCostUsd: 0,
          calls: 0,
        };
        user.modelCostUsd += costUsd;
        users.set(userKey, user);
      }
    }
  }

  for (const balance of balances) {
    workspace(balance.workspaceId).balanceUsd = microusdToUsd(
      balance.balanceMicrousd,
    );
  }

  const quality = new Map<string, { facts: number; standardCostUsd: number }>();
  const serviceMetrics = new Map<
    string,
    { quantity: number; standardCostUsd: number; units: Set<string> }
  >();
  const rootSessions = new Set<string>();
  let pendingFacts = 0;
  let standardInfrastructureCostUsd = 0;
  let sharedStandardInfrastructureCostUsd = 0;

  for (const fact of facts) {
    const periodShare = usageFactShareInsidePeriod(fact, period);
    if (!(periodShare > 0)) continue;
    const costUsd = Number(fact.standardCostUsd ?? 0) * periodShare;
    standardInfrastructureCostUsd += costUsd;
    if (fact.rootSessionId) rootSessions.add(fact.rootSessionId);
    if (fact.status === "pending") pendingFacts += 1;
    const qualityRow = quality.get(fact.quality) ?? { facts: 0, standardCostUsd: 0 };
    qualityRow.facts += 1;
    qualityRow.standardCostUsd += costUsd;
    quality.set(fact.quality, qualityRow);

    const metricKey = `${fact.service}:${fact.metric}`;
    const metric = serviceMetrics.get(metricKey) ?? {
      quantity: 0,
      standardCostUsd: 0,
      units: new Set<string>(),
    };
    metric.quantity += Number(fact.quantity ?? 0) * periodShare;
    metric.standardCostUsd += costUsd;
    metric.units.add(fact.unit);
    serviceMetrics.set(metricKey, metric);

    if (!fact.workspaceId) {
      sharedStandardInfrastructureCostUsd += costUsd;
    } else if (fact.service === "sandbox") {
      workspace(fact.workspaceId).sandboxStandardCostUsd += costUsd;
    } else if (fact.service === "workflow") {
      workspace(fact.workspaceId).workflowStandardCostUsd += costUsd;
    }
  }

  let billedInfrastructureCostUsd = 0;
  let effectiveInfrastructureCostUsd = 0;
  let sharedBilledCostUsd = 0;
  let sharedEffectiveCostUsd = 0;
  let unclassifiedBilledCostUsd = 0;
  let unclassifiedEffectiveCostUsd = 0;
  const actualByService = new Map<
    string,
    { billedCostUsd: number; effectiveCostUsd: number }
  >();

  for (const allocation of actualAllocations) {
    const billed = Number(allocation.billedCostUsd);
    const effective = Number(allocation.effectiveCostUsd);
    const service = allocation.service ?? "unclassified";
    const actual = actualByService.get(service) ?? {
      billedCostUsd: 0,
      effectiveCostUsd: 0,
    };
    actual.billedCostUsd += billed;
    actual.effectiveCostUsd += effective;
    actualByService.set(service, actual);

    if (!INFRASTRUCTURE_SERVICES.has(service)) {
      unclassifiedBilledCostUsd += billed;
      unclassifiedEffectiveCostUsd += effective;
      continue;
    }

    billedInfrastructureCostUsd += billed;
    effectiveInfrastructureCostUsd += effective;

    if (!allocation.workspaceId || allocation.scope === "platform_shared") {
      sharedBilledCostUsd += billed;
      sharedEffectiveCostUsd += effective;
    } else {
      const target = workspace(allocation.workspaceId);
      target.billedInfrastructureCostUsd += billed;
      target.effectiveInfrastructureCostUsd += effective;
    }
  }

  const modelCostUsd = [...workspaces.values()].reduce(
    (total, row) => total + row.modelCostUsd,
    0,
  );
  const activeWorkspaceCount = [...workspaces.values()].filter(
    (row) =>
      row.modelCostUsd > 0 ||
      row.sandboxStandardCostUsd > 0 ||
      row.workflowStandardCostUsd > 0,
  ).length;
  const standardPricingBasisUsd = modelCostUsd + standardInfrastructureCostUsd;
  const billedPricingBasisUsd = modelCostUsd + billedInfrastructureCostUsd;
  const effectivePricingBasisUsd = modelCostUsd + effectiveInfrastructureCostUsd;

  return {
    period: {
      start: period.start.toISOString(),
      end: period.end.toISOString(),
      generatedAt: generatedAt.toISOString(),
    },
    totals: {
      activeWorkspaceCount,
      modelCalls: calls.length,
      modelCostUsd,
      creditsDebitedUsd: [...workspaces.values()].reduce(
        (total, row) => total + row.creditsDebitedUsd,
        0,
      ),
      standardInfrastructureCostUsd,
      billedInfrastructureCostUsd,
      effectiveInfrastructureCostUsd,
      sharedStandardInfrastructureCostUsd,
      sharedBilledCostUsd,
      sharedEffectiveCostUsd,
      unclassifiedBilledCostUsd,
      unclassifiedEffectiveCostUsd,
      residualBilledCostUsd: sharedBilledCostUsd,
      pendingFacts,
      platformCogsToModelCostRatio:
        modelCostUsd > 0 ? standardInfrastructureCostUsd / modelCostUsd : null,
    },
    workspaces: [...workspaces.values()].sort(
      (left, right) => right.modelCostUsd - left.modelCostUsd,
    ),
    users: [...users.values()].sort(
      (left, right) => right.modelCostUsd - left.modelCostUsd,
    ),
    models: [...models.values()].sort(
      (left, right) => right.costUsd - left.costUsd,
    ),
    callKinds: [...callKinds.values()].sort(
      (left, right) => right.costUsd - left.costUsd,
    ),
    infrastructure: {
      standardByMetric: [...serviceMetrics.entries()].map(([key, value]) => ({
        key,
        quantity: value.quantity,
        units: [...value.units],
        standardCostUsd: value.standardCostUsd,
      })),
      actualByService: [...actualByService.entries()].map(([service, value]) => ({
        service,
        ...value,
      })),
      standardCostPerRootSessionUsd:
        rootSessions.size > 0
          ? standardInfrastructureCostUsd / rootSessions.size
          : null,
      quality: [...quality.entries()].map(([measurementQuality, value]) => ({
        measurementQuality,
        ...value,
        standardCostShare:
          standardInfrastructureCostUsd > 0
            ? value.standardCostUsd / standardInfrastructureCostUsd
            : null,
      })),
    },
    pricingSimulation: {
      recommendedBasis: "standardMarginal",
      standardMarginal: pricingScenario(
        "model cost plus public-rate infrastructure standard cost",
        standardPricingBasisUsd,
        activeWorkspaceCount,
      ),
      actualBilled: pricingScenario(
        "model cost plus project-attributed billed infrastructure cost",
        billedPricingBasisUsd,
        activeWorkspaceCount,
      ),
      actualEffective: pricingScenario(
        "model cost plus project-attributed effective infrastructure cost",
        effectivePricingBasisUsd,
        activeWorkspaceCount,
      ),
    },
  };
}

async function loadLatestActualAllocations(
  period: TimeWindow,
): Promise<ActualAllocationRow[]> {
  const result = await db.execute(sql`
    with latest_charges as (
      select distinct on (charge."sourceChargeKey") charge.id
      from "vercel_billing_charges" charge
      inner join "infrastructure_cost_allocations" existing_allocation
        on existing_allocation."billingChargeId" = charge.id
      where charge."chargePeriodStart" < ${period.end}
        and charge."chargePeriodEnd" >= ${period.start}
      order by charge."sourceChargeKey", charge."importedAt" desc
    )
    select
      allocation."workspaceId" as "workspaceId",
      allocation.scope,
      allocation.metadata ->> 'service' as service,
      sum(allocation."billedCostUsd" * (
        extract(epoch from least(allocation."periodEnd", ${period.end}) - greatest(allocation."periodStart", ${period.start}))
        / nullif(extract(epoch from allocation."periodEnd" - allocation."periodStart"), 0)
      ))::text as "billedCostUsd",
      sum(allocation."effectiveCostUsd" * (
        extract(epoch from least(allocation."periodEnd", ${period.end}) - greatest(allocation."periodStart", ${period.start}))
        / nullif(extract(epoch from allocation."periodEnd" - allocation."periodStart"), 0)
      ))::text as "effectiveCostUsd"
    from "infrastructure_cost_allocations" allocation
    inner join latest_charges on latest_charges.id = allocation."billingChargeId"
    group by allocation."workspaceId", allocation.scope, allocation.metadata ->> 'service'
  `);

  return result.rows as ActualAllocationRow[];
}

const INFRASTRUCTURE_SERVICES = new Set([
  "sandbox",
  "workflow",
  "functions",
  "queues",
]);

function pricingScenario(
  basis: string,
  weeklyCostBasisUsd: number,
  activeWorkspaceCount: number,
) {
  const monthlyCostPerActiveWorkspaceUsd = activeWorkspaceCount > 0
    ? (weeklyCostBasisUsd / activeWorkspaceCount) * (365.25 / 12 / 7)
    : 0;

  return {
    basis,
    weeklyCostBasisUsd,
    monthlyCostPerActiveWorkspaceUsd,
    floors: [0.7, 0.8, 0.85].map((targetGrossMargin) => ({
      targetGrossMargin,
      monthlyPricePerActiveWorkspaceUsd: pricingFloorForMargin(
        monthlyCostPerActiveWorkspaceUsd,
        targetGrossMargin,
      ),
    })),
  };
}

const DISCRETE_USAGE_METRICS = new Set(["creation", "event"]);

function usageFactShareInsidePeriod(
  fact: {
    metric: string;
    periodStart: Date;
    periodEnd: Date | null;
    observedAt: Date;
  },
  period: TimeWindow,
): number {
  if (DISCRETE_USAGE_METRICS.has(fact.metric)) {
    return fact.periodStart >= period.start && fact.periodStart < period.end
      ? 1
      : 0;
  }

  const factEnd = fact.periodEnd ?? fact.observedAt;
  const durationMs = factEnd.getTime() - fact.periodStart.getTime();
  if (!(durationMs > 0)) return 0;

  const overlapStartMs = Math.max(
    fact.periodStart.getTime(),
    period.start.getTime(),
  );
  const overlapEndMs = Math.min(factEnd.getTime(), period.end.getTime());
  const overlapMs = Math.max(0, overlapEndMs - overlapStartMs);
  return Math.min(1, overlapMs / durationMs);
}

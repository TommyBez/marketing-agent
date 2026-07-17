import { createGateway } from "ai";
import { and, eq, gte, isNotNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiModelCalls, companyProfiles, member } from "@/lib/db/schema";
import {
  reconcileModelCall,
  type ModelCallUsage,
} from "@/lib/cost-accounting/ai-usage";
import { applyGatewaySpendAdjustment } from "@/lib/cost-accounting/credits";
import { gatewayUserIdForIdentity } from "@/lib/cost-accounting/gateway-identity";
import { usdToMicrousd } from "@/lib/cost-accounting/money";
import { addUtcDays, startOfUtcDay, utcDateKey } from "@/lib/cost-accounting/time";
import type { CollectorWindow } from "./types";

type Warning = { operation: string; resourceId?: string; message: string };

export type AiGatewayCollectorResult = {
  service: "ai_gateway";
  status: "complete" | "partial";
  generationsExamined: number;
  generationsReconciled: number;
  unpricedCompletedCalls: number;
  reportRows: number;
  reportedCostUsd: number;
  localCostUsd: number;
  residualCostUsd: number;
  ledgerAdjustmentMicrousd: string;
  warnings: Warning[];
};

export async function collectAiGatewayUsage(input: {
  window: CollectorWindow;
}): Promise<AiGatewayCollectorResult> {
  const apiKey = process.env.AI_GATEWAY_REPORTING_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_REPORTING_KEY is required");
  }

  const gateway = createGateway({
    apiKey,
    teamIdOrSlug: process.env.VERCEL_TEAM_ID,
  });
  const warnings: Warning[] = [];
  const start = startOfUtcDay(input.window.start);
  const requestedEnd = startOfUtcDay(input.window.end);
  const endExclusive = requestedEnd > start
    ? requestedEnd
    : addUtcDays(start, 1);

  const callsWithGeneration = await db
    .select({
      id: aiModelCalls.id,
      gatewayGenerationId: aiModelCalls.gatewayGenerationId,
    })
    .from(aiModelCalls)
    .where(
      and(
        gte(aiModelCalls.startedAt, start),
        lt(aiModelCalls.startedAt, endExclusive),
        isNotNull(aiModelCalls.gatewayGenerationId),
      ),
    );

  let generationsReconciled = 0;
  await mapWithConcurrency(callsWithGeneration, 5, async (call) => {
    if (!call.gatewayGenerationId) return;
    try {
      const info = await gateway.getGenerationInfo({ id: call.gatewayGenerationId });
      const usage: ModelCallUsage = {
        gatewayGenerationId: info.id,
        inputTokens: info.promptTokens,
        outputTokens: info.completionTokens,
        reasoningTokens: info.reasoningTokens,
        cacheReadTokens: info.cachedTokens,
        cacheWriteTokens: info.cacheCreationTokens,
        finishReason: info.finishReason,
        modelServed: info.model,
        provider: info.providerName,
      };

      await reconcileModelCall({
        modelCallId: call.id,
        costUsd: info.totalCost,
        sourceVersion: `gateway-generation:${info.id}:${usdToMicrousd(info.totalCost)}`,
        usage,
      });
      generationsReconciled += 1;
    } catch (error) {
      warnings.push({
        operation: "getGenerationInfo",
        resourceId: call.gatewayGenerationId,
        message: errorMessage(error),
      });
    }
  });

  const reportDays: Date[] = [];
  for (let day = start; day < endExclusive; day = addUtcDays(day, 1)) {
    reportDays.push(day);
  }

  const [dailyReports, localCalls, registeredIdentities] = await Promise.all([
    Promise.all(
      reportDays.map(async (day) => ({
        day,
        report: await gateway.getSpendReport({
          startDate: utcDateKey(day),
          endDate: utcDateKey(day),
          groupBy: "user",
        }),
      })),
    ),
    db
      .select({
        id: aiModelCalls.id,
        workspaceId: aiModelCalls.workspaceId,
        userId: aiModelCalls.userId,
        status: aiModelCalls.status,
        startedAt: aiModelCalls.startedAt,
        rawUsage: aiModelCalls.rawUsage,
        provisionalCostUsd: aiModelCalls.provisionalCostUsd,
        reconciledCostUsd: aiModelCalls.reconciledCostUsd,
      })
      .from(aiModelCalls)
      .where(
        and(
          gte(aiModelCalls.startedAt, start),
          lt(aiModelCalls.startedAt, endExclusive),
        ),
      ),
    db
      .select({
        workspaceId: companyProfiles.id,
        userId: member.userId,
      })
      .from(companyProfiles)
      .innerJoin(
        member,
        eq(member.organizationId, companyProfiles.organizationId),
      ),
  ]);

  const unpricedCompletedCalls = localCalls.filter(
    (call) =>
      call.status === "completed" &&
      call.provisionalCostUsd === null &&
      call.reconciledCostUsd === null,
  );
  if (unpricedCompletedCalls.length > 0) {
    warnings.push({
      operation: "detectUnpricedCompletedCalls",
      message:
        `${unpricedCompletedCalls.length} completed model call(s) still have no direct cost; ` +
        "the user/day spend residual will protect the balance, but model-level attribution needs review",
    });
  }

  const localByGatewayUserAndDay = new Map<
    string,
    { workspaceId: string; userId: string; costUsd: number; ambiguous: boolean }
  >();

  for (const call of localCalls) {
    const gatewayUserId = stringValue(call.rawUsage.gatewayUserId);
    if (!gatewayUserId) continue;

    const costUsd = Number(
      call.reconciledCostUsd ?? call.provisionalCostUsd ?? 0,
    );
    const callDay = utcDateKey(call.startedAt);
    const localKey = `${callDay}:${gatewayUserId}`;
    const existing = localByGatewayUserAndDay.get(localKey);
    if (!existing) {
      localByGatewayUserAndDay.set(localKey, {
        workspaceId: call.workspaceId,
        userId: call.userId,
        costUsd,
        ambiguous: false,
      });
      continue;
    }

    existing.costUsd += costUsd;
    existing.ambiguous ||=
      existing.workspaceId !== call.workspaceId || existing.userId !== call.userId;
  }

  const identityByGatewayUser = new Map<
    string,
    { workspaceId: string; userId: string; ambiguous: boolean }
  >();
  for (const identity of registeredIdentities) {
    const gatewayUserId = gatewayUserIdForIdentity(
      identity.workspaceId,
      identity.userId,
    );
    const existing = identityByGatewayUser.get(gatewayUserId);
    if (!existing) {
      identityByGatewayUser.set(gatewayUserId, {
        ...identity,
        ambiguous: false,
      });
      continue;
    }
    existing.ambiguous ||= existing.workspaceId !== identity.workspaceId ||
      existing.userId !== identity.userId;
  }

  let reportedCostUsd = 0;
  let matchedLocalCostUsd = 0;
  let ledgerAdjustmentMicrousd = BigInt(0);
  const spendRows = dailyReports.flatMap(({ day, report }) =>
    report.results.map((row) => ({ day, row })),
  );

  for (const { day, row } of spendRows) {
    reportedCostUsd += row.totalCost;
    if (!row.user) {
      warnings.push({
        operation: "attributeSpendReport",
        message: "Gateway spend row has no user attribution",
      });
      continue;
    }

    const dayKey = utcDateKey(day);
    const local = localByGatewayUserAndDay.get(`${dayKey}:${row.user}`);
    const registered = identityByGatewayUser.get(row.user);
    const attribution = local ?? registered;
    const ambiguous = local?.ambiguous || registered?.ambiguous ||
      (local !== undefined && registered !== undefined &&
        (local.workspaceId !== registered.workspaceId ||
          local.userId !== registered.userId));
    if (!attribution || ambiguous) {
      warnings.push({
        operation: "attributeSpendReport",
        resourceId: row.user,
        message: ambiguous
          ? "Gateway user maps to multiple product identities"
          : "Gateway user has no matching registered product identity",
      });
      continue;
    }

    const localCostUsd = local?.costUsd ?? 0;
    matchedLocalCostUsd += localCostUsd;
    const targetResidualCostMicrousd = usdToMicrousd(
      row.totalCost - localCostUsd,
    );
    try {
      ledgerAdjustmentMicrousd += await applyGatewaySpendAdjustment({
        workspaceId: attribution.workspaceId,
        userId: attribution.userId,
        windowKey: dayKey,
        gatewayUserId: row.user,
        targetResidualCostMicrousd,
        reportedCostUsd: row.totalCost,
        localCostUsd,
        occurredAt: new Date(addUtcDays(day, 1).getTime() - 1),
      });
    } catch (error) {
      warnings.push({
        operation: "applySpendAdjustment",
        resourceId: row.user,
        message: errorMessage(error),
      });
    }
  }

  return {
    service: "ai_gateway",
    status: warnings.length > 0 ? "partial" : "complete",
    generationsExamined: callsWithGeneration.length,
    generationsReconciled,
    unpricedCompletedCalls: unpricedCompletedCalls.length,
    reportRows: spendRows.length,
    reportedCostUsd,
    localCostUsd: matchedLocalCostUsd,
    residualCostUsd: reportedCostUsd - matchedLocalCostUsd,
    ledgerAdjustmentMicrousd: ledgerAdjustmentMicrousd.toString(),
    warnings,
  };
}

async function mapWithConcurrency<T>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (cursor < values.length) {
        const value = values[cursor];
        cursor += 1;
        if (value !== undefined) await worker(value);
      }
    }),
  );
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

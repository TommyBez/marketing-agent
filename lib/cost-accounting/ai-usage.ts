import { randomUUID } from "node:crypto";
import {
  and,
  desc,
  eq,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  agentExecutionSessions,
  agentThreads,
  aiCreditAccounts,
  aiCreditLedgerEntries,
  aiModelCalls,
  aiTurns,
  companyProfiles,
} from "@/lib/db/schema";
import { usdDecimal, usdToMicrousd } from "@/lib/cost-accounting/money";
import { ledgerAdjustmentToTarget } from "@/lib/cost-accounting/ledger-math";

export type AiUsageIdentity = {
  userId: string;
  workspaceId: string;
  organizationId?: string;
  conversationId?: string;
  eveSessionId: string;
  rootEveSessionId: string;
  turnId?: string;
  turnSequence?: number;
  stepIndex?: number;
  agentName: string;
  agentNodeId?: string;
};

export type BeginAiModelCallInput = AiUsageIdentity & {
  modelId: string;
  operation: "generate" | "stream";
  attempt: number;
  callKind: AiModelCallKind;
  gatewayUserId: string;
};

export type AiModelCallKind = "step" | "retry" | "compaction" | "other";

export type ModelCallUsage = {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  finishReason?: string;
  gatewayGenerationId?: string;
  modelServed?: string;
  provider?: string;
  costUsd?: number;
  raw?: Record<string, unknown>;
};

export type RecordAiUsageEventInput = AiUsageIdentity & {
  source: "eve.step.completed";
  idempotencyKey: string;
  modelId: string;
  occurredAt: Date | string;
  finishReason: string;
  gatewayGenerationId?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costUsd?: number;
};

export type LinkEveSessionIdentityInput = {
  userId: string;
  workspaceId: string;
  organizationId?: string;
  conversationId?: string;
  eveSessionId: string;
};

export type RecordEveLifecycleEventInput = {
  type: string;
  userId: string;
  workspaceId: string;
  organizationId?: string;
  conversationId?: string;
  eveSessionId: string;
  rootEveSessionId: string;
  turnId?: string;
  turnSequence?: number;
  parentEveSessionId?: string;
  parentTurnId?: string;
  parentCallId?: string;
  agentName: string;
  agentNodeId?: string;
  occurredAt: Date | string;
  payload?: Record<string, unknown>;
};

export class AiCreditsExhaustedError extends Error {
  readonly code = "AI_CREDITS_EXHAUSTED";

  constructor() {
    super("This workspace has no AI credits remaining");
    this.name = "AiCreditsExhaustedError";
  }
}

export class AiUsageUnavailableError extends Error {
  readonly code = "AI_USAGE_UNAVAILABLE";

  constructor(cause: unknown) {
    super("AI usage accounting is temporarily unavailable", { cause });
    this.name = "AiUsageUnavailableError";
  }
}

async function resolveOrganizationId(
  workspaceId: string,
  organizationId?: string,
): Promise<string> {
  if (organizationId) {
    return organizationId;
  }

  const [profile] = await db
    .select({ organizationId: companyProfiles.organizationId })
    .from(companyProfiles)
    .where(eq(companyProfiles.id, workspaceId))
    .limit(1);

  if (!profile) {
    throw new Error(`Unknown workspace ${workspaceId}`);
  }

  return profile.organizationId;
}

export async function linkEveSessionIdentity(
  input: LinkEveSessionIdentityInput,
): Promise<void> {
  if (!input.conversationId) {
    return;
  }
  const conversationId = input.conversationId;

  const organizationId = await resolveOrganizationId(
    input.workspaceId,
    input.organizationId,
  );

  await db.transaction(async (tx) => {
    await tx
      .insert(aiCreditAccounts)
      .values({
        workspaceId: input.workspaceId,
        organizationId,
      })
      .onConflictDoNothing();

    const claimed = await tx
      .update(agentThreads)
      .set({
        eveSessionId: input.eveSessionId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(agentThreads.id, conversationId),
          eq(agentThreads.companyProfileId, input.workspaceId),
          or(
            isNull(agentThreads.eveSessionId),
            eq(agentThreads.eveSessionId, input.eveSessionId),
          ),
        ),
      )
      .returning({ id: agentThreads.id });

    if (claimed.length === 0) {
      throw new Error("Conversation is already linked to another Eve session");
    }
  });
}

export async function recordEveLifecycleEvent(
  input: RecordEveLifecycleEventInput,
): Promise<void> {
  const organizationId = await resolveOrganizationId(
    input.workspaceId,
    input.organizationId,
  );
  const isRoot = input.eveSessionId === input.rootEveSessionId;
  const sessionStatus = sessionStatusForEvent(input.type);
  const occurredAt = new Date(input.occurredAt);

  await db.transaction(async (tx) => {
    await tx
      .insert(aiCreditAccounts)
      .values({ workspaceId: input.workspaceId, organizationId })
      .onConflictDoNothing();

    await tx
      .insert(agentExecutionSessions)
      .values({
        sessionId: input.eveSessionId,
        rootSessionId: input.rootEveSessionId,
        parentSessionId: isRoot
          ? null
          : input.parentEveSessionId ?? input.rootEveSessionId,
        parentTurnId: input.parentTurnId ?? null,
        workspaceId: input.workspaceId,
        organizationId,
        userId: input.userId,
        conversationId: input.conversationId ?? null,
        kind: isRoot ? "root" : "subagent",
        agentId: input.agentNodeId ?? input.agentName,
        status: sessionStatus ?? "running",
        startedAt: occurredAt,
        lastSeenAt: occurredAt,
        terminalAt: isTerminalSessionStatus(sessionStatus)
          ? occurredAt
          : null,
      })
      .onConflictDoUpdate({
        target: agentExecutionSessions.sessionId,
        set: {
          lastSeenAt: sql`greatest(${agentExecutionSessions.lastSeenAt}, ${occurredAt})`,
          ...(sessionStatus === undefined
            ? {}
            : {
                status: sql`case
                  when ${agentExecutionSessions.status} in ('completed', 'failed')
                    then ${agentExecutionSessions.status}
                  when ${occurredAt} < ${agentExecutionSessions.lastSeenAt}
                    then ${agentExecutionSessions.status}
                  else ${sessionStatus}
                end`,
                terminalAt: isTerminalSessionStatus(sessionStatus)
                  ? sql`coalesce(${agentExecutionSessions.terminalAt}, ${occurredAt})`
                  : agentExecutionSessions.terminalAt,
              }),
          updatedAt: new Date(),
        },
      });

    const turnStatus = turnStatusForEvent(input.type);
    const isTurnScopedEvent = turnStatus !== undefined || input.type.startsWith("step.");
    if (input.turnId && input.turnSequence !== undefined && isTurnScopedEvent) {
      await tx
        .insert(aiTurns)
        .values({
          sessionId: input.eveSessionId,
          eveTurnId: input.turnId,
          sequence: input.turnSequence,
          workspaceId: input.workspaceId,
          organizationId,
          userId: input.userId,
          conversationId: input.conversationId ?? null,
          status: turnStatus ?? "running",
          failure:
            turnStatus === "failed" ? (input.payload ?? {}) : null,
          startedAt: occurredAt,
          completedAt: turnStatus && turnStatus !== "running"
            ? occurredAt
            : null,
        })
        .onConflictDoUpdate({
          target: [aiTurns.sessionId, aiTurns.eveTurnId],
          set: {
            userId: input.userId,
            ...(turnStatus === undefined
              ? {}
              : {
                  status: sql`case
                    when ${aiTurns.status} in ('completed', 'failed')
                      then ${aiTurns.status}
                    else ${turnStatus}
                  end`,
                  failure: turnStatus === "failed"
                    ? sql`case
                        when ${aiTurns.status} in ('completed', 'failed')
                          then ${aiTurns.failure}
                        else ${JSON.stringify(input.payload ?? {})}::jsonb
                      end`
                    : aiTurns.failure,
                  completedAt: turnStatus !== "running"
                    ? sql`coalesce(${aiTurns.completedAt}, ${occurredAt})`
                    : aiTurns.completedAt,
                }),
            updatedAt: new Date(),
          },
        });
    }
  });

  if (isRoot && input.type === "session.started") {
    await linkEveSessionIdentity({
      userId: input.userId,
      workspaceId: input.workspaceId,
      organizationId,
      conversationId: input.conversationId,
      eveSessionId: input.eveSessionId,
    });
  }
}

export async function beginAiModelCall(
  input: BeginAiModelCallInput,
): Promise<{ id: string; callId: string }> {
  const organizationId = await resolveOrganizationId(
    input.workspaceId,
    input.organizationId,
  );
  const id = randomUUID();
  const callId = randomUUID();

  try {
    return await db.transaction(async (tx) => {
      await tx
        .insert(aiCreditAccounts)
        .values({ workspaceId: input.workspaceId, organizationId })
        .onConflictDoNothing();

      const [account] = await tx
        .select({ balanceMicrousd: aiCreditAccounts.balanceMicrousd })
        .from(aiCreditAccounts)
        .where(eq(aiCreditAccounts.workspaceId, input.workspaceId))
        .for("update");

      if (!account) {
        throw new Error(`Missing credit account for ${input.workspaceId}`);
      }

      if (
        process.env.AI_CREDIT_ENFORCEMENT === "true" &&
        account.balanceMicrousd <= BigInt(0)
      ) {
        throw new AiCreditsExhaustedError();
      }

      const [turn] = input.turnId
        ? await tx
            .select({ id: aiTurns.id })
            .from(aiTurns)
            .where(
              and(
                eq(aiTurns.sessionId, input.eveSessionId),
                eq(aiTurns.eveTurnId, input.turnId),
              ),
            )
            .limit(1)
        : [];

      const [executionSession] = await tx
        .select({
          rootSessionId: agentExecutionSessions.rootSessionId,
          conversationId: agentExecutionSessions.conversationId,
        })
        .from(agentExecutionSessions)
        .where(eq(agentExecutionSessions.sessionId, input.eveSessionId))
        .limit(1);

      if (!executionSession) {
        throw new Error(
          `Missing Eve session identity for ${input.eveSessionId}`,
        );
      }

      await tx.insert(aiModelCalls).values({
        id,
        callId,
        aiTurnId: turn?.id ?? null,
        sessionId: input.eveSessionId,
        rootSessionId: executionSession.rootSessionId,
        eveTurnId: input.turnId ?? null,
        workspaceId: input.workspaceId,
        organizationId,
        userId: input.userId,
        conversationId:
          input.conversationId ?? executionSession.conversationId ?? null,
        agentId: input.agentNodeId ?? input.agentName,
        callKind: input.callKind,
        attempt: input.attempt,
        stepIndex: input.stepIndex ?? null,
        status: "pending",
        modelRequested: input.modelId,
        rawUsage: {
          operation: input.operation,
          gatewayUserId: input.gatewayUserId,
        },
      });

      return { id, callId };
    });
  } catch (error) {
    if (error instanceof AiCreditsExhaustedError) {
      throw error;
    }
    throw new AiUsageUnavailableError(error);
  }
}

export async function completeAiModelCall(
  modelCallId: string,
  usage: ModelCallUsage,
): Promise<void> {
  await db
    .update(aiModelCalls)
    .set({
      gatewayGenerationId: usage.gatewayGenerationId,
      status: sql`case
        when ${aiModelCalls.status} = 'reconciled' then 'reconciled'
        else 'completed'
      end`,
      modelServed: usage.modelServed,
      provider: usage.provider,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      reasoningTokens: usage.reasoningTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      rawUsage: sql`${aiModelCalls.rawUsage} || ${JSON.stringify({
        ...(usage.raw ?? {}),
        finishReason: usage.finishReason,
      })}::jsonb`,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aiModelCalls.id, modelCallId));

  if (usage.costUsd !== undefined) {
    await applyModelCallCost({
      modelCallId,
      costUsd: usage.costUsd,
      source: "provisional",
      sourceVersion: usage.gatewayGenerationId ?? "middleware",
    });
  }
}

export async function failAiModelCall(
  modelCallId: string,
  error: unknown,
  gatewayGenerationId?: string,
): Promise<void> {
  await db
    .update(aiModelCalls)
    .set({
      gatewayGenerationId,
      status: sql`case
        when ${aiModelCalls.status} = 'reconciled' then 'reconciled'
        else 'error'
      end`,
      rawUsage: sql`${aiModelCalls.rawUsage} || ${JSON.stringify({
        error: safeError(error),
      })}::jsonb`,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aiModelCalls.id, modelCallId));
}

export async function abortAiModelCall(
  modelCallId: string,
  reason: unknown,
  gatewayGenerationId?: string,
): Promise<void> {
  await db
    .update(aiModelCalls)
    .set({
      gatewayGenerationId,
      status: sql`case
        when ${aiModelCalls.status} = 'reconciled' then 'reconciled'
        else 'aborted'
      end`,
      rawUsage: sql`${aiModelCalls.rawUsage} || ${JSON.stringify({
        cancellation: safeError(reason),
      })}::jsonb`,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aiModelCalls.id, modelCallId));
}

export async function markAiModelCallKind(
  modelCallId: string,
  callKind: AiModelCallKind,
): Promise<void> {
  await db
    .update(aiModelCalls)
    .set({ callKind, updatedAt: new Date() })
    .where(eq(aiModelCalls.id, modelCallId));
}

export async function reconcileModelCall(input: {
  modelCallId: string;
  costUsd: number;
  sourceVersion: string;
  usage?: ModelCallUsage;
}): Promise<void> {
  if (input.usage) {
    await db
      .update(aiModelCalls)
      .set({
        gatewayGenerationId: input.usage.gatewayGenerationId,
        status: "reconciled",
        modelServed: input.usage.modelServed,
        provider: input.usage.provider,
        inputTokens: input.usage.inputTokens,
        outputTokens: input.usage.outputTokens,
        reasoningTokens: input.usage.reasoningTokens,
        cacheReadTokens: input.usage.cacheReadTokens,
        cacheWriteTokens: input.usage.cacheWriteTokens,
        reconciledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiModelCalls.id, input.modelCallId));
  }

  await applyModelCallCost({
    modelCallId: input.modelCallId,
    costUsd: input.costUsd,
    source: "reconciled",
    sourceVersion: input.sourceVersion,
  });
}

export async function recordAiUsageEvent(
  input: RecordAiUsageEventInput,
): Promise<void> {
  let [modelCall] = input.gatewayGenerationId
    ? await db
        .select({ id: aiModelCalls.id })
        .from(aiModelCalls)
        .where(eq(aiModelCalls.gatewayGenerationId, input.gatewayGenerationId))
        .limit(1)
    : [];

  if (!modelCall) {
    [modelCall] = await db
      .select({ id: aiModelCalls.id })
      .from(aiModelCalls)
      .where(
        and(
          eq(aiModelCalls.sessionId, input.eveSessionId),
          input.turnId
            ? eq(aiModelCalls.eveTurnId, input.turnId)
            : isNull(aiModelCalls.eveTurnId),
          input.stepIndex !== undefined
            ? eq(aiModelCalls.stepIndex, input.stepIndex)
            : isNull(aiModelCalls.stepIndex),
        ),
      )
      .orderBy(desc(aiModelCalls.startedAt))
      .limit(1);
  }

  if (!modelCall) {
    modelCall = await createObservedModelCall(input);
  }

  await completeAiModelCall(modelCall.id, {
    gatewayGenerationId: input.gatewayGenerationId,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    cacheReadTokens: input.cacheReadTokens,
    cacheWriteTokens: input.cacheWriteTokens,
    finishReason: input.finishReason,
    costUsd: input.costUsd,
    raw: { source: input.source, idempotencyKey: input.idempotencyKey },
  });
}

async function createObservedModelCall(
  input: RecordAiUsageEventInput,
): Promise<{ id: string }> {
  const organizationId = await resolveOrganizationId(
    input.workspaceId,
    input.organizationId,
  );
  const id = randomUUID();
  const [turn] = input.turnId
    ? await db
        .select({ id: aiTurns.id })
        .from(aiTurns)
        .where(
          and(
            eq(aiTurns.sessionId, input.eveSessionId),
            eq(aiTurns.eveTurnId, input.turnId),
          ),
        )
        .limit(1)
    : [];

  await db.insert(aiModelCalls).values({
    id,
    callId: input.idempotencyKey,
    gatewayGenerationId: input.gatewayGenerationId,
    aiTurnId: turn?.id ?? null,
    sessionId: input.eveSessionId,
    rootSessionId: input.rootEveSessionId,
    eveTurnId: input.turnId ?? null,
    workspaceId: input.workspaceId,
    organizationId,
    userId: input.userId,
    conversationId: input.conversationId ?? null,
    agentId: input.agentNodeId ?? input.agentName,
    callKind: "step",
    attempt: 0,
    stepIndex: input.stepIndex ?? null,
    status: "pending",
    modelRequested: input.modelId,
    startedAt: new Date(input.occurredAt),
    rawUsage: { source: input.source },
  }).onConflictDoNothing({ target: aiModelCalls.callId });

  const [created] = await db
    .select({ id: aiModelCalls.id })
    .from(aiModelCalls)
    .where(eq(aiModelCalls.callId, input.idempotencyKey))
    .limit(1);

  if (!created) {
    throw new Error("Unable to create observed AI model call");
  }

  return created;
}

async function applyModelCallCost(input: {
  modelCallId: string;
  costUsd: number;
  source: "provisional" | "reconciled";
  sourceVersion: string;
}): Promise<void> {
  const nextMicrousd = usdToMicrousd(input.costUsd);

  await db.transaction(async (tx) => {
    const [call] = await tx
      .select({
        id: aiModelCalls.id,
        callId: aiModelCalls.callId,
        workspaceId: aiModelCalls.workspaceId,
        userId: aiModelCalls.userId,
        startedAt: aiModelCalls.startedAt,
        provisionalCostUsd: aiModelCalls.provisionalCostUsd,
        reconciledCostUsd: aiModelCalls.reconciledCostUsd,
      })
      .from(aiModelCalls)
      .where(eq(aiModelCalls.id, input.modelCallId))
      .for("update");

    if (!call) {
      throw new Error(`Unknown model call ${input.modelCallId}`);
    }

    if (
      input.source === "provisional" &&
      (call.provisionalCostUsd !== null || call.reconciledCostUsd !== null)
    ) {
      return;
    }

    const previousCostUsd = Number(
      call.reconciledCostUsd ?? call.provisionalCostUsd ?? 0,
    );
    const previousMicrousd = usdToMicrousd(previousCostUsd);
    const amountMicrousd = ledgerAdjustmentToTarget(
      -previousMicrousd,
      -nextMicrousd,
    );

    await tx
      .update(aiModelCalls)
      .set(
        input.source === "provisional"
          ? {
              provisionalCostUsd: usdDecimal(input.costUsd),
              pricingVersion: input.sourceVersion,
              updatedAt: new Date(),
            }
          : {
              reconciledCostUsd: usdDecimal(input.costUsd),
              pricingVersion: input.sourceVersion,
              status: "reconciled",
              reconciledAt: new Date(),
              updatedAt: new Date(),
            },
      )
      .where(eq(aiModelCalls.id, call.id));

    if (amountMicrousd === BigInt(0)) {
      return;
    }

    const idempotencyKey = input.source === "provisional"
      ? `model-call:${call.callId}:provisional`
      : `model-call:${call.callId}:reconcile:${randomUUID()}`;

    const [existing] = await tx
      .select({ id: aiCreditLedgerEntries.id })
      .from(aiCreditLedgerEntries)
      .where(eq(aiCreditLedgerEntries.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existing) {
      return;
    }

    const [account] = await tx
      .select({ balanceMicrousd: aiCreditAccounts.balanceMicrousd })
      .from(aiCreditAccounts)
      .where(eq(aiCreditAccounts.workspaceId, call.workspaceId))
      .for("update");

    if (!account) {
      throw new Error(`Missing credit account for ${call.workspaceId}`);
    }

    const balanceAfterMicrousd =
      account.balanceMicrousd + amountMicrousd;

    await tx.insert(aiCreditLedgerEntries).values({
      workspaceId: call.workspaceId,
      userId: call.userId,
      modelCallId: call.id,
      kind:
        input.source === "provisional" || previousMicrousd === BigInt(0)
          ? "usage"
          : "reconciliation_adjustment",
      amountMicrousd,
      balanceAfterMicrousd,
      idempotencyKey,
      reason:
        input.source === "provisional"
          ? "AI model usage"
          : "AI Gateway cost reconciliation",
      metadata: {
        source: input.source,
        sourceVersion: input.sourceVersion,
        costUsd: input.costUsd,
      },
      // Keep usage and later reconciliation deltas in the period in which the
      // generation happened. Otherwise a Sunday call reconciled on Monday
      // would split model cost and credit debits across different reports.
      occurredAt: call.startedAt,
    });

    await tx
      .update(aiCreditAccounts)
      .set({
        balanceMicrousd: balanceAfterMicrousd,
        updatedAt: new Date(),
      })
      .where(eq(aiCreditAccounts.workspaceId, call.workspaceId));
  });
}

function sessionStatusForEvent(type: string):
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | undefined {
  if (type === "session.completed") return "completed";
  if (type === "session.failed" || type === "session.cancelled") return "failed";
  if (type === "session.waiting") return "waiting";
  if (type.startsWith("session.")) return "running";
  return undefined;
}

function turnStatusForEvent(type: string):
  | "running"
  | "completed"
  | "failed"
  | undefined {
  if (type === "turn.completed") return "completed";
  if (type === "turn.failed") return "failed";
  if (type === "turn.started") return "running";
  return undefined;
}

function isTerminalSessionStatus(
  status: ReturnType<typeof sessionStatusForEvent>,
): status is "completed" | "failed" {
  return status === "completed" || status === "failed";
}

function safeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { message: String(error) };
}

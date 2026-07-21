import {
  createGateway,
  gateway,
  wrapLanguageModel,
  type JSONValue,
  type LanguageModelMiddleware,
} from "ai";
import { defineDynamic } from "eve";
import {
  abortAiModelCall,
  beginAiModelCall,
  completeAiModelCall,
  failAiModelCall,
  markAiModelCallKind,
  type AiUsageIdentity,
  type AiModelCallKind,
  type ModelCallUsage,
} from "@/lib/cost-accounting/ai-usage";
import {
  gatewayReportingTag,
  gatewayUserIdForIdentity,
} from "@/lib/cost-accounting/gateway-identity";

type StepStartedEvent = {
  type: "step.started";
  data: {
    sequence: number;
    stepIndex: number;
    turnId: string;
  };
};

type DynamicContext = {
  session: {
    id: string;
    auth: {
      current: AuthContext | null;
      initiator: AuthContext | null;
    };
  };
};

type AuthContext = {
  principalId: string;
  principalType: string;
  attributes: Readonly<Record<string, string | readonly string[]>>;
};

export function meteredModel(modelId: string, agentName: string) {
  return defineDynamic({
    fallback: modelId,
    events: {
      "step.started": (rawEvent, rawContext) => {
        const event = rawEvent as StepStartedEvent;
        const context = rawContext as DynamicContext;
        const identity = resolveIdentity({ event, context, agentName });
        const baseModel = gateway(modelId as Parameters<typeof gateway>[0]);

        if (!identity) {
          console.error("[cost-accounting] model call has no verified user identity", {
            agentName,
            sessionId: context.session.id,
          });

          if (process.env.NODE_ENV === "production") {
            // Eve intentionally degrades dynamic-resolver exceptions to the
            // static fallback. Return a selected model that rejects before the
            // provider call instead, so missing attribution cannot bypass
            // accounting through that fallback behavior.
            return wrapLanguageModel({
              model: baseModel,
              middleware: unattributedCallGuard(),
            });
          }

          return baseModel;
        }

        return wrapLanguageModel({
          model: baseModel,
          middleware: createMeteringMiddleware({ identity, modelId }),
        });
      },
    },
  });
}

export function unattributedCallGuard(): LanguageModelMiddleware {
  const reject = () => {
    throw new Error("AI usage accounting cannot attribute this model call");
  };

  return {
    specificationVersion: "v4",
    wrapGenerate: async () => reject(),
    wrapStream: async () => reject(),
  };
}

function createMeteringMiddleware(input: {
  identity: AiUsageIdentity;
  modelId: string;
}): LanguageModelMiddleware {
  let physicalCallCount = 0;
  let retryAttempt = 0;
  let previousCall:
    | { id: string; outcome: "pending" | "completed" | "failed" | "aborted" }
    | undefined;
  const gatewayUserId = gatewayUserIdForIdentity(
    input.identity.workspaceId,
    input.identity.userId,
  );
  const reportingTag = gatewayReportingTag();

  const startCall = async (operation: "generate" | "stream") => {
    let callKind: AiModelCallKind = "step";
    if (
      physicalCallCount === 1 &&
      previousCall?.outcome === "completed"
    ) {
      // Eve performs compaction before the logical step with the same wrapped
      // dynamic model. A second successful physical invocation identifies the
      // first as compaction without relying on a separate model configuration.
      await safelyMarkCompaction(previousCall.id);
      retryAttempt = 0;
    } else if (
      previousCall?.outcome === "failed" ||
      previousCall?.outcome === "aborted"
    ) {
      callKind = "retry";
      retryAttempt += 1;
    } else if (physicalCallCount > 0) {
      callKind = "other";
    }

    physicalCallCount += 1;
    const call = await beginAiModelCall({
      ...input.identity,
      modelId: input.modelId,
      operation,
      attempt: retryAttempt,
      callKind,
      gatewayUserId,
      gatewayReportingTag: reportingTag,
    });
    const state = { id: call.id, outcome: "pending" as const } as {
      id: string;
      outcome: "pending" | "completed" | "failed" | "aborted";
    };
    previousCall = state;
    return state;
  };

  return {
    specificationVersion: "v4",
    transformParams: async ({ params }) => ({
      ...params,
      providerOptions: {
        ...params.providerOptions,
        gateway: meteredGatewayOptions(
          params.providerOptions?.gateway,
          gatewayUserId,
          reportingTag,
        ),
      },
    }),
    wrapGenerate: async ({ doGenerate }) => {
      const call = await startCall("generate");

      try {
        const result = await doGenerate();
        const usage = await enrichUsageWithGatewayCost(
          input.modelId,
          usageFromResult(result),
        );
        await safelyCompleteCall(call.id, usage);
        call.outcome = "completed";
        return result;
      } catch (error) {
        await safelyFailCall(call.id, error);
        call.outcome = "failed";
        throw error;
      }
    },
    wrapStream: async ({ doStream }) => {
      const call = await startCall("stream");
      let gatewayGenerationId: string | undefined;
      let gatewayCostUsd: number | undefined;

      try {
        const result = await doStream();
        let settled = false;
        const reader = result.stream.getReader();

        return {
          ...result,
          stream: new ReadableStream({
            async pull(controller) {
              try {
                const { done, value: part } = await reader.read();
                if (done) {
                  if (!settled) {
                    settled = true;
                    await safelyFailCall(
                      call.id,
                      new Error("Model stream ended without a finish event"),
                      gatewayGenerationId,
                    );
                    call.outcome = "failed";
                  }
                  controller.close();
                  return;
                }

                const gatewayUsage = gatewayUsageFromStreamPart(part);
                gatewayGenerationId ??= gatewayUsage.generationId;
                gatewayCostUsd ??= gatewayUsage.costUsd;

                if (part.type === "finish") {
                  settled = true;
                  const rawUsage = usageFromResult(part);
                  rawUsage.gatewayGenerationId ??= gatewayGenerationId;
                  rawUsage.costUsd ??= gatewayCostUsd;
                  const usage = await enrichUsageWithGatewayCost(
                    input.modelId,
                    rawUsage,
                  );
                  await safelyCompleteCall(call.id, usage);
                  call.outcome = "completed";
                } else if (part.type === "error") {
                  settled = true;
                  await safelyFailCall(
                    call.id,
                    part.error,
                    gatewayGenerationId,
                  );
                  call.outcome = "failed";
                }
                controller.enqueue(part);
              } catch (error) {
                if (!settled) {
                  settled = true;
                  await safelyFailCall(call.id, error, gatewayGenerationId);
                  call.outcome = "failed";
                }
                controller.error(error);
              }
            },
            async cancel(reason) {
              if (!settled) {
                settled = true;
                await safelyAbortCall(call.id, reason, gatewayGenerationId);
                call.outcome = "aborted";
              }
              await reader.cancel(reason);
            },
          }),
        };
      } catch (error) {
        await safelyFailCall(call.id, error, gatewayGenerationId);
        call.outcome = "failed";
        throw error;
      }
    },
  };
}

export function meteredGatewayOptions(
  existing: unknown,
  gatewayUserId: string,
  reportingTag = gatewayReportingTag(),
): Record<string, JSONValue | undefined> {
  const options = asRecord(existing) as Record<string, JSONValue | undefined>;
  const existingTags = Array.isArray(options.tags)
    ? options.tags.filter((tag): tag is string => typeof tag === "string")
    : [];

  return {
    ...options,
    user: gatewayUserId,
    tags: [...new Set([...existingTags, reportingTag])],
  };
}

type GatewayTokenPricing = {
  input: string;
  output: string;
  cachedInputTokens?: string;
  cacheCreationInputTokens?: string;
};

let gatewayCostClient: ReturnType<typeof createGateway> | undefined;

function costLookupGateway() {
  gatewayCostClient ??= createGateway({
    apiKey: process.env.AI_GATEWAY_REPORTING_KEY,
    teamIdOrSlug: process.env.VERCEL_TEAM_ID,
  });
  return gatewayCostClient;
}

async function enrichUsageWithGatewayCost(
  modelId: string,
  usage: ModelCallUsage,
): Promise<ModelCallUsage> {
  if (usage.costUsd !== undefined) {
    return usage;
  }

  const costGateway = costLookupGateway();
  if (usage.gatewayGenerationId) {
    try {
      const generation = await costGateway.getGenerationInfo({
        id: usage.gatewayGenerationId,
      });
      return {
        ...usage,
        inputTokens: generation.promptTokens ?? usage.inputTokens,
        outputTokens: generation.completionTokens ?? usage.outputTokens,
        reasoningTokens: generation.reasoningTokens ?? usage.reasoningTokens,
        cacheReadTokens: generation.cachedTokens ?? usage.cacheReadTokens,
        cacheWriteTokens:
          generation.cacheCreationTokens ?? usage.cacheWriteTokens,
        modelServed: generation.model ?? usage.modelServed,
        provider: generation.providerName ?? usage.provider,
        costUsd: generation.totalCost,
        raw: {
          ...usage.raw,
          costSource: "gateway-generation-info",
        },
      };
    } catch (error) {
      console.warn("[cost-accounting] immediate Gateway cost lookup failed", {
        gatewayGenerationId: usage.gatewayGenerationId,
        error: errorMessage(error),
      });
    }
  }

  try {
    const metadata = await costGateway.getAvailableModels();
    const model = metadata.models.find(
      (candidate) =>
        candidate.id === usage.modelServed || candidate.id === modelId,
    );
    const estimatedCostUsd = model?.pricing
      ? estimateGatewayCost(usage, model.pricing)
      : undefined;
    if (estimatedCostUsd !== undefined) {
      return {
        ...usage,
        costUsd: estimatedCostUsd,
        raw: {
          ...usage.raw,
          costSource: "gateway-model-catalog",
          pricingModelId: model?.id,
        },
      };
    }
  } catch (error) {
    console.warn("[cost-accounting] Gateway price catalog lookup failed", {
      modelId,
      error: errorMessage(error),
    });
  }

  return usage;
}

export function estimateGatewayCost(
  usage: Pick<
    ModelCallUsage,
    | "inputTokens"
    | "outputTokens"
    | "cacheReadTokens"
    | "cacheWriteTokens"
  >,
  pricing: GatewayTokenPricing,
): number | undefined {
  if (usage.inputTokens === undefined && usage.outputTokens === undefined) {
    return undefined;
  }

  const inputRate = nonNegativeNumber(pricing.input);
  const outputRate = nonNegativeNumber(pricing.output);
  if (inputRate === undefined || outputRate === undefined) {
    return undefined;
  }

  const cacheReadTokens = Math.max(0, usage.cacheReadTokens ?? 0);
  const cacheWriteTokens = Math.max(0, usage.cacheWriteTokens ?? 0);
  const regularInputTokens = Math.max(
    0,
    (usage.inputTokens ?? 0) - cacheReadTokens - cacheWriteTokens,
  );
  const cacheReadRate =
    nonNegativeNumber(pricing.cachedInputTokens) ?? inputRate;
  const cacheWriteRate =
    nonNegativeNumber(pricing.cacheCreationInputTokens) ?? inputRate;

  return regularInputTokens * inputRate +
    cacheReadTokens * cacheReadRate +
    cacheWriteTokens * cacheWriteRate +
    Math.max(0, usage.outputTokens ?? 0) * outputRate;
}

function resolveIdentity(input: {
  event: StepStartedEvent;
  context: DynamicContext;
  agentName: string;
}): AiUsageIdentity | null {
  const auth = [
    input.context.session.auth.current,
    input.context.session.auth.initiator,
  ].find(
    (candidate): candidate is AuthContext =>
      candidate?.principalType === "user" &&
      Boolean(attribute(candidate, "workspaceId")),
  );
  if (!auth) {
    return null;
  }

  const workspaceId = attribute(auth, "workspaceId");
  if (!workspaceId) {
    return null;
  }

  return {
    userId: auth.principalId,
    workspaceId,
    organizationId: attribute(auth, "organizationId"),
    conversationId: attribute(auth, "conversationId"),
    eveSessionId: input.context.session.id,
    // beginAiModelCall resolves authoritative root lineage from the execution
    // session row; dynamic model contexts intentionally expose only this id.
    rootEveSessionId: input.context.session.id,
    turnId: input.event.data.turnId,
    turnSequence: input.event.data.sequence,
    stepIndex: input.event.data.stepIndex,
    agentName: input.agentName,
  };
}

function usageFromResult(result: {
  usage: {
    inputTokens: {
      total?: number;
      cacheRead?: number;
      cacheWrite?: number;
    };
    outputTokens: {
      total?: number;
      reasoning?: number;
    };
    raw?: Record<string, unknown>;
  };
  finishReason: { unified: string; raw?: string };
  providerMetadata?: Record<string, Record<string, unknown>>;
  response?: { modelId?: string };
}): ModelCallUsage {
  const gatewayMetadata = asRecord(result.providerMetadata?.gateway);
  return {
    inputTokens: result.usage.inputTokens.total,
    outputTokens: result.usage.outputTokens.total,
    reasoningTokens: result.usage.outputTokens.reasoning,
    cacheReadTokens: result.usage.inputTokens.cacheRead,
    cacheWriteTokens: result.usage.inputTokens.cacheWrite,
    finishReason: result.finishReason.unified,
    gatewayGenerationId: firstString(
      gatewayMetadata.generationId,
      gatewayMetadata.generation_id,
    ),
    modelServed: result.response?.modelId,
    provider: firstString(
      gatewayMetadata.provider,
      gatewayMetadata.providerName,
    ),
    costUsd: firstNumber(
      gatewayMetadata.cost,
      gatewayMetadata.totalCost,
      gatewayMetadata.total_cost,
    ),
    raw: {
      providerMetadata: result.providerMetadata,
      providerUsage: result.usage.raw,
    },
  };
}

async function safelyCompleteCall(
  modelCallId: string,
  usage: ModelCallUsage,
): Promise<void> {
  try {
    await completeAiModelCall(modelCallId, usage);
  } catch (error) {
    console.error("[cost-accounting] unable to complete model call", {
      modelCallId,
      error,
    });
  }
}

async function safelyFailCall(
  modelCallId: string,
  error: unknown,
  gatewayGenerationId?: string,
): Promise<void> {
  try {
    await failAiModelCall(
      modelCallId,
      error,
      gatewayGenerationId ?? generationIdFromError(error),
    );
  } catch (accountingError) {
    console.error("[cost-accounting] unable to mark model call failed", {
      modelCallId,
      error: accountingError,
    });
  }
}

async function safelyAbortCall(
  modelCallId: string,
  reason: unknown,
  gatewayGenerationId?: string,
): Promise<void> {
  try {
    await abortAiModelCall(modelCallId, reason, gatewayGenerationId);
  } catch (accountingError) {
    console.error("[cost-accounting] unable to mark model call aborted", {
      modelCallId,
      error: accountingError,
    });
  }
}

async function safelyMarkCompaction(modelCallId: string): Promise<void> {
  try {
    await markAiModelCallKind(modelCallId, "compaction");
  } catch (error) {
    console.error("[cost-accounting] unable to classify compaction call", {
      modelCallId,
      error,
    });
  }
}

function attribute(auth: AuthContext, key: string): string | undefined {
  const value = auth.attributes[key];
  return typeof value === "string" ? value : value?.[0];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string");
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value !== "number" && typeof value !== "string") continue;
    if (typeof value === "string" && value.trim().length === 0) continue;
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function generationIdFromError(error: unknown): string | undefined {
  return firstString(asRecord(error).generationId);
}

export function gatewayUsageFromStreamPart(part: unknown): {
  generationId?: string;
  costUsd?: number;
} {
  const providerMetadata = asRecord(asRecord(part).providerMetadata);
  const gatewayMetadata = asRecord(providerMetadata.gateway);
  return {
    generationId: firstString(
      gatewayMetadata.generationId,
      gatewayMetadata.generation_id,
    ),
    costUsd: firstNumber(
      gatewayMetadata.cost,
      gatewayMetadata.totalCost,
      gatewayMetadata.total_cost,
    ),
  };
}

function nonNegativeNumber(value: unknown): number | undefined {
  const parsed = firstNumber(value);
  return parsed !== undefined && parsed >= 0 ? parsed : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

import {
  linkEveSessionIdentity,
  recordAiUsageEvent,
  recordEveLifecycleEvent,
} from '@/lib/cost-accounting/ai-usage'
import { defineHook } from 'eve/hooks'
import type { HookContext } from 'eve/hooks'

type VerifiedEveIdentity = {
  conversationId: string
  organizationId?: string
  userId: string
  workspaceId: string
}

type LifecycleEventType =
  | 'session.started'
  | 'session.waiting'
  | 'session.completed'
  | 'session.failed'
  | 'turn.started'
  | 'turn.completed'
  | 'turn.failed'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'

type LifecyclePayload = Record<string, number | string>

function stringAttribute(value: string | readonly string[] | undefined) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function verifiedIdentity(ctx: HookContext): VerifiedEveIdentity | null {
  for (const caller of [ctx.session.auth.current, ctx.session.auth.initiator]) {
    if (!caller || caller.principalType !== 'user') continue

    const conversationId = stringAttribute(caller.attributes.conversationId)
    const organizationId = stringAttribute(caller.attributes.organizationId)
    const workspaceId = stringAttribute(caller.attributes.workspaceId)
    if (!conversationId || !workspaceId) continue

    return {
      conversationId,
      ...(organizationId ? { organizationId } : {}),
      userId: caller.principalId,
      workspaceId,
    }
  }

  return null
}

function eventTime(event: { readonly meta?: { readonly at: string } }) {
  const occurredAt = event.meta?.at ? new Date(event.meta.at) : new Date()
  return Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt
}

function rootSessionId(ctx: HookContext) {
  return ctx.session.parent?.rootSessionId ?? ctx.session.id
}

function warnMissingIdentity(eventType: string, ctx: HookContext) {
  console.warn('[cost-accounting] Eve event has no verified user, workspace, and conversation identity', {
    agentName: ctx.agent.name,
    eventType,
    sessionId: ctx.session.id,
  })
}

async function safelyRecord(
  operation: () => unknown | Promise<unknown>,
  label: string,
  ctx: HookContext,
) {
  try {
    await operation()
  }
  catch (error) {
    // Accounting is post-use bookkeeping. A write failure must not fail the
    // already-recorded Eve event or interrupt the user's turn.
    console.error(`[cost-accounting] Failed to ${label}`, {
      agentName: ctx.agent.name,
      error,
      sessionId: ctx.session.id,
      turnId: ctx.session.turn.id,
    })
  }
}

async function recordLifecycle(
  type: LifecycleEventType,
  ctx: HookContext,
  occurredAt: Date,
  payload?: LifecyclePayload,
  turn = ctx.session.turn,
) {
  const identity = verifiedIdentity(ctx)
  if (!identity) {
    if (type === 'session.started') warnMissingIdentity(type, ctx)
    return
  }

  const parent = ctx.session.parent
  await safelyRecord(
    () => recordEveLifecycleEvent({
      type,
      ...identity,
      eveSessionId: ctx.session.id,
      rootEveSessionId: rootSessionId(ctx),
      turnId: turn.id,
      turnSequence: turn.sequence,
      parentEveSessionId: parent?.sessionId,
      parentTurnId: parent?.turn.id,
      parentCallId: parent?.callId,
      agentName: ctx.agent.name,
      agentNodeId: ctx.agent.nodeId,
      occurredAt,
      payload,
    }),
    `record Eve ${type}`,
    ctx,
  )
}

export function createCostAccountingHook({ modelId }: { modelId: string }) {
  return defineHook({
    events: {
      async 'session.started'(event, ctx) {
        const identity = verifiedIdentity(ctx)
        const occurredAt = eventTime(event)

        if (!identity) {
          warnMissingIdentity(event.type, ctx)
          return
        }

        if (rootSessionId(ctx) === ctx.session.id) {
          // This happens before the first model call. A root session must claim
          // its conversation atomically; suppressing a conflict here could leave
          // a second, billable Eve session detached from the product thread.
          await linkEveSessionIdentity({
            ...identity,
            eveSessionId: ctx.session.id,
          })
        }
        await recordLifecycle(event.type, ctx, occurredAt)
      },
      async 'turn.started'(event, ctx) {
        await recordLifecycle(event.type, ctx, eventTime(event), undefined, {
          id: event.data.turnId,
          sequence: event.data.sequence,
        })
      },
      async 'step.started'(event, ctx) {
        await recordLifecycle(event.type, ctx, eventTime(event), {
          stepIndex: event.data.stepIndex,
        }, {
          id: event.data.turnId,
          sequence: event.data.sequence,
        })
      },
      async 'step.completed'(event, ctx) {
        const identity = verifiedIdentity(ctx)
        const occurredAt = eventTime(event)
        const gatewayGenerationId = event.data.providerMetadata?.gateway?.generationId

        if (!identity) {
          warnMissingIdentity(event.type, ctx)
        }
        else {
          const usage = event.data.usage
          await safelyRecord(
            () => recordAiUsageEvent({
              source: 'eve.step.completed',
              idempotencyKey: gatewayGenerationId
                ? `ai-gateway:${gatewayGenerationId}`
                : `eve:${ctx.session.id}:${event.data.turnId}:${event.data.stepIndex}`,
              ...identity,
              eveSessionId: ctx.session.id,
              rootEveSessionId: rootSessionId(ctx),
              turnId: event.data.turnId,
              turnSequence: event.data.sequence,
              stepIndex: event.data.stepIndex,
              agentName: ctx.agent.name,
              agentNodeId: ctx.agent.nodeId,
              modelId,
              occurredAt,
              finishReason: event.data.finishReason,
              gatewayGenerationId,
              inputTokens: usage?.inputTokens,
              outputTokens: usage?.outputTokens,
              cacheReadTokens: usage?.cacheReadTokens,
              cacheWriteTokens: usage?.cacheWriteTokens,
              costUsd: usage?.costUsd,
            }),
            'record Eve step usage',
            ctx,
          )
        }

        await recordLifecycle(event.type, ctx, occurredAt, {
          finishReason: event.data.finishReason,
          stepIndex: event.data.stepIndex,
        }, {
          id: event.data.turnId,
          sequence: event.data.sequence,
        })
      },
      async 'step.failed'(event, ctx) {
        await recordLifecycle(event.type, ctx, eventTime(event), {
          code: event.data.code,
          stepIndex: event.data.stepIndex,
        }, {
          id: event.data.turnId,
          sequence: event.data.sequence,
        })
      },
      async 'turn.completed'(event, ctx) {
        await recordLifecycle(event.type, ctx, eventTime(event), undefined, {
          id: event.data.turnId,
          sequence: event.data.sequence,
        })
      },
      async 'turn.failed'(event, ctx) {
        await recordLifecycle(event.type, ctx, eventTime(event), {
          code: event.data.code,
        }, {
          id: event.data.turnId,
          sequence: event.data.sequence,
        })
      },
      async 'session.waiting'(event, ctx) {
        await recordLifecycle(event.type, ctx, eventTime(event), {
          wait: event.data.wait,
        })
      },
      async 'session.completed'(event, ctx) {
        await recordLifecycle(event.type, ctx, eventTime(event))
      },
      async 'session.failed'(event, ctx) {
        await recordLifecycle(event.type, ctx, eventTime(event), {
          code: event.data.code,
        })
      },
    },
  })
}

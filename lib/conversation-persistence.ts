import 'server-only'

import { db } from '@/lib/db'
import { agentThreads } from '@/lib/db/schema'
import { requireWorkspaceMembership } from '@/lib/workspace-access'
import { del, get, put } from '@vercel/blob'
import { and, eq, isNull, lte, or } from 'drizzle-orm'
import type { HandleMessageStreamEvent } from 'eve/client'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

const idSchema = z.uuid()
const sessionStateSchema = z.object({
  continuationToken: z.string().optional(),
  sessionId: z.string().optional(),
  streamIndex: z.number().int().min(0),
})
const transcriptEventsSchema = z.array(z.unknown())
const transcriptPointerSchema = z.object({
  blobPath: z.string().min(1),
  eventCount: z.number().int().min(0).optional(),
})

type ConversationPersistenceStatus = 400 | 401 | 404 | 409

export class ConversationPersistenceError extends Error {
  constructor(message: string, readonly status: ConversationPersistenceStatus) {
    super(message)
    this.name = 'ConversationPersistenceError'
  }
}

function getTranscriptPath(
  userId: string,
  conversationId: string,
  sessionId: string,
  streamIndex: number,
  eventCount: number,
) {
  return `agent-transcripts/${userId}/${conversationId}/${encodeURIComponent(sessionId)}/${streamIndex}-${eventCount}-${randomUUID()}.json`
}

async function readTranscript(value: unknown) {
  const inlineTranscript = transcriptEventsSchema.safeParse(value)
  if (inlineTranscript.success) return inlineTranscript.data as HandleMessageStreamEvent[]

  const pointer = transcriptPointerSchema.safeParse(value)
  if (!pointer.success) return []

  const result = await get(pointer.data.blobPath, { access: 'private', useCache: false })
  if (!result || result.statusCode !== 200) return []
  const payload = await new Response(result.stream).json()
  return transcriptEventsSchema.parse(payload) as HandleMessageStreamEvent[]
}

async function requireConversation(workspaceId: string, conversationId: string) {
  const parsedWorkspaceId = idSchema.parse(workspaceId)
  const parsedConversationId = idSchema.parse(conversationId)
  let access
  try {
    access = await requireWorkspaceMembership(parsedWorkspaceId)
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'Unauthorized') {
      throw new ConversationPersistenceError('Unauthorized', 401)
    }
    throw new ConversationPersistenceError('Conversation not found', 404)
  }

  const conversation = (await db.select().from(agentThreads).where(and(
    eq(agentThreads.id, parsedConversationId),
    eq(agentThreads.companyProfileId, parsedWorkspaceId),
  )).limit(1))[0]

  if (!conversation) throw new ConversationPersistenceError('Conversation not found', 404)
  return { conversation, userId: access.userId }
}

function assertCompatibleSession(currentSessionId: string | null, incomingSessionId: string) {
  if (currentSessionId && currentSessionId !== incomingSessionId) {
    throw new ConversationPersistenceError('Conversation is already attached to a different Eve session', 409)
  }
}

async function getTranscriptEventCount(value: unknown) {
  const inlineTranscript = transcriptEventsSchema.safeParse(value)
  if (inlineTranscript.success) return inlineTranscript.data.length

  const pointer = transcriptPointerSchema.safeParse(value)
  if (!pointer.success) return 0
  if (pointer.data.eventCount !== undefined) return pointer.data.eventCount
  return (await readTranscript(value)).length
}

function createTitle(message: string) {
  const normalized = message.replace(/\s+/g, ' ').trim()
  if (!normalized) return 'New conversation'
  return normalized.length > 64 ? `${normalized.slice(0, 61).trimEnd()}…` : normalized
}

export async function persistConversationTranscript(
  workspaceId: string,
  conversationId: string,
  sessionState: unknown,
  events: unknown,
  firstMessage?: string,
) {
  const { conversation, userId } = await requireConversation(workspaceId, conversationId)
  const parsedSession = sessionStateSchema.parse(sessionState)
  const parsedEvents = transcriptEventsSchema.parse(events)

  if (!parsedSession.sessionId) {
    if (parsedEvents.length === 0) return
    throw new ConversationPersistenceError('Cannot persist Eve events without a session cursor', 400)
  }
  const sessionId = parsedSession.sessionId
  assertCompatibleSession(conversation.eveSessionId, sessionId)

  let pendingBlobPath: string | undefined
  try {
    const outcome = await db.transaction(async (transaction) => {
      const current = (await transaction.select().from(agentThreads).where(and(
        eq(agentThreads.id, conversation.id),
        eq(agentThreads.companyProfileId, conversation.companyProfileId),
      )).for('update').limit(1))[0]

      if (!current) throw new ConversationPersistenceError('Conversation not found', 404)
      assertCompatibleSession(current.eveSessionId, sessionId)
      if (parsedSession.streamIndex < current.streamIndex) return { saved: false as const }
      if (parsedSession.streamIndex === current.streamIndex) {
        const savedEventCount = await getTranscriptEventCount(current.events)
        if (parsedEvents.length <= savedEventCount) return { saved: false as const }
      }

      pendingBlobPath = getTranscriptPath(
        userId,
        current.id,
        sessionId,
        parsedSession.streamIndex,
        parsedEvents.length,
      )
      await put(pendingBlobPath, JSON.stringify(parsedEvents), {
        access: 'private',
        addRandomSuffix: false,
        contentType: 'application/json',
      })

      await transaction.update(agentThreads).set({
        eveSessionId: parsedSession.sessionId,
        continuationToken: parsedSession.continuationToken,
        streamIndex: parsedSession.streamIndex,
        events: { blobPath: pendingBlobPath, eventCount: parsedEvents.length },
        ...(current.title === 'New conversation' && firstMessage?.trim()
          ? { title: createTitle(firstMessage) }
          : {}),
        updatedAt: new Date(),
      }).where(and(
        eq(agentThreads.id, current.id),
        eq(agentThreads.companyProfileId, current.companyProfileId),
      ))

      const previousPointer = transcriptPointerSchema.safeParse(current.events)
      return {
        previousBlobPath: previousPointer.success ? previousPointer.data.blobPath : undefined,
        saved: true as const,
      }
    })

    if (outcome.saved && outcome.previousBlobPath && outcome.previousBlobPath !== pendingBlobPath) {
      await del(outcome.previousBlobPath).catch(() => undefined)
    }
  } catch (error) {
    if (pendingBlobPath) await del(pendingBlobPath).catch(() => undefined)
    throw error
  }
}

export async function persistConversationSession(
  workspaceId: string,
  conversationId: string,
  sessionState: unknown,
  firstMessage?: string,
) {
  const { conversation } = await requireConversation(workspaceId, conversationId)
  const parsedSession = sessionStateSchema.parse(sessionState)
  if (!parsedSession.sessionId) throw new ConversationPersistenceError('Missing Eve session ID', 400)
  const shouldTitle = conversation.title === 'New conversation' && Boolean(firstMessage?.trim())

  assertCompatibleSession(conversation.eveSessionId, parsedSession.sessionId)

  const [updated] = await db.update(agentThreads).set({
    eveSessionId: parsedSession.sessionId,
    continuationToken: parsedSession.continuationToken,
    streamIndex: parsedSession.streamIndex,
    ...(shouldTitle ? { title: createTitle(firstMessage ?? '') } : {}),
    updatedAt: new Date(),
  }).where(and(
    eq(agentThreads.id, conversation.id),
    eq(agentThreads.companyProfileId, conversation.companyProfileId),
    or(isNull(agentThreads.eveSessionId), eq(agentThreads.eveSessionId, parsedSession.sessionId)),
    lte(agentThreads.streamIndex, parsedSession.streamIndex),
  )).returning({ id: agentThreads.id })

  if (!updated && conversation.eveSessionId !== parsedSession.sessionId) {
    throw new ConversationPersistenceError('Conversation is already attached to a different Eve session', 409)
  }
}

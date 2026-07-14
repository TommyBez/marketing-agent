import 'server-only'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { agentThreads, companyProfiles } from '@/lib/db/schema'
import { del, get, put } from '@vercel/blob'
import { and, eq, isNull, lte, or } from 'drizzle-orm'
import type { HandleMessageStreamEvent } from 'eve/client'
import { headers } from 'next/headers'
import { z } from 'zod'

const idSchema = z.string().uuid()
const sessionStateSchema = z.object({
  continuationToken: z.string().optional(),
  sessionId: z.string().optional(),
  streamIndex: z.number().int().min(0),
})
const transcriptEventsSchema = z.array(z.unknown()).max(5_000)
const transcriptPointerSchema = z.object({ blobPath: z.string().min(1) })

function getTranscriptPath(
  userId: string,
  conversationId: string,
  sessionId: string,
  streamIndex: number,
  eventCount: number,
) {
  return `agent-transcripts/${userId}/${conversationId}/${encodeURIComponent(sessionId)}/${streamIndex}-${eventCount}.json`
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

async function getUserId() {
  const currentSession = await auth.api.getSession({ headers: await headers() })
  if (!currentSession?.user) throw new Error('Unauthorized')
  return currentSession.user.id
}

async function requireConversation(userId: string, workspaceId: string, conversationId: string) {
  const parsedWorkspaceId = idSchema.safeParse(workspaceId)
  const parsedConversationId = idSchema.safeParse(conversationId)
  if (!parsedWorkspaceId.success || !parsedConversationId.success) throw new Error('Invalid conversation')

  const conversation = (await db.select().from(agentThreads).innerJoin(
    companyProfiles,
    and(
      eq(companyProfiles.id, agentThreads.companyProfileId),
      eq(companyProfiles.userId, userId),
    ),
  ).where(and(
    eq(agentThreads.id, parsedConversationId.data),
    eq(agentThreads.companyProfileId, parsedWorkspaceId.data),
    eq(agentThreads.userId, userId),
  )).limit(1))[0]?.agent_threads

  if (!conversation) throw new Error('Conversation not found')
  return conversation
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
  const userId = await getUserId()
  const conversation = await requireConversation(userId, workspaceId, conversationId)
  const parsedSession = sessionStateSchema.parse(sessionState)
  const parsedEvents = transcriptEventsSchema.parse(events)
  const shouldTitle = conversation.title === 'New conversation' && Boolean(firstMessage?.trim())

  if (conversation.eveSessionId && parsedSession.sessionId !== conversation.eveSessionId) {
    throw new Error('Conversation is already attached to a different Eve session')
  }
  if (!parsedSession.sessionId) {
    if (parsedEvents.length === 0) return
    throw new Error('Cannot persist Eve events without a session cursor')
  }
  if (parsedSession.streamIndex < conversation.streamIndex) return
  if (parsedSession.streamIndex === conversation.streamIndex) {
    const savedEvents = await readTranscript(conversation.events)
    if (parsedEvents.length < savedEvents.length) return
  }

  const blobPath = getTranscriptPath(
    userId,
    conversation.id,
    parsedSession.sessionId,
    parsedSession.streamIndex,
    parsedEvents.length,
  )
  await put(blobPath, JSON.stringify(parsedEvents), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  })
  const [updated] = await db.update(agentThreads).set({
    eveSessionId: parsedSession.sessionId,
    continuationToken: parsedSession.continuationToken,
    streamIndex: parsedSession.streamIndex,
    events: { blobPath },
    ...(shouldTitle ? { title: createTitle(firstMessage ?? '') } : {}),
    updatedAt: new Date(),
  }).where(and(
    eq(agentThreads.id, conversation.id),
    eq(agentThreads.userId, userId),
    or(isNull(agentThreads.eveSessionId), eq(agentThreads.eveSessionId, parsedSession.sessionId)),
    lte(agentThreads.streamIndex, parsedSession.streamIndex),
  )).returning({ id: agentThreads.id })

  if (!updated) {
    await del(blobPath).catch(() => undefined)
    if (conversation.eveSessionId !== parsedSession.sessionId) {
      throw new Error('Conversation is already attached to a different Eve session')
    }
    return
  }

  const previousPointer = transcriptPointerSchema.safeParse(conversation.events)
  if (previousPointer.success && previousPointer.data.blobPath !== blobPath) {
    await del(previousPointer.data.blobPath).catch(() => undefined)
  }
}

export async function persistConversationSession(
  workspaceId: string,
  conversationId: string,
  sessionState: unknown,
  firstMessage?: string,
) {
  const userId = await getUserId()
  const conversation = await requireConversation(userId, workspaceId, conversationId)
  const parsedSession = sessionStateSchema.parse(sessionState)
  if (!parsedSession.sessionId) throw new Error('Missing Eve session ID')
  const shouldTitle = conversation.title === 'New conversation' && Boolean(firstMessage?.trim())

  const [updated] = await db.update(agentThreads).set({
    eveSessionId: parsedSession.sessionId,
    continuationToken: parsedSession.continuationToken,
    streamIndex: parsedSession.streamIndex,
    ...(shouldTitle ? { title: createTitle(firstMessage ?? '') } : {}),
    updatedAt: new Date(),
  }).where(and(
    eq(agentThreads.id, conversation.id),
    eq(agentThreads.userId, userId),
    or(isNull(agentThreads.eveSessionId), eq(agentThreads.eveSessionId, parsedSession.sessionId)),
    lte(agentThreads.streamIndex, parsedSession.streamIndex),
  )).returning({ id: agentThreads.id })

  if (!updated && conversation.eveSessionId !== parsedSession.sessionId) {
    throw new Error('Conversation is already attached to a different Eve session')
  }
}

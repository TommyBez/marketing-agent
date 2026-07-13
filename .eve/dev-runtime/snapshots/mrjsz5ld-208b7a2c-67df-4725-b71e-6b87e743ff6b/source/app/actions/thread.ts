'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { agentThreads, companyProfiles } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import type { HandleMessageStreamEvent } from 'eve/client'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'

const idSchema = z.string().uuid()
const titleSchema = z.string().trim().min(1).max(80)
const sessionStateSchema = z.object({
  continuationToken: z.string().optional(),
  sessionId: z.string().optional(),
  streamIndex: z.number().int().min(0),
})
const transcriptEventsSchema = z.array(z.unknown()).max(5_000)

export interface ConversationSummary {
  id: string
  title: string
  updatedAt: Date
}

async function getUserId() {
  const currentSession = await auth.api.getSession({ headers: await headers() })
  if (!currentSession?.user) throw new Error('Unauthorized')
  return currentSession.user.id
}

async function requireWorkspace(userId: string, workspaceId: string) {
  const parsedWorkspaceId = idSchema.safeParse(workspaceId)
  if (!parsedWorkspaceId.success) throw new Error('Invalid workspace')
  const workspace = (await db.select({ id: companyProfiles.id }).from(companyProfiles).where(and(
    eq(companyProfiles.id, parsedWorkspaceId.data),
    eq(companyProfiles.userId, userId),
  )).limit(1))[0]
  if (!workspace) throw new Error('Workspace not found')
  return workspace.id
}

async function requireConversation(userId: string, workspaceId: string, conversationId: string) {
  const parsedConversationId = idSchema.safeParse(conversationId)
  if (!parsedConversationId.success) throw new Error('Invalid conversation')
  const validWorkspaceId = await requireWorkspace(userId, workspaceId)
  const conversation = (await db.select().from(agentThreads).where(and(
    eq(agentThreads.id, parsedConversationId.data),
    eq(agentThreads.companyProfileId, validWorkspaceId),
    eq(agentThreads.userId, userId),
  )).limit(1))[0]
  if (!conversation) throw new Error('Conversation not found')
  return conversation
}

function createTitle(message: string) {
  const normalized = message.replace(/\s+/g, ' ').trim()
  if (!normalized) return 'New conversation'
  return normalized.length > 64 ? `${normalized.slice(0, 61).trimEnd()}…` : normalized
}

export async function listWorkspaceConversations(workspaceId: string): Promise<ConversationSummary[]> {
  const userId = await getUserId()
  const validWorkspaceId = await requireWorkspace(userId, workspaceId)
  return db.select({ id: agentThreads.id, title: agentThreads.title, updatedAt: agentThreads.updatedAt })
    .from(agentThreads)
    .where(and(eq(agentThreads.userId, userId), eq(agentThreads.companyProfileId, validWorkspaceId)))
    .orderBy(desc(agentThreads.updatedAt))
}

export async function createConversation(workspaceId: string) {
  const userId = await getUserId()
  const validWorkspaceId = await requireWorkspace(userId, workspaceId)
  const [conversation] = await db.insert(agentThreads).values({
    userId,
    companyProfileId: validWorkspaceId,
    title: 'New conversation',
  }).returning({ id: agentThreads.id, title: agentThreads.title, updatedAt: agentThreads.updatedAt })
  revalidatePath(`/workspace/${validWorkspaceId}`)
  return conversation
}

export async function getConversation(workspaceId: string, conversationId: string) {
  const userId = await getUserId()
  const conversation = await requireConversation(userId, workspaceId, conversationId)
  return {
    id: conversation.id,
    title: conversation.title,
    events: transcriptEventsSchema.parse(conversation.events) as HandleMessageStreamEvent[],
    session: {
      continuationToken: conversation.continuationToken ?? undefined,
      sessionId: conversation.eveSessionId ?? undefined,
      streamIndex: conversation.streamIndex,
    },
  }
}

export async function saveConversation(workspaceId: string, conversationId: string, sessionState: unknown, events: unknown, firstMessage?: string) {
  const userId = await getUserId()
  const conversation = await requireConversation(userId, workspaceId, conversationId)
  const parsedSession = sessionStateSchema.parse(sessionState)
  const parsedEvents = transcriptEventsSchema.parse(events)
  const shouldTitle = conversation.title === 'New conversation' && Boolean(firstMessage?.trim())

  await db.update(agentThreads).set({
    eveSessionId: parsedSession.sessionId,
    continuationToken: parsedSession.continuationToken,
    streamIndex: parsedSession.streamIndex,
    events: parsedEvents,
    ...(shouldTitle ? { title: createTitle(firstMessage ?? '') } : {}),
    updatedAt: new Date(),
  }).where(and(eq(agentThreads.id, conversation.id), eq(agentThreads.userId, userId)))
  revalidatePath(`/workspace/${workspaceId}`)
}

export async function renameConversation(workspaceId: string, conversationId: string, title: string) {
  const userId = await getUserId()
  const conversation = await requireConversation(userId, workspaceId, conversationId)
  const parsedTitle = titleSchema.safeParse(title)
  if (!parsedTitle.success) throw new Error('Enter a conversation title')
  await db.update(agentThreads).set({ title: parsedTitle.data, updatedAt: new Date() }).where(and(
    eq(agentThreads.id, conversation.id),
    eq(agentThreads.userId, userId),
  ))
  revalidatePath(`/workspace/${workspaceId}`)
}

export async function deleteConversation(workspaceId: string, conversationId: string) {
  const userId = await getUserId()
  const conversation = await requireConversation(userId, workspaceId, conversationId)
  await db.delete(agentThreads).where(and(eq(agentThreads.id, conversation.id), eq(agentThreads.userId, userId)))
  revalidatePath(`/workspace/${workspaceId}`)
}

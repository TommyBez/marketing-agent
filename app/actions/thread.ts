'use server'

import { db } from '@/lib/db'
import { agentThreads, companyProfiles } from '@/lib/db/schema'
import { getConversationTranscriptBlobPath, readConversationTranscript } from '@/lib/conversation-transcript'
import { getPublicShareResourceCacheTag } from '@/lib/public-share'
import { requireWorkspaceMembership } from '@/lib/workspace-access'
import { del } from '@vercel/blob'
import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'

const idSchema = z.uuid()
const titleSchema = z.string().trim().min(1).max(80)
export interface ConversationSummary {
  id: string
  title: string
  updatedAt: Date
}

async function requireConversation(workspaceId: string, conversationId: string) {
  const parsedConversationId = idSchema.safeParse(conversationId)
  if (!parsedConversationId.success) throw new Error('Invalid conversation')
  const { workspace } = await requireWorkspaceMembership(workspaceId)
  const conversation = (await db.select().from(agentThreads).where(and(
    eq(agentThreads.id, parsedConversationId.data),
    eq(agentThreads.companyProfileId, workspace.id),
  )).limit(1))[0]
  if (!conversation) throw new Error('Conversation not found')
  return conversation
}

export async function listWorkspaceConversations(workspaceId: string): Promise<ConversationSummary[]> {
  const { workspace } = await requireWorkspaceMembership(workspaceId)
  return db.select({ id: agentThreads.id, title: agentThreads.title, updatedAt: agentThreads.updatedAt })
    .from(agentThreads)
    .where(eq(agentThreads.companyProfileId, workspace.id))
    .orderBy(desc(agentThreads.updatedAt))
}

export async function createConversation(workspaceId: string) {
  const { userId, workspace } = await requireWorkspaceMembership(workspaceId)
  const [conversation] = await db.insert(agentThreads).values({
    userId,
    companyProfileId: workspace.id,
    title: 'New conversation',
  }).returning({ id: agentThreads.id, title: agentThreads.title, updatedAt: agentThreads.updatedAt })
  revalidatePath(`/workspace/${workspace.id}`)
  return conversation
}

export async function ensureWorkspaceConversation(workspaceId: string) {
  const { userId, workspace } = await requireWorkspaceMembership(workspaceId)
  const conversation = await db.transaction(async (transaction) => {
    const [lockedWorkspace] = await transaction.select({ id: companyProfiles.id }).from(companyProfiles)
      .where(eq(companyProfiles.id, workspace.id)).for('update')
    if (!lockedWorkspace) throw new Error('Workspace not found')

    const existing = (await transaction.select({
      id: agentThreads.id,
      title: agentThreads.title,
      updatedAt: agentThreads.updatedAt,
    }).from(agentThreads).where(and(
      eq(agentThreads.companyProfileId, workspace.id),
    )).orderBy(desc(agentThreads.updatedAt)).limit(1))[0]
    if (existing) return existing

    return (await transaction.insert(agentThreads).values({
      userId,
      companyProfileId: workspace.id,
      title: 'New conversation',
    }).returning({ id: agentThreads.id, title: agentThreads.title, updatedAt: agentThreads.updatedAt }))[0]
  })
  revalidatePath(`/workspace/${workspace.id}`)
  return conversation
}

export async function getConversation(workspaceId: string, conversationId: string) {
  const conversation = await requireConversation(workspaceId, conversationId)
  return {
    id: conversation.id,
    title: conversation.title,
    events: await readConversationTranscript(conversation.events),
    session: {
      continuationToken: conversation.continuationToken ?? undefined,
      sessionId: conversation.eveSessionId ?? undefined,
      streamIndex: conversation.streamIndex,
    },
  }
}

export async function renameConversation(workspaceId: string, conversationId: string, title: string) {
  const conversation = await requireConversation(workspaceId, conversationId)
  const parsedTitle = titleSchema.safeParse(title)
  if (!parsedTitle.success) throw new Error('Enter a conversation title')
  await db.update(agentThreads).set({ title: parsedTitle.data, updatedAt: new Date() }).where(and(
    eq(agentThreads.id, conversation.id),
    eq(agentThreads.companyProfileId, conversation.companyProfileId),
  ))
  revalidatePath(`/workspace/${workspaceId}`)
}

export async function deleteConversation(workspaceId: string, conversationId: string) {
  const conversation = await requireConversation(workspaceId, conversationId)
  await db.delete(agentThreads).where(and(
    eq(agentThreads.id, conversation.id),
    eq(agentThreads.companyProfileId, conversation.companyProfileId),
  ))
  updateTag(getPublicShareResourceCacheTag('conversation', conversation.id))
  const blobPath = getConversationTranscriptBlobPath(conversation.events)
  if (blobPath) await del(blobPath).catch(() => undefined)
  revalidatePath(`/workspace/${workspaceId}`)
}

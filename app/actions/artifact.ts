'use server'

import { db } from '@/lib/db'
import { agentThreads, artifacts } from '@/lib/db/schema'
import { requireWorkspaceMembership } from '@/lib/workspace-access'
import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const idSchema = z.uuid()
const titleSchema = z.string().trim().min(1, 'Enter an artifact title').max(120, 'Artifact title must be 120 characters or fewer')
const contentSchema = z.string().trim().min(1, 'The artifact content is empty').max(200_000, 'This output is too large to save as an artifact')

export interface ArtifactSummary {
  id: string
  title: string
  updatedAt: Date
}

async function requireArtifact(workspaceId: string, artifactId: string) {
  const parsedArtifactId = idSchema.safeParse(artifactId)
  if (!parsedArtifactId.success) throw new Error('Invalid artifact')
  const { workspace } = await requireWorkspaceMembership(workspaceId)
  const artifact = (await db.select().from(artifacts).where(and(
    eq(artifacts.id, parsedArtifactId.data),
    eq(artifacts.companyProfileId, workspace.id),
  )).limit(1))[0]
  if (!artifact) throw new Error('Artifact not found')
  return artifact
}

export async function saveArtifact(workspaceId: string, input: { title: string; content: string; conversationId?: string }) {
  const { userId, workspace } = await requireWorkspaceMembership(workspaceId)
  const parsedTitle = titleSchema.parse(input.title)
  const parsedContent = contentSchema.parse(input.content)
  const parsedConversationId = idSchema.optional().parse(input.conversationId)
  if (parsedConversationId) {
    const conversation = (await db.select({ id: agentThreads.id }).from(agentThreads).where(and(
      eq(agentThreads.id, parsedConversationId),
      eq(agentThreads.companyProfileId, workspace.id),
    )).limit(1))[0]
    if (!conversation) throw new Error('Conversation not found')
  }
  const [artifact] = await db.insert(artifacts).values({
    userId,
    companyProfileId: workspace.id,
    threadId: parsedConversationId ?? null,
    title: parsedTitle,
    content: parsedContent,
  }).returning({ id: artifacts.id, title: artifacts.title, updatedAt: artifacts.updatedAt })
  revalidatePath(`/workspace/${workspace.id}`)
  return artifact
}

export async function listWorkspaceArtifacts(workspaceId: string): Promise<ArtifactSummary[]> {
  const { workspace } = await requireWorkspaceMembership(workspaceId)
  return db.select({ id: artifacts.id, title: artifacts.title, updatedAt: artifacts.updatedAt })
    .from(artifacts)
    .where(eq(artifacts.companyProfileId, workspace.id))
    .orderBy(desc(artifacts.updatedAt))
}

export async function getArtifact(workspaceId: string, artifactId: string) {
  const artifact = await requireArtifact(workspaceId, artifactId)
  return {
    id: artifact.id,
    title: artifact.title,
    content: artifact.content,
    conversationId: artifact.threadId,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
  }
}

export async function renameArtifact(workspaceId: string, artifactId: string, title: string) {
  const artifact = await requireArtifact(workspaceId, artifactId)
  const parsedTitle = titleSchema.safeParse(title)
  if (!parsedTitle.success) throw new Error('Enter an artifact title')
  await db.update(artifacts).set({ title: parsedTitle.data, updatedAt: new Date() }).where(and(
    eq(artifacts.id, artifact.id),
    eq(artifacts.companyProfileId, artifact.companyProfileId),
  ))
  revalidatePath(`/workspace/${workspaceId}`)
}

export async function deleteArtifact(workspaceId: string, artifactId: string) {
  const artifact = await requireArtifact(workspaceId, artifactId)
  await db.delete(artifacts).where(and(
    eq(artifacts.id, artifact.id),
    eq(artifacts.companyProfileId, artifact.companyProfileId),
  ))
  revalidatePath(`/workspace/${workspaceId}`)
}

'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { artifacts, companyProfiles } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'

const idSchema = z.uuid()
const titleSchema = z.string().trim().min(1, 'Enter an artifact title').max(120, 'Artifact title must be 120 characters or fewer')
const contentSchema = z.string().trim().min(1, 'The artifact content is empty').max(200_000, 'This output is too large to save as an artifact')

export interface ArtifactSummary {
  id: string
  title: string
  updatedAt: Date
}

// Postgres 42P01 (undefined_table): the artifacts table hasn't been pushed yet (pnpm db:push).
function isMissingArtifactsTable(cause: unknown): boolean {
  if (!cause || typeof cause !== 'object') return false
  if ('code' in cause && (cause as { code?: unknown }).code === '42P01') return true
  return 'cause' in cause && isMissingArtifactsTable((cause as { cause?: unknown }).cause)
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

async function requireArtifact(userId: string, workspaceId: string, artifactId: string) {
  const parsedArtifactId = idSchema.safeParse(artifactId)
  if (!parsedArtifactId.success) throw new Error('Invalid artifact')
  const validWorkspaceId = await requireWorkspace(userId, workspaceId)
  const artifact = (await db.select().from(artifacts).where(and(
    eq(artifacts.id, parsedArtifactId.data),
    eq(artifacts.companyProfileId, validWorkspaceId),
    eq(artifacts.userId, userId),
  )).limit(1))[0]
  if (!artifact) throw new Error('Artifact not found')
  return artifact
}

export async function saveArtifact(workspaceId: string, input: { title: string; content: string; conversationId?: string }) {
  const userId = await getUserId()
  const validWorkspaceId = await requireWorkspace(userId, workspaceId)
  const parsedTitle = titleSchema.parse(input.title)
  const parsedContent = contentSchema.parse(input.content)
  const parsedConversationId = idSchema.safeParse(input.conversationId)
  try {
    const [artifact] = await db.insert(artifacts).values({
      userId,
      companyProfileId: validWorkspaceId,
      threadId: parsedConversationId.success ? parsedConversationId.data : null,
      title: parsedTitle,
      content: parsedContent,
    }).returning({ id: artifacts.id, title: artifacts.title, updatedAt: artifacts.updatedAt })
    revalidatePath(`/workspace/${validWorkspaceId}`)
    return artifact
  } catch (cause) {
    if (isMissingArtifactsTable(cause)) throw new Error('Artifacts storage is not set up yet. Run `pnpm db:push` to create it.')
    throw cause
  }
}

export async function listWorkspaceArtifacts(workspaceId: string): Promise<ArtifactSummary[]> {
  const userId = await getUserId()
  const validWorkspaceId = await requireWorkspace(userId, workspaceId)
  try {
    return await db.select({ id: artifacts.id, title: artifacts.title, updatedAt: artifacts.updatedAt })
      .from(artifacts)
      .where(and(eq(artifacts.userId, userId), eq(artifacts.companyProfileId, validWorkspaceId)))
      .orderBy(desc(artifacts.updatedAt))
  } catch (cause) {
    if (isMissingArtifactsTable(cause)) return []
    throw cause
  }
}

export async function getArtifact(workspaceId: string, artifactId: string) {
  const userId = await getUserId()
  const artifact = await requireArtifact(userId, workspaceId, artifactId)
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
  const userId = await getUserId()
  const artifact = await requireArtifact(userId, workspaceId, artifactId)
  const parsedTitle = titleSchema.safeParse(title)
  if (!parsedTitle.success) throw new Error('Enter an artifact title')
  await db.update(artifacts).set({ title: parsedTitle.data, updatedAt: new Date() }).where(and(
    eq(artifacts.id, artifact.id),
    eq(artifacts.userId, userId),
  ))
  revalidatePath(`/workspace/${workspaceId}`)
}

export async function deleteArtifact(workspaceId: string, artifactId: string) {
  const userId = await getUserId()
  const artifact = await requireArtifact(userId, workspaceId, artifactId)
  await db.delete(artifacts).where(and(eq(artifacts.id, artifact.id), eq(artifacts.userId, userId)))
  revalidatePath(`/workspace/${workspaceId}`)
}

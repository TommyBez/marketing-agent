'use server'

import { readConversationTranscript } from '@/lib/conversation-transcript'
import { actionFailure, actionSuccess, type ActionResult } from '@/lib/action-result'
import { db } from '@/lib/db'
import { agentThreads, artifacts, publicShares } from '@/lib/db/schema'
import {
  type PublicShareResource,
  type PublicShareSnapshot,
  type WorkspacePublicShare,
} from '@/lib/public-share-contract'
import {
  createPublicConversationMessages,
  getConversationShareRestriction,
  parsePublicShareSnapshot,
} from '@/lib/public-share'
import { canManageOrganization, requireWorkspaceMembership } from '@/lib/workspace-access'
import { and, eq } from 'drizzle-orm'
import { isCurrentTurnBoundaryEvent } from 'eve/client'
import { nanoid } from 'nanoid'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const resourceSchema = z.discriminatedUnion('type', [
  z.object({ id: z.uuid(), type: z.literal('artifact') }),
  z.object({ id: z.uuid(), type: z.literal('conversation') }),
])
const shareIdSchema = z.uuid()

function toWorkspacePublicShare(
  share: {
    createdAt: Date
    createdByUserId: string | null
    id: string
    publicId: string
  },
  access: { role: string; userId: string },
): WorkspacePublicShare {
  return {
    canRevoke: share.createdByUserId === access.userId || canManageOrganization(access.role),
    createdAt: share.createdAt.toISOString(),
    id: share.id,
    publicId: share.publicId,
  }
}

function resourceWhere(resource: PublicShareResource) {
  return resource.type === 'artifact'
    ? eq(publicShares.artifactId, resource.id)
    : eq(publicShares.threadId, resource.id)
}

async function findShare(
  workspaceId: string,
  resource: PublicShareResource,
) {
  const parsedResource = resourceSchema.parse(resource)
  const access = await requireWorkspaceMembership(workspaceId)
  const share = (await db.select({
    createdAt: publicShares.createdAt,
    createdByUserId: publicShares.createdByUserId,
    id: publicShares.id,
    publicId: publicShares.publicId,
  }).from(publicShares).where(and(
    eq(publicShares.companyProfileId, access.workspace.id),
    resourceWhere(parsedResource),
  )).limit(1))[0]

  return { access, parsedResource, share }
}

export async function getWorkspacePublicShare(
  workspaceId: string,
  resource: PublicShareResource,
): Promise<WorkspacePublicShare | null> {
  const { access, share } = await findShare(workspaceId, resource)
  return share ? toWorkspacePublicShare(share, access) : null
}

async function createSnapshot(
  workspaceId: string,
  resource: PublicShareResource,
): Promise<ActionResult<{
  access: Awaited<ReturnType<typeof requireWorkspaceMembership>>
  snapshot: PublicShareSnapshot
}>> {
  const parsedResource = resourceSchema.parse(resource)
  const access = await requireWorkspaceMembership(workspaceId)

  if (parsedResource.type === 'artifact') {
    const artifact = (await db.select({
      content: artifacts.content,
      title: artifacts.title,
    }).from(artifacts).where(and(
      eq(artifacts.id, parsedResource.id),
      eq(artifacts.companyProfileId, access.workspace.id),
    )).limit(1))[0]
    if (!artifact) return actionFailure('Artifact not found')

    return actionSuccess({
      access,
      snapshot: parsePublicShareSnapshot({
        content: artifact.content,
        title: artifact.title,
        type: 'artifact',
        version: 1,
        workspaceName: access.workspace.name,
      }),
    })
  }

  const conversation = (await db.select({
    events: agentThreads.events,
    title: agentThreads.title,
  }).from(agentThreads).where(and(
    eq(agentThreads.id, parsedResource.id),
    eq(agentThreads.companyProfileId, access.workspace.id),
  )).limit(1))[0]
  if (!conversation) return actionFailure('Conversation not found')

  const events = await readConversationTranscript(conversation.events)
  if (!events.length) return actionFailure('This conversation has no messages to share yet')
  if (!isCurrentTurnBoundaryEvent(events.at(-1)!)) {
    return actionFailure('Wait for the current response to finish before sharing')
  }

  let messages: ReturnType<typeof createPublicConversationMessages>
  let restriction: string | null
  try {
    restriction = getConversationShareRestriction(events)
    messages = createPublicConversationMessages(events)
  } catch {
    return actionFailure('This conversation could not be prepared for sharing')
  }
  if (restriction) return actionFailure(restriction)
  if (!messages.length) {
    return actionFailure('This conversation has no completed messages to share yet')
  }

  return actionSuccess({
    access,
    snapshot: parsePublicShareSnapshot({
      messages,
      title: conversation.title,
      type: 'conversation',
      version: 1,
      workspaceName: access.workspace.name,
    }),
  })
}

export async function createWorkspacePublicShare(
  workspaceId: string,
  resource: PublicShareResource,
): Promise<ActionResult<WorkspacePublicShare>> {
  const existing = await findShare(workspaceId, resource)
  if (existing.share) {
    return actionSuccess(toWorkspacePublicShare(existing.share, existing.access))
  }

  const snapshotResult = await createSnapshot(workspaceId, existing.parsedResource)
  if (!snapshotResult.ok) return snapshotResult
  const { access, snapshot } = snapshotResult.data
  await db.insert(publicShares).values({
    artifactId: existing.parsedResource.type === 'artifact' ? existing.parsedResource.id : null,
    companyProfileId: access.workspace.id,
    createdByUserId: access.userId,
    publicId: nanoid(32),
    resourceType: existing.parsedResource.type,
    snapshot,
    threadId: existing.parsedResource.type === 'conversation' ? existing.parsedResource.id : null,
  }).onConflictDoNothing()

  const created = await findShare(workspaceId, existing.parsedResource)
  if (!created.share) throw new Error('Unable to create the public link')

  revalidatePath(`/workspace/${workspaceId}`)
  return actionSuccess(toWorkspacePublicShare(created.share, created.access))
}

export async function revokeWorkspacePublicShare(
  workspaceId: string,
  shareId: string,
): Promise<ActionResult> {
  const parsedShareId = shareIdSchema.parse(shareId)
  const access = await requireWorkspaceMembership(workspaceId)
  const share = (await db.select({
    createdByUserId: publicShares.createdByUserId,
    publicId: publicShares.publicId,
  }).from(publicShares).where(and(
    eq(publicShares.id, parsedShareId),
    eq(publicShares.companyProfileId, access.workspace.id),
  )).limit(1))[0]
  if (!share) return actionSuccess(null)
  if (share.createdByUserId !== access.userId && !canManageOrganization(access.role)) {
    return actionFailure('Only the link creator or a workspace admin can revoke it')
  }

  await db.delete(publicShares).where(and(
    eq(publicShares.id, parsedShareId),
    eq(publicShares.companyProfileId, access.workspace.id),
  ))
  revalidatePath(`/s/${share.publicId}`)
  revalidatePath(`/workspace/${workspaceId}`)
  return actionSuccess(null)
}

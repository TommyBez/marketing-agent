import 'server-only'

import { db } from '@/lib/db'
import { publicShares } from '@/lib/db/schema'
import type {
  PublicConversationMessage,
  PublicShareSnapshot,
} from '@/lib/public-share-contract'
import { eq } from 'drizzle-orm'
import {
  defaultMessageReducer,
  type HandleMessageStreamEvent,
} from 'eve/client'
import { cacheLife, cacheTag } from 'next/cache'
import { z } from 'zod'

export const publicShareIdSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/)

const publicConversationMessageSchema = z.object({
  role: z.enum(['assistant', 'user']),
  text: z.string().min(1),
})

const publicShareSnapshotSchema = z.discriminatedUnion('type', [
  z.object({
    content: z.string().min(1),
    title: z.string().min(1),
    type: z.literal('artifact'),
    version: z.literal(1),
    workspaceName: z.string().min(1),
  }),
  z.object({
    messages: z.array(publicConversationMessageSchema).min(1),
    title: z.string().min(1),
    type: z.literal('conversation'),
    version: z.literal(1),
    workspaceName: z.string().min(1),
  }),
])

export function createPublicConversationMessages(
  events: readonly HandleMessageStreamEvent[],
): PublicConversationMessage[] {
  const reducer = defaultMessageReducer()

  const projection = events.reduce((state, event) => {
    if (event.type !== 'message.received' && event.type !== 'message.completed') {
      return state
    }
    return reducer.reduce(state, event)
  }, reducer.initial())

  return projection.messages.flatMap((message) => {
    const text = message.parts
      .flatMap((part) => part.type === 'text' && part.state === 'done' ? [part.text.trim()] : [])
      .filter(Boolean)
      .join('\n\n')

    return text ? [{ role: message.role, text }] : []
  })
}

export function getConversationShareRestriction(
  events: readonly HandleMessageStreamEvent[],
): string | null {
  const reducer = defaultMessageReducer()
  const projection = events.reduce(
    (state, event) => reducer.reduce(state, event),
    reducer.initial(),
  )

  for (const message of projection.messages) {
    for (const part of message.parts) {
      if (part.type === 'file') {
        return 'Conversations with file attachments cannot be shared yet'
      }
      if (part.type === 'authorization' && part.state === 'required') {
        return 'Complete the pending authorization before sharing this conversation'
      }
      if (
        part.type === 'dynamic-tool'
        && (part.state === 'approval-requested' || part.state === 'approval-responded')
      ) {
        return 'Answer the pending request before sharing this conversation'
      }
    }
  }

  return null
}

export function parsePublicShareSnapshot(value: unknown): PublicShareSnapshot {
  return publicShareSnapshotSchema.parse(value)
}

export function getPublicShareCacheTag(publicId: string) {
  return `public-share:${publicId}`
}

export function getPublicShareResourceCacheTag(resourceType: 'artifact' | 'conversation', resourceId: string) {
  return `public-share-resource:${resourceType}:${resourceId}`
}

export function getPublicShareWorkspaceCacheTag(workspaceId: string) {
  return `public-share-workspace:${workspaceId}`
}

async function getCachedPublicShareByPublicId(publicId: string) {
  'use cache'

  cacheLife('max')
  cacheTag(getPublicShareCacheTag(publicId))

  const share = (await db.select({
    artifactId: publicShares.artifactId,
    companyProfileId: publicShares.companyProfileId,
    createdAt: publicShares.createdAt,
    publicId: publicShares.publicId,
    resourceType: publicShares.resourceType,
    snapshot: publicShares.snapshot,
    threadId: publicShares.threadId,
  }).from(publicShares).where(eq(publicShares.publicId, publicId)).limit(1))[0]

  if (!share) return null

  cacheTag(getPublicShareWorkspaceCacheTag(share.companyProfileId))
  if (share.resourceType === 'artifact' && share.artifactId) {
    cacheTag(getPublicShareResourceCacheTag('artifact', share.artifactId))
  }
  if (share.resourceType === 'conversation' && share.threadId) {
    cacheTag(getPublicShareResourceCacheTag('conversation', share.threadId))
  }

  const snapshot = publicShareSnapshotSchema.safeParse(share.snapshot)
  if (!snapshot.success) return null

  return {
    createdAt: share.createdAt,
    publicId: share.publicId,
    snapshot: snapshot.data,
  }
}

export async function getPublicShareByPublicId(publicId: string) {
  const parsedPublicId = publicShareIdSchema.safeParse(publicId)
  if (!parsedPublicId.success) return null

  return getCachedPublicShareByPublicId(parsedPublicId.data)
}

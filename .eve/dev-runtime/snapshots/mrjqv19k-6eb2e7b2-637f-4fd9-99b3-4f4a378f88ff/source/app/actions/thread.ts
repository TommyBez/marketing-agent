'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { agentThreads, companyProfiles } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import type { HandleMessageStreamEvent } from 'eve/client'
import { headers } from 'next/headers'
import { z } from 'zod'

const workspaceIdSchema = z.string().uuid()
const sessionStateSchema = z.object({
  continuationToken: z.string().optional(),
  sessionId: z.string().optional(),
  streamIndex: z.number().int().min(0),
})
const transcriptEventsSchema = z.array(z.unknown()).max(5_000)

async function getUserId() {
  const currentSession = await auth.api.getSession({ headers: await headers() })
  if (!currentSession?.user) throw new Error('Unauthorized')
  return currentSession.user.id
}

async function assertWorkspaceOwnership(userId: string, workspaceId: string) {
  const workspace = (await db.select({ id: companyProfiles.id }).from(companyProfiles).where(and(
    eq(companyProfiles.id, workspaceId),
    eq(companyProfiles.userId, userId),
  )).limit(1))[0]
  if (!workspace) throw new Error('Workspace not found')
}

export async function getWorkspaceThread(workspaceId: string) {
  const userId = await getUserId()
  const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId)
  await assertWorkspaceOwnership(userId, parsedWorkspaceId)

  const thread = (await db.select().from(agentThreads).where(and(
    eq(agentThreads.userId, userId),
    eq(agentThreads.companyProfileId, parsedWorkspaceId),
    eq(agentThreads.channel, 'web'),
  )).limit(1))[0]

  if (!thread) return null
  return {
    events: transcriptEventsSchema.parse(thread.events) as HandleMessageStreamEvent[],
    session: {
      continuationToken: thread.continuationToken ?? undefined,
      sessionId: thread.eveSessionId ?? undefined,
      streamIndex: thread.streamIndex,
    },
  }
}

export async function saveWorkspaceThread(workspaceId: string, sessionState: unknown, events: unknown) {
  const userId = await getUserId()
  const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId)
  const parsedSession = sessionStateSchema.parse(sessionState)
  const parsedEvents = transcriptEventsSchema.parse(events)
  await assertWorkspaceOwnership(userId, parsedWorkspaceId)

  await db.insert(agentThreads).values({
    userId,
    companyProfileId: parsedWorkspaceId,
    channel: 'web',
    eveSessionId: parsedSession.sessionId,
    continuationToken: parsedSession.continuationToken,
    streamIndex: parsedSession.streamIndex,
    events: parsedEvents,
  }).onConflictDoUpdate({
    target: [agentThreads.userId, agentThreads.companyProfileId, agentThreads.channel],
    set: {
      eveSessionId: parsedSession.sessionId,
      continuationToken: parsedSession.continuationToken,
      streamIndex: parsedSession.streamIndex,
      events: parsedEvents,
      updatedAt: new Date(),
    },
  })
}

export async function resetWorkspaceThread(workspaceId: string) {
  const userId = await getUserId()
  const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId)
  await assertWorkspaceOwnership(userId, parsedWorkspaceId)
  await db.delete(agentThreads).where(and(
    eq(agentThreads.userId, userId),
    eq(agentThreads.companyProfileId, parsedWorkspaceId),
    eq(agentThreads.channel, 'web'),
  ))
}

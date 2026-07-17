import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { agentThreads, companyProfiles, member } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { eveChannel } from 'eve/channels/eve'
import { ForbiddenError, localDev, vercelOidc } from 'eve/channels/auth'
import { z } from 'zod'

const resourceIdSchema = z.string().uuid()

function rejectConversationAccess(): never {
  throw new ForbiddenError({
    code: 'eve_conversation_forbidden',
    message: 'The selected Eve conversation is unavailable.',
  })
}

function eveSessionRoute(request: Request) {
  const pathname = new URL(request.url).pathname
  if (/\/eve\/v1\/session$/.test(pathname)) return { kind: 'create' } as const

  const match = pathname.match(/\/eve\/v1\/session\/([^/]+)(?:\/stream)?$/)
  if (!match?.[1]) return { kind: 'other' } as const

  try {
    return { kind: 'existing', sessionId: decodeURIComponent(match[1]) } as const
  }
  catch {
    return { kind: 'invalid' } as const
  }
}

async function betterAuthSession(request: Request) {
  const currentSession = await auth.api.getSession({ headers: request.headers })
  if (!currentSession?.user) return null

  const parsedWorkspaceId = resourceIdSchema.safeParse(request.headers.get('x-relay-workspace-id'))
  const parsedConversationId = resourceIdSchema.safeParse(request.headers.get('x-relay-conversation-id'))
  if (!parsedWorkspaceId.success || !parsedConversationId.success) rejectConversationAccess()

  const conversation = (await db
    .select({
      conversationId: agentThreads.id,
      eveSessionId: agentThreads.eveSessionId,
      organizationId: companyProfiles.organizationId,
      workspaceId: companyProfiles.id,
    })
    .from(companyProfiles)
    .innerJoin(member, and(
      eq(member.organizationId, companyProfiles.organizationId),
      eq(member.userId, currentSession.user.id),
    ))
    .innerJoin(agentThreads, and(
      eq(agentThreads.id, parsedConversationId.data),
      eq(agentThreads.companyProfileId, companyProfiles.id),
    ))
    .where(eq(companyProfiles.id, parsedWorkspaceId.data))
    .limit(1))[0]
  if (!conversation) rejectConversationAccess()

  const sessionRoute = eveSessionRoute(request)
  if (sessionRoute.kind === 'invalid') rejectConversationAccess()
  if (sessionRoute.kind === 'create' && conversation.eveSessionId !== null) rejectConversationAccess()
  if (sessionRoute.kind === 'existing' && conversation.eveSessionId !== sessionRoute.sessionId)
    rejectConversationAccess()

  return {
    attributes: {
      conversationId: conversation.conversationId,
      email: currentSession.user.email,
      name: currentSession.user.name,
      organizationId: conversation.organizationId,
      workspaceId: conversation.workspaceId,
    },
    authenticator: 'better-auth-session',
    issuer: 'relay',
    principalId: currentSession.user.id,
    principalType: 'user',
    subject: currentSession.user.id,
  } as const
}

export default eveChannel({
  auth: process.env.NODE_ENV === 'development'
    ? [betterAuthSession, vercelOidc(), localDev()]
    : [betterAuthSession, vercelOidc()],
})

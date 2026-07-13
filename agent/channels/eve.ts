import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { companyProfiles } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { eveChannel } from 'eve/channels/eve'
import { localDev, vercelOidc } from 'eve/channels/auth'
import { z } from 'zod'

const workspaceIdSchema = z.string().uuid()

async function betterAuthSession(request: Request) {
  const currentSession = await auth.api.getSession({ headers: request.headers })
  if (!currentSession?.user) return null

  const parsedWorkspaceId = workspaceIdSchema.safeParse(request.headers.get('x-relay-workspace-id'))
  if (!parsedWorkspaceId.success) return null

  const workspace = (await db.select({ id: companyProfiles.id }).from(companyProfiles).where(and(
    eq(companyProfiles.id, parsedWorkspaceId.data),
    eq(companyProfiles.userId, currentSession.user.id),
  )).limit(1))[0]
  if (!workspace) return null

  return {
    attributes: {
      email: currentSession.user.email,
      name: currentSession.user.name,
      workspaceId: workspace.id,
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

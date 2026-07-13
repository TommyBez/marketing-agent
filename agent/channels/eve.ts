import { auth } from '@/lib/auth'
import { eveChannel } from 'eve/channels/eve'
import { localDev, vercelOidc } from 'eve/channels/auth'

async function betterAuthSession(request: Request) {
  const currentSession = await auth.api.getSession({ headers: request.headers })
  if (!currentSession?.user) return null

  return {
    attributes: {
      email: currentSession.user.email,
      name: currentSession.user.name,
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

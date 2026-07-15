import 'server-only'

import { db } from '@/lib/db'
import { invitation, organization } from '@/lib/db/schema'
import { and, eq, gt } from 'drizzle-orm'
import { z } from 'zod'

const invitationIdSchema = z.string().min(1).max(200)

export async function getPendingInvitationSignInContext(invitationId: string) {
  const parsedInvitationId = invitationIdSchema.safeParse(invitationId)
  if (!parsedInvitationId.success) return null

  return (await db.select({
    email: invitation.email,
    organizationName: organization.name,
  }).from(invitation).innerJoin(
    organization,
    eq(organization.id, invitation.organizationId),
  ).where(and(
    eq(invitation.id, parsedInvitationId.data),
    eq(invitation.status, 'pending'),
    gt(invitation.expiresAt, new Date()),
  )).limit(1))[0] ?? null
}

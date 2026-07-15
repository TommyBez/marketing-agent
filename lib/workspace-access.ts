import 'server-only'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { companyProfiles, member } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { z } from 'zod'

const workspaceIdSchema = z.uuid()

export type OrganizationRole = 'owner' | 'admin' | 'member'

function includesRole(role: string, allowedRoles: OrganizationRole[]) {
  return role.split(',').some((value) => allowedRoles.includes(value.trim() as OrganizationRole))
}

export async function requireUser() {
  const requestHeaders = await headers()
  const currentSession = await auth.api.getSession({ headers: requestHeaders })
  if (!currentSession?.user) throw new Error('Unauthorized')
  return { requestHeaders, session: currentSession, userId: currentSession.user.id }
}

export async function requireWorkspaceMembership(
  workspaceId: string,
  allowedRoles?: OrganizationRole[],
) {
  const parsedWorkspaceId = workspaceIdSchema.safeParse(workspaceId)
  if (!parsedWorkspaceId.success) throw new Error('Invalid workspace')

  const { requestHeaders, session, userId } = await requireUser()
  const result = (await db.select({
    role: member.role,
    workspace: companyProfiles,
  }).from(companyProfiles).innerJoin(member, and(
    eq(member.organizationId, companyProfiles.organizationId),
    eq(member.userId, userId),
  )).where(eq(companyProfiles.id, parsedWorkspaceId.data)).limit(1))[0]

  if (!result) throw new Error('Workspace not found')
  if (allowedRoles && !includesRole(result.role, allowedRoles)) {
    throw new Error('You do not have permission to manage this workspace')
  }

  return {
    organizationId: result.workspace.organizationId,
    requestHeaders,
    role: result.role,
    session,
    userId,
    workspace: result.workspace,
  }
}

export function canManageOrganization(role: string) {
  return includesRole(role, ['owner', 'admin'])
}

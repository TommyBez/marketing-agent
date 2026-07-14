'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { companyProfiles, invitation, member, user } from '@/lib/db/schema'
import { canManageOrganization, requireUser, requireWorkspaceMembership } from '@/lib/workspace-access'
import { and, asc, desc, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const emailSchema = z.string().trim().email('Enter a valid email address').transform((value) => value.toLowerCase())
const invitationIdSchema = z.string().min(1)
const memberIdSchema = z.string().min(1)
const roleSchema = z.enum(['owner', 'admin', 'member'])

export async function getWorkspacePeople(workspaceId: string) {
  const access = await requireWorkspaceMembership(workspaceId)
  const members = await db.select({
    createdAt: member.createdAt,
    email: user.email,
    id: member.id,
    name: user.name,
    role: member.role,
    userId: member.userId,
  }).from(member).innerJoin(user, eq(user.id, member.userId)).where(
    eq(member.organizationId, access.organizationId),
  ).orderBy(asc(member.createdAt))

  const pendingInvitations = canManageOrganization(access.role)
    ? await db.select({
        createdAt: invitation.createdAt,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        id: invitation.id,
        role: invitation.role,
      }).from(invitation).where(and(
        eq(invitation.organizationId, access.organizationId),
        eq(invitation.status, 'pending'),
      )).orderBy(desc(invitation.createdAt))
    : []

  return {
    currentRole: access.role,
    currentUserId: access.userId,
    members,
    pendingInvitations,
  }
}

export async function inviteWorkspaceMember(workspaceId: string, email: string, role: string) {
  const access = await requireWorkspaceMembership(workspaceId, ['owner', 'admin'])
  const parsedRole = roleSchema.exclude(['owner']).parse(role)
  await auth.api.createInvitation({
    body: {
      email: emailSchema.parse(email),
      organizationId: access.organizationId,
      resend: true,
      role: parsedRole,
    },
    headers: access.requestHeaders,
  })
  revalidatePath(`/workspace/${workspaceId}`)
}

export async function updateWorkspaceMemberRole(workspaceId: string, memberId: string, role: string) {
  const access = await requireWorkspaceMembership(workspaceId, ['owner', 'admin'])
  await auth.api.updateMemberRole({
    body: {
      memberId: memberIdSchema.parse(memberId),
      organizationId: access.organizationId,
      role: roleSchema.parse(role),
    },
    headers: access.requestHeaders,
  })
  revalidatePath(`/workspace/${workspaceId}`)
}

export async function removeWorkspaceMember(workspaceId: string, memberId: string) {
  const access = await requireWorkspaceMembership(workspaceId, ['owner', 'admin'])
  await auth.api.removeMember({
    body: {
      memberIdOrEmail: memberIdSchema.parse(memberId),
      organizationId: access.organizationId,
    },
    headers: access.requestHeaders,
  })
  revalidatePath(`/workspace/${workspaceId}`)
}

export async function cancelWorkspaceInvitation(workspaceId: string, invitationId: string) {
  const access = await requireWorkspaceMembership(workspaceId, ['owner', 'admin'])
  await auth.api.cancelInvitation({
    body: { invitationId: invitationIdSchema.parse(invitationId) },
    headers: access.requestHeaders,
  })
  revalidatePath(`/workspace/${workspaceId}`)
}

export async function leaveWorkspace(workspaceId: string) {
  const access = await requireWorkspaceMembership(workspaceId)
  const nextWorkspace = (await db.select({ id: companyProfiles.id }).from(companyProfiles).innerJoin(member, and(
    eq(member.organizationId, companyProfiles.organizationId),
    eq(member.userId, access.userId),
  )).where(ne(companyProfiles.id, access.workspace.id)).orderBy(desc(companyProfiles.updatedAt)).limit(1))[0] ?? null

  await auth.api.leaveOrganization({
    body: { organizationId: access.organizationId },
    headers: access.requestHeaders,
  })
  revalidatePath('/workspace', 'layout')
  return { nextWorkspaceId: nextWorkspace?.id ?? null }
}

export async function acceptWorkspaceInvitation(invitationId: string) {
  const parsedInvitationId = invitationIdSchema.parse(invitationId)
  const { requestHeaders } = await requireUser()
  const accepted = await auth.api.acceptInvitation({
    body: { invitationId: parsedInvitationId },
    headers: requestHeaders,
  })
  const workspace = (await db.select({ id: companyProfiles.id }).from(companyProfiles).where(
    eq(companyProfiles.organizationId, accepted.invitation.organizationId),
  ).limit(1))[0]
  revalidatePath('/workspace', 'layout')
  redirect(workspace ? `/workspace/${workspace.id}` : '/workspace')
}

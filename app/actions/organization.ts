'use server'

import { getPostHogClient } from '@/lib/posthog-server'
import { auth } from '@/lib/auth'
import { actionFailure, actionSuccess, type ActionResult } from '@/lib/action-result'
import { db } from '@/lib/db'
import { companyProfiles, invitation, member, user } from '@/lib/db/schema'
import { propagateInvitationDeliveryFailure } from '@/lib/invitation-delivery'
import { canManageOrganization, requireUser, requireWorkspaceMembership } from '@/lib/workspace-access'
import { and, asc, desc, eq, gt, ne } from 'drizzle-orm'
import { isAPIError } from 'better-auth/api'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const emailSchema = z.string().trim().email('Enter a valid email address').transform((value) => value.toLowerCase())
const invitationIdSchema = z.string().min(1)
const memberIdSchema = z.string().min(1)
const roleSchema = z.enum(['owner', 'admin', 'member'])

const inviteErrorMessages: Record<string, string> = {
  INVITATION_LIMIT_REACHED: 'This workspace has reached its pending invitation limit.',
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: 'This person is already a member of the workspace.',
}

const updateRoleErrorMessages: Record<string, string> = {
  MEMBER_NOT_FOUND: 'This workspace member no longer exists.',
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER: 'A workspace must keep at least one owner.',
}

const removeMemberErrorMessages: Record<string, string> = {
  MEMBER_NOT_FOUND: 'This workspace member no longer exists.',
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER: 'A workspace must keep at least one owner.',
}

const cancelInvitationErrorMessages: Record<string, string> = {
  INVITATION_NOT_FOUND: 'This invitation is no longer available.',
}

function getOrganizationActionMessage(
  cause: unknown,
  messages: Record<string, string>,
): string | null {
  if (!isAPIError(cause)) return null
  const code = cause.body?.code
  return typeof code === 'string' ? messages[code] ?? null : null
}

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
        gt(invitation.expiresAt, new Date()),
      )).orderBy(desc(invitation.createdAt))
    : []

  return {
    currentRole: access.role,
    currentUserId: access.userId,
    members,
    pendingInvitations,
  }
}

export async function inviteWorkspaceMember(
  workspaceId: string,
  email: string,
  role: string,
): Promise<ActionResult> {
  const access = await requireWorkspaceMembership(workspaceId, ['owner', 'admin'])
  const parsedEmail = emailSchema.safeParse(email)
  if (!parsedEmail.success) {
    return actionFailure(parsedEmail.error.issues[0]?.message ?? 'Enter a valid email address')
  }
  const parsedRole = roleSchema.exclude(['owner']).safeParse(role)
  if (!parsedRole.success) return actionFailure('Choose a valid workspace role.')

  try {
    await propagateInvitationDeliveryFailure(() => auth.api.createInvitation({
      body: {
        email: parsedEmail.data,
        organizationId: access.organizationId,
        resend: true,
        role: parsedRole.data,
      },
      headers: access.requestHeaders,
    }))
  } catch (cause) {
    const message = getOrganizationActionMessage(cause, inviteErrorMessages)
    if (message) return actionFailure(message)
    throw cause
  }
  revalidatePath(`/workspace/${workspaceId}`)
  return actionSuccess(null)
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  memberId: string,
  role: string,
): Promise<ActionResult> {
  const access = await requireWorkspaceMembership(workspaceId, ['owner', 'admin'])
  const parsedMemberId = memberIdSchema.safeParse(memberId)
  if (!parsedMemberId.success) return actionFailure('This workspace member no longer exists.')
  const parsedRole = roleSchema.safeParse(role)
  if (!parsedRole.success) return actionFailure('Choose a valid workspace role.')

  try {
    await auth.api.updateMemberRole({
      body: {
        memberId: parsedMemberId.data,
        organizationId: access.organizationId,
        role: parsedRole.data,
      },
      headers: access.requestHeaders,
    })
  } catch (cause) {
    const message = getOrganizationActionMessage(cause, updateRoleErrorMessages)
    if (message) return actionFailure(message)
    throw cause
  }
  revalidatePath(`/workspace/${workspaceId}`)
  return actionSuccess(null)
}

export async function removeWorkspaceMember(
  workspaceId: string,
  memberId: string,
): Promise<ActionResult> {
  const access = await requireWorkspaceMembership(workspaceId, ['owner', 'admin'])
  const parsedMemberId = memberIdSchema.safeParse(memberId)
  if (!parsedMemberId.success) return actionFailure('This workspace member no longer exists.')

  try {
    await auth.api.removeMember({
      body: {
        memberIdOrEmail: parsedMemberId.data,
        organizationId: access.organizationId,
      },
      headers: access.requestHeaders,
    })
  } catch (cause) {
    const message = getOrganizationActionMessage(cause, removeMemberErrorMessages)
    if (message) return actionFailure(message)
    throw cause
  }
  revalidatePath(`/workspace/${workspaceId}`)
  return actionSuccess(null)
}

export async function cancelWorkspaceInvitation(
  workspaceId: string,
  invitationId: string,
): Promise<ActionResult> {
  const access = await requireWorkspaceMembership(workspaceId, ['owner', 'admin'])
  const parsedInvitationId = invitationIdSchema.safeParse(invitationId)
  if (!parsedInvitationId.success) return actionFailure('This invitation is no longer available.')

  try {
    await auth.api.cancelInvitation({
      body: { invitationId: parsedInvitationId.data },
      headers: access.requestHeaders,
    })
  } catch (cause) {
    const message = getOrganizationActionMessage(cause, cancelInvitationErrorMessages)
    if (message) return actionFailure(message)
    throw cause
  }
  revalidatePath(`/workspace/${workspaceId}`)
  return actionSuccess(null)
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
  const { requestHeaders, userId } = await requireUser()
  const accepted = await auth.api.acceptInvitation({
    body: { invitationId: parsedInvitationId },
    headers: requestHeaders,
  })
  const workspace = (await db.select({ id: companyProfiles.id }).from(companyProfiles).where(
    eq(companyProfiles.organizationId, accepted.invitation.organizationId),
  ).limit(1))[0]
  revalidatePath('/workspace', 'layout')
  const posthog = getPostHogClient()
  posthog.capture({
    distinctId: userId,
    event: 'invitation_accepted',
    properties: { organization_id: accepted.invitation.organizationId },
  })
  await posthog.flush()
  redirect(workspace ? `/workspace/${workspace.id}` : '/workspace')
}

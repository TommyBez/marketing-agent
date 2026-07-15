'use client'

import {
  cancelWorkspaceInvitation,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from '@/app/actions/organization'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { MailPlus, Trash2, UserRoundCog, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition, type FormEvent } from 'react'

interface WorkspaceMember {
  email: string
  id: string
  name: string
  role: string
  userId: string
}

interface PendingInvitation {
  email: string
  id: string
  role: string
}

interface WorkspacePeopleDialogProps {
  currentRole: string
  currentUserId: string
  members: WorkspaceMember[]
  pendingInvitations: PendingInvitation[]
  workspaceId: string
  workspaceName: string
}

function hasRole(role: string, expectedRole: 'owner' | 'admin') {
  return role.split(',').map((value) => value.trim()).includes(expectedRole)
}

export function WorkspacePeopleDialog({
  currentRole,
  currentUserId,
  members,
  pendingInvitations,
  workspaceId,
  workspaceName,
}: WorkspacePeopleDialogProps) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const dialogGenerationRef = useRef(0)
  const isOwner = hasRole(currentRole, 'owner')
  const canManage = isOwner || hasRole(currentRole, 'admin')

  function run(
    action: () => ReturnType<typeof inviteWorkspaceMember>,
    onSuccess?: () => void,
  ) {
    setError('')
    const dialogGeneration = dialogGenerationRef.current
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) {
          if (dialogGenerationRef.current === dialogGeneration) setError(result.message)
          return
        }
        if (dialogGenerationRef.current === dialogGeneration) onSuccess?.()
        router.refresh()
      } catch {
        if (dialogGenerationRef.current === dialogGeneration) {
          setError('Unable to update workspace access')
        }
      }
    })
  }

  function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    run(() => inviteWorkspaceMember(
      workspaceId,
      String(formData.get('email')),
      String(formData.get('role')),
    ), () => form.reset())
  }

  return (
    <Dialog onOpenChange={(open) => {
      if (!open) {
        dialogGenerationRef.current += 1
        setError('')
      }
    }}>
      <DialogTrigger render={
        <Button variant="outline" size="icon" aria-label={`Manage people in ${workspaceName}`} />
      }>
        <Users />
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>People in {workspaceName}</DialogTitle>
          <DialogDescription>
            Everyone here shares the company brief, conversations, and saved artifacts.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {canManage && (
          <form onSubmit={handleInvite} className="rounded-xl border bg-muted/30 p-4">
            <FieldGroup className="gap-3 sm:grid sm:grid-cols-[1fr_8rem_auto] sm:items-end">
              <Field data-disabled={isPending}>
                <FieldLabel htmlFor="inviteEmail">Invite by email</FieldLabel>
                <Input id="inviteEmail" name="email" type="email" autoComplete="email" placeholder="teammate@company.com" required disabled={isPending} />
              </Field>
              <Field data-disabled={isPending}>
                <FieldLabel htmlFor="inviteRole">Role</FieldLabel>
                <select id="inviteRole" name="role" defaultValue="member" disabled={isPending} className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Spinner data-icon="inline-start" /> : <MailPlus data-icon="inline-start" />}
                Invite
              </Button>
            </FieldGroup>
          </form>
        )}

        <ScrollArea className="max-h-[48vh] pr-3">
          <div className="flex flex-col gap-3">
            {members.map((workspaceMember) => {
              const targetIsOwner = hasRole(workspaceMember.role, 'owner')
              const canEditTarget = canManage && (isOwner || !targetIsOwner)
              const displayRole = workspaceMember.role.split(',')[0]?.trim() || 'member'

              return (
                <div key={workspaceMember.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{workspaceMember.name}</p>
                      {workspaceMember.userId === currentUserId && <Badge variant="secondary">You</Badge>}
                      <Badge variant="outline" className="capitalize">{displayRole}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{workspaceMember.email}</p>
                  </div>

                  {canEditTarget && (
                    <div className="flex items-center gap-2">
                      <form action={(formData) => run(() => updateWorkspaceMemberRole(workspaceId, workspaceMember.id, String(formData.get('role'))))} className="flex items-center gap-2">
                        <label htmlFor={`role-${workspaceMember.id}`} className="sr-only">Role for {workspaceMember.name}</label>
                        <select id={`role-${workspaceMember.id}`} name="role" defaultValue={displayRole} disabled={isPending} className="h-7 rounded-lg border border-input bg-background px-2 text-xs capitalize outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                          {isOwner && <option value="owner">Owner</option>}
                        </select>
                        <Button type="submit" variant="outline" size="icon-sm" disabled={isPending} aria-label={`Save role for ${workspaceMember.name}`}>
                          <UserRoundCog />
                        </Button>
                      </form>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-sm"
                        disabled={isPending}
                        aria-label={`Remove ${workspaceMember.name}`}
                        onClick={() => run(() => removeWorkspaceMember(workspaceId, workspaceMember.id))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {canManage && pendingInvitations.length > 0 && (
            <>
              <Separator className="my-5" />
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-medium">Pending invitations</h3>
                  <p className="text-xs text-muted-foreground">Invitations expire after seven days.</p>
                </div>
                {pendingInvitations.map((pendingInvitation) => (
                  <div key={pendingInvitation.id} className="flex items-center gap-3 rounded-xl border border-dashed p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{pendingInvitation.email}</p>
                      <p className="text-xs capitalize text-muted-foreground">{pendingInvitation.role}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => run(() => cancelWorkspaceInvitation(workspaceId, pendingInvitation.id))}>
                      Cancel
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import {
  createWorkspacePublicShare,
  getWorkspacePublicShare,
  revokeWorkspacePublicShare,
} from '@/app/actions/share'
import { inviteWorkspaceMember } from '@/app/actions/organization'
import type {
  PublicShareResourceType,
  WorkspacePublicShare,
} from '@/lib/public-share-contract'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Mail,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useEffect, useState, useTransition, type FormEvent } from 'react'

interface ShareResourceDialogProps {
  canInvite: boolean
  onOpenChange: (open: boolean) => void
  open: boolean
  resourceId: string
  resourceTitle: string
  resourceType: PublicShareResourceType
  workspaceId: string
  workspaceName: string
}

export function ShareResourceDialog({
  canInvite,
  onOpenChange,
  open,
  resourceId,
  resourceTitle,
  resourceType,
  workspaceId,
  workspaceName,
}: ShareResourceDialogProps) {
  const [share, setShare] = useState<WorkspacePublicShare | null>(null)
  const [origin, setOrigin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCopied, setIsCopied] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState('')
  const [isPending, startTransition] = useTransition()
  const [isInviting, startInvitationTransition] = useTransition()

  useEffect(() => {
    if (!open) return

    let isCurrent = true
    setOrigin(window.location.origin)
    setShare(null)
    setError('')
    setInviteStatus('')
    setIsCopied(false)
    setIsLoading(true)

    void getWorkspacePublicShare(workspaceId, { id: resourceId, type: resourceType })
      .then((existingShare) => {
        if (isCurrent) setShare(existingShare)
      })
      .catch((cause) => {
        if (isCurrent) {
          setError(cause instanceof Error ? cause.message : 'Unable to load the public link')
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [open, resourceId, resourceType, workspaceId])

  const shareUrl = share ? `${origin}/s/${share.publicId}` : ''
  const resourceLabel = resourceType === 'artifact' ? 'artifact' : 'conversation'

  async function copyLink(publicId: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/s/${publicId}`)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      setError('The link is ready, but it could not be copied automatically.')
    }
  }

  function handleCreate() {
    setError('')
    startTransition(async () => {
      try {
        const createdShare = await createWorkspacePublicShare(
          workspaceId,
          { id: resourceId, type: resourceType },
        )
        setShare(createdShare)
        await copyLink(createdShare.publicId)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to create the public link')
      }
    })
  }

  function handleRevoke() {
    if (!share) return
    setError('')
    startTransition(async () => {
      try {
        await revokeWorkspacePublicShare(workspaceId, share.id)
        setShare(null)
        setIsCopied(false)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to revoke the public link')
      }
    })
  }

  function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setInviteStatus('')
    setError('')
    startInvitationTransition(async () => {
      try {
        await inviteWorkspaceMember(workspaceId, inviteEmail, 'member')
        setInviteStatus(`Invitation sent to ${inviteEmail.trim().toLowerCase()}.`)
        setInviteEmail('')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to send the invitation')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share “{resourceTitle}”</DialogTitle>
          <DialogDescription>
            Create a read-only snapshot that anyone with the link can open, even without an account.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex min-h-36 items-center justify-center"><Spinner /></div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border bg-muted/35 p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <ShieldCheck className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Public, read-only snapshot</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    The link keeps the version captured when it is created. Future workspace changes stay private.
                  </p>
                </div>
              </div>

              {share ? (
                <div className="mt-4 flex flex-col gap-3">
                  <Field>
                    <FieldLabel htmlFor={`share-link-${resourceId}`}>Public link</FieldLabel>
                    <div className="flex gap-2">
                      <Input
                        id={`share-link-${resourceId}`}
                        readOnly
                        value={shareUrl}
                        className="font-mono text-xs"
                        onFocus={(event) => event.currentTarget.select()}
                      />
                      <Button type="button" variant="outline" size="icon" aria-label="Copy public link" onClick={() => void copyLink(share.publicId)}>
                        {isCopied ? <Check /> : <Copy />}
                      </Button>
                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open public link"
                        className={buttonVariants({ variant: 'outline', size: 'icon' })}
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    </div>
                  </Field>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Snapshot created {new Date(share.createdAt).toLocaleDateString()}</span>
                    {share.canRevoke ? (
                      <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={handleRevoke}>
                        {isPending ? <Spinner data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
                        Revoke link
                      </Button>
                    ) : (
                      <span>Only its creator or a workspace admin can revoke it.</span>
                    )}
                  </div>
                </div>
              ) : (
                <Button type="button" className="mt-4 w-full" disabled={isPending} onClick={handleCreate}>
                  {isPending ? <Spinner data-icon="inline-start" /> : <Link2 data-icon="inline-start" />}
                  Create and copy link
                </Button>
              )}
            </div>

            {canInvite && (
              <>
                <Separator />
                <section className="flex flex-col gap-3" aria-labelledby={`workspace-invite-${resourceId}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
                      <Mail className="size-4" />
                    </span>
                    <div>
                      <h3 id={`workspace-invite-${resourceId}`} className="font-medium">Invite them to collaborate</h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        This is separate from the public link. An invitation grants access to the entire {workspaceName} workspace.
                      </p>
                    </div>
                  </div>
                  <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleInvite}>
                    <Input
                      aria-label="Collaborator email"
                      type="email"
                      placeholder="collaborator@company.com"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      disabled={isInviting}
                      required
                    />
                    <Button type="submit" variant="outline" disabled={isInviting || !inviteEmail.trim()}>
                      {isInviting ? <Spinner data-icon="inline-start" /> : <Mail data-icon="inline-start" />}
                      Invite
                    </Button>
                  </form>
                  {inviteStatus && <p className="text-xs text-success" role="status">{inviteStatus}</p>}
                </section>
              </>
            )}

            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <p className="text-xs text-muted-foreground">
              The shared {resourceLabel} cannot be edited, continued, or used to access other workspace content.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

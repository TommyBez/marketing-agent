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
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'

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
  const dialogGenerationRef = useRef(0)
  const shareMutationRef = useRef(0)
  const copyOperationRef = useRef(0)
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return

    const dialogGeneration = ++dialogGenerationRef.current
    shareMutationRef.current += 1
    copyOperationRef.current += 1
    if (copyFeedbackTimeoutRef.current) {
      clearTimeout(copyFeedbackTimeoutRef.current)
      copyFeedbackTimeoutRef.current = null
    }
    setOrigin(window.location.origin)
    setShare(null)
    setError('')
    setInviteStatus('')
    setIsCopied(false)
    setIsLoading(true)

    void getWorkspacePublicShare(workspaceId, { id: resourceId, type: resourceType })
      .then((existingShare) => {
        if (dialogGenerationRef.current === dialogGeneration) setShare(existingShare)
      })
      .catch((cause) => {
        if (dialogGenerationRef.current === dialogGeneration) {
          setError(cause instanceof Error ? cause.message : 'Unable to load the public link')
        }
      })
      .finally(() => {
        if (dialogGenerationRef.current === dialogGeneration) setIsLoading(false)
      })

    return () => {
      if (dialogGenerationRef.current === dialogGeneration) {
        dialogGenerationRef.current += 1
      }
      shareMutationRef.current += 1
      copyOperationRef.current += 1
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current)
        copyFeedbackTimeoutRef.current = null
      }
    }
  }, [open, resourceId, resourceType, workspaceId])

  const shareUrl = share ? `${origin}/s/${share.publicId}` : ''
  const resourceLabel = resourceType === 'artifact' ? 'artifact' : 'conversation'

  function beginShareMutation() {
    copyOperationRef.current += 1
    return {
      dialogGeneration: dialogGenerationRef.current,
      shareMutation: ++shareMutationRef.current,
    }
  }

  function isCurrentShareMutation(mutation: ReturnType<typeof beginShareMutation>) {
    return mutation.dialogGeneration === dialogGenerationRef.current
      && mutation.shareMutation === shareMutationRef.current
  }

  function beginCopyOperation() {
    return {
      copyOperation: ++copyOperationRef.current,
      dialogGeneration: dialogGenerationRef.current,
    }
  }

  function isCurrentCopyOperation(operation: ReturnType<typeof beginCopyOperation>) {
    return operation.dialogGeneration === dialogGenerationRef.current
      && operation.copyOperation === copyOperationRef.current
  }

  function clearCopyFeedback() {
    if (copyFeedbackTimeoutRef.current) {
      clearTimeout(copyFeedbackTimeoutRef.current)
      copyFeedbackTimeoutRef.current = null
    }
    setIsCopied(false)
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      dialogGenerationRef.current += 1
      shareMutationRef.current += 1
      copyOperationRef.current += 1
      clearCopyFeedback()
    }
    onOpenChange(nextOpen)
  }

  async function copyLink(
    publicId: string,
    operation: ReturnType<typeof beginCopyOperation>,
  ) {
    try {
      if (!isCurrentCopyOperation(operation)) return
      await navigator.clipboard.writeText(`${window.location.origin}/s/${publicId}`)
      if (!isCurrentCopyOperation(operation)) return
      setIsCopied(true)
      copyFeedbackTimeoutRef.current = setTimeout(() => {
        if (isCurrentCopyOperation(operation)) setIsCopied(false)
        copyFeedbackTimeoutRef.current = null
      }, 2000)
    } catch {
      if (isCurrentCopyOperation(operation)) {
        setError('The link is ready, but it could not be copied automatically.')
      }
    }
  }

  function handleCopy(publicId: string) {
    clearCopyFeedback()
    const operation = beginCopyOperation()
    void copyLink(publicId, operation)
  }

  function handleCreate() {
    setError('')
    clearCopyFeedback()
    const mutation = beginShareMutation()
    startTransition(async () => {
      try {
        const createdShare = await createWorkspacePublicShare(
          workspaceId,
          { id: resourceId, type: resourceType },
        )
        if (!isCurrentShareMutation(mutation)) return
        setShare(createdShare)
        await copyLink(createdShare.publicId, beginCopyOperation())
      } catch (cause) {
        if (isCurrentShareMutation(mutation)) {
          setError(cause instanceof Error ? cause.message : 'Unable to create the public link')
        }
      }
    })
  }

  function handleRevoke() {
    if (!share) return
    setError('')
    clearCopyFeedback()
    const mutation = beginShareMutation()
    startTransition(async () => {
      try {
        await revokeWorkspacePublicShare(workspaceId, share.id)
        if (!isCurrentShareMutation(mutation)) return
        setShare(null)
      } catch (cause) {
        if (isCurrentShareMutation(mutation)) {
          setError(cause instanceof Error ? cause.message : 'Unable to revoke the public link')
        }
      }
    })
  }

  function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setInviteStatus('')
    setError('')
    const dialogGeneration = dialogGenerationRef.current
    startInvitationTransition(async () => {
      try {
        await inviteWorkspaceMember(workspaceId, inviteEmail, 'member')
        if (dialogGenerationRef.current !== dialogGeneration) return
        setInviteStatus(`Invitation sent to ${inviteEmail.trim().toLowerCase()}.`)
        setInviteEmail('')
      } catch (cause) {
        if (dialogGenerationRef.current === dialogGeneration) {
          setError(cause instanceof Error ? cause.message : 'Unable to send the invitation')
        }
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
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
                      <Button type="button" variant="outline" size="icon" aria-label="Copy public link" disabled={isPending} onClick={() => handleCopy(share.publicId)}>
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

'use client'

import { deleteArtifact, getArtifact, renameArtifact, type ArtifactSummary } from '@/app/actions/artifact'
import { MessageResponse } from '@/components/ai-elements/message'
import { ShareResourceDialog } from '@/components/share-resource-dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/spinner'
import { Bookmark, Check, Copy, MoreHorizontal, Pencil, Share2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

interface ArtifactListProps {
  artifacts: ArtifactSummary[]
  canInvite: boolean
  workspaceId: string
  workspaceName: string
}

interface OpenArtifact {
  id: string
  title: string
  content: string
  updatedAt: Date
}

function CopyArtifactButton({ text }: { text: string }) {
  const [isCopied, setIsCopied] = useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(text)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
      }}
    >
      {isCopied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
      {isCopied ? 'Copied' : 'Copy'}
    </Button>
  )
}

export function ArtifactList({ artifacts, canInvite, workspaceId, workspaceName }: ArtifactListProps) {
  const router = useRouter()
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactSummary | null>(null)
  const [openArtifact, setOpenArtifact] = useState<OpenArtifact | null>(null)
  const [dialog, setDialog] = useState<'view' | 'share' | 'rename' | 'delete' | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function openDialog(nextDialog: 'share' | 'rename' | 'delete', artifact: ArtifactSummary) {
    setError('')
    setSelectedArtifact(artifact)
    setDialog(nextDialog)
  }

  function handleOpen(artifact: ArtifactSummary) {
    setError('')
    setSelectedArtifact(artifact)
    setOpenArtifact(null)
    setDialog('view')
    startTransition(async () => {
      try {
        const fullArtifact = await getArtifact(workspaceId, artifact.id)
        setOpenArtifact(fullArtifact)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to open the artifact')
      }
    })
  }

  function handleRename(formData: FormData) {
    if (!selectedArtifact) return
    setError('')
    startTransition(async () => {
      try {
        await renameArtifact(workspaceId, selectedArtifact.id, String(formData.get('title')))
        setDialog(null)
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to rename artifact')
      }
    })
  }

  function handleDelete() {
    if (!selectedArtifact) return
    setError('')
    startTransition(async () => {
      try {
        await deleteArtifact(workspaceId, selectedArtifact.id)
        setDialog(null)
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to delete artifact')
      }
    })
  }

  if (artifacts.length === 0) return null

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-[0.12em]">Artifacts</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {artifacts.map((artifact) => (
              <SidebarMenuItem key={artifact.id}>
                <SidebarMenuButton tooltip={artifact.title} onClick={() => handleOpen(artifact)}>
                  <Bookmark />
                  <span>{artifact.title}</span>
                </SidebarMenuButton>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<SidebarMenuAction showOnHover aria-label={`Actions for ${artifact.title}`}><MoreHorizontal /></SidebarMenuAction>} />
                  <DropdownMenuContent align="start">
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={() => openDialog('share', artifact)}><Share2 />Share</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openDialog('rename', artifact)}><Pencil />Rename</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => openDialog('delete', artifact)}><Trash2 />Delete</DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <Dialog open={dialog === 'view'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="pr-8">{selectedArtifact?.title}</DialogTitle>
            <DialogDescription>
              {openArtifact ? `Saved ${new Date(openArtifact.updatedAt).toLocaleDateString()}` : 'Saved agent output'}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!openArtifact && !error && <div className="flex justify-center py-8"><Spinner /></div>}
          {openArtifact && (
            <>
              <div className="max-h-[60vh] min-w-0 overflow-y-auto text-sm">
                <MessageResponse mode="static">{openArtifact.content}</MessageResponse>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setDialog('share')}>
                  <Share2 data-icon="inline-start" />Share
                </Button>
                <CopyArtifactButton text={openArtifact.content} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {selectedArtifact && (
        <ShareResourceDialog
          canInvite={canInvite}
          open={dialog === 'share'}
          onOpenChange={(open) => !open && setDialog(null)}
          resourceId={selectedArtifact.id}
          resourceTitle={selectedArtifact.title}
          resourceType="artifact"
          workspaceId={workspaceId}
          workspaceName={workspaceName}
        />
      )}

      <Dialog open={dialog === 'rename'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename artifact</DialogTitle><DialogDescription>Choose a title that makes this artifact easy to find.</DialogDescription></DialogHeader>
          <form action={handleRename} className="flex flex-col gap-4">
            <FieldGroup><Field data-invalid={Boolean(error)} data-disabled={isPending}><FieldLabel htmlFor="artifactTitle">Title</FieldLabel><Input id="artifactTitle" name="title" defaultValue={selectedArtifact?.title} maxLength={120} required disabled={isPending} aria-invalid={Boolean(error)} />{error && <p className="text-sm text-destructive">{error}</p>}</Field></FieldGroup>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button type="submit" disabled={isPending}>{isPending && <Spinner data-icon="inline-start" />}Save</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialog === 'delete'} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this artifact?</AlertDialogTitle><AlertDialogDescription>This permanently removes “{selectedArtifact?.title}” from your workspace.</AlertDialogDescription></AlertDialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter><AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={isPending} onClick={handleDelete}>{isPending && <Spinner data-icon="inline-start" />}Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

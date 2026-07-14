'use client'

import { saveArtifact } from '@/app/actions/artifact'
import { MessageAction } from '@/components/ai-elements/message'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { BookmarkCheck, BookmarkPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

interface SaveArtifactActionProps {
  conversationId: string
  text: string
  workspaceId: string
}

function deriveArtifactTitle(text: string) {
  const firstLine = text
    .split('\n')
    .map((line) => line.replace(/^#{1,6}\s+/, '').replace(/[*_`]/g, '').trim())
    .find(Boolean) ?? 'Untitled artifact'
  return firstLine.length > 120 ? `${firstLine.slice(0, 117).trimEnd()}…` : firstLine
}

export function SaveArtifactAction({ conversationId, text, workspaceId }: SaveArtifactActionProps) {
  const router = useRouter()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSave(formData: FormData) {
    setError('')
    startTransition(async () => {
      try {
        await saveArtifact(workspaceId, {
          title: String(formData.get('title')),
          content: text,
          conversationId,
        })
        setIsDialogOpen(false)
        setIsSaved(true)
        setTimeout(() => setIsSaved(false), 2000)
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to save the artifact')
      }
    })
  }

  return (
    <>
      <MessageAction
        label="Save as artifact"
        tooltip={isSaved ? 'Saved' : 'Save as artifact'}
        onClick={() => {
          setError('')
          setIsDialogOpen(true)
        }}
      >
        {isSaved ? <BookmarkCheck className="size-3.5" /> : <BookmarkPlus className="size-3.5" />}
      </MessageAction>

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && setIsDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as artifact</DialogTitle>
            <DialogDescription>Keep this output in your workspace so you can find it again later.</DialogDescription>
          </DialogHeader>
          <form action={handleSave} className="flex flex-col gap-4">
            <FieldGroup>
              <Field data-invalid={Boolean(error)} data-disabled={isPending}>
                <FieldLabel htmlFor="artifactTitle">Title</FieldLabel>
                <Input id="artifactTitle" name="title" defaultValue={deriveArtifactTitle(text)} maxLength={120} required disabled={isPending} aria-invalid={Boolean(error)} />
                {error && <p className="text-sm text-destructive">{error}</p>}
              </Field>
            </FieldGroup>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending && <Spinner data-icon="inline-start" />}Save artifact</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

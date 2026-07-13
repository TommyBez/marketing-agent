'use client'

import { deleteWorkspace, renameWorkspace } from '@/app/actions/company'
import { CompanyOnboarding } from '@/components/company-onboarding'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Check, ChevronsUpDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export interface WorkspaceSummary {
  id: string
  name: string
  websiteUrl: string
}

interface WorkspaceSwitcherProps {
  activeWorkspace: WorkspaceSummary
  workspaces: WorkspaceSummary[]
  isCompact?: boolean
}

export function WorkspaceSwitcher({ activeWorkspace, workspaces, isCompact = false }: WorkspaceSwitcherProps) {
  const router = useRouter()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleRename(formData: FormData) {
    setError('')
    startTransition(async () => {
      try {
        await renameWorkspace(activeWorkspace.id, String(formData.get('name')))
        setIsRenameOpen(false)
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to rename workspace')
      }
    })
  }

  function handleDelete() {
    setError('')
    startTransition(async () => {
      try {
        const result = await deleteWorkspace(activeWorkspace.id)
        setIsDeleteOpen(false)
        router.push(result.nextWorkspaceId ? `/workspace/${result.nextWorkspaceId}` : '/workspace')
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to delete workspace')
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={
          <Button variant="ghost" className={isCompact ? 'max-w-48 justify-between' : 'h-auto w-full justify-between px-2 py-2'} />
        }>
          <span className="truncate text-left">{activeWorkspace.name}</span>
          <ChevronsUpDown data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isCompact ? 'end' : 'start'} className="min-w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {workspaces.map((workspace) => (
              <DropdownMenuItem key={workspace.id} onClick={() => router.push(`/workspace/${workspace.id}`)}>
                <span className="truncate">{workspace.name}</span>
                {workspace.id === activeWorkspace.id && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setIsCreateOpen(true)}><Plus />New workspace</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsRenameOpen(true)}><Pencil />Rename current</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setIsDeleteOpen(true)}><Trash2 />Delete current</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>Create workspace</DialogTitle>
            <DialogDescription>Analyze a company website to create a private marketing workspace.</DialogDescription>
          </DialogHeader>
          <CompanyOnboarding isCompact onCreated={() => setIsCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename workspace</DialogTitle>
            <DialogDescription>Update the name shown throughout Relay. Company context will not change.</DialogDescription>
          </DialogHeader>
          <form action={handleRename} className="flex flex-col gap-4">
            <FieldGroup>
              <Field data-invalid={Boolean(error)} data-disabled={isPending}>
                <FieldLabel htmlFor="workspaceName">Workspace name</FieldLabel>
                <Input id="workspaceName" name="name" defaultValue={activeWorkspace.name} maxLength={80} required disabled={isPending} aria-invalid={Boolean(error)} />
                {error && <p className="text-sm text-destructive">{error}</p>}
              </Field>
            </FieldGroup>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending && <Spinner data-icon="inline-start" />}Save name</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {activeWorkspace.name}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes its company brief and all saved conversations. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleDelete}>
              {isPending && <Spinner data-icon="inline-start" />}Delete workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

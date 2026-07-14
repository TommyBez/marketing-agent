'use client'

import { type ArtifactSummary } from '@/app/actions/artifact'
import { createConversation, deleteConversation, renameConversation, type ConversationSummary } from '@/app/actions/thread'
import { ArtifactList } from '@/components/artifact-list'
import { BrandMark } from '@/components/brand-mark'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar } from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/spinner'
import { MessageSquare, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

interface ConversationSidebarProps {
  activeConversationId: string
  artifacts: ArtifactSummary[]
  conversations: ConversationSummary[]
  workspaceId: string
}

export function ConversationSidebar({ activeConversationId, artifacts, conversations, workspaceId }: ConversationSidebarProps) {
  const router = useRouter()
  const { setOpenMobile } = useSidebar()
  const [selectedConversation, setSelectedConversation] = useState<ConversationSummary | null>(null)
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function openDialog(nextDialog: 'rename' | 'delete', conversation: ConversationSummary) {
    setError('')
    setSelectedConversation(conversation)
    setDialog(nextDialog)
  }

  function handleNewConversation() {
    startTransition(async () => {
      const conversation = await createConversation(workspaceId)
      setOpenMobile(false)
      router.push(`/workspace/${workspaceId}?conversation=${conversation.id}`)
      router.refresh()
    })
  }

  function handleRename(formData: FormData) {
    if (!selectedConversation) return
    setError('')
    startTransition(async () => {
      try {
        await renameConversation(workspaceId, selectedConversation.id, String(formData.get('title')))
        setDialog(null)
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to rename conversation')
      }
    })
  }

  function handleDelete() {
    if (!selectedConversation) return
    setError('')
    startTransition(async () => {
      try {
        await deleteConversation(workspaceId, selectedConversation.id)
        const nextConversation = conversations.find((conversation) => conversation.id !== selectedConversation.id)
        setDialog(null)
        if (selectedConversation.id === activeConversationId) {
          if (nextConversation) router.push(`/workspace/${workspaceId}?conversation=${nextConversation.id}`)
          else {
            const conversation = await createConversation(workspaceId)
            router.push(`/workspace/${workspaceId}?conversation=${conversation.id}`)
          }
        }
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to delete conversation')
      }
    })
  }

  return (
    <>
      <Sidebar collapsible="offcanvas" variant="inset" className="border-r-0">
        <SidebarHeader className="gap-4 px-3 pt-4">
          <BrandMark className="px-1 text-sm" />
          <Button onClick={handleNewConversation} disabled={isPending} className="h-10 w-full justify-start">
            {isPending ? <Spinner data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
            New conversation
          </Button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-[0.12em]">Conversation history</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {conversations.map((conversation) => (
                  <SidebarMenuItem key={conversation.id}>
                    <SidebarMenuButton
                      isActive={conversation.id === activeConversationId}
                      tooltip={conversation.title}
                      render={<Link href={`/workspace/${workspaceId}?conversation=${conversation.id}`} onClick={() => setOpenMobile(false)} />}
                    >
                      <MessageSquare />
                      <span>{conversation.title}</span>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<SidebarMenuAction showOnHover aria-label={`Actions for ${conversation.title}`}><MoreHorizontal /></SidebarMenuAction>} />
                      <DropdownMenuContent align="start">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => openDialog('rename', conversation)}><Pencil />Rename</DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => openDialog('delete', conversation)}><Trash2 />Delete</DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <ArtifactList workspaceId={workspaceId} artifacts={artifacts} />
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      <Dialog open={dialog === 'rename'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename conversation</DialogTitle><DialogDescription>Choose a title that makes this conversation easy to find.</DialogDescription></DialogHeader>
          <form action={handleRename} className="flex flex-col gap-4">
            <FieldGroup><Field data-invalid={Boolean(error)} data-disabled={isPending}><FieldLabel htmlFor="conversationTitle">Title</FieldLabel><Input id="conversationTitle" name="title" defaultValue={selectedConversation?.title} maxLength={80} required disabled={isPending} aria-invalid={Boolean(error)} />{error && <p className="text-sm text-destructive">{error}</p>}</Field></FieldGroup>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button type="submit" disabled={isPending}>{isPending && <Spinner data-icon="inline-start" />}Save</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialog === 'delete'} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this conversation?</AlertDialogTitle><AlertDialogDescription>This permanently removes “{selectedConversation?.title}” and its saved agent session.</AlertDialogDescription></AlertDialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter><AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={isPending} onClick={handleDelete}>{isPending && <Spinner data-icon="inline-start" />}Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

import { getWorkspace, listWorkspaces } from '@/app/actions/company'
import { getConversation, listWorkspaceConversations } from '@/app/actions/thread'
import { AgentChat } from '@/components/agent-chat'
import { ConversationBootstrap } from '@/components/conversation-bootstrap'
import { ConversationSidebar } from '@/components/conversation-sidebar'
import { SignOutButton } from '@/components/sign-out-button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { WorkspaceSwitcher } from '@/components/workspace-switcher'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'

interface WorkspacePageProps {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ conversation?: string }>
}

export default async function WorkspacePage({ params, searchParams }: WorkspacePageProps) {
  const currentSession = await auth.api.getSession({ headers: await headers() })
  if (!currentSession?.user) redirect('/sign-in')

  const { workspaceId } = await params
  const { conversation: requestedConversationId } = await searchParams
  const workspace = await getWorkspace(workspaceId)
  if (!workspace) notFound()

  const [workspaces, initialConversations] = await Promise.all([
    listWorkspaces(),
    listWorkspaceConversations(workspaceId),
  ])
  const activeConversationId = requestedConversationId && initialConversations.some(({ id }) => id === requestedConversationId)
    ? requestedConversationId
    : initialConversations[0]?.id
  const activeConversation = activeConversationId ? await getConversation(workspaceId, activeConversationId) : null

  const workspaceSummaries = workspaces.map(({ id, name, websiteUrl }) => ({ id, name, websiteUrl }))
  const activeWorkspace = { id: workspace.id, name: workspace.name, websiteUrl: workspace.websiteUrl }

  return (
    <main className="workspace-shell flex h-dvh min-h-[640px] p-2 md:p-3">
      <Card className="workspace-frame min-w-0 flex-1 overflow-hidden p-0">
        <SidebarProvider className="workspace-sidebar min-h-0 flex-1">
          <ConversationSidebar workspaceId={workspaceId} conversations={initialConversations} activeConversationId={activeConversationId ?? ''} />
          <SidebarInset className="workspace-inset min-h-0 overflow-hidden">
            <header className="workspace-header flex h-15 shrink-0 items-center justify-between gap-2 border-b px-3 md:px-4">
              <div className="flex min-w-0 items-center gap-2">
                <SidebarTrigger />
                <WorkspaceSwitcher activeWorkspace={activeWorkspace} workspaces={workspaceSummaries} isCompact />
                <Badge variant="secondary" className="hidden font-mono text-[10px] uppercase tracking-widest lg:flex">Brand command</Badge>
              </div>
              <div className="flex shrink-0 items-center gap-2"><span className="hidden text-xs text-muted-foreground lg:inline">{currentSession.user.email}</span><SignOutButton /></div>
            </header>
            <Suspense fallback={<WorkspaceSkeleton />}>
              {activeConversation ? (
                <AgentChat
                  key={`${activeConversation.id}:${activeConversation.session.sessionId ?? 'new'}:${activeConversation.session.streamIndex}:${activeConversation.events.length}`}
                  workspaceId={workspace.id}
                  conversationId={activeConversation.id}
                  conversationTitle={activeConversation.title}
                  companyName={workspace.name}
                  initialEvents={activeConversation.events}
                  initialSession={activeConversation.session}
                />
              ) : (
                <ConversationBootstrap workspaceId={workspace.id} />
              )}
            </Suspense>
          </SidebarInset>
        </SidebarProvider>
      </Card>
    </main>
  )
}

function WorkspaceSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-6" aria-label="Loading workspace">
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="mt-auto h-28 w-full" />
    </div>
  )
}

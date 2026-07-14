import { listWorkspaceArtifacts } from '@/app/actions/artifact'
import { getWorkspace, listWorkspaces, setActiveWorkspace } from '@/app/actions/company'
import { getConversation, listWorkspaceConversations } from '@/app/actions/thread'
import { getWorkspacePeople } from '@/app/actions/organization'
import { AgentChat } from '@/components/agent-chat'
import { CompanyBrief } from '@/components/company-brief'
import { CompanyBriefDialog } from '@/components/company-brief-dialog'
import { ConversationBootstrap } from '@/components/conversation-bootstrap'
import { ConversationSidebar } from '@/components/conversation-sidebar'
import { SignOutButton } from '@/components/sign-out-button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { WorkspaceSwitcher } from '@/components/workspace-switcher'
import { WorkspacePeopleDialog } from '@/components/workspace-people-dialog'
import { auth } from '@/lib/auth'
import { canManageOrganization } from '@/lib/workspace-access'
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
  if (currentSession.session.activeOrganizationId !== workspace.organizationId) {
    await setActiveWorkspace(workspaceId)
  }

  const [workspaces, initialConversations, initialArtifacts, workspacePeople] = await Promise.all([
    listWorkspaces(),
    listWorkspaceConversations(workspaceId),
    listWorkspaceArtifacts(workspaceId),
    getWorkspacePeople(workspaceId),
  ])
  const activeConversationId = requestedConversationId && initialConversations.some(({ id }) => id === requestedConversationId)
    ? requestedConversationId
    : initialConversations[0]?.id
  const activeConversation = activeConversationId ? await getConversation(workspaceId, activeConversationId) : null

  const workspaceSummaries = workspaces.map(({ id, name, role, websiteUrl }) => ({ id, name, role, websiteUrl }))
  const activeWorkspace = { id: workspace.id, name: workspace.name, role: workspace.role, websiteUrl: workspace.websiteUrl }
  const companyBrief = {
    name: workspace.name,
    websiteUrl: workspace.websiteUrl,
    summary: workspace.summary,
    audience: workspace.audience,
    offering: workspace.offering,
    voice: workspace.voice,
  }
  const canInvite = canManageOrganization(workspacePeople.currentRole)

  return (
    <main className="workspace-shell flex h-dvh min-h-[640px] p-2 md:p-3">
      <Card className="workspace-frame min-w-0 flex-1 overflow-hidden p-0">
        <SidebarProvider className="workspace-sidebar min-h-0 flex-1">
          <ConversationSidebar
            workspaceId={workspaceId}
            workspaceName={workspace.name}
            canInvite={canInvite}
            conversations={initialConversations}
            artifacts={initialArtifacts}
            activeConversationId={activeConversationId ?? ''}
          />
          <SidebarInset className="workspace-inset min-h-0 overflow-hidden">
            <header className="workspace-header flex h-15 shrink-0 items-center justify-between gap-2 border-b px-3 md:px-4">
              <div className="flex min-w-0 items-center gap-2">
                <SidebarTrigger />
                <WorkspaceSwitcher activeWorkspace={activeWorkspace} workspaces={workspaceSummaries} isCompact />
                <CompanyBriefDialog companyName={companyBrief.name}>
                  <CompanyBrief brief={companyBrief} className="rounded-none bg-transparent ring-0" />
                </CompanyBriefDialog>
                <Badge variant="secondary" className="hidden font-mono text-[10px] uppercase tracking-widest lg:flex">Brand command</Badge>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden text-xs text-muted-foreground lg:inline">{currentSession.user.email}</span>
                <WorkspacePeopleDialog
                  currentRole={workspacePeople.currentRole}
                  currentUserId={workspacePeople.currentUserId}
                  members={workspacePeople.members}
                  pendingInvitations={workspacePeople.pendingInvitations}
                  workspaceId={workspace.id}
                  workspaceName={workspace.name}
                />
                <SignOutButton />
              </div>
            </header>
            <Suspense fallback={<WorkspaceSkeleton />}>
              {activeConversation ? (
                <AgentChat
                  canInvite={canInvite}
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

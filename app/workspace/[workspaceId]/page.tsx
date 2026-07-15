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
import { Sidebar, SidebarContent, SidebarHeader, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { WorkspaceConversationSkeleton, WorkspaceFrameSkeleton } from '@/components/workspace-loading'
import { WorkspaceSwitcher } from '@/components/workspace-switcher'
import { WorkspacePeopleDialog } from '@/components/workspace-people-dialog'
import { getCurrentSession } from '@/lib/session'
import { canManageOrganization } from '@/lib/workspace-access'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'

interface WorkspacePageProps {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ conversation?: string }>
}

type Workspace = NonNullable<Awaited<ReturnType<typeof getWorkspace>>>
type WorkspacePeople = Awaited<ReturnType<typeof getWorkspacePeople>>
type Workspaces = Awaited<ReturnType<typeof listWorkspaces>>
type Conversations = Awaited<ReturnType<typeof listWorkspaceConversations>>
type Artifacts = Awaited<ReturnType<typeof listWorkspaceArtifacts>>

export default function WorkspacePage({ params, searchParams }: WorkspacePageProps) {
  return (
    <main className="workspace-shell flex h-dvh min-h-[640px] p-2 md:p-3">
      <Card className="workspace-frame min-w-0 flex-1 overflow-hidden p-0">
        <Suspense fallback={<WorkspaceFrameSkeleton />}>
          <WorkspacePageContent params={params} searchParams={searchParams} />
        </Suspense>
      </Card>
    </main>
  )
}

async function WorkspacePageContent({ params, searchParams }: WorkspacePageProps) {
  const [currentSession, { workspaceId }, { conversation: requestedConversationId }] = await Promise.all([
    getCurrentSession(),
    params,
    searchParams,
  ])
  if (!currentSession?.user) redirect('/sign-in')

  const workspace = await getWorkspace(workspaceId)
  if (!workspace) notFound()
  if (currentSession.session.activeOrganizationId !== workspace.organizationId) {
    await setActiveWorkspace(workspaceId)
  }

  const workspacesPromise = listWorkspaces()
  const conversationsPromise = listWorkspaceConversations(workspaceId)
  const artifactsPromise = listWorkspaceArtifacts(workspaceId)
  const workspacePeoplePromise = getWorkspacePeople(workspaceId)
  const canInvite = canManageOrganization(workspace.role)

  return (
    <SidebarProvider className="workspace-sidebar min-h-0 flex-1">
      <Suspense fallback={<WorkspaceSidebarSkeleton />}>
        <WorkspaceSidebar
          artifactsPromise={artifactsPromise}
          canInvite={canInvite}
          conversationsPromise={conversationsPromise}
          requestedConversationId={requestedConversationId}
          workspace={workspace}
        />
      </Suspense>
      <SidebarInset className="workspace-inset min-h-0 overflow-hidden">
        <Suspense fallback={<WorkspaceHeaderSkeleton />}>
          <WorkspaceHeader
            currentUserEmail={currentSession.user.email}
            workspace={workspace}
            workspacePeoplePromise={workspacePeoplePromise}
            workspacesPromise={workspacesPromise}
          />
        </Suspense>
        <Suspense fallback={<WorkspaceConversationSkeleton />}>
          <WorkspaceConversation
            canInvite={canInvite}
            conversationsPromise={conversationsPromise}
            requestedConversationId={requestedConversationId}
            workspaceId={workspaceId}
            workspaceName={workspace.name}
          />
        </Suspense>
      </SidebarInset>
    </SidebarProvider>
  )
}

function getActiveConversationId(conversations: Conversations, requestedConversationId?: string) {
  return requestedConversationId && conversations.some(({ id }) => id === requestedConversationId)
    ? requestedConversationId
    : conversations[0]?.id
}

async function WorkspaceSidebar({
  artifactsPromise,
  canInvite,
  conversationsPromise,
  requestedConversationId,
  workspace,
}: {
  artifactsPromise: Promise<Artifacts>
  canInvite: boolean
  conversationsPromise: Promise<Conversations>
  requestedConversationId?: string
  workspace: Workspace
}) {
  const [artifacts, conversations] = await Promise.all([artifactsPromise, conversationsPromise])
  const activeConversationId = getActiveConversationId(conversations, requestedConversationId)

  return (
    <ConversationSidebar
      activeConversationId={activeConversationId ?? ''}
      artifacts={artifacts}
      canInvite={canInvite}
      conversations={conversations}
      workspaceId={workspace.id}
      workspaceName={workspace.name}
    />
  )
}

async function WorkspaceHeader({
  currentUserEmail,
  workspace,
  workspacePeoplePromise,
  workspacesPromise,
}: {
  currentUserEmail: string
  workspace: Workspace
  workspacePeoplePromise: Promise<WorkspacePeople>
  workspacesPromise: Promise<Workspaces>
}) {
  const [workspacePeople, workspaces] = await Promise.all([workspacePeoplePromise, workspacesPromise])
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

  return (
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
        <span className="hidden text-xs text-muted-foreground lg:inline">{currentUserEmail}</span>
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
  )
}

async function WorkspaceConversation({
  canInvite,
  conversationsPromise,
  requestedConversationId,
  workspaceId,
  workspaceName,
}: {
  canInvite: boolean
  conversationsPromise: Promise<Conversations>
  requestedConversationId?: string
  workspaceId: string
  workspaceName: string
}) {
  const conversations = await conversationsPromise
  const activeConversationId = getActiveConversationId(conversations, requestedConversationId)
  const activeConversation = activeConversationId
    ? await getConversation(workspaceId, activeConversationId)
    : null

  return activeConversation ? (
    <AgentChat
      canInvite={canInvite}
      key={`${activeConversation.id}:${activeConversation.session.sessionId ?? 'new'}:${activeConversation.session.streamIndex}:${activeConversation.events.length}`}
      workspaceId={workspaceId}
      conversationId={activeConversation.id}
      conversationTitle={activeConversation.title}
      companyName={workspaceName}
      initialEvents={activeConversation.events}
      initialSession={activeConversation.session}
    />
  ) : (
    <ConversationBootstrap workspaceId={workspaceId} />
  )
}

function WorkspaceSidebarSkeleton() {
  return (
    <Sidebar collapsible="offcanvas" variant="inset" className="border-r-0" aria-label="Loading navigation">
      <SidebarHeader className="gap-4 px-3 pt-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-10 w-full" />
      </SidebarHeader>
      <SidebarContent className="gap-3 p-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-4/5" />
        <Skeleton className="h-8 w-11/12" />
      </SidebarContent>
    </Sidebar>
  )
}

function WorkspaceHeaderSkeleton() {
  return (
    <header className="workspace-header flex h-15 shrink-0 items-center justify-between gap-2 border-b px-3 md:px-4" aria-label="Loading workspace controls">
      <div className="flex items-center gap-2"><SidebarTrigger /><Skeleton className="h-8 w-40" /></div>
      <Skeleton className="h-8 w-24" />
    </header>
  )
}

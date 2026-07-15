import { listWorkspaces } from '@/app/actions/company'
import { CompanyOnboarding } from '@/components/company-onboarding'
import { Card } from '@/components/ui/card'
import { WorkspaceLoadingPage } from '@/components/workspace-loading'
import { getCurrentSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

export default function WorkspacePage() {
  return (
    <Suspense fallback={<WorkspaceLoadingPage />}>
      <WorkspacePageContent />
    </Suspense>
  )
}

async function WorkspacePageContent() {
  const currentSession = await getCurrentSession()
  if (!currentSession?.user) redirect('/sign-in')

  const workspaces = await listWorkspaces()
  const workspace = workspaces.find(({ organizationId }) => (
    organizationId === currentSession.session.activeOrganizationId
  )) ?? workspaces[0]
  if (workspace) redirect(`/workspace/${workspace.id}`)

  return (
    <main className="workspace-shell flex min-h-dvh p-2 md:p-3">
      <Card className="workspace-frame min-w-0 flex-1 overflow-hidden p-0">
        <CompanyOnboarding />
      </Card>
    </main>
  )
}

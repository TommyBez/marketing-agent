import { listWorkspaces } from '@/app/actions/company'
import { CompanyOnboarding } from '@/components/company-onboarding'
import { Card } from '@/components/ui/card'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function WorkspacePage() {
  const currentSession = await auth.api.getSession({ headers: await headers() })
  if (!currentSession?.user) redirect('/sign-in')

  const [workspace] = await listWorkspaces()
  if (workspace) redirect(`/workspace/${workspace.id}`)

  return (
    <main className="workspace-shell flex min-h-dvh p-2 md:p-3">
      <Card className="workspace-frame min-w-0 flex-1 overflow-hidden p-0">
        <CompanyOnboarding />
      </Card>
    </main>
  )
}

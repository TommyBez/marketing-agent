import { getLatestCompanyProfile } from '@/app/actions/company'
import { AgentChat } from '@/components/agent-chat'
import { CompanyOnboarding } from '@/components/company-onboarding'
import { SignOutButton } from '@/components/sign-out-button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

const specialists = [
  { name: 'SEO & Content', code: 'SC' },
  { name: 'Copywriting', code: 'CW' },
  { name: 'CRO', code: 'CR' },
  { name: 'Growth & Retention', code: 'GR' },
  { name: 'Paid & Social', code: 'PS' },
  { name: 'Strategy & Analytics', code: 'AN' },
]

export default async function WorkspacePage() {
  const currentSession = await auth.api.getSession({ headers: await headers() })
  if (!currentSession?.user) redirect('/sign-in')

  const profile = await getLatestCompanyProfile()

  return (
    <main className="flex h-dvh min-h-[640px] bg-background p-2 md:p-3">
      <Card className="min-w-0 flex-1 flex-row gap-0 overflow-hidden p-0 shadow-2xl">
        <aside className="hidden w-64 shrink-0 flex-col bg-sidebar p-4 md:flex">
          <div className="flex items-center gap-3 px-2 py-2">
            <Badge className="size-9 justify-center rounded-lg p-0 font-mono">R</Badge>
            <div><p className="text-sm font-semibold">Relay</p><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Marketing OS</p></div>
          </div>
          <Separator className="my-4" />
          <nav aria-label="Agent team" className="flex flex-col gap-1">
            <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Your team</p>
            {specialists.map(({ name, code }) => (
              <div key={name} className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-muted-foreground">
                <Badge variant="outline" className="w-8 justify-center px-1 font-mono text-[10px]">{code}</Badge>
                <span>{name}</span>
              </div>
            ))}
          </nav>
        </aside>
        <Separator orientation="vertical" className="hidden md:block" />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-15 shrink-0 items-center justify-between border-b px-4">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-medium">{profile?.name ?? 'New workspace'}</p>
              {profile && <Badge variant="secondary" className="hidden font-mono text-[10px] uppercase tracking-widest sm:inline-flex">Command center</Badge>}
            </div>
            <div className="flex items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:inline">{currentSession.user.email}</span><SignOutButton /></div>
          </header>
          {profile ? (
            <Suspense fallback={<WorkspaceSkeleton />}>
              <AgentChat companyName={profile.name} />
            </Suspense>
          ) : <CompanyOnboarding />}
        </div>
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

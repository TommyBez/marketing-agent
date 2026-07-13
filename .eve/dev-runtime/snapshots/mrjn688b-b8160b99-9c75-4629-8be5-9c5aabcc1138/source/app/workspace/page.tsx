import { getLatestCompanyProfile } from '@/app/actions/company'
import { AgentChat } from '@/components/agent-chat'
import { CompanyOnboarding } from '@/components/company-onboarding'
import { SignOutButton } from '@/components/sign-out-button'
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
      <div className="flex min-w-0 flex-1 overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar p-4 md:flex">
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary font-mono text-xs text-primary-foreground" aria-hidden="true">R</span>
            <div><p className="text-sm font-semibold">Relay</p><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Marketing OS</p></div>
          </div>
          <nav aria-label="Agent team" className="mt-8 flex flex-col gap-1">
            <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Your team</p>
            {specialists.map(({ name, code }) => <div key={name} className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-muted-foreground"><span className="w-5 font-mono text-[10px] text-accent-foreground" aria-hidden="true">{code}</span><span>{name}</span></div>)}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-15 shrink-0 items-center justify-between border-b px-4">
            <div className="flex min-w-0 items-center gap-2"><p className="truncate text-sm font-medium">{profile?.name ?? 'New workspace'}</p>{profile && <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">/ Command center</span>}</div>
            <div className="flex items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:inline">{currentSession.user.email}</span><SignOutButton /></div>
          </header>
          {profile ? <Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground"><span className="motion-safe:animate-pulse">Loading workspace…</span></div>}><AgentChat companyName={profile.name} companyContext={JSON.stringify(profile.rawContext)} /></Suspense> : <CompanyOnboarding />}
        </div>
      </div>
    </main>
  )
}

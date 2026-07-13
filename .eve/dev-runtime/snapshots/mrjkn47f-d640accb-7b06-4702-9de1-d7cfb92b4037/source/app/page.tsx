import { getLatestCompanyProfile } from '@/app/actions/company'
import { AgentChat } from '@/components/agent-chat'
import { CompanyOnboarding } from '@/components/company-onboarding'
import { SignOutButton } from '@/components/sign-out-button'
import { auth } from '@/lib/auth'
import { BarChart3, Bot, ChevronRight, CircleCheck, Compass, Megaphone, Search, Sparkles, Target } from 'lucide-react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

const specialists = [
  { name: 'SEO & Content', icon: Search }, { name: 'Copywriting', icon: Sparkles }, { name: 'CRO', icon: Target },
  { name: 'Growth & Retention', icon: Compass }, { name: 'Paid & Social', icon: Megaphone }, { name: 'Strategy & Analytics', icon: BarChart3 },
]

export default async function Page() {
  const currentSession = await auth.api.getSession({ headers: await headers() })
  if (!currentSession?.user) redirect('/sign-in')
  const profile = await getLatestCompanyProfile()
  return <main className="flex h-dvh min-h-[640px] bg-background p-2 md:p-3"><div className="flex min-w-0 flex-1 overflow-hidden rounded-2xl border bg-card shadow-2xl"><aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar p-4 md:flex"><div className="flex items-center gap-3 px-2 py-2"><span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Bot className="size-4"/></span><div><p className="text-sm font-semibold">Relay</p><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Marketing OS</p></div></div><nav aria-label="Agent team" className="mt-8 flex flex-col gap-1"><p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Your team</p>{specialists.map(({ name, icon: Icon }) => <div key={name} className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-muted-foreground"><Icon className="size-4"/><span>{name}</span></div>)}</nav><div className="mt-auto flex flex-col gap-3 rounded-xl border bg-background p-3"><div className="flex items-start gap-2"><CircleCheck className="mt-0.5 size-4 text-accent-foreground"/><div><p className="text-xs font-medium">Slack connected</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Mention Relay from your workspace.</p></div></div></div></aside><div className="flex min-w-0 flex-1 flex-col"><header className="flex h-15 shrink-0 items-center justify-between border-b px-4"><div className="flex min-w-0 items-center gap-2"><p className="truncate text-sm font-medium">{profile?.name ?? 'New workspace'}</p>{profile && <><ChevronRight className="size-3 text-muted-foreground"/><span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Command center</span></>}</div><div className="flex items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:inline">{currentSession.user.email}</span><SignOutButton/></div></header>{profile ? <Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading manager…</div>}><AgentChat companyName={profile.name} companyContext={JSON.stringify({ website: profile.websiteUrl, summary: profile.summary, audience: profile.audience, offering: profile.offering, voice: profile.voice })}/></Suspense> : <CompanyOnboarding/>}</div></div></main>
}

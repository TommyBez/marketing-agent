/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V5 */
import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  Compass,
  FileSearch,
  Globe2,
  Megaphone,
  Search,
  Sparkles,
  Target,
} from 'lucide-react'
import Link from 'next/link'

const specialists = [
  { name: 'SEO & Content', detail: 'Demand and discovery', icon: Search },
  { name: 'Copywriting', detail: 'Words that move', icon: Sparkles },
  { name: 'CRO', detail: 'Friction and conversion', icon: Target },
  { name: 'Growth', detail: 'Retention and loops', icon: Compass },
  { name: 'Paid & Social', detail: 'Distribution systems', icon: Megaphone },
  { name: 'Analytics', detail: 'Signal over noise', icon: BarChart3 },
]

function BrandMark() {
  return <span className="flex items-center gap-2.5 font-semibold"><span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Bot className="size-4" /></span>Relay</span>
}

function LandingHeader({ isSignedIn }: { isSignedIn: boolean }) {
  return <header className="landing-shell flex items-center justify-between py-4"><Link href="/" aria-label="Relay home"><BrandMark /></Link><nav aria-label="Main navigation" className="flex items-center gap-2"><Link className="landing-nav-link hidden sm:inline-flex" href="#how-it-works">How it works</Link>{!isSignedIn && <Link className="landing-nav-link" href="/sign-in">Sign in</Link>}<Link className="landing-button landing-button-small" href={isSignedIn ? '/workspace' : '/sign-up'}>{isSignedIn ? 'Open workspace' : 'Start free'}<ArrowRight className="size-4" /></Link></nav></header>
}

function CommandPreview() {
  return <div className="command-preview" aria-label="Example Relay workspace conversation"><div className="flex items-center justify-between border-b border-border/70 px-4 py-3"><div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><Bot className="size-3.5" /></span><div><p className="text-xs font-semibold">Marketing Manager</p><p className="text-[10px] text-muted-foreground">6 specialists ready</p></div></div><span className="command-status"><span />Live context</span></div><div className="flex flex-col gap-5 p-4 sm:p-6"><div className="ml-auto max-w-[84%] rounded-xl bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground">Build a launch plan for our new analytics feature.</div><div className="flex max-w-md flex-col gap-3"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Manager</p><p className="text-sm leading-6">I&apos;m bringing Strategy, Copy, SEO, and Paid Social into one coordinated brief.</p><div className="grid grid-cols-2 gap-2"><span className="agent-chip"><Check className="size-3" />Positioning mapped</span><span className="agent-chip"><Check className="size-3" />Channels assigned</span><span className="agent-chip"><Check className="size-3" />SEO reviewed</span><span className="agent-chip agent-chip-active"><span />Copy in progress</span></div></div></div></div>
}

function ContextCard() {
  return <div className="product-panel"><div className="flex items-center justify-between"><span className="panel-icon"><Globe2 className="size-4" /></span><span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Shared brief</span></div><div className="flex flex-col gap-3"><p className="text-sm font-semibold">yourcompany.com</p>{['Positioning', 'Audience', 'Product signals'].map((item, index) => <div className="context-row" key={item}><span>{item}</span><span className="context-meter" style={{ '--meter': `${88 - index * 15}%` } as React.CSSProperties} /></div>)}</div><p className="border-t pt-4 text-xs leading-5 text-muted-foreground">Every specialist starts from the same company truth.</p></div>
}

function SpecialistGrid() {
  return <div className="specialist-grid">{specialists.map(({ name, detail, icon: Icon }) => <div className="specialist-card" key={name}><span className="panel-icon"><Icon className="size-4" /></span><div><p className="text-sm font-semibold">{name}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div></div>)}</div>
}

function WorkflowSection({ number, verb, title, body, children }: { number: string; verb: string; title: string; body: string; children: React.ReactNode }) {
  return <section className="workflow-section"><div className="workflow-copy"><p className="workflow-number">{number} · {verb}</p><h2>{title}</h2><p>{body}</p></div><div className="min-w-0">{children}</div></section>
}

export function LandingPage({ isSignedIn }: { isSignedIn: boolean }) {
  const primaryHref = isSignedIn ? '/workspace' : '/sign-up'
  return <main className="landing-page"><LandingHeader isSignedIn={isSignedIn} /><section className="landing-shell hero-section"><div className="hero-copy"><p className="hero-kicker"><span />Your company context, in motion</p><h1>One marketing mind.<br/><span>A whole team behind it.</span></h1><p>Relay learns your business, then coordinates six specialist agents to turn strategy into finished marketing work.</p><div className="flex flex-wrap gap-3"><Link className="landing-button" href={primaryHref}>{isSignedIn ? 'Open your workspace' : 'Build your team'}<ArrowRight className="size-4" /></Link><a className="landing-button landing-button-quiet" href="#how-it-works">See the workflow</a></div><p className="hero-note">Start with a URL. No prompt engineering required.</p></div><CommandPreview /></section><div id="how-it-works" className="landing-shell workflow"><WorkflowSection number="1.0" verb="UNDERSTAND" title="Your website becomes working memory." body="Relay reads the source material you already have and distills the positioning, audience, offers, and language every agent needs."><ContextCard /></WorkflowSection><WorkflowSection number="2.0" verb="ASSEMBLE" title="The right specialists enter the room." body="One manager delegates across search, copy, conversion, growth, distribution, and analytics—without making you brief six separate tools."><SpecialistGrid /></WorkflowSection><WorkflowSection number="3.0" verb="MOVE" title="Ask once. Get coordinated work." body="Start with an outcome, not a workflow. Relay turns the request into a shared plan, routes the work, and returns one coherent answer."><div className="execution-card"><div className="execution-rail"><span className="execution-node complete"><FileSearch className="size-4" /></span><span className="execution-line"/><span className="execution-node complete"><Compass className="size-4" /></span><span className="execution-line"/><span className="execution-node active"><Sparkles className="size-4" /></span></div><div className="grid min-w-0 gap-4 sm:grid-cols-3"><div><p className="execution-label">Discover</p><p>Ground the request</p></div><div><p className="execution-label">Coordinate</p><p>Route specialist work</p></div><div><p className="execution-label">Deliver</p><p>Return one clear plan</p></div></div></div></WorkflowSection></div><footer className="landing-shell landing-footer"><div><p className="font-serif text-3xl text-balance sm:text-5xl">Marketing should feel like momentum,<br className="hidden sm:block" /> not management.</p><Link className="landing-button mt-8" href={primaryHref}>{isSignedIn ? 'Open your workspace' : 'Start with your website'}<ArrowRight className="size-4" /></Link></div><div className="footer-bottom"><BrandMark /><p>AI marketing coordination for focused teams.</p><Link href="/sign-in">Sign in</Link></div></footer></main>
}

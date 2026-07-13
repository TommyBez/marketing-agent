/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import Link from 'next/link'

const specialists = [
  { name: 'SEO & Content', detail: 'Demand and discovery', code: 'SC' },
  { name: 'Copywriting', detail: 'Words that move', code: 'CW' },
  { name: 'CRO', detail: 'Friction and conversion', code: 'CR' },
  { name: 'Growth', detail: 'Retention and loops', code: 'GR' },
  { name: 'Paid & Social', detail: 'Distribution systems', code: 'PS' },
  { name: 'Analytics', detail: 'Signal over noise', code: 'AN' },
]

function BrandMark() {
  return <span className="flex items-center gap-2.5 font-semibold"><span className="brand-monogram" aria-hidden="true">R</span>Relay</span>
}

function LandingHeader({ isSignedIn }: { isSignedIn: boolean }) {
  return <header className="landing-shell flex items-center justify-between py-4"><Link href="/" aria-label="Relay home"><BrandMark /></Link><nav aria-label="Main navigation" className="flex items-center gap-2"><Link className="landing-nav-link hidden sm:inline-flex" href="#how-it-works">How it works</Link>{!isSignedIn && <Link className="landing-nav-link" href="/sign-in">Sign in</Link>}<Link className="landing-button landing-button-small" href={isSignedIn ? '/workspace' : '/sign-up'}>{isSignedIn ? 'Open workspace' : 'Start free'}</Link></nav></header>
}

function CommandPreview() {
  return <div className="command-preview motion-reveal motion-delay-4" aria-label="Example Relay workspace conversation"><div className="flex items-center justify-between border-b border-border/70 px-4 py-3"><div><p className="text-xs font-semibold">Marketing Manager</p><p className="text-[10px] text-muted-foreground">6 specialists ready</p></div><span className="command-status"><span />Live context</span></div><div className="flex flex-col gap-5 p-4 sm:p-6"><div className="ml-auto max-w-[84%] rounded-xl bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground">Build a launch plan for our new analytics feature.</div><div className="flex max-w-md flex-col gap-3"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Manager</p><p className="text-sm leading-6">I&apos;m bringing Strategy, Copy, SEO, and Paid Social into one coordinated brief.</p><div className="grid grid-cols-2 gap-2"><span className="agent-chip">Positioning mapped</span><span className="agent-chip">Channels assigned</span><span className="agent-chip">SEO reviewed</span><span className="agent-chip agent-chip-active"><span />Copy in progress</span></div></div></div></div>
}

function ContextCard() {
  return <div className="product-panel"><div className="flex items-center justify-between"><span className="panel-label">Company context</span><span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Shared brief</span></div><div className="flex flex-col gap-3"><p className="text-sm font-semibold">yourcompany.com</p>{['Positioning', 'Audience', 'Product signals'].map((item, index) => <div className="context-row" key={item}><span>{item}</span><span className="context-meter context-meter-motion" style={{ '--meter': `${88 - index * 15}%` } as React.CSSProperties} /></div>)}</div><p className="border-t pt-4 text-xs leading-5 text-muted-foreground">Every specialist starts from the same company truth.</p></div>
}

function SpecialistGrid() {
  return <div className="specialist-grid">{specialists.map(({ name, detail, code }) => <div className="specialist-card specialist-card-motion" key={name}><span className="specialist-code" aria-hidden="true">{code}</span><div><p className="text-sm font-semibold">{name}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div></div>)}</div>
}

function WorkflowSection({ number, verb, title, body, children }: { number: string; verb: string; title: string; body: string; children: React.ReactNode }) {
  return <section className="workflow-section scroll-reveal"><div className="workflow-copy"><p className="workflow-number">{number} · {verb}</p><h2>{title}</h2><p>{body}</p></div><div className="min-w-0">{children}</div></section>
}

export function LandingPage({ isSignedIn }: { isSignedIn: boolean }) {
  const primaryHref = isSignedIn ? '/workspace' : '/sign-up'
  return <main className="landing-page"><LandingHeader isSignedIn={isSignedIn} /><section className="landing-shell hero-section"><div className="hero-copy"><p className="hero-kicker motion-reveal motion-delay-1"><span />Your company context, in motion</p><h1 className="motion-reveal motion-delay-2">One marketing mind.<br/><span>A whole team behind it.</span></h1><p className="motion-reveal motion-delay-3">Relay learns your business, then coordinates six specialist agents to turn strategy into finished marketing work.</p><div className="flex flex-wrap gap-3"><Link className="landing-button" href={primaryHref}>{isSignedIn ? 'Open your workspace' : 'Build your team'}</Link><a className="landing-button landing-button-quiet" href="#how-it-works">See the workflow</a></div><p className="hero-note">Start with a URL. No prompt engineering required.</p></div><CommandPreview /></section><div id="how-it-works" className="landing-shell workflow"><WorkflowSection number="1.0" verb="UNDERSTAND" title="Your website becomes working memory." body="Relay reads the source material you already have and distills the positioning, audience, offers, and language every agent needs."><ContextCard /></WorkflowSection><WorkflowSection number="2.0" verb="ASSEMBLE" title="The right specialists enter the room." body="One manager delegates across search, copy, conversion, growth, distribution, and analytics—without making you brief six separate tools."><SpecialistGrid /></WorkflowSection><WorkflowSection number="3.0" verb="MOVE" title="Ask once. Get coordinated work." body="Start with an outcome, not a workflow. Relay turns the request into a shared plan, routes the work, and returns one coherent answer."><div className="execution-card"><div className="execution-rail" aria-label="Workflow progress"><span className="execution-node complete">01</span><span className="execution-line"/><span className="execution-node complete">02</span><span className="execution-line"/><span className="execution-node active">03</span></div><div><p className="execution-label">Launch strategy is being assembled</p><p>One plan. Shared context. Every specialist moving in the same direction.</p></div></div></WorkflowSection></div><footer className="landing-shell landing-footer"><div className="hero-copy"><p className="hero-kicker"><span />Ready when you are</p><h2 className="font-serif text-5xl leading-none tracking-tight text-balance sm:text-7xl">Bring the brief.<br/><span className="text-muted-foreground">Relay brings the team.</span></h2><Link className="landing-button mt-3" href={primaryHref}>{isSignedIn ? 'Open your workspace' : 'Start with your website'}</Link></div><div className="footer-bottom"><BrandMark /><p>AI marketing work, coordinated.</p><Link href="/sign-in">Sign in</Link></div></footer></main>
}

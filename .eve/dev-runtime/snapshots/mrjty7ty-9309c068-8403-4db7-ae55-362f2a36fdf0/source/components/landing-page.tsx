import { Badge } from '@/components/ui/badge'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

const specialists = [
  { name: 'SEO & Content', detail: 'Search demand and discovery', code: 'SC' },
  { name: 'Copywriting', detail: 'Copy that converts', code: 'CW' },
  { name: 'CRO', detail: 'Friction and conversion', code: 'CR' },
  { name: 'Growth', detail: 'Retention and loops', code: 'GR' },
  { name: 'Paid & Social', detail: 'Distribution systems', code: 'PS' },
  { name: 'Analytics', detail: 'Clear performance insights', code: 'AN' },
]

interface LandingPageProps {
  isSignedIn: boolean
}

function BrandMark() {
  return <span className="flex items-center gap-2.5 font-semibold"><Badge className="size-8 justify-center rounded-lg p-0 font-mono" aria-hidden="true">R</Badge>Relay</span>
}

function LandingHeader({ isSignedIn }: LandingPageProps) {
  return (
    <header className="landing-shell flex items-center justify-between py-4">
      <Link href="/" aria-label="Relay home"><BrandMark /></Link>
      <nav aria-label="Main navigation" className="flex items-center gap-2">
        <Button variant="ghost" nativeButton={false} render={<Link href="#how-it-works" />} className="hidden sm:inline-flex">How it works</Button>
        {!isSignedIn && <Button variant="ghost" nativeButton={false} render={<Link href="/sign-in" />}>Sign in</Button>}
        <Button nativeButton={false} render={<Link href={isSignedIn ? '/workspace' : '/sign-up'} />}>{isSignedIn ? 'Open workspace' : 'Start free'}</Button>
      </nav>
    </header>
  )
}

function CommandPreview() {
  return (
    <Card className="command-preview motion-reveal motion-delay-4">
      <CardHeader className="border-b">
        <CardTitle>Marketing Manager</CardTitle>
        <CardDescription>6 specialists ready</CardDescription>
        <Badge variant="secondary" className="command-status"><span />Live context</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Bubble align="end"><BubbleContent>Build a launch plan for our new analytics feature.</BubbleContent></Bubble>
        <div className="flex max-w-md flex-col gap-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Manager</p>
          <p className="text-sm leading-6">I&apos;m bringing Strategy, Copy, SEO, and Paid Social into one coordinated brief.</p>
          <div className="grid grid-cols-2 gap-2">
            {['Positioning mapped', 'Channels assigned', 'SEO reviewed', 'Copy in progress'].map((item, index) => <Badge variant={index === 3 ? 'default' : 'secondary'} className="justify-start" key={item}>{item}</Badge>)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ContextCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="panel-label">Company context</CardTitle>
        <CardDescription>Shared brief</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm font-semibold">yourcompany.com</p>
        {['Positioning', 'Audience', 'Product signals'].map((item, index) => (
          <div className="flex flex-col gap-2" key={item}>
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{item}</span><span>{88 - index * 15}%</span></div>
            <Progress value={88 - index * 15} />
          </div>
        ))}
      </CardContent>
      <CardFooter><p className="text-xs leading-5 text-muted-foreground">Every specialist starts with the same company context.</p></CardFooter>
    </Card>
  )
}

function SpecialistGrid() {
  return (
    <div className="specialist-grid">
      {specialists.map(({ name, detail, code }) => (
        <Card size="sm" className="specialist-card-motion" key={name}>
          <CardHeader className="grid grid-cols-[auto_1fr] gap-x-3">
            <Badge variant="outline" className="row-span-2 size-9 justify-center p-0 font-mono">{code}</Badge>
            <CardTitle>{name}</CardTitle>
            <CardDescription>{detail}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

interface WorkflowSectionProps {
  number: string
  verb: string
  title: string
  body: string
  children: React.ReactNode
}

function WorkflowSection({ number, verb, title, body, children }: WorkflowSectionProps) {
  return (
    <section className="workflow-section scroll-reveal">
      <div className="workflow-copy"><Badge variant="outline">{number} · {verb}</Badge><h2>{title}</h2><p>{body}</p></div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function ExecutionCard() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="execution-rail" aria-label="Workflow progress">
          <Badge className="execution-node complete">01</Badge><Separator className="execution-line" /><Badge className="execution-node complete">02</Badge><Separator className="execution-line" /><Badge className="execution-node active">03</Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center"><div><p className="execution-label">Brief</p><p>Context aligned</p></div><div><p className="execution-label">Delegate</p><p>Experts active</p></div><div><p className="execution-label">Deliver</p><p>One answer</p></div></div>
      </CardContent>
      <CardFooter className="justify-between gap-4"><div><p className="panel-label">Manager synthesis</p><p className="mt-2 text-sm text-foreground">Launch plan ready for review</p></div><Badge variant="secondary">Complete</Badge></CardFooter>
    </Card>
  )
}

export function LandingPage({ isSignedIn }: LandingPageProps) {
  const primaryHref = isSignedIn ? '/workspace' : '/sign-up'
  return (
    <main className="landing-page">
      <LandingHeader isSignedIn={isSignedIn} />
      <section className="landing-shell hero-section">
        <div className="hero-copy">
          <Badge variant="outline" className="motion-reveal motion-delay-1">Marketing grounded in your business</Badge>
          <h1 className="motion-reveal motion-delay-2">One marketing mind.<br /><span>A whole team behind it.</span></h1>
          <p className="motion-reveal motion-delay-3">Relay learns your business, then coordinates six marketing specialists to turn strategy into ready-to-review marketing work.</p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" nativeButton={false} render={<Link href={primaryHref} />}>{isSignedIn ? 'Open workspace' : 'Start free'}<ArrowRight data-icon="inline-end" /></Button>
            <Button size="lg" variant="outline" nativeButton={false} render={<Link href="#how-it-works" />}>See the workflow</Button>
          </div>
          <p className="hero-note">Start with a URL. No prompt engineering required.</p>
        </div>
        <CommandPreview />
      </section>
      <div id="how-it-works" className="landing-shell workflow">
        <WorkflowSection number="1.0" verb="UNDERSTAND" title="Your website becomes working memory." body="Relay reads the source material you already have and distills the positioning, audience, offers, and language every specialist needs."><ContextCard /></WorkflowSection>
        <WorkflowSection number="2.0" verb="ASSEMBLE" title="The right specialists enter the room." body="One manager coordinates search, copy, conversion, growth, distribution, and analytics—without making you brief six specialists separately."><SpecialistGrid /></WorkflowSection>
        <WorkflowSection number="3.0" verb="MOVE" title="Ask once. Get coordinated work." body="Start with an outcome, not a workflow. Relay turns the request into a shared plan, routes the work, and returns one coherent answer."><ExecutionCard /></WorkflowSection>
      </div>
      <footer className="landing-shell landing-footer"><div className="hero-copy"><p className="panel-label">READY WHEN YOU ARE</p><h2 className="font-serif text-5xl leading-none tracking-tight text-balance md:text-7xl">Bring your marketing work together.</h2><Button size="lg" nativeButton={false} render={<Link href={primaryHref} />}>{isSignedIn ? 'Open workspace' : 'Start free'}<ArrowRight data-icon="inline-end" /></Button></div><div className="footer-bottom"><BrandMark /><p>One manager. Six specialists. Your company context.</p><Link href={primaryHref}>{isSignedIn ? 'Open workspace' : 'Start free'} →</Link></div></footer>
    </main>
  )
}

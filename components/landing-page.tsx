import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

const specialists = [
  { name: 'Strategy', detail: 'Positioning and market signals' },
  { name: 'SEO + Content', detail: 'Demand, discovery, and authority' },
  { name: 'Copywriting', detail: 'Clear ideas that move people' },
  { name: 'Conversion', detail: 'Sharper journeys with less friction' },
  { name: 'Growth', detail: 'Retention and compounding loops' },
  { name: 'Paid + Social', detail: 'Campaigns built for distribution' },
]

interface LandingPageProps {
  isSignedIn: boolean
}

function LandingHeader({ isSignedIn }: LandingPageProps) {
  const primaryHref = isSignedIn ? '/workspace' : '/sign-up'

  return (
    <header className="landing-shell landing-header">
      <Link href="/" aria-label="Branderize home">
        <BrandMark />
      </Link>
      <nav aria-label="Main navigation" className="landing-nav">
        <Link className="landing-nav-link" href="#how-it-works">How it works</Link>
        {!isSignedIn && <Link className="landing-nav-link" href="/sign-in">Sign in</Link>}
        <Button nativeButton={false} render={<Link href={primaryHref} />}>
          {isSignedIn ? 'Open workspace' : 'Start free'}
        </Button>
      </nav>
    </header>
  )
}

function DisciplineRail() {
  return (
    <section className="landing-shell discipline-rail" aria-label="Marketing specialists">
      <p>One brief, six disciplines</p>
      <div>
        {specialists.map(({ name }) => <span key={name}>{name}</span>)}
      </div>
    </section>
  )
}

function ContextSection() {
  return (
    <section className="landing-shell context-section">
      <div className="context-copy">
        <h2>Your brand is the brief.</h2>
        <p>Branderize studies your positioning, audience, offers, and voice before the first specialist starts working.</p>
        <ul>
          <li>One source of truth for every request</li>
          <li>Company context that persists between conversations</li>
          <li>Work that sounds recognizably yours</li>
        </ul>
      </div>
      <figure className="context-image">
        <Image
          src="/branderize-system.webp"
          alt="A tactile brand system made from typographic proofs and color materials"
          width={1200}
          height={1500}
          sizes="(max-width: 767px) 100vw, 52vw"
        />
      </figure>
    </section>
  )
}

function WorkflowSection() {
  return (
    <section id="how-it-works" className="landing-shell workflow-section">
      <div className="workflow-heading">
        <h2>Brief once. Move as one.</h2>
        <p>Give Branderize an outcome. The manager assembles the right specialists and returns one coordinated answer.</p>
      </div>
      <div className="workflow-grid">
        <article className="workflow-lead">
          <span>Understand</span>
          <h3>Start with the business, not a blank prompt.</h3>
          <p>Add your website once. Branderize turns it into durable context for every project that follows.</p>
        </article>
        <article>
          <span>Orchestrate</span>
          <h3>The right minds enter the room.</h3>
          <p>Strategy, search, copy, conversion, growth, and distribution collaborate without six separate briefs.</p>
        </article>
        <article className="workflow-accent">
          <span>Deliver</span>
          <h3>One answer, ready to shape.</h3>
          <p>Ideas arrive connected, traceable, and grounded in the same brand truth.</p>
        </article>
      </div>
    </section>
  )
}

export function LandingPage({ isSignedIn }: LandingPageProps) {
  const primaryHref = isSignedIn ? '/workspace' : '/sign-up'
  const primaryLabel = isSignedIn ? 'Open workspace' : 'Start free'

  return (
    <main className="landing-page">
      <LandingHeader isSignedIn={isSignedIn} />
      <section className="landing-shell hero-section">
        <div className="hero-copy">
          <p className="hero-kicker">AI marketing workspace</p>
          <h1>Make every channel <span>sound like you.</span></h1>
          <p>Branderize learns your business and directs six specialists from one shared source of truth.</p>
          <div className="hero-actions">
            <Button size="lg" nativeButton={false} render={<Link href={primaryHref} />}>
              {primaryLabel}<ArrowRight data-icon="inline-end" />
            </Button>
            <Button size="lg" variant="outline" nativeButton={false} render={<Link href="#how-it-works" />}>
              See how it works
            </Button>
          </div>
        </div>
        <figure className="hero-visual">
          <Image
            src="/branderize-studio.webp"
            alt="Contemporary brand materials in black, cobalt, and vermilion"
            width={1600}
            height={1200}
            priority
            sizes="(max-width: 767px) 100vw, 52vw"
          />
        </figure>
      </section>
      <DisciplineRail />
      <ContextSection />
      <WorkflowSection />
      <footer className="landing-shell landing-footer">
        <div>
          <p>Ready when you are</p>
          <h2>Put your whole marketing team on the same page.</h2>
          <Button size="lg" nativeButton={false} render={<Link href={primaryHref} />}>
            {primaryLabel}<ArrowRight data-icon="inline-end" />
          </Button>
        </div>
        <div className="footer-bottom">
          <BrandMark />
          <p>One manager. Six specialists. Your company context.</p>
          <p>Built for focused marketing teams.</p>
        </div>
      </footer>
    </main>
  )
}

import { BrandMark } from '@/components/brand-mark'
import { CompanyBrief } from '@/components/company-brief'
import { LandingAnalyzerDemo } from '@/components/landing-analyzer-demo'
import { LandingStoryMotion } from '@/components/landing-motion'
import { SpecialistActivityItem } from '@/components/specialist-activity-item'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

const expertiseExamples = [
  { name: 'Positioning', detail: 'Clarify the market, offer, and decision context' },
  { name: 'Demand', detail: 'Find the channels and moments worth pursuing' },
  { name: 'Messaging', detail: 'Turn the brief into a clear story and campaign' },
  { name: 'Conversion', detail: 'Remove friction and prioritize measurable moves' },
]

const assignedSpecialists = ['Strategy', 'Copywriting', 'Growth']

const northlineBrief = {
  name: 'Northline',
  websiteUrl: 'https://northline.studio',
  summary: 'A strategy-led design partner helping independent hospitality brands launch with a clearer point of view.',
  audience: 'Founder-led hospitality teams preparing a new opening, repositioning, or expansion.',
  offering: 'Brand strategy, launch systems, digital direction, and campaign creative.',
  voice: 'Direct, considered, and quietly confident.',
}

const coordinatedAnswer = [
  {
    title: 'Launch direction',
    body: 'Own the moment between a strong concept and an opening people can already picture themselves inside.',
  },
  {
    title: 'Shared campaign idea',
    body: 'Build every channel around one invitation: see the place take shape before the doors open.',
  },
  {
    title: 'First move',
    body: 'Publish the opening story, then let search, lifecycle, conversion, and paid creative compound around it.',
  },
]

interface LandingPageProps {
  isSignedIn: boolean
}

function LandingHeader({ isSignedIn }: LandingPageProps) {
  const primaryHref = isSignedIn ? '/workspace' : '/sign-up'
  const primaryLabel = isSignedIn ? 'Open workspace' : 'Create your workspace'

  return (
    <header className="landing-shell landing-header">
      <Link href="/" aria-label="Branderize home">
        <BrandMark />
      </Link>
      <nav aria-label="Main navigation" className="landing-nav">
        {!isSignedIn && <Link className="landing-nav-link" href="/sign-in">Sign in</Link>}
        <Button className="landing-cta" nativeButton={false} render={<Link href={primaryHref} />}>
          {isSignedIn ? primaryLabel : (
            <>
              <span className="landing-header-cta-full">Create your workspace</span>
              <span className="landing-header-cta-compact">Create workspace</span>
            </>
          )}
        </Button>
      </nav>
    </header>
  )
}

function DisciplineScore() {
  return (
    <section className="landing-shell discipline-score" aria-labelledby="discipline-score-title">
      <div className="discipline-score-copy landing-view-reveal">
        <p>One shared company brief</p>
        <div>
          <h2 id="discipline-score-title">The right expertise. One coordinated answer.</h2>
          <p>Each assigned specialist works from the same company context. The manager resolves overlaps and trade-offs, so you get one direction instead of disconnected opinions.</p>
        </div>
      </div>
      <div className="discipline-roles-wrap">
        <div aria-hidden="true" className="discipline-baton" />
        <ul className="discipline-roles">
          {expertiseExamples.map(({ name, detail }) => (
            <li className="discipline-role" key={name}>
              <div>
                <strong>{name}</strong>
                <span>{detail}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function OrchestrationStory() {
  return (
    <LandingStoryMotion
      heading={(
        <header className="story-heading-copy landing-view-reveal">
          <p>How it works</p>
          <h2>Your brand is not a blank prompt.</h2>
          <span>Branderize turns your website into a private company brief, so every request starts with the right context.</span>
        </header>
      )}
      contextBeat={(
        <article className="story-beat">
          <p>Context</p>
          <h3>Start with what your business already knows.</h3>
          <span>Branderize captures your positioning, audience, offer, and voice in one shared brief.</span>
        </article>
      )}
      orchestrationBeat={(
        <article className="story-beat">
          <p>Orchestration</p>
          <h3>Bring in the right minds.</h3>
          <span>The manager assigns the specialists your request needs, without making you repeat the brief.</span>
        </article>
      )}
      synthesisBeat={(
        <article className="story-beat">
          <p>Synthesis</p>
          <h3>Get one accountable answer.</h3>
          <span>The manager resolves trade-offs, separates evidence from assumptions, and gives you concrete next actions.</span>
        </article>
      )}
      contextPanel={<CompanyBrief brief={northlineBrief} density="compact" />}
      activities={assignedSpecialists.map((name) => (
        <SpecialistActivityItem
          className="living-activity"
          key={name}
          kind="subagent-call"
          status="completed"
          title={`${name} specialist`}
          toolName={name.toLowerCase().replaceAll(/[^a-z]+/g, '-')}
        />
      ))}
      prompt="Build a coordinated launch plan for Northline."
      responseBlocks={coordinatedAnswer.map(({ body, title }) => (
        <section className="living-response-block" key={title}>
          <h4>{title}</h4>
          <p>{body}</p>
        </section>
      ))}
      composer="Ask your brand director…"
      workspaceName="Northline"
    />
  )
}

export function LandingPage({ isSignedIn }: LandingPageProps) {
  const primaryHref = isSignedIn ? '/workspace' : '/sign-up'
  const primaryLabel = isSignedIn ? 'Open workspace' : 'Create your workspace'

  return (
    <main className="landing-page">
        <LandingHeader isSignedIn={isSignedIn} />
        <section className="landing-shell hero-section">
          <div className="hero-copy">
            <p className="hero-kicker landing-load-reveal landing-load-1">AI marketing workspace</p>
            <h1 aria-label="Brief once. Move as one.">
              <span aria-hidden="true" className="hero-line">
                <span className="landing-headline-reveal landing-load-2">Brief once.</span>
              </span>
              <span aria-hidden="true" className="hero-line hero-line-muted">
                <span className="landing-headline-reveal landing-load-3">Move as one.</span>
              </span>
            </h1>
            <p className="landing-load-reveal landing-load-4">Add your website once. Branderize builds a shared brief, assigns the right specialists, and returns one coordinated answer.</p>
            <div className="hero-actions landing-load-reveal landing-load-5">
              <Button className="landing-cta" size="lg" nativeButton={false} render={<Link href={primaryHref} />}>
                {primaryLabel}<ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
          <div className="hero-visual" role="img" aria-label="Branderize turning a website into a shared company brief">
            <LandingAnalyzerDemo />
          </div>
        </section>
        <DisciplineScore />
        <OrchestrationStory />
        <footer className="landing-closing">
          <div className="landing-shell landing-closing-main landing-view-reveal">
            <p>Your move</p>
            <h2>Your next brief already has a team.</h2>
            <span>Create your account, add your website, and make your first request. No credit card required.</span>
            <Button
              className="landing-cta landing-closing-cta"
              size="lg"
              variant="secondary"
              nativeButton={false}
              render={<Link href={primaryHref} />}
            >
              {primaryLabel}<ArrowRight data-icon="inline-end" />
            </Button>
          </div>
          <div className="landing-shell footer-bottom">
            <BrandMark />
            <p>One manager. The right specialists. Your company context.</p>
            <p>Your workspace and conversations stay private to your account.</p>
          </div>
        </footer>
    </main>
  )
}

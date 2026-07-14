import { BrandMark } from '@/components/brand-mark'
import {
  LandingMotionConfig,
  LandingStoryMotion,
} from '@/components/landing-motion'
import { Button } from '@/components/ui/button'
import {
  LANDING_DISCIPLINE_STAGGER,
  LANDING_EASE_OUT,
  LANDING_HEADLINE_STAGGER,
  LANDING_REVEAL_DURATION,
  LANDING_STAGGER,
  LANDING_TRAVEL,
} from '@/lib/landing-motion-tokens'
import { ArrowRight } from 'lucide-react'
import type { Variants } from 'motion/react'
import * as motion from 'motion/react-client'
import Image from 'next/image'
import Link from 'next/link'

function createLandingRevealVariants(delay = 0): Variants {
  return {
    hidden: {
      opacity: 0,
      transform: `translate3d(0, ${LANDING_TRAVEL}, 0)`,
    },
    visible: {
      opacity: 1,
      transform: 'translate3d(0, 0rem, 0)',
      transition: {
        delay,
        duration: LANDING_REVEAL_DURATION,
        ease: LANDING_EASE_OUT,
      },
    },
  }
}

function createHeadlineLineVariants(index: number): Variants {
  return {
    hidden: {
      opacity: 0,
      transform: 'translate3d(0, 0.8em, 0)',
    },
    visible: {
      opacity: 1,
      transform: 'translate3d(0, 0em, 0)',
      transition: {
        delay: LANDING_STAGGER + index * LANDING_HEADLINE_STAGGER,
        duration: 0.7,
        ease: LANDING_EASE_OUT,
      },
    },
  }
}

function createDisciplineVariants(index: number): Variants {
  return {
    hidden: {
      opacity: 0,
      transform: 'translate3d(0, 0.9em, 0)',
    },
    visible: {
      opacity: 1,
      transform: 'translate3d(0, 0em, 0)',
      transition: {
        delay: LANDING_STAGGER + index * LANDING_DISCIPLINE_STAGGER,
        duration: LANDING_REVEAL_DURATION,
        ease: LANDING_EASE_OUT,
      },
    },
  }
}

const landingRevealVariants = createLandingRevealVariants()

const landingHeroMediaVariants = {
  hidden: {
    opacity: 0.72,
    transform: 'translate3d(0, 0.5rem, 0) scale(0.98)',
  },
  visible: {
    opacity: 1,
    transform: 'translate3d(0, 0rem, 0) scale(1)',
    transition: {
      delay: 0.18,
      duration: 0.78,
      ease: LANDING_EASE_OUT,
    },
  },
} satisfies Variants

const disciplineBatonVariants = {
  hidden: {
    opacity: 0,
    transform: 'scaleX(0)',
  },
  visible: {
    opacity: 1,
    transform: 'scaleX(1)',
    transition: {
      delay: LANDING_STAGGER,
      duration: 0.9,
      ease: LANDING_EASE_OUT,
    },
  },
} satisfies Variants

const landingLoadMotion = {
  initial: 'hidden',
  animate: 'visible',
} as const

const landingViewMotion = {
  initial: 'hidden',
  whileInView: 'visible',
  viewport: { once: true, amount: 0.25 },
} as const

const landingScoreViewMotion = {
  initial: 'hidden',
  whileInView: 'visible',
  viewport: {
    once: true,
    amount: 0.35,
    margin: '0px 0px -8% 0px',
  },
} as const

const specialists = [
  { name: 'Strategy', detail: 'Positioning, pricing, and market evidence' },
  { name: 'SEO + Content', detail: 'Search visibility and content systems' },
  { name: 'Copywriting', detail: 'Voice, messaging, and campaign copy' },
  { name: 'Conversion', detail: 'Funnel friction and measurable experiments' },
  { name: 'Growth', detail: 'Lifecycle, retention, and referrals' },
  { name: 'Paid + Social', detail: 'Campaign strategy, creative, and distribution' },
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
        <Link className="landing-nav-link" href="#how-it-works">How it works</Link>
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
    <motion.section
      className="landing-shell discipline-score"
      aria-labelledby="discipline-score-title"
      {...landingScoreViewMotion}
    >
      <motion.div className="discipline-score-copy" variants={landingRevealVariants}>
        <p>One shared company brief</p>
        <div>
          <h2 id="discipline-score-title">Six disciplines. One coordinated answer.</h2>
          <p>Every specialist works from the same company context. The manager reconciles their recommendations, so you get one direction instead of six disconnected opinions.</p>
        </div>
      </motion.div>
      <div className="discipline-roles-wrap">
        <motion.div
          aria-hidden="true"
          className="discipline-baton"
          variants={disciplineBatonVariants}
        />
        <ul className="discipline-roles">
          {specialists.map(({ name, detail }, index) => (
            <li className="discipline-role" key={name}>
              <motion.div variants={createDisciplineVariants(index)}>
                <strong>{name}</strong>
                <span>{detail}</span>
              </motion.div>
            </li>
          ))}
        </ul>
      </div>
    </motion.section>
  )
}

function OrchestrationStory() {
  return (
    <LandingStoryMotion
      heading={(
        <motion.header
          className="story-heading-copy"
          variants={landingRevealVariants}
          {...landingViewMotion}
        >
          <p>How it works</p>
          <h2>Your brand is not a blank prompt.</h2>
          <span>Branderize turns your website into a private company brief, so every request starts with the right context.</span>
        </motion.header>
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
      contextMedia={(
        <figure>
          <Image
            src="/branderize-workspace-context.webp"
            alt="Branderize workspace showing Northline positioning, audience, offer, and voice as a shared company brief"
            width={1000}
            height={1250}
            sizes="(max-width: 767px) 100vw, 58vw"
          />
          <figcaption className="sr-only">Northline company context shared across every specialist request</figcaption>
        </figure>
      )}
      outputMedia={(
        <figure>
          <Image
            src="/branderize-workspace-launch.webp"
            alt="Branderize workspace returning one coordinated Northline launch plan from six marketing disciplines"
            width={1200}
            height={900}
            sizes="(max-width: 767px) 100vw, 58vw"
          />
          <figcaption className="sr-only">One coordinated launch direction, rollout, and first move</figcaption>
        </figure>
      )}
    />
  )
}

export function LandingPage({ isSignedIn }: LandingPageProps) {
  const primaryHref = isSignedIn ? '/workspace' : '/sign-up'
  const primaryLabel = isSignedIn ? 'Open workspace' : 'Create your workspace'

  return (
    <LandingMotionConfig>
      <main className="landing-page">
        <LandingHeader isSignedIn={isSignedIn} />
        <section className="landing-shell hero-section">
          <div className="hero-copy">
            <motion.p className="hero-kicker" variants={landingRevealVariants} {...landingLoadMotion}>AI marketing workspace</motion.p>
            <h1 aria-label="Brief once. Move as one.">
              <span aria-hidden="true" className="hero-line">
                <motion.span variants={createHeadlineLineVariants(0)} {...landingLoadMotion}>Brief once.</motion.span>
              </span>
              <span aria-hidden="true" className="hero-line hero-line-muted">
                <motion.span variants={createHeadlineLineVariants(1)} {...landingLoadMotion}>Move as one.</motion.span>
              </span>
            </h1>
            <motion.p variants={createLandingRevealVariants(LANDING_STAGGER * 2)} {...landingLoadMotion}>Add your website once. Branderize turns it into a shared company brief, assigns the right specialists, and returns one coordinated answer.</motion.p>
            <motion.div
              className="hero-actions"
              variants={createLandingRevealVariants(LANDING_STAGGER * 3)}
              {...landingLoadMotion}
            >
              <Button className="landing-cta" size="lg" nativeButton={false} render={<Link href={primaryHref} />}>
                {primaryLabel}<ArrowRight data-icon="inline-end" />
              </Button>
              <Button className="landing-cta" size="lg" variant="outline" nativeButton={false} render={<Link href="#how-it-works" />}>
                See the workflow
              </Button>
            </motion.div>
          </div>
          <motion.figure className="hero-visual" variants={landingHeroMediaVariants} {...landingLoadMotion}>
            <Image
              src="/branderize-workspace-ingest.webp"
              alt="Branderize analyzing the Northline website and building a shared company brief"
              width={1200}
              height={900}
              loading="eager"
              priority
              sizes="(max-width: 767px) 100vw, 56vw"
            />
            <figcaption className="sr-only">A real website analysis becoming shared company context inside Branderize</figcaption>
          </motion.figure>
        </section>
        <DisciplineScore />
        <OrchestrationStory />
        <footer className="landing-closing">
          <motion.div
            className="landing-shell landing-closing-main"
            variants={landingRevealVariants}
            {...landingViewMotion}
          >
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
          </motion.div>
          <div className="landing-shell footer-bottom">
            <BrandMark />
            <p>One manager. Six specialists. Your company context.</p>
            <p>Your workspace and conversations stay private to your account.</p>
          </div>
        </footer>
      </main>
    </LandingMotionConfig>
  )
}

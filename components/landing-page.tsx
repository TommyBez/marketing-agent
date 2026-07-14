import { BrandMark } from '@/components/brand-mark'
import { LandingContextParallax, LandingMotionConfig } from '@/components/landing-motion'
import { Button } from '@/components/ui/button'
import {
  LANDING_EASE_OUT,
  LANDING_MEDIA_DURATION,
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

const landingRevealVariants = createLandingRevealVariants()

const landingHeroMediaVariants = {
  hidden: {
    opacity: 0.75,
    transform: 'translate3d(0, 0rem, 0) scale(0.97)',
  },
  visible: {
    opacity: 1,
    transform: 'translate3d(0, 0rem, 0) scale(1)',
    transition: {
      delay: LANDING_STAGGER * 2,
      duration: LANDING_MEDIA_DURATION,
      ease: LANDING_EASE_OUT,
    },
  },
} satisfies Variants

const landingContextMediaVariants = {
  hidden: landingRevealVariants.hidden,
  visible: {
    ...landingRevealVariants.visible,
    transition: {
      duration: LANDING_MEDIA_DURATION,
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

const landingRailViewMotion = {
  initial: 'hidden',
  whileInView: 'visible',
  viewport: {
    once: true,
    amount: 0.6,
    margin: '0px 0px -12% 0px',
  },
} as const

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
        <Button className="landing-cta" nativeButton={false} render={<Link href={primaryHref} />}>
          {isSignedIn ? 'Open workspace' : 'Start free'}
        </Button>
      </nav>
    </header>
  )
}

function DisciplineRail() {
  return (
    <motion.section
      className="landing-shell discipline-rail"
      aria-label="Marketing specialists"
      {...landingRailViewMotion}
    >
      <motion.p variants={landingRevealVariants}>One brief, six disciplines</motion.p>
      <div>
        {specialists.map(({ name }, index) => (
          <motion.span
            key={name}
            variants={createLandingRevealVariants((index + 1) * LANDING_STAGGER)}
          >
            {name}
          </motion.span>
        ))}
      </div>
    </motion.section>
  )
}

function ContextSection() {
  return (
    <section className="landing-shell context-section">
      <motion.div
        className="context-copy"
        variants={landingRevealVariants}
        {...landingViewMotion}
      >
        <h2>Your brand is the brief.</h2>
        <p>Branderize studies your positioning, audience, offers, and voice before the first specialist starts working.</p>
        <ul>
          <li>One source of truth for every request</li>
          <li>Company context that persists between conversations</li>
          <li>Work that sounds recognizably yours</li>
        </ul>
      </motion.div>
      <motion.figure
        className="context-image"
        variants={landingContextMediaVariants}
        {...landingViewMotion}
      >
        <LandingContextParallax>
          <Image
            src="/branderize-workspace-context.webp"
            alt="Branderize workspace showing Northline positioning, audience, offer, and voice as a shared brand brief"
            width={1000}
            height={1250}
            sizes="(max-width: 767px) 100vw, 52vw"
          />
        </LandingContextParallax>
      </motion.figure>
    </section>
  )
}

function WorkflowSection() {
  return (
    <section id="how-it-works" className="landing-shell workflow-section">
      <motion.div
        className="workflow-heading"
        variants={landingRevealVariants}
        {...landingViewMotion}
      >
        <h2>Brief once. Move as one.</h2>
        <p>Give Branderize an outcome. The manager assembles the right specialists and returns one coordinated answer.</p>
      </motion.div>
      <div className="workflow-grid">
        <motion.article className="workflow-lead" variants={landingRevealVariants} {...landingViewMotion}>
          <span>Understand</span>
          <h3>Start with the business, not a blank prompt.</h3>
          <p>Add your website once. Branderize turns it into durable context for every project that follows.</p>
        </motion.article>
        <motion.article variants={createLandingRevealVariants(LANDING_STAGGER)} {...landingViewMotion}>
          <span>Orchestrate</span>
          <h3>The right minds enter the room.</h3>
          <p>Strategy, search, copy, conversion, growth, and distribution collaborate without six separate briefs.</p>
        </motion.article>
        <motion.article
          className="workflow-accent"
          variants={createLandingRevealVariants(LANDING_STAGGER * 2)}
          {...landingViewMotion}
        >
          <span>Deliver</span>
          <h3>One answer, ready to shape.</h3>
          <p>Ideas arrive connected, traceable, and grounded in the same brand truth.</p>
        </motion.article>
      </div>
    </section>
  )
}

export function LandingPage({ isSignedIn }: LandingPageProps) {
  const primaryHref = isSignedIn ? '/workspace' : '/sign-up'
  const primaryLabel = isSignedIn ? 'Open workspace' : 'Start free'

  return (
    <LandingMotionConfig>
      <main className="landing-page">
        <LandingHeader isSignedIn={isSignedIn} />
        <section className="landing-shell hero-section">
          <div className="hero-copy">
            <motion.p className="hero-kicker" variants={landingRevealVariants} {...landingLoadMotion}>AI marketing workspace</motion.p>
            <motion.h1 variants={createLandingRevealVariants(LANDING_STAGGER)} {...landingLoadMotion}>Make every channel <span>sound like you.</span></motion.h1>
            <motion.p variants={createLandingRevealVariants(LANDING_STAGGER * 2)} {...landingLoadMotion}>Branderize learns your business and directs six specialists from one shared source of truth.</motion.p>
            <motion.div
              className="hero-actions"
              variants={createLandingRevealVariants(LANDING_STAGGER * 3)}
              {...landingLoadMotion}
            >
              <Button className="landing-cta" size="lg" nativeButton={false} render={<Link href={primaryHref} />}>
                {primaryLabel}<ArrowRight data-icon="inline-end" />
              </Button>
              <Button className="landing-cta" size="lg" variant="outline" nativeButton={false} render={<Link href="#how-it-works" />}>
                See how it works
              </Button>
            </motion.div>
          </div>
          <motion.figure className="hero-visual" variants={landingHeroMediaVariants} {...landingLoadMotion}>
            <Image
              src="/branderize-workspace-launch.webp"
              alt="Branderize workspace coordinating six marketing disciplines for a Northline launch"
              width={1200}
              height={900}
              priority
              sizes="(max-width: 767px) 100vw, 52vw"
            />
          </motion.figure>
        </section>
        <DisciplineRail />
        <ContextSection />
        <WorkflowSection />
        <motion.footer
          className="landing-shell landing-footer"
          variants={landingRevealVariants}
          {...landingViewMotion}
        >
          <div>
            <p>Ready when you are</p>
            <h2>Put your whole marketing team on the same page.</h2>
            <Button className="landing-cta" size="lg" nativeButton={false} render={<Link href={primaryHref} />}>
              {primaryLabel}<ArrowRight data-icon="inline-end" />
            </Button>
          </div>
          <div className="footer-bottom">
            <BrandMark />
            <p>One manager. Six specialists. Your company context.</p>
            <p>Built for focused marketing teams.</p>
          </div>
        </motion.footer>
      </main>
    </LandingMotionConfig>
  )
}

'use client'

import {
  LANDING_EASE_OUT,
  LANDING_STORY_SPRING,
} from '@/lib/landing-motion-tokens'
import {
  MotionConfig,
  motion,
  type MotionStyle,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react'
import {
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type RefObject,
  type ReactNode,
} from 'react'

const LANDING_TRANSITION = { ease: LANDING_EASE_OUT } as const
const DESKTOP_STORY_QUERY = '(min-width: 48rem)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

interface LandingStoryMotionProps {
  heading: ReactNode
  contextBeat: ReactNode
  orchestrationBeat: ReactNode
  synthesisBeat: ReactNode
  contextMedia: ReactNode
  outputMedia: ReactNode
}

export function LandingMotionConfig({ children }: PropsWithChildren) {
  return (
    <MotionConfig reducedMotion="user" transition={LANDING_TRANSITION}>
      {children}
    </MotionConfig>
  )
}

interface LandingStoryStyles {
  contextBeat: MotionStyle
  orchestrationBeat: MotionStyle
  synthesisBeat: MotionStyle
  contextMedia: MotionStyle
  outputMedia: MotionStyle
  outputMediaInner: MotionStyle
  outputEdge: MotionStyle
}

interface LandingStoryLayoutProps extends LandingStoryMotionProps {
  targetRef?: RefObject<HTMLElement | null>
  motionStyles?: LandingStoryStyles
}

function LandingStoryLayout({
  heading,
  contextBeat,
  orchestrationBeat,
  synthesisBeat,
  contextMedia,
  outputMedia,
  targetRef,
  motionStyles,
}: LandingStoryLayoutProps) {
  return (
    <section id="how-it-works" ref={targetRef} className="story-section">
      <div className="landing-shell story-heading">{heading}</div>
      <div className="landing-shell story-grid">
        <motion.div
          className="story-beat-shell story-beat-context"
          style={motionStyles?.contextBeat}
        >
          {contextBeat}
        </motion.div>
        <motion.div
          className="story-beat-shell story-beat-orchestration"
          style={motionStyles?.orchestrationBeat}
        >
          {orchestrationBeat}
        </motion.div>
        <div className="story-stage-column">
          <div
            className="story-stage"
            role="group"
            aria-label="Company context becoming one coordinated marketing answer"
          >
            <motion.div
              className="story-media story-media-context"
              style={motionStyles?.contextMedia}
            >
              {contextMedia}
            </motion.div>
            <motion.div
              className="story-media story-media-output"
              style={motionStyles?.outputMedia}
            >
              <motion.div
                className="story-media-output-inner"
                style={motionStyles?.outputMediaInner}
              >
                {outputMedia}
              </motion.div>
              <motion.div
                aria-hidden="true"
                className="story-wipe-edge"
                style={motionStyles?.outputEdge}
              />
            </motion.div>
          </div>
        </div>
        <motion.div
          className="story-beat-shell story-beat-synthesis"
          style={motionStyles?.synthesisBeat}
        >
          {synthesisBeat}
        </motion.div>
      </div>
    </section>
  )
}

function LandingStoryAnimated(props: LandingStoryMotionProps) {
  const targetRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ['start start', 'end end'],
  })
  const storyProgress = useSpring(scrollYProgress, LANDING_STORY_SPRING)

  const contextBeatOpacity = useTransform(
    storyProgress,
    [0, 0.08, 0.3, 0.4],
    [0.4, 1, 1, 0.35],
  )
  const contextBeatTransform = useTransform(
    storyProgress,
    [0, 0.08, 0.3, 0.4],
    [
      'translate3d(0, 1rem, 0)',
      'translate3d(0, 0rem, 0)',
      'translate3d(0, 0rem, 0)',
      'translate3d(0, -0.5rem, 0)',
    ],
  )
  const orchestrationBeatOpacity = useTransform(
    storyProgress,
    [0.28, 0.42, 0.6, 0.7],
    [0.35, 1, 1, 0.35],
  )
  const orchestrationBeatTransform = useTransform(
    storyProgress,
    [0.28, 0.42, 0.6, 0.7],
    [
      'translate3d(0, 1rem, 0)',
      'translate3d(0, 0rem, 0)',
      'translate3d(0, 0rem, 0)',
      'translate3d(0, -0.5rem, 0)',
    ],
  )
  const synthesisBeatOpacity = useTransform(
    storyProgress,
    [0.6, 0.74, 1],
    [0.35, 1, 1],
  )
  const synthesisBeatTransform = useTransform(
    storyProgress,
    [0.6, 0.74, 1],
    [
      'translate3d(0, 1rem, 0)',
      'translate3d(0, 0rem, 0)',
      'translate3d(0, 0rem, 0)',
    ],
  )
  const contextMediaTransform = useTransform(
    storyProgress,
    [0, 0.44, 0.66],
    [
      'translate3d(0, 0rem, 0) scale(1)',
      'translate3d(0, 0rem, 0) scale(1)',
      'translate3d(-0.5rem, 0rem, 0) scale(0.99)',
    ],
  )
  const outputMediaTransform = useTransform(
    storyProgress,
    [0.44, 0.66],
    [
      'translate3d(100%, 0rem, 0)',
      'translate3d(0%, 0rem, 0)',
    ],
  )
  const outputMediaInnerTransform = useTransform(
    storyProgress,
    [0.44, 0.66],
    [
      'translate3d(-100%, 0rem, 0)',
      'translate3d(0%, 0rem, 0)',
    ],
  )
  const outputEdgeOpacity = useTransform(
    storyProgress,
    [0.44, 0.46, 0.64, 0.66],
    [0, 1, 1, 0],
  )

  return (
    <LandingStoryLayout
      {...props}
      targetRef={targetRef}
      motionStyles={{
        contextBeat: {
          opacity: contextBeatOpacity,
          transform: contextBeatTransform,
        },
        orchestrationBeat: {
          opacity: orchestrationBeatOpacity,
          transform: orchestrationBeatTransform,
        },
        synthesisBeat: {
          opacity: synthesisBeatOpacity,
          transform: synthesisBeatTransform,
        },
        contextMedia: { transform: contextMediaTransform },
        outputMedia: {
          opacity: 1,
          transform: outputMediaTransform,
        },
        outputMediaInner: { transform: outputMediaInnerTransform },
        outputEdge: { opacity: outputEdgeOpacity },
      }}
    />
  )
}

export function LandingStoryMotion(props: LandingStoryMotionProps) {
  const [isHydrated, setIsHydrated] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false)

  useEffect(() => {
    const desktopQuery = window.matchMedia(DESKTOP_STORY_QUERY)
    const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY)
    const updateMotionMode = () => {
      setIsDesktop(desktopQuery.matches)
      setShouldReduceMotion(reducedMotionQuery.matches)
    }

    setIsHydrated(true)
    updateMotionMode()
    desktopQuery.addEventListener('change', updateMotionMode)
    reducedMotionQuery.addEventListener('change', updateMotionMode)

    return () => {
      desktopQuery.removeEventListener('change', updateMotionMode)
      reducedMotionQuery.removeEventListener('change', updateMotionMode)
    }
  }, [])

  const isMotionEnabled = isHydrated && isDesktop && !shouldReduceMotion

  return isMotionEnabled
    ? <LandingStoryAnimated key="animated" {...props} />
    : <LandingStoryLayout key="static" {...props} />
}

'use client'

import { BrandMark } from '@/components/brand-mark'
import { ChatComposerSurface } from '@/components/chat-composer-surface'
import { ChatSurface } from '@/components/chat-surface'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LANDING_STORY_SPRING } from '@/lib/landing-motion-tokens'
import { ArrowUp } from 'lucide-react'
import {
  motion,
  type MotionValue,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react'
import {
  isValidElement,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react'

const DESKTOP_STORY_QUERY = '(min-width: 72rem) and (min-height: 36rem)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function getNodeKey(node: ReactNode, fallback: string) {
  return isValidElement(node) && node.key !== null ? node.key : fallback
}

interface LandingStoryMotionProps {
  activities: ReactNode[]
  composer: ReactNode
  contextBeat: ReactNode
  contextPanel: ReactNode
  heading: ReactNode
  orchestrationBeat: ReactNode
  prompt: ReactNode
  responseBlocks: ReactNode[]
  synthesisBeat: ReactNode
  workspaceName: string
}

interface StoryWorkspaceProps {
  activities?: ReactNode[]
  composer: ReactNode
  contextPanel?: ReactNode
  prompt: ReactNode
  responseBlocks?: ReactNode[]
  storyProgress?: MotionValue<number>
  workspaceName: string
}

function WorkspaceChrome({ workspaceName }: { workspaceName: string }) {
  return (
    <header className="living-workspace-header">
      <BrandMark className="living-workspace-brand" />
      <div className="living-workspace-identity">
        <strong>{workspaceName}</strong>
        <Badge variant="secondary">Brand command</Badge>
      </div>
    </header>
  )
}

function DemoComposer({ children }: PropsWithChildren) {
  return (
    <ChatComposerSurface className="living-composer-shell" contentClassName="max-w-none">
      <div className="living-composer">
        <span>{children}</span>
        <Button aria-hidden="true" size="icon-sm" tabIndex={-1}>
          <ArrowUp />
        </Button>
      </div>
    </ChatComposerSurface>
  )
}

function AnimatedActivity({
  children,
  index,
  progress,
}: {
  children: ReactNode
  index: number
  progress: MotionValue<number>
}) {
  const start = 0.29 + index * 0.045
  const opacity = useTransform(progress, [start, start + 0.065, 0.62, 0.72], [0, 1, 1, 0.28])
  const transform = useTransform(
    progress,
    [start, start + 0.065, 0.62, 0.72],
    [
      'translate3d(0, 0.5rem, 0)',
      'translate3d(0, 0rem, 0)',
      'translate3d(0, 0rem, 0)',
      'translate3d(0, -0.4rem, 0)',
    ],
  )

  return <motion.div style={{ opacity, transform }}>{children}</motion.div>
}

function AnimatedResponseBlock({
  children,
  index,
  progress,
}: {
  children: ReactNode
  index: number
  progress: MotionValue<number>
}) {
  const start = 0.68 + index * 0.045
  const opacity = useTransform(progress, [start, start + 0.07], [0, 1])
  const transform = useTransform(
    progress,
    [start, start + 0.07],
    ['translate3d(0, 0.55rem, 0)', 'translate3d(0, 0rem, 0)'],
  )

  return <motion.div style={{ opacity, transform }}>{children}</motion.div>
}

function StoryWorkspace({
  activities = [],
  composer,
  contextPanel,
  prompt,
  responseBlocks = [],
  storyProgress,
  workspaceName,
}: StoryWorkspaceProps) {
  const staticProgress = useMotionValue(1)
  const progress = storyProgress ?? staticProgress
  const contextOpacity = useTransform(progress, [0, 0.2, 0.32], [1, 1, 0])
  const contextTransform = useTransform(
    progress,
    [0, 0.2, 0.32],
    ['translate3d(0, 0rem, 0) scale(1)', 'translate3d(0, 0rem, 0) scale(1)', 'translate3d(-1rem, 0, 0) scale(0.985)'],
  )
  const chatOpacity = useTransform(progress, [0.2, 0.32], [0, 1])
  const chatTransform = useTransform(
    progress,
    [0.2, 0.32],
    ['translate3d(1rem, 0, 0) scale(0.985)', 'translate3d(0rem, 0, 0) scale(1)'],
  )
  const promptOpacity = useTransform(progress, [0.24, 0.34], [0, 1])
  const promptTransform = useTransform(
    progress,
    [0.24, 0.34],
    ['translate3d(0, 0.6rem, 0)', 'translate3d(0, 0rem, 0)'],
  )
  const responseOpacity = useTransform(progress, [0.61, 0.69], [0, 1])

  const isAnimated = storyProgress !== undefined

  return (
    <div className="living-workspace" aria-hidden="true" inert>
      <WorkspaceChrome workspaceName={workspaceName} />
      {contextPanel && (
        <motion.div
          className="living-context-layer"
          style={isAnimated ? { opacity: contextOpacity, transform: contextTransform } : undefined}
        >
          {contextPanel}
        </motion.div>
      )}
      <motion.div
        className="living-chat-layer"
        style={isAnimated ? { opacity: chatOpacity, transform: chatTransform } : undefined}
      >
        <ChatSurface
          className="living-chat-surface"
          title="Build a coordinated launch plan"
          subtitle={`Brand director for ${workspaceName}, coordinating the right specialists`}
          composer={<DemoComposer>{composer}</DemoComposer>}
        >
          <div className="living-transcript">
            <motion.div
              className="living-user-prompt"
              style={isAnimated ? { opacity: promptOpacity, transform: promptTransform } : undefined}
            >
              {prompt}
            </motion.div>
            {activities.length > 0 && (
              <div className="living-activities" aria-label="Specialist activity">
                {activities.map((activity, index) => (
                  isAnimated ? (
                    <AnimatedActivity key={getNodeKey(activity, `activity-${index}`)} index={index} progress={storyProgress}>
                      {activity}
                    </AnimatedActivity>
                  ) : <div key={getNodeKey(activity, `activity-${index}`)}>{activity}</div>
                ))}
              </div>
            )}
            {responseBlocks.length > 0 && (
              <motion.article
                className="living-response"
                style={isAnimated ? { opacity: responseOpacity } : undefined}
              >
                <p>Coordinated answer</p>
                <div className="living-response-blocks">
                  {responseBlocks.map((block, index) => (
                    isAnimated ? (
                      <AnimatedResponseBlock key={getNodeKey(block, `response-${index}`)} index={index} progress={storyProgress}>
                        {block}
                      </AnimatedResponseBlock>
                    ) : <div key={getNodeKey(block, `response-${index}`)}>{block}</div>
                  ))}
                </div>
              </motion.article>
            )}
          </div>
        </ChatSurface>
      </motion.div>
    </div>
  )
}

function StoryStaticLayout({
  activities,
  composer,
  contextBeat,
  contextPanel,
  heading,
  orchestrationBeat,
  prompt,
  responseBlocks,
  synthesisBeat,
  workspaceName,
}: LandingStoryMotionProps) {
  return (
    <section className="story-section">
      <div className="landing-shell story-heading">{heading}</div>
      <div className="landing-shell story-static-sequence">
        <div className="story-beat-shell">{contextBeat}</div>
        <div className="story-static-scene">
          <div className="living-workspace" aria-hidden="true" inert>
            <WorkspaceChrome workspaceName={workspaceName} />
            <div className="living-context-static">{contextPanel}</div>
          </div>
        </div>
        <div className="story-beat-shell">{orchestrationBeat}</div>
        <div className="story-static-scene">
          <StoryWorkspace
            activities={activities}
            composer={composer}
            prompt={prompt}
            workspaceName={workspaceName}
          />
        </div>
        <div className="story-beat-shell">{synthesisBeat}</div>
        <div className="story-static-scene">
          <StoryWorkspace
            composer={composer}
            prompt={prompt}
            responseBlocks={responseBlocks}
            workspaceName={workspaceName}
          />
        </div>
      </div>
    </section>
  )
}

function StoryAnimatedLayout(props: LandingStoryMotionProps) {
  const targetRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ['start start', 'end end'],
  })
  const storyProgress = useSpring(scrollYProgress, LANDING_STORY_SPRING)

  const contextBeatOpacity = useTransform(storyProgress, [0, 0.08, 0.28, 0.38], [0.4, 1, 1, 0.35])
  const contextBeatTransform = useTransform(
    storyProgress,
    [0, 0.08, 0.28, 0.38],
    ['translate3d(0, 1rem, 0)', 'translate3d(0, 0rem, 0)', 'translate3d(0, 0rem, 0)', 'translate3d(0, -0.5rem, 0)'],
  )
  const orchestrationBeatOpacity = useTransform(storyProgress, [0.27, 0.4, 0.6, 0.7], [0.35, 1, 1, 0.35])
  const orchestrationBeatTransform = useTransform(
    storyProgress,
    [0.27, 0.4, 0.6, 0.7],
    ['translate3d(0, 1rem, 0)', 'translate3d(0, 0rem, 0)', 'translate3d(0, 0rem, 0)', 'translate3d(0, -0.5rem, 0)'],
  )
  const synthesisBeatOpacity = useTransform(storyProgress, [0.61, 0.74, 1], [0.35, 1, 1])
  const synthesisBeatTransform = useTransform(
    storyProgress,
    [0.61, 0.74, 1],
    ['translate3d(0, 1rem, 0)', 'translate3d(0, 0rem, 0)', 'translate3d(0, 0rem, 0)'],
  )

  return (
    <section ref={targetRef} className="story-section">
      <div className="landing-shell story-heading">{props.heading}</div>
      <div className="landing-shell story-grid">
        <motion.div className="story-beat-shell story-beat-context" style={{ opacity: contextBeatOpacity, transform: contextBeatTransform }}>
          {props.contextBeat}
        </motion.div>
        <motion.div className="story-beat-shell story-beat-orchestration" style={{ opacity: orchestrationBeatOpacity, transform: orchestrationBeatTransform }}>
          {props.orchestrationBeat}
        </motion.div>
        <div className="story-stage-column">
          <div className="story-stage" role="img" aria-label="Company context becoming one coordinated marketing answer">
            <StoryWorkspace
              activities={props.activities}
              composer={props.composer}
              contextPanel={props.contextPanel}
              prompt={props.prompt}
              responseBlocks={props.responseBlocks}
              storyProgress={storyProgress}
              workspaceName={props.workspaceName}
            />
          </div>
        </div>
        <motion.div className="story-beat-shell story-beat-synthesis" style={{ opacity: synthesisBeatOpacity, transform: synthesisBeatTransform }}>
          {props.synthesisBeat}
        </motion.div>
      </div>
    </section>
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

  return isHydrated && isDesktop && !shouldReduceMotion
    ? <StoryAnimatedLayout key="animated" {...props} />
    : <StoryStaticLayout key="static" {...props} />
}

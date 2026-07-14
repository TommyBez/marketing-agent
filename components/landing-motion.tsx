'use client'

import { LANDING_EASE_OUT } from '@/lib/landing-motion-tokens'
import {
  MotionConfig,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react'
import {
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'

const LANDING_TRANSITION = { ease: LANDING_EASE_OUT } as const

function ContextParallaxLayer({ children }: PropsWithChildren) {
  const targetRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ['start end', 'end start'],
  })
  const transform = useTransform(
    scrollYProgress,
    [0, 1],
    [
      'translate3d(0, 0.75rem, 0) scale(1.035)',
      'translate3d(0, -0.75rem, 0) scale(1.035)',
    ],
  )

  return (
    <motion.div ref={targetRef} className="context-parallax-layer" style={{ transform }}>
      {children}
    </motion.div>
  )
}

export function LandingMotionConfig({ children }: PropsWithChildren) {
  return (
    <MotionConfig reducedMotion="user" transition={LANDING_TRANSITION}>
      {children}
    </MotionConfig>
  )
}

export function LandingContextParallax({ children }: PropsWithChildren) {
  const shouldReduceMotion = useReducedMotion()
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  if (!isHydrated || shouldReduceMotion !== false) {
    return <div className="context-parallax-layer">{children}</div>
  }

  return <ContextParallaxLayer>{children}</ContextParallaxLayer>
}

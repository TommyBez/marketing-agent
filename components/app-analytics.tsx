'use client'

import { Analytics } from '@vercel/analytics/next'
import { usePathname } from 'next/navigation'

export function AppAnalytics() {
  const pathname = usePathname()
  if (pathname.startsWith('/s/')) return null

  return <Analytics />
}

import { addUtcDays, startOfUtcDay, utcDateKey } from '@/lib/cost-accounting/time'
import type { CollectorWindow } from './types'

const HOUR_MS = 60 * 60 * 1_000

export type StorageBucket = {
  key: string
  periodStart: Date
  periodEnd: Date
  hours: number
  status: 'pending' | 'final'
}

function latest(...dates: Date[]): Date {
  return new Date(Math.max(...dates.map((date) => date.getTime())))
}

function earliest(...dates: Date[]): Date {
  return new Date(Math.min(...dates.map((date) => date.getTime())))
}

/**
 * Produces UTC-day buckets with stable keys. The collection window selects
 * which days to revisit, while each bucket is always recomputed from the day
 * boundary so reruns update the same fact instead of creating overlaps.
 */
export function storageBuckets(input: {
  window: CollectorWindow
  resourceStartedAt: Date
  resourceEndedAt?: Date
  observedAt: Date
}): StorageBucket[] {
  const effectiveEnd = earliest(input.window.end, input.observedAt)
  if (effectiveEnd <= input.resourceStartedAt || effectiveEnd <= input.window.start) {
    return []
  }

  const buckets: StorageBucket[] = []
  let dayStart = startOfUtcDay(input.window.start)
  const lastDay = startOfUtcDay(effectiveEnd)

  while (dayStart <= lastDay) {
    const dayEnd = addUtcDays(dayStart, 1)
    const periodStart = latest(dayStart, input.resourceStartedAt)
    const periodEnd = earliest(
      dayEnd,
      effectiveEnd,
      input.resourceEndedAt ?? effectiveEnd,
    )

    if (periodEnd > periodStart) {
      const ended = input.resourceEndedAt !== undefined
        && input.resourceEndedAt <= input.observedAt
        && periodEnd >= input.resourceEndedAt

      buckets.push({
        key: utcDateKey(dayStart),
        periodStart,
        periodEnd,
        hours: (periodEnd.getTime() - periodStart.getTime()) / HOUR_MS,
        status: periodEnd >= dayEnd || ended ? 'final' : 'pending',
      })
    }

    dayStart = dayEnd
  }

  return buckets
}

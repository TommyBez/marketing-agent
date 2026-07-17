import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addUtcDays,
  previousFullUtcWeek,
  reconciliationWindows,
  startOfUtcDay,
  utcDateKey,
} from './time'

describe('UTC accounting windows', () => {
  it('normalizes dates and advances days on UTC boundaries', () => {
    const instant = new Date('2026-03-29T23:30:00+02:00')
    assert.equal(startOfUtcDay(instant).toISOString(), '2026-03-29T00:00:00.000Z')
    assert.equal(
      addUtcDays(new Date('2026-03-29T00:00:00.000Z'), 1).toISOString(),
      '2026-03-30T00:00:00.000Z',
    )
    assert.equal(utcDateKey(instant), '2026-03-29')
  })

  it('builds reconciliation lookbacks from UTC day boundaries', () => {
    const now = new Date('2026-07-17T15:45:00.000Z')
    const windows = reconciliationWindows(now)

    assert.equal(windows.aiGateway.start.toISOString(), '2026-07-10T00:00:00.000Z')
    assert.equal(windows.focus.start.toISOString(), '2026-07-10T00:00:00.000Z')
    assert.equal(windows.sandbox.start.toISOString(), '2026-07-15T00:00:00.000Z')
    assert.equal(windows.workflow.start.toISOString(), '2026-07-16T09:45:00.000Z')
    assert.equal(windows.aiGateway.end, now)
    assert.equal(windows.workflow.end, now)
  })

  it('returns the previous complete Monday-to-Monday UTC week', () => {
    const previousWeek = previousFullUtcWeek(new Date('2026-07-15T18:30:00.000Z'))
    assert.equal(previousWeek.start.toISOString(), '2026-07-06T00:00:00.000Z')
    assert.equal(previousWeek.end.toISOString(), '2026-07-13T00:00:00.000Z')

    const twoWeeksAgo = previousFullUtcWeek(new Date('2026-07-15T18:30:00.000Z'), 2)
    assert.equal(twoWeeksAgo.start.toISOString(), '2026-06-29T00:00:00.000Z')
    assert.equal(twoWeeksAgo.end.toISOString(), '2026-07-06T00:00:00.000Z')
  })
})

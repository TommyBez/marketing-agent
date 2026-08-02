import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addUtcDays,
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

  it('builds the Gateway reconciliation lookback from UTC day boundaries', () => {
    const now = new Date('2026-07-17T15:45:00.000Z')
    const windows = reconciliationWindows(now)

    assert.equal(windows.aiGateway.start.toISOString(), '2026-07-03T00:00:00.000Z')
    assert.equal(windows.aiGateway.end, now)
  })
})

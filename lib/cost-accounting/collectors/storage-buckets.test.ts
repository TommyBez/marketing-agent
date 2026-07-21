import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { storageBuckets } from './storage-buckets'

describe('storageBuckets', () => {
  it('finalizes complete UTC days and leaves the active partial day pending', () => {
    const buckets = storageBuckets({
      window: {
        start: new Date('2026-07-15T12:00:00.000Z'),
        end: new Date('2026-07-18T00:00:00.000Z'),
      },
      resourceStartedAt: new Date('2026-07-15T10:00:00.000Z'),
      observedAt: new Date('2026-07-17T06:00:00.000Z'),
    })

    assert.deepEqual(buckets.map((bucket) => ({
      key: bucket.key,
      periodStart: bucket.periodStart.toISOString(),
      periodEnd: bucket.periodEnd.toISOString(),
      hours: bucket.hours,
      status: bucket.status,
    })), [
      {
        key: '2026-07-15',
        periodStart: '2026-07-15T10:00:00.000Z',
        periodEnd: '2026-07-16T00:00:00.000Z',
        hours: 14,
        status: 'final',
      },
      {
        key: '2026-07-16',
        periodStart: '2026-07-16T00:00:00.000Z',
        periodEnd: '2026-07-17T00:00:00.000Z',
        hours: 24,
        status: 'final',
      },
      {
        key: '2026-07-17',
        periodStart: '2026-07-17T00:00:00.000Z',
        periodEnd: '2026-07-17T06:00:00.000Z',
        hours: 6,
        status: 'pending',
      },
    ])
  })

  it('finalizes a partial UTC-day bucket when the resource has ended', () => {
    const buckets = storageBuckets({
      window: {
        start: new Date('2026-07-16T00:00:00.000Z'),
        end: new Date('2026-07-18T00:00:00.000Z'),
      },
      resourceStartedAt: new Date('2026-07-16T06:00:00.000Z'),
      resourceEndedAt: new Date('2026-07-17T03:00:00.000Z'),
      observedAt: new Date('2026-07-17T10:00:00.000Z'),
    })

    assert.deepEqual(buckets.map((bucket) => ({
      key: bucket.key,
      hours: bucket.hours,
      status: bucket.status,
    })), [
      { key: '2026-07-16', hours: 18, status: 'final' },
      { key: '2026-07-17', hours: 3, status: 'final' },
    ])
  })

  it('returns no buckets when the resource and collection window do not overlap', () => {
    assert.deepEqual(storageBuckets({
      window: {
        start: new Date('2026-07-17T00:00:00.000Z'),
        end: new Date('2026-07-18T00:00:00.000Z'),
      },
      resourceStartedAt: new Date('2026-07-18T00:00:00.000Z'),
      observedAt: new Date('2026-07-17T12:00:00.000Z'),
    }), [])
  })
})

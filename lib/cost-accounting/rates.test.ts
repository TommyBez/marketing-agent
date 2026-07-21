import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  asCostDecimal,
  billedMemorySeconds,
  COST_RATE_VERSION,
  PUBLIC_RATES,
  sandboxCpuCost,
  sandboxCreationCost,
  sandboxMemoryCost,
  sandboxNetworkCost,
  sandboxSnapshotCost,
  workflowDataRetainedCost,
  workflowDataWrittenCost,
  workflowEventCost,
} from './rates'

function assertClose(actual: number, expected: number) {
  assert.ok(
    Math.abs(actual - expected) < 1e-15,
    `expected ${actual} to be within 1e-15 of ${expected}`,
  )
}

describe('public cost rates', () => {
  it('pins the current Vercel Sandbox and Workflow price card', () => {
    assert.equal(COST_RATE_VERSION, 'vercel-public-2026-07-17')
    assert.deepEqual(PUBLIC_RATES, {
      sandbox: {
        activeCpuHourUsd: 0.128,
        provisionedMemoryGbHourUsd: 0.0212,
        networkGbUsd: 0.15,
        creationUsd: 0.0000006,
        snapshotGbMonthUsd: 0.08,
      },
      workflow: {
        eventUsd: 0.00002,
        dataWrittenGbUsd: 0.5,
        dataRetainedGbMonthUsd: 0.5,
      },
    })
  })

  it('bills provisioned memory in whole minutes with a one-minute minimum', () => {
    assert.equal(billedMemorySeconds(0), 0)
    assert.equal(billedMemorySeconds(-1), 0)
    assert.equal(billedMemorySeconds(1), 60)
    assert.equal(billedMemorySeconds(60), 60)
    assert.equal(billedMemorySeconds(61), 120)
    assertClose(sandboxMemoryCost(1, 1), 0.0212 / 60)
    assertClose(sandboxMemoryCost(2, 61), 2 * 0.0212 / 30)
  })

  it('calculates Sandbox CPU, network, creation, and snapshot costs', () => {
    assert.equal(sandboxCpuCost(3_600), 0.128)
    assert.equal(sandboxNetworkCost(1_000_000_000), 0.15)
    assert.equal(sandboxCreationCost(), 0.0000006)
    assert.equal(sandboxCreationCost(1_000_000), 0.6)
    assert.equal(sandboxSnapshotCost(1_000_000_000, 30), 0.08)
  })

  it('calculates Workflow event, written, and retained-data costs', () => {
    assert.equal(workflowEventCost(1_000), 0.02)
    assert.equal(workflowDataWrittenCost(1_000_000_000), 0.5)
    assert.equal(workflowDataRetainedCost(1_000_000_000, 30 * 24), 0.5)
    assert.equal(asCostDecimal(0.00002), '0.000020000000')
  })
})

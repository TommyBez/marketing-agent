import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSandboxRecords,
  readSandboxObservation,
  type SandboxListItem,
  type SandboxReadApi,
  type SandboxSessionObservation,
  type SandboxSnapshotObservation,
} from './sandbox'

async function* iterable<T>(items: T[]): AsyncIterable<T> {
  yield* items
}

const sandbox: SandboxListItem = {
  name: 'sbx_test',
  persistent: true,
  createdAt: Date.parse('2026-07-16T09:00:00.000Z'),
  updatedAt: Date.parse('2026-07-17T10:00:00.000Z'),
  currentSessionId: 'session-running',
  status: 'running',
  tags: { sessionId: 'root-session' },
}

const stoppedSession: SandboxSessionObservation = {
  id: 'session-stopped',
  memory: 1_024,
  vcpus: 2,
  region: 'iad1',
  runtime: 'node24',
  status: 'stopped',
  requestedAt: Date.parse('2026-07-16T10:00:00.000Z'),
  createdAt: Date.parse('2026-07-16T10:00:00.000Z'),
  startedAt: Date.parse('2026-07-16T10:00:00.000Z'),
  stoppedAt: Date.parse('2026-07-16T11:00:00.000Z'),
  updatedAt: Date.parse('2026-07-16T11:00:00.000Z'),
  duration: 60 * 60 * 1_000,
  activeCpuDurationMs: 30 * 60 * 1_000,
  networkTransfer: { ingress: 100_000_000, egress: 200_000_000 },
}

const runningSession: SandboxSessionObservation = {
  id: 'session-running',
  memory: 512,
  vcpus: 1,
  region: 'iad1',
  runtime: 'node24',
  status: 'running',
  requestedAt: Date.parse('2026-07-17T10:00:00.000Z'),
  createdAt: Date.parse('2026-07-17T10:00:00.000Z'),
  startedAt: Date.parse('2026-07-17T10:00:00.000Z'),
  updatedAt: Date.parse('2026-07-17T10:00:00.000Z'),
}

const snapshot: SandboxSnapshotObservation = {
  id: 'snapshot-1',
  sourceSessionId: 'session-stopped',
  region: 'iad1',
  status: 'created',
  sizeBytes: 1_000_000_000,
  createdAt: Date.parse('2026-07-16T00:00:00.000Z'),
  updatedAt: Date.parse('2026-07-16T00:00:00.000Z'),
}

test('Sandbox observation is read-only and explicitly disables resume', async () => {
  const gets: Array<{ name: string; resume: false }> = []
  const api: SandboxReadApi = {
    async list() {
      return iterable([sandbox])
    },
    async get(params) {
      gets.push(params)
      return {
        async listSessions() {
          return iterable([stoppedSession, runningSession])
        },
        async listSnapshots() {
          return iterable([snapshot])
        },
      }
    },
  }

  const observation = await readSandboxObservation(api)

  assert.deepEqual(gets, [{ name: 'sbx_test', resume: false }])
  assert.equal(observation.sandboxes[0]?.sessions.length, 2)
  assert.equal(observation.sandboxes[0]?.snapshots.length, 1)
  assert.deepEqual(observation.warnings, [])
})

test('Sandbox facts reconcile terminal sessions and retain running sessions as pending', () => {
  const observedAt = new Date('2026-07-17T12:00:00.000Z')
  const records = buildSandboxRecords({
    reconciliationRunId: '00000000-0000-0000-0000-000000000001',
    window: {
      start: new Date('2026-07-16T00:00:00.000Z'),
      end: new Date('2026-07-18T00:00:00.000Z'),
    },
    observedAt,
    observation: {
      sandboxes: [{
        sandbox,
        sessions: [stoppedSession, runningSession],
        snapshots: [snapshot],
      }],
      warnings: [],
    },
    attributionBySession: new Map([['root-session', {
      workspaceId: '00000000-0000-0000-0000-000000000002',
      userId: 'user-1',
      sessionId: 'root-session',
      rootSessionId: 'root-session',
    }]]),
  })

  const stoppedCpu = records.facts.find((fact) =>
    fact.idempotencyKey === 'sandbox:session:session-stopped:active-cpu')
  const runningCpu = records.facts.find((fact) =>
    fact.idempotencyKey === 'sandbox:session:session-running:active-cpu')
  const stoppedMemory = records.facts.find((fact) =>
    fact.idempotencyKey === 'sandbox:session:session-stopped:memory')
  const snapshotFacts = records.facts.filter((fact) => fact.metric === 'snapshot_storage')

  assert.equal(stoppedCpu?.status, 'final')
  assert.equal(stoppedCpu?.quality, 'exact')
  assert.equal(stoppedCpu?.quantity, '0.500000000000')
  assert.equal(runningCpu?.status, 'pending')
  assert.equal(runningCpu?.quantity, undefined)
  assert.equal(stoppedMemory?.status, 'final')
  assert.equal(stoppedMemory?.quantity, '1.000000000000')
  assert.equal(snapshotFacts.length, 2)
  assert.deepEqual(snapshotFacts.map((fact) => fact.status), ['final', 'pending'])
  assert.ok(records.inventory.every((resource) => resource.workspaceId !== undefined))
})

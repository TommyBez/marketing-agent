import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildWorkflowRecords,
  collectWorkflowUsage,
  readWorkflowObservation,
  resolveEveWorkflowLineage,
  type WorkflowAnalyticsEvent,
  type WorkflowAnalyticsRun,
  type WorkflowAnalyticsStep,
  type WorkflowReadApi,
} from './workflow'

const rootRun: WorkflowAnalyticsRun = {
  runId: 'root-run',
  status: 'completed',
  deploymentId: 'deployment-1',
  workflowName: 'workflowEntry',
  attributes: { '$eve.type': 'session' },
  createdAt: new Date('2026-07-16T00:00:00.000Z'),
  updatedAt: new Date('2026-07-16T01:00:00.000Z'),
  completedAt: new Date('2026-07-16T01:00:00.000Z'),
}

const turnRun: WorkflowAnalyticsRun = {
  runId: 'turn-run',
  status: 'running',
  deploymentId: 'deployment-1',
  workflowName: 'turnWorkflow',
  attributes: {
    '$eve.type': 'turn',
    '$eve.parent': 'root-run',
    '$eve.root': 'root-run',
  },
  createdAt: new Date('2026-07-17T10:00:00.000Z'),
  updatedAt: new Date('2026-07-17T11:00:00.000Z'),
}

const unrelatedRun: WorkflowAnalyticsRun = {
  ...rootRun,
  runId: 'unrelated-run',
  workflowName: 'otherWorkflow',
  attributes: {},
}

const step: WorkflowAnalyticsStep = {
  runId: 'root-run',
  stepId: 'step-1',
  stepName: 'turnStep',
  status: 'completed',
  attempt: 1,
  createdAt: new Date('2026-07-16T00:10:00.000Z'),
  updatedAt: new Date('2026-07-16T00:11:00.000Z'),
  completedAt: new Date('2026-07-16T00:11:00.000Z'),
}

const event: WorkflowAnalyticsEvent = {
  runId: 'root-run',
  eventId: 'event-1',
  eventType: 'step_completed',
  correlationId: 'correlation-1',
  entityId: 'step-1',
  stepName: 'turnStep',
  workflowName: 'workflowEntry',
  deploymentId: 'deployment-1',
  runCreatedAt: rootRun.createdAt,
  createdAt: new Date('2026-07-16T00:11:00.000Z'),
  region: 'iad1',
}

const retryEvent: WorkflowAnalyticsEvent = {
  ...event,
  eventId: 'event-2',
  eventType: 'step_retrying',
  createdAt: new Date('2026-07-16T00:12:00.000Z'),
}

test('Workflow observation paginates, filters to Eve, and only performs metadata reads', async () => {
  const stepReads: string[] = []
  const eventReads: string[] = []
  let storageListReads = 0
  const api: WorkflowReadApi = {
    async listRuns(params) {
      if (!params.cursor) {
        return { data: [rootRun, unrelatedRun], cursor: 'next', hasMore: true }
      }
      return { data: [turnRun], cursor: null, hasMore: false }
    },
    async listSteps(params) {
      stepReads.push(params.runId)
      return {
        data: params.runId === 'root-run' ? [step] : [],
        cursor: null,
        hasMore: false,
      }
    },
    async listEvents(params) {
      eventReads.push(params.runId)
      return {
        data: params.runId === 'root-run' ? [event] : [],
        cursor: null,
        hasMore: false,
      }
    },
    async listStorageRuns() {
      storageListReads += 1
      return {
        data: [{
          runId: 'retained-run',
          status: 'completed',
          deploymentId: 'deployment-1',
          workflowName: 'workflowEntry',
          attributes: { '$eve.type': 'session' },
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          updatedAt: new Date('2026-07-01T01:00:00.000Z'),
          completedAt: new Date('2026-07-01T01:00:00.000Z'),
          blobStorageBytes: 1_000_000_000,
          streamStorageBytes: 0,
        }, ...[rootRun, turnRun].map((run) => ({
          runId: run.runId,
          status: run.status,
          deploymentId: run.deploymentId,
          workflowName: run.workflowName,
          attributes: run.attributes,
          createdAt: run.createdAt,
          updatedAt: run.updatedAt,
          completedAt: run.completedAt ?? undefined,
          blobStorageBytes: 1_000_000_000,
          streamStorageBytes: 0,
        }))],
        cursor: null,
        hasMore: false,
      }
    },
    async getStorageRun() {
      throw new Error('getStorageRun should not be called for a listed run')
    },
  }

  const observation = await readWorkflowObservation({
    window: {
      start: new Date('2026-07-16T00:00:00.000Z'),
      end: new Date('2026-07-18T00:00:00.000Z'),
    },
    api,
  })

  assert.deepEqual(
    observation.runs.map((run) => run.runId),
    ['retained-run', 'root-run', 'turn-run'],
  )
  assert.deepEqual(stepReads, ['root-run', 'turn-run'])
  assert.deepEqual(eventReads, ['root-run', 'turn-run'])
  assert.deepEqual(observation.eventsByRun.get('root-run'), [event])
  assert.equal(storageListReads, 1)
  assert.deepEqual(observation.warnings, [])
})

test('Workflow lineage maps root, turn, and subagent runs to execution sessions', () => {
  assert.deepEqual(resolveEveWorkflowLineage(rootRun), {
    kind: 'session',
    sessionId: 'root-run',
    rootSessionId: 'root-run',
  })
  assert.deepEqual(resolveEveWorkflowLineage(turnRun), {
    kind: 'turn',
    sessionId: 'root-run',
    rootSessionId: 'root-run',
    parentRunId: 'root-run',
  })
  assert.deepEqual(resolveEveWorkflowLineage({
    ...rootRun,
    runId: 'subagent-run',
    attributes: {
      '$eve.type': 'subagent',
      '$eve.parent': 'root-run',
      '$eve.root': 'root-run',
    },
  }), {
    kind: 'subagent',
    sessionId: 'subagent-run',
    rootSessionId: 'root-run',
    parentRunId: 'root-run',
  })
  assert.deepEqual(resolveEveWorkflowLineage({
    ...rootRun,
    runId: 'untagged-root-run',
    attributes: {},
  }), {
    kind: 'session',
    sessionId: 'untagged-root-run',
    rootSessionId: 'untagged-root-run',
  })
})

test('Workflow facts price exact events and classify retained-data snapshots as experimental', () => {
  const observedAt = new Date('2026-07-17T12:00:00.000Z')
  const records = buildWorkflowRecords({
    reconciliationRunId: '00000000-0000-0000-0000-000000000001',
    window: {
      start: new Date('2026-07-16T00:00:00.000Z'),
      end: new Date('2026-07-18T00:00:00.000Z'),
    },
    observedAt,
    observation: {
      runs: [rootRun],
      stepsByRun: new Map([['root-run', [step]]]),
      eventsByRun: new Map([['root-run', [event, retryEvent]]]),
      storageByRun: new Map([['root-run', {
        runId: 'root-run',
        status: 'completed',
        deploymentId: rootRun.deploymentId,
        workflowName: rootRun.workflowName,
        attributes: rootRun.attributes,
        createdAt: rootRun.createdAt,
        updatedAt: rootRun.updatedAt,
        completedAt: rootRun.completedAt ?? undefined,
        blobStorageBytes: 750_000_000,
        streamStorageBytes: 250_000_000,
      }]]),
      warnings: [],
    },
    attributionBySession: new Map([['root-run', {
      workspaceId: '00000000-0000-0000-0000-000000000002',
      userId: 'user-1',
      sessionId: 'root-run',
      rootSessionId: 'root-run',
    }]]),
  })

  const eventFacts = records.facts.filter((fact) => fact.metric === 'event')
  const retainedFacts = records.facts.filter((fact) => fact.metric === 'data_retained')

  assert.equal(eventFacts.length, 2)
  assert.ok(eventFacts.every((fact) => fact.status === 'final'))
  assert.ok(eventFacts.every((fact) => fact.quality === 'exact'))
  assert.ok(eventFacts.every((fact) => fact.standardCostUsd === '0.000020000000'))
  assert.deepEqual(eventFacts.map((fact) => fact.idempotencyKey), [
    'workflow:event:root-run:event-1',
    'workflow:event:root-run:event-2',
  ])
  assert.equal(records.facts.some((fact) => fact.metric === 'step_execution'), false)
  assert.equal(records.facts.some((fact) => fact.metric === 'data_written'), false)
  assert.equal(retainedFacts.length, 2)
  assert.ok(retainedFacts.every((fact) => fact.quality === 'experimental'))
  assert.ok(retainedFacts.every((fact) => fact.unit === 'GB-month'))
  assert.deepEqual(retainedFacts.map((fact) => fact.status), ['final', 'pending'])
  assert.deepEqual(retainedFacts.map((fact) => fact.standardCostUsd), [
    '0.016666666667',
    '0.008333333333',
  ])
  assert.deepEqual(records.warnings.map((warning) => warning.operation), [
    'measure-workflow-data-written',
  ])
  assert.equal(records.warnings[0]?.affectsHealth, false)
})

test('Workflow charges an exact retry event once and does not infer retry cost from step attempts', () => {
  const retryingStep: WorkflowAnalyticsStep = {
    ...step,
    status: 'failed',
    attempt: 2,
    completedAt: undefined,
    retryAfter: new Date('2026-07-16T00:12:00.000Z'),
  }
  const records = buildWorkflowRecords({
    reconciliationRunId: '00000000-0000-0000-0000-000000000001',
    window: {
      start: new Date('2026-07-16T00:00:00.000Z'),
      end: new Date('2026-07-17T00:00:00.000Z'),
    },
    observedAt: new Date('2026-07-16T00:11:00.000Z'),
    observation: {
      runs: [{ ...rootRun, status: 'running', completedAt: undefined }],
      stepsByRun: new Map([['root-run', [retryingStep]]]),
      eventsByRun: new Map([['root-run', [retryEvent, retryEvent]]]),
      storageByRun: new Map(),
      warnings: [],
    },
    attributionBySession: new Map(),
  })

  const eventFacts = records.facts.filter((fact) => fact.metric === 'event')
  const stepInventory = records.inventory.find(
    (record) => record.resourceType === 'workflow_step',
  )
  assert.equal(eventFacts.length, 1)
  assert.equal(eventFacts[0]?.status, 'final')
  assert.equal(eventFacts[0]?.standardCostUsd, '0.000020000000')
  assert.equal(stepInventory?.terminalAt, undefined)
  assert.equal(records.facts.some((fact) => fact.metric === 'reported_attempt'), false)
})

test('Workflow recovers persisted pending runs and finalizes retention beyond the lookback', async () => {
  const recoveredRun: WorkflowAnalyticsRun = {
    ...rootRun,
    runId: 'recovered-run',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-17T01:00:00.000Z'),
    completedAt: new Date('2026-07-17T01:00:00.000Z'),
  }
  const api: WorkflowReadApi = {
    async listRuns() {
      return { data: [], cursor: null, hasMore: false }
    },
    async listSteps() {
      return { data: [], cursor: null, hasMore: false }
    },
    async listEvents() {
      return { data: [], cursor: null, hasMore: false }
    },
    async listStorageRuns() {
      return { data: [], cursor: null, hasMore: false }
    },
    async getStorageRun(runId) {
      assert.equal(runId, recoveredRun.runId)
      return {
        runId: recoveredRun.runId,
        status: recoveredRun.status,
        deploymentId: recoveredRun.deploymentId,
        workflowName: recoveredRun.workflowName,
        attributes: recoveredRun.attributes,
        createdAt: recoveredRun.createdAt,
        updatedAt: recoveredRun.updatedAt,
        completedAt: recoveredRun.completedAt ?? undefined,
        expiredAt: recoveredRun.completedAt ?? undefined,
        blobStorageBytes: 1_000_000_000,
        streamStorageBytes: 0,
      }
    },
  }
  const window = {
    start: new Date('2026-07-16T06:00:00.000Z'),
    end: new Date('2026-07-17T12:00:00.000Z'),
  }
  const observation = await readWorkflowObservation({
    window,
    api,
    pendingRunIds: [recoveredRun.runId],
  })
  const records = buildWorkflowRecords({
    reconciliationRunId: '00000000-0000-0000-0000-000000000001',
    window,
    observedAt: window.end,
    observation,
    attributionBySession: new Map(),
  })
  const retainedFacts = records.facts.filter((fact) => fact.metric === 'data_retained')

  assert.deepEqual(observation.runs.map((run) => run.runId), ['recovered-run'])
  assert.ok(retainedFacts.length > 2)
  assert.equal(retainedFacts[0]?.periodStart.toISOString(), '2026-07-01T00:00:00.000Z')
  assert.ok(retainedFacts.every((fact) => fact.status === 'final'))
})

test('known Data Written coverage gap stays visible without degrading collector health', async () => {
  const emptyPage = { data: [], cursor: null, hasMore: false }
  const result = await collectWorkflowUsage({
    reconciliationRunId: '00000000-0000-0000-0000-000000000001',
    window: {
      start: new Date('2026-07-16T00:00:00.000Z'),
      end: new Date('2026-07-18T00:00:00.000Z'),
    },
    observedAt: new Date('2026-07-17T12:00:00.000Z'),
    persist: false,
    attributionBySession: new Map(),
    api: {
      async listRuns() {
        return { data: [rootRun], cursor: null, hasMore: false }
      },
      async listSteps() {
        return emptyPage
      },
      async listEvents() {
        return emptyPage
      },
      async listStorageRuns() {
        return emptyPage
      },
      async getStorageRun() {
        throw new Error('getStorageRun should not be called without pending runs')
      },
    },
  })

  assert.equal(result.status, 'complete')
  assert.deepEqual(result.warnings.map((warning) => warning.operation), [
    'measure-workflow-data-written',
  ])
  assert.equal(result.warnings[0]?.affectsHealth, false)
})

import {
  createAnalytics,
  createStorage,
  type APIConfig,
} from '@workflow/world-vercel'
import {
  asCostDecimal,
  COST_RATE_VERSION,
  PUBLIC_RATES,
  workflowDataRetainedCost,
  workflowEventCost,
} from '@/lib/cost-accounting/rates'
import {
  loadPendingUsageResourceIds,
  loadSessionAttribution,
  persistCollectorRecords,
} from './persistence'
import { storageBuckets } from './storage-buckets'
import {
  decimal,
  errorMessage,
  inventoryKey,
  type Attribution,
  type CollectorResult,
  type CollectorWarning,
  type CollectorWindow,
  type InventoryRecord,
  type UsageFactRecord,
} from './types'

const TERMINAL_WORKFLOW_STATUSES = new Set(['completed', 'failed', 'cancelled'])
const EVE_RUN_TYPES = new Set(['session', 'subagent', 'turn'])
const EVE_WORKFLOW_NAMES = new Set(['workflowEntry', 'turnWorkflow'])
const BYTES_PER_DECIMAL_GIGABYTE = 1_000_000_000
const PAGE_SIZE = 1_000

export type WorkflowAnalyticsRun = {
  runId: string
  status: string
  deploymentId: string
  workflowName: string
  specVersion?: number
  attributes: Record<string, string>
  createdAt: Date
  updatedAt: Date
  startedAt?: Date | null
  completedAt?: Date | null
  errorCode?: string | null
  workflowCoreVersion?: string | null
}

export type WorkflowAnalyticsStep = {
  runId: string
  stepId: string
  stepName?: string | null
  status: string
  attempt?: number
  createdAt: Date
  updatedAt: Date
  startedAt?: Date | null
  completedAt?: Date | null
  retryAfter?: Date | null
  errorCode?: string | null
}

export type WorkflowAnalyticsEvent = {
  runId: string
  eventId: string
  eventType: string
  correlationId?: string | null
  entityId?: string | null
  stepName?: string | null
  workflowName: string
  deploymentId: string
  runCreatedAt: Date
  createdAt: Date
  region?: string | null
  errorCode?: string | null
}

export type WorkflowStorageRun = {
  runId: string
  status: string
  deploymentId: string
  workflowName: string
  specVersion?: number
  attributes: Record<string, string>
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  expiredAt?: Date
  blobStorageBytes?: number
  streamStorageBytes?: number
}

type WorkflowPage<T> = {
  data: T[]
  cursor: string | null
  hasMore: boolean
}

export type WorkflowReadApi = {
  listRuns(params: {
    startTime: string
    endTime: string
    cursor?: string
    limit: number
  }): Promise<WorkflowPage<WorkflowAnalyticsRun>>
  listSteps(params: {
    runId: string
    cursor?: string
    limit: number
  }): Promise<WorkflowPage<WorkflowAnalyticsStep>>
  listEvents(params: {
    runId: string
    cursor?: string
    limit: number
  }): Promise<WorkflowPage<WorkflowAnalyticsEvent>>
  listStorageRuns(params: {
    cursor?: string
    limit: number
  }): Promise<WorkflowPage<WorkflowStorageRun>>
  getStorageRun(runId: string): Promise<WorkflowStorageRun>
}

export type WorkflowObservation = {
  runs: WorkflowAnalyticsRun[]
  stepsByRun: Map<string, WorkflowAnalyticsStep[]>
  eventsByRun: Map<string, WorkflowAnalyticsEvent[]>
  storageByRun: Map<string, WorkflowStorageRun>
  warnings: CollectorWarning[]
}

export type WorkflowCollectorOptions = {
  reconciliationRunId: string
  window: CollectorWindow
  observedAt?: Date
  api?: WorkflowReadApi
  apiConfig?: APIConfig
  persist?: boolean
  pendingRunIds?: readonly string[]
  attributionBySession?: Map<string, Attribution>
}

export type EveWorkflowLineage = {
  kind: 'session' | 'subagent' | 'turn'
  sessionId?: string
  rootSessionId?: string
  parentRunId?: string
}

function defaultWorkflowReadApi(config?: APIConfig): WorkflowReadApi {
  const analytics = createAnalytics(config)
  const storage = createStorage(config)

  return {
    listRuns(params) {
      return analytics.runs.list({
        startTime: params.startTime,
        endTime: params.endTime,
        pagination: {
          cursor: params.cursor,
          limit: params.limit,
          sortOrder: 'asc',
        },
      }) as Promise<WorkflowPage<WorkflowAnalyticsRun>>
    },
    listSteps(params) {
      return analytics.steps.list({
        runId: params.runId,
        pagination: {
          cursor: params.cursor,
          limit: params.limit,
          sortOrder: 'asc',
        },
      }) as Promise<WorkflowPage<WorkflowAnalyticsStep>>
    },
    listEvents(params) {
      return analytics.events.list({
        runId: params.runId,
        pagination: {
          cursor: params.cursor,
          limit: params.limit,
          sortOrder: 'asc',
        },
      }) as Promise<WorkflowPage<WorkflowAnalyticsEvent>>
    },
    listStorageRuns(params) {
      return storage.runs.list({
        resolveData: 'none',
        pagination: {
          cursor: params.cursor,
          limit: params.limit,
          sortOrder: 'asc',
        },
      }) as unknown as Promise<WorkflowPage<WorkflowStorageRun>>
    },
    getStorageRun(runId) {
      return storage.runs.get(runId, {
        resolveData: 'none',
      }) as unknown as Promise<WorkflowStorageRun>
    },
  }
}

function safePeriodEnd(start: Date, end: Date): Date {
  return end > start ? end : new Date(start.getTime() + 1)
}

function firstSeenAt(source: Date, observedAt: Date): Date {
  return source > observedAt ? observedAt : source
}

function isTerminalStep(step: WorkflowAnalyticsStep): boolean {
  return TERMINAL_WORKFLOW_STATUSES.has(step.status)
    && !(step.status === 'failed' && step.retryAfter)
}

function isEveRun(run: WorkflowAnalyticsRun): boolean {
  return EVE_RUN_TYPES.has(run.attributes['$eve.type'])
    || EVE_WORKFLOW_NAMES.has(run.workflowName)
}

function isEveStorageRun(run: WorkflowStorageRun): boolean {
  return EVE_RUN_TYPES.has(run.attributes['$eve.type'])
    || EVE_WORKFLOW_NAMES.has(run.workflowName)
}

function analyticsRunFromStorage(run: WorkflowStorageRun): WorkflowAnalyticsRun {
  return {
    runId: run.runId,
    status: run.status,
    deploymentId: run.deploymentId,
    workflowName: run.workflowName,
    specVersion: run.specVersion,
    attributes: run.attributes,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
  }
}

export function resolveEveWorkflowLineage(
  run: WorkflowAnalyticsRun,
): EveWorkflowLineage | undefined {
  const declaredKind = run.attributes['$eve.type']
  const kind = EVE_RUN_TYPES.has(declaredKind)
    ? declaredKind
    : run.workflowName === 'workflowEntry'
      ? run.attributes['$eve.parent'] || run.attributes['$eve.root']
        ? 'subagent'
        : 'session'
      : run.workflowName === 'turnWorkflow'
        ? 'turn'
        : undefined
  if (!kind) return undefined

  if (kind === 'session') {
    return {
      kind,
      sessionId: run.runId,
      rootSessionId: run.runId,
    }
  }

  if (kind === 'subagent') {
    return {
      kind,
      sessionId: run.runId,
      rootSessionId: run.attributes['$eve.root'] ?? run.runId,
      parentRunId: run.attributes['$eve.parent'],
    }
  }

  const parentRunId = run.attributes['$eve.parent']
  return {
    kind: 'turn',
    sessionId: parentRunId,
    rootSessionId: run.attributes['$eve.root'] ?? parentRunId,
    parentRunId,
  }
}

function attributionForRun(
  run: WorkflowAnalyticsRun,
  attributionBySession: Map<string, Attribution>,
): Attribution {
  const lineage = resolveEveWorkflowLineage(run)
  if (!lineage?.sessionId) {
    return lineage?.rootSessionId ? { rootSessionId: lineage.rootSessionId } : {}
  }

  const stored = attributionBySession.get(lineage.sessionId)
  return stored ?? {
    sessionId: lineage.sessionId,
    rootSessionId: lineage.rootSessionId,
  }
}

function factBase(input: {
  reconciliationRunId: string
  attribution: Attribution
  idempotencyKey: string
  metric: string
  resourceType: string
  resourceId: string
  periodStart: Date
  periodEnd?: Date
  quantity: number
  unit: string
  quality: UsageFactRecord['quality']
  status: UsageFactRecord['status']
  rateUsd: number
  rateUnit: string
  standardCostUsd: number
  rawData: Record<string, unknown>
  observedAt: Date
}): UsageFactRecord {
  return {
    ...input.attribution,
    reconciliationRunId: input.reconciliationRunId,
    inventoryKey: inventoryKey('workflow', input.resourceType, input.resourceId),
    idempotencyKey: input.idempotencyKey,
    service: 'workflow',
    metric: input.metric,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    quantity: decimal(input.quantity),
    unit: input.unit,
    quality: input.quality,
    status: input.status,
    rateUsd: decimal(input.rateUsd),
    rateUnit: input.rateUnit,
    pricingVersion: COST_RATE_VERSION,
    standardCostUsd: asCostDecimal(input.standardCostUsd),
    rawData: input.rawData,
    observedAt: input.observedAt,
    finalizedAt: input.status === 'final' ? input.observedAt : undefined,
  }
}

async function paginated<T>(
  load: (cursor?: string) => Promise<WorkflowPage<T>>,
): Promise<T[]> {
  const rows: T[] = []
  const seenCursors = new Set<string>()
  let cursor: string | undefined

  for (;;) {
    const page = await load(cursor)
    rows.push(...page.data)
    if (!page.hasMore) return rows
    if (!page.cursor || seenCursors.has(page.cursor)) {
      throw new Error('Workflow pagination returned hasMore without a new cursor')
    }
    seenCursors.add(page.cursor)
    cursor = page.cursor
  }
}

/**
 * Reads only Workflow analytics and metadata-only storage records. It never
 * starts, resumes, cancels, retries, or mutates a Workflow run.
 */
export async function readWorkflowObservation(input: {
  window: CollectorWindow
  api: WorkflowReadApi
  pendingRunIds?: readonly string[]
}): Promise<WorkflowObservation> {
  const warnings: CollectorWarning[] = []
  const listedRuns = await paginated((cursor) => input.api.listRuns({
    startTime: input.window.start.toISOString(),
    endTime: input.window.end.toISOString(),
    cursor,
    limit: PAGE_SIZE,
  }))
  const analyticsRuns = listedRuns.filter(isEveRun)
  const stepsByRun = new Map<string, WorkflowAnalyticsStep[]>()
  const eventsByRun = new Map<string, WorkflowAnalyticsEvent[]>()
  const storageByRun = new Map<string, WorkflowStorageRun>()

  for (const run of analyticsRuns) {
    try {
      const steps = await paginated((cursor) => input.api.listSteps({
        runId: run.runId,
        cursor,
        limit: PAGE_SIZE,
      }))
      stepsByRun.set(run.runId, steps)
    } catch (error) {
      warnings.push({
        operation: 'list-workflow-steps',
        resourceId: run.runId,
        message: errorMessage(error),
      })
    }

    try {
      const events = await paginated((cursor) => input.api.listEvents({
        runId: run.runId,
        cursor,
        limit: PAGE_SIZE,
      }))
      eventsByRun.set(run.runId, events)
    } catch (error) {
      warnings.push({
        operation: 'list-workflow-events',
        resourceId: run.runId,
        message: errorMessage(error),
      })
    }
  }

  try {
    const storageRuns = await paginated((cursor) => input.api.listStorageRuns({
      cursor,
      limit: PAGE_SIZE,
    }))
    for (const run of storageRuns.filter(isEveStorageRun)) {
      storageByRun.set(run.runId, run)
    }
  } catch (error) {
    warnings.push({
      operation: 'list-workflow-storage-metadata',
      message: errorMessage(error),
    })
  }

  for (const runId of new Set(input.pendingRunIds ?? [])) {
    if (storageByRun.has(runId)) continue

    try {
      const run = await input.api.getStorageRun(runId)
      if (isEveStorageRun(run)) {
        storageByRun.set(run.runId, run)
      } else {
        warnings.push({
          operation: 'reconcile-workflow-pending-retention',
          resourceId: runId,
          message: 'Pending Workflow retention run is no longer identifiable as an Eve run',
        })
      }
    } catch (error) {
      warnings.push({
        operation: 'reconcile-workflow-pending-retention',
        resourceId: runId,
        message: errorMessage(error),
      })
    }
  }

  const runsById = new Map(analyticsRuns.map((run) => [run.runId, run]))
  for (const storageRun of storageByRun.values()) {
    if (!runsById.has(storageRun.runId)) {
      runsById.set(storageRun.runId, analyticsRunFromStorage(storageRun))
    }
  }
  const runs = [...runsById.values()].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  )

  return { runs, stepsByRun, eventsByRun, storageByRun, warnings }
}

export function buildWorkflowRecords(input: {
  reconciliationRunId: string
  window: CollectorWindow
  observedAt: Date
  observation: WorkflowObservation
  attributionBySession: Map<string, Attribution>
}): {
  inventory: InventoryRecord[]
  facts: UsageFactRecord[]
  warnings: CollectorWarning[]
} {
  const inventory: InventoryRecord[] = []
  const facts: UsageFactRecord[] = []
  const warnings: CollectorWarning[] = []

  if (input.observation.runs.length > 0) {
    warnings.push({
      operation: 'measure-workflow-data-written',
      message: 'Workflow APIs do not expose a semantically distinct Data Written byte counter; no estimated cost fact was emitted. Reconcile this SKU against FOCUS billing data.',
      affectsHealth: false,
    })
  }

  for (const run of input.observation.runs) {
    const lineage = resolveEveWorkflowLineage(run)
    if (!lineage) continue

    if (!EVE_RUN_TYPES.has(run.attributes['$eve.type'])) {
      warnings.push({
        operation: 'infer-eve-workflow-lineage',
        resourceId: run.runId,
        message: `Missing $eve.type; inferred Eve run from workflowName=${run.workflowName}`,
      })
    }

    const attribution = attributionForRun(run, input.attributionBySession)
    const runTerminal = TERMINAL_WORKFLOW_STATUSES.has(run.status)
    const terminalAt = runTerminal
      ? run.completedAt ?? run.updatedAt
      : undefined

    inventory.push({
      ...attribution,
      service: 'workflow',
      resourceType: 'workflow_run',
      resourceId: run.runId,
      sourceParentId: lineage.parentRunId,
      sourceStatus: run.status,
      firstSeenAt: firstSeenAt(run.createdAt, input.observedAt),
      lastSeenAt: input.observedAt,
      terminalAt: terminalAt ?? undefined,
      metadata: {
        eveType: lineage.kind,
        workflowName: run.workflowName,
        deploymentId: run.deploymentId,
        specVersion: run.specVersion,
        errorCode: run.errorCode,
        workflowCoreVersion: run.workflowCoreVersion,
        eveAttributes: run.attributes,
      },
    })

    for (const step of input.observation.stepsByRun.get(run.runId) ?? []) {
      const stepTerminal = runTerminal || isTerminalStep(step)
      const stepTerminalAt = stepTerminal
        ? step.completedAt ?? step.updatedAt
        : undefined

      inventory.push({
        ...attribution,
        service: 'workflow',
        resourceType: 'workflow_step',
        resourceId: `${run.runId}:${step.stepId}`,
        sourceParentId: run.runId,
        sourceStatus: step.status,
        firstSeenAt: firstSeenAt(step.createdAt, input.observedAt),
        lastSeenAt: input.observedAt,
        terminalAt: stepTerminalAt ?? undefined,
        metadata: {
          providerStepId: step.stepId,
          stepName: step.stepName,
          attempt: step.attempt,
          errorCode: step.errorCode,
          retryAfter: step.retryAfter?.toISOString(),
        },
      })
    }

    const seenEventIds = new Set<string>()
    for (const event of input.observation.eventsByRun.get(run.runId) ?? []) {
      if (seenEventIds.has(event.eventId)) continue
      seenEventIds.add(event.eventId)

      facts.push(factBase({
        reconciliationRunId: input.reconciliationRunId,
        attribution,
        idempotencyKey: `workflow:event:${run.runId}:${event.eventId}`,
        metric: 'event',
        resourceType: 'workflow_run',
        resourceId: run.runId,
        periodStart: event.createdAt,
        periodEnd: safePeriodEnd(event.createdAt, event.createdAt),
        quantity: 1,
        unit: 'event',
        quality: 'exact',
        status: 'final',
        rateUsd: PUBLIC_RATES.workflow.eventUsd,
        rateUnit: 'event',
        standardCostUsd: workflowEventCost(1),
        rawData: {
          eventId: event.eventId,
          eventType: event.eventType,
          correlationId: event.correlationId,
          entityId: event.entityId,
          stepName: event.stepName,
          region: event.region,
          errorCode: event.errorCode,
          source: '@workflow/world-vercel.createAnalytics.events.list',
        },
        observedAt: input.observedAt,
      }))
    }

    const storage = input.observation.storageByRun.get(run.runId)
    if (!storage) continue
    if (storage.blobStorageBytes === undefined && storage.streamStorageBytes === undefined) {
      warnings.push({
        operation: 'measure-workflow-data-retained',
        resourceId: run.runId,
        message: 'Workflow storage record did not expose blobStorageBytes or streamStorageBytes',
      })
      continue
    }

    const blobStorageBytes = storage.blobStorageBytes ?? 0
    const streamStorageBytes = storage.streamStorageBytes ?? 0
    const storageBytes = blobStorageBytes + streamStorageBytes
    const storageTerminal = TERMINAL_WORKFLOW_STATUSES.has(storage.status)
    const storageEndedAt = storage.expiredAt && storage.expiredAt <= input.observedAt
      ? storage.expiredAt
      : undefined

    const retentionWindow = runTerminal && storageTerminal
      ? { start: storage.createdAt, end: input.window.end }
      : input.window

    for (const bucket of storageBuckets({
      window: retentionWindow,
      resourceStartedAt: storage.createdAt,
      resourceEndedAt: storageEndedAt,
      observedAt: input.observedAt,
    })) {
      // Storage byte totals can grow while a run is active. Do not finalize
      // historical buckets until the run itself is terminal and size-stable.
      const status = runTerminal && storageTerminal && bucket.status === 'final'
        ? 'final'
        : 'pending'
      const gbMonths = storageBytes / BYTES_PER_DECIMAL_GIGABYTE
        * bucket.hours / (30 * 24)

      facts.push(factBase({
        reconciliationRunId: input.reconciliationRunId,
        attribution,
        idempotencyKey: `workflow:run:${run.runId}:data-retained:${bucket.key}`,
        metric: 'data_retained',
        resourceType: 'workflow_run',
        resourceId: run.runId,
        periodStart: bucket.periodStart,
        periodEnd: bucket.periodEnd,
        quantity: gbMonths,
        unit: 'GB-month',
        quality: 'experimental',
        status,
        rateUsd: PUBLIC_RATES.workflow.dataRetainedGbMonthUsd,
        rateUnit: 'GB-month',
        standardCostUsd: workflowDataRetainedCost(storageBytes, bucket.hours),
        rawData: {
          blobStorageBytes,
          streamStorageBytes,
          retainedHours: bucket.hours,
          caveat: 'Provider byte totals are current snapshots, not a byte-month time series.',
          source: '@workflow/world-vercel.createStorage.runs.list',
        },
        observedAt: input.observedAt,
      }))
    }
  }

  return { inventory, facts, warnings }
}

export async function collectWorkflowUsage(
  options: WorkflowCollectorOptions,
): Promise<CollectorResult> {
  const observedAt = options.observedAt ?? new Date()
  const pendingRunIds = options.pendingRunIds ?? (
    options.persist === false
      ? []
      : await loadPendingUsageResourceIds({
          service: 'workflow',
          metric: 'data_retained',
          resourceType: 'workflow_run',
        })
  )
  const observation = await readWorkflowObservation({
    window: options.window,
    api: options.api ?? defaultWorkflowReadApi(options.apiConfig),
    pendingRunIds,
  })
  const lineage = observation.runs
    .map(resolveEveWorkflowLineage)
    .filter((value): value is EveWorkflowLineage => value !== undefined)
  const attributionBySession = options.attributionBySession
    ?? await loadSessionAttribution(lineage.map((value) => value.sessionId))
  const records = buildWorkflowRecords({
    reconciliationRunId: options.reconciliationRunId,
    window: options.window,
    observedAt,
    observation,
    attributionBySession,
  })
  const warnings = [...observation.warnings, ...records.warnings]

  if (options.persist !== false) {
    await persistCollectorRecords(records.inventory, records.facts)
  }

  return {
    service: 'workflow',
    status: warnings.some((warning) => warning.affectsHealth !== false)
      ? 'partial'
      : 'complete',
    resourcesObserved: records.inventory.length,
    factsObserved: records.facts.length,
    finalFacts: records.facts.filter((fact) => fact.status === 'final').length,
    pendingFacts: records.facts.filter((fact) => fact.status === 'pending').length,
    unattributedResources: records.inventory.filter((resource) => !resource.workspaceId).length,
    warnings,
  }
}

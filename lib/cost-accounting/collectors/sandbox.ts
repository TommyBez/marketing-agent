import { Sandbox } from '@vercel/sandbox'
import {
  asCostDecimal,
  COST_RATE_VERSION,
  PUBLIC_RATES,
  billedMemorySeconds,
  sandboxCpuCost,
  sandboxCreationCost,
  sandboxMemoryCost,
  sandboxNetworkCost,
  sandboxSnapshotCost,
} from '@/lib/cost-accounting/rates'
import { persistCollectorRecords, loadSessionAttribution } from './persistence'
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

const TERMINAL_SESSION_STATUSES = new Set(['stopped', 'failed', 'aborted'])
const TERMINAL_SNAPSHOT_STATUSES = new Set(['failed', 'deleted'])
const MILLISECONDS_PER_HOUR = 60 * 60 * 1_000
const BYTES_PER_DECIMAL_GIGABYTE = 1_000_000_000
const HOURS_PER_BILLING_MONTH = 30 * 24

export type SandboxListItem = {
  name: string
  persistent: boolean
  createdAt: number
  updatedAt: number
  currentSessionId: string
  status: string
  region?: string
  vcpus?: number
  memory?: number
  runtime?: string
  totalEgressBytes?: number
  totalIngressBytes?: number
  totalActiveCpuDurationMs?: number
  totalDurationMs?: number
  currentSnapshotId?: string
  tags?: Record<string, string>
}

export type SandboxSessionObservation = {
  id: string
  memory: number
  vcpus: number
  region: string
  runtime: string
  status: string
  requestedAt: number
  createdAt: number
  updatedAt: number
  startedAt?: number
  requestedStopAt?: number
  stoppedAt?: number
  abortedAt?: number
  duration?: number
  sourceSnapshotId?: string
  snapshottedAt?: number
  activeCpuDurationMs?: number
  networkTransfer?: {
    ingress: number
    egress: number
  }
}

export type SandboxSnapshotObservation = {
  id: string
  sourceSessionId: string
  region: string
  status: string
  sizeBytes: number
  createdAt: number
  updatedAt: number
  expiresAt?: number
  lastUsedAt?: number
  creationMethod?: string
  parentId?: string
}

export type SandboxReadHandle = {
  listSessions(): Promise<AsyncIterable<SandboxSessionObservation>>
  listSnapshots(): Promise<AsyncIterable<SandboxSnapshotObservation>>
}

export type SandboxReadApi = {
  list(): Promise<AsyncIterable<SandboxListItem>>
  get(params: { name: string; resume: false }): Promise<SandboxReadHandle>
}

export type SandboxObservation = {
  sandboxes: Array<{
    sandbox: SandboxListItem
    sessions: SandboxSessionObservation[]
    snapshots: SandboxSnapshotObservation[]
  }>
  warnings: CollectorWarning[]
}

export type SandboxCollectorOptions = {
  reconciliationRunId: string
  window: CollectorWindow
  observedAt?: Date
  api?: SandboxReadApi
  credentials?: {
    token: string
    projectId: string
    teamId: string
  }
  persist?: boolean
}

function defaultSandboxReadApi(
  credentials?: SandboxCollectorOptions['credentials'],
): SandboxReadApi {
  return {
    async list() {
      return Sandbox.list(credentials) as Promise<AsyncIterable<SandboxListItem>>
    },
    async get(params) {
      const sandbox = await Sandbox.get({ ...credentials, ...params })
      return {
        listSessions: () => sandbox.listSessions() as Promise<AsyncIterable<SandboxSessionObservation>>,
        listSnapshots: () => sandbox.listSnapshots() as Promise<AsyncIterable<SandboxSnapshotObservation>>,
      }
    },
  }
}

function dateFromMilliseconds(value: number): Date {
  const date = new Date(value)
  if (!Number.isFinite(value) || Number.isNaN(date.getTime())) {
    throw new Error(`Invalid Vercel Sandbox timestamp: ${value}`)
  }
  return date
}

function laterDate(first: Date, second: Date): Date {
  return first > second ? first : second
}

function safePeriodEnd(start: Date, end: Date): Date {
  return end > start ? end : new Date(start.getTime() + 1)
}

function sandboxAttribution(
  sandbox: SandboxListItem,
  attributionBySession: Map<string, Attribution>,
): Attribution {
  const sessionId = sandbox.tags?.sessionId
  if (!sessionId) return {}

  const stored = attributionBySession.get(sessionId)
  return stored ?? { sessionId, rootSessionId: sessionId }
}

function sessionTerminalAt(session: SandboxSessionObservation): Date | undefined {
  if (!TERMINAL_SESSION_STATUSES.has(session.status)) return undefined
  const value = session.stoppedAt ?? session.abortedAt ?? session.updatedAt
  return dateFromMilliseconds(value)
}

function sessionStartedAt(session: SandboxSessionObservation): Date {
  return dateFromMilliseconds(session.startedAt ?? session.createdAt ?? session.requestedAt)
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
  quantity?: number
  unit: string
  quality: UsageFactRecord['quality']
  status: UsageFactRecord['status']
  rateUsd: number
  rateUnit: string
  standardCostUsd?: number
  rawData: Record<string, unknown>
  observedAt: Date
}): UsageFactRecord {
  return {
    ...input.attribution,
    reconciliationRunId: input.reconciliationRunId,
    inventoryKey: inventoryKey('sandbox', input.resourceType, input.resourceId),
    idempotencyKey: input.idempotencyKey,
    service: 'sandbox',
    metric: input.metric,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    quantity: input.quantity === undefined ? undefined : decimal(input.quantity),
    unit: input.unit,
    quality: input.quality,
    status: input.status,
    rateUsd: decimal(input.rateUsd),
    rateUnit: input.rateUnit,
    pricingVersion: COST_RATE_VERSION,
    standardCostUsd: input.standardCostUsd === undefined
      ? undefined
      : asCostDecimal(input.standardCostUsd),
    rawData: input.rawData,
    observedAt: input.observedAt,
    finalizedAt: input.status === 'final' ? input.observedAt : undefined,
  }
}

/**
 * Reads Sandbox inventory without starting, resuming, stopping, snapshotting,
 * or deleting any VM. `resume: false` is deliberately part of the API
 * contract so a reconciliation run cannot create billable compute.
 */
export async function readSandboxObservation(
  api: SandboxReadApi = defaultSandboxReadApi(),
): Promise<SandboxObservation> {
  const warnings: CollectorWarning[] = []
  const sandboxes: SandboxObservation['sandboxes'] = []
  const listed = await api.list()

  for await (const sandbox of listed) {
    const sessions: SandboxSessionObservation[] = []
    const snapshots: SandboxSnapshotObservation[] = []

    try {
      const handle = await api.get({ name: sandbox.name, resume: false })

      try {
        const listedSessions = await handle.listSessions()
        for await (const session of listedSessions) sessions.push(session)
      } catch (error) {
        warnings.push({
          operation: 'list-sandbox-sessions',
          resourceId: sandbox.name,
          message: errorMessage(error),
        })
      }

      try {
        const listedSnapshots = await handle.listSnapshots()
        for await (const snapshot of listedSnapshots) snapshots.push(snapshot)
      } catch (error) {
        warnings.push({
          operation: 'list-sandbox-snapshots',
          resourceId: sandbox.name,
          message: errorMessage(error),
        })
      }
    } catch (error) {
      warnings.push({
        operation: 'get-sandbox-read-only',
        resourceId: sandbox.name,
        message: errorMessage(error),
      })
    }

    sandboxes.push({ sandbox, sessions, snapshots })
  }

  return { sandboxes, warnings }
}

export function buildSandboxRecords(input: {
  reconciliationRunId: string
  window: CollectorWindow
  observedAt: Date
  observation: SandboxObservation
  attributionBySession: Map<string, Attribution>
}): {
  inventory: InventoryRecord[]
  facts: UsageFactRecord[]
  warnings: CollectorWarning[]
} {
  const inventory: InventoryRecord[] = []
  const facts: UsageFactRecord[] = []
  const warnings: CollectorWarning[] = []

  for (const group of input.observation.sandboxes) {
    const { sandbox } = group
    const attribution = sandboxAttribution(sandbox, input.attributionBySession)
    const sandboxCreatedAt = dateFromMilliseconds(sandbox.createdAt)

    inventory.push({
      ...attribution,
      service: 'sandbox',
      resourceType: 'sandbox',
      resourceId: sandbox.name,
      sourceStatus: sandbox.status,
      firstSeenAt: sandboxCreatedAt > input.observedAt ? input.observedAt : sandboxCreatedAt,
      lastSeenAt: laterDate(sandboxCreatedAt, input.observedAt),
      metadata: {
        persistent: sandbox.persistent,
        currentSessionId: sandbox.currentSessionId,
        currentSnapshotId: sandbox.currentSnapshotId,
        region: sandbox.region,
        runtime: sandbox.runtime,
        tags: sandbox.tags,
      },
    })

    facts.push(factBase({
      reconciliationRunId: input.reconciliationRunId,
      attribution,
      idempotencyKey: `sandbox:creation:${sandbox.name}:${sandbox.createdAt}`,
      metric: 'creation',
      resourceType: 'sandbox',
      resourceId: sandbox.name,
      periodStart: sandboxCreatedAt,
      periodEnd: safePeriodEnd(sandboxCreatedAt, sandboxCreatedAt),
      quantity: 1,
      unit: 'creation',
      quality: 'exact',
      status: 'final',
      rateUsd: PUBLIC_RATES.sandbox.creationUsd,
      rateUnit: 'creation',
      standardCostUsd: sandboxCreationCost(),
      rawData: {
        source: '@vercel/sandbox.Sandbox.list',
      },
      observedAt: input.observedAt,
    }))

    for (const session of group.sessions) {
      const startedAt = sessionStartedAt(session)
      const terminalAt = sessionTerminalAt(session)
      const sourceUpdatedAt = dateFromMilliseconds(session.updatedAt)
      const terminal = terminalAt !== undefined
      const measuredDurationMs = session.duration
        ?? (terminalAt?.getTime() ?? input.observedAt.getTime()) - startedAt.getTime()
      const durationMs = Math.max(0, measuredDurationMs)
      const memoryGb = session.memory / 1_024
      const billedDurationSeconds = billedMemorySeconds(durationMs / 1_000)
      const billedMemoryGbHours = memoryGb * billedDurationSeconds / 3_600
      const periodEnd = terminalAt ? safePeriodEnd(startedAt, terminalAt) : undefined

      inventory.push({
        ...attribution,
        service: 'sandbox',
        resourceType: 'sandbox_session',
        resourceId: session.id,
        sourceParentId: sandbox.name,
        sourceStatus: session.status,
        firstSeenAt: startedAt > input.observedAt ? input.observedAt : startedAt,
        lastSeenAt: laterDate(startedAt, input.observedAt),
        terminalAt,
        metadata: {
          sourceUpdatedAt: sourceUpdatedAt.toISOString(),
          sourceSnapshotId: session.sourceSnapshotId,
          region: session.region,
          runtime: session.runtime,
          memoryMb: session.memory,
          vcpus: session.vcpus,
        },
      })

      const activeCpuMs = session.activeCpuDurationMs
      const cpuFinal = terminal && activeCpuMs !== undefined
      if (terminal && activeCpuMs === undefined) {
        warnings.push({
          operation: 'measure-sandbox-active-cpu',
          resourceId: session.id,
          message: 'Terminal Sandbox session did not expose activeCpuDurationMs',
        })
      }
      facts.push(factBase({
        reconciliationRunId: input.reconciliationRunId,
        attribution,
        idempotencyKey: `sandbox:session:${session.id}:active-cpu`,
        metric: 'active_cpu',
        resourceType: 'sandbox_session',
        resourceId: session.id,
        periodStart: startedAt,
        periodEnd: cpuFinal ? periodEnd : undefined,
        quantity: activeCpuMs === undefined ? undefined : activeCpuMs / MILLISECONDS_PER_HOUR,
        unit: 'CPU-hour',
        quality: cpuFinal ? 'exact' : 'experimental',
        status: cpuFinal ? 'final' : 'pending',
        rateUsd: PUBLIC_RATES.sandbox.activeCpuHourUsd,
        rateUnit: 'CPU-hour',
        standardCostUsd: activeCpuMs === undefined
          ? undefined
          : sandboxCpuCost(activeCpuMs / 1_000),
        rawData: {
          activeCpuDurationMs: activeCpuMs,
          sourceStatus: session.status,
          source: '@vercel/sandbox.Sandbox.listSessions',
        },
        observedAt: input.observedAt,
      }))

      facts.push(factBase({
        reconciliationRunId: input.reconciliationRunId,
        attribution,
        idempotencyKey: `sandbox:session:${session.id}:memory`,
        metric: 'provisioned_memory',
        resourceType: 'sandbox_session',
        resourceId: session.id,
        periodStart: startedAt,
        periodEnd,
        quantity: billedMemoryGbHours,
        unit: 'GB-hour',
        quality: terminal ? 'derived' : 'estimated',
        status: terminal ? 'final' : 'pending',
        rateUsd: PUBLIC_RATES.sandbox.provisionedMemoryGbHourUsd,
        rateUnit: 'GB-hour',
        standardCostUsd: sandboxMemoryCost(memoryGb, durationMs / 1_000),
        rawData: {
          durationMs,
          durationSource: session.duration === undefined ? 'timestamps' : 'provider',
          memoryMb: session.memory,
          billedDurationSeconds,
          billingMinimumSeconds: 60,
        },
        observedAt: input.observedAt,
      }))

      const transferBytes = session.networkTransfer === undefined
        ? undefined
        : session.networkTransfer.ingress + session.networkTransfer.egress
      const networkFinal = terminal && transferBytes !== undefined
      if (terminal && transferBytes === undefined) {
        warnings.push({
          operation: 'measure-sandbox-network',
          resourceId: session.id,
          message: 'Terminal Sandbox session did not expose networkTransfer',
        })
      }
      facts.push(factBase({
        reconciliationRunId: input.reconciliationRunId,
        attribution,
        idempotencyKey: `sandbox:session:${session.id}:network`,
        metric: 'data_transfer',
        resourceType: 'sandbox_session',
        resourceId: session.id,
        periodStart: startedAt,
        periodEnd: networkFinal ? periodEnd : undefined,
        quantity: transferBytes === undefined
          ? undefined
          : transferBytes / BYTES_PER_DECIMAL_GIGABYTE,
        unit: 'GB',
        quality: networkFinal ? 'exact' : 'experimental',
        status: networkFinal ? 'final' : 'pending',
        rateUsd: PUBLIC_RATES.sandbox.networkGbUsd,
        rateUnit: 'GB',
        standardCostUsd: transferBytes === undefined
          ? undefined
          : sandboxNetworkCost(transferBytes),
        rawData: {
          ingressBytes: session.networkTransfer?.ingress,
          egressBytes: session.networkTransfer?.egress,
          sourceStatus: session.status,
          source: '@vercel/sandbox.Sandbox.listSessions',
        },
        observedAt: input.observedAt,
      }))
    }

    for (const snapshot of group.snapshots) {
      const createdAt = dateFromMilliseconds(snapshot.createdAt)
      const updatedAt = dateFromMilliseconds(snapshot.updatedAt)
      const expiredAt = snapshot.expiresAt === undefined
        ? undefined
        : dateFromMilliseconds(snapshot.expiresAt)
      const endedAt = TERMINAL_SNAPSHOT_STATUSES.has(snapshot.status)
        ? updatedAt
        : expiredAt && expiredAt <= input.observedAt
          ? expiredAt
          : undefined

      inventory.push({
        ...attribution,
        service: 'sandbox',
        resourceType: 'sandbox_snapshot',
        resourceId: snapshot.id,
        sourceParentId: sandbox.name,
        sourceStatus: snapshot.status,
        firstSeenAt: createdAt > input.observedAt ? input.observedAt : createdAt,
        lastSeenAt: laterDate(createdAt, input.observedAt),
        terminalAt: endedAt,
        metadata: {
          sourceSessionId: snapshot.sourceSessionId,
          parentId: snapshot.parentId,
          region: snapshot.region,
          sizeBytes: snapshot.sizeBytes,
          expiresAt: expiredAt?.toISOString(),
          creationMethod: snapshot.creationMethod,
        },
      })

      for (const bucket of storageBuckets({
        window: input.window,
        resourceStartedAt: createdAt,
        resourceEndedAt: endedAt,
        observedAt: input.observedAt,
      })) {
        const sizeGbHours = snapshot.sizeBytes
          / BYTES_PER_DECIMAL_GIGABYTE
          * bucket.hours

        facts.push(factBase({
          reconciliationRunId: input.reconciliationRunId,
          attribution,
          idempotencyKey: `sandbox:snapshot:${snapshot.id}:storage:${bucket.key}`,
          metric: 'snapshot_storage',
          resourceType: 'sandbox_snapshot',
          resourceId: snapshot.id,
          periodStart: bucket.periodStart,
          periodEnd: bucket.periodEnd,
          quantity: sizeGbHours,
          unit: 'GB-hour',
          quality: bucket.status === 'final' ? 'derived' : 'estimated',
          status: bucket.status,
          rateUsd: PUBLIC_RATES.sandbox.snapshotGbMonthUsd / HOURS_PER_BILLING_MONTH,
          rateUnit: 'GB-hour',
          standardCostUsd: sandboxSnapshotCost(snapshot.sizeBytes, bucket.hours / 24),
          rawData: {
            sizeBytes: snapshot.sizeBytes,
            retainedHours: bucket.hours,
            providerRateUnit: 'GB-month',
            billingMonthDays: 30,
          },
          observedAt: input.observedAt,
        }))
      }
    }
  }

  return { inventory, facts, warnings }
}

export async function collectSandboxUsage(
  options: SandboxCollectorOptions,
): Promise<CollectorResult> {
  const observedAt = options.observedAt ?? new Date()
  const observation = await readSandboxObservation(
    options.api ?? defaultSandboxReadApi(options.credentials),
  )
  const taggedSessionIds = observation.sandboxes.map(({ sandbox }) => sandbox.tags?.sessionId)
  const attributionBySession = await loadSessionAttribution(taggedSessionIds)
  const records = buildSandboxRecords({
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
    service: 'sandbox',
    status: warnings.length > 0 ? 'partial' : 'complete',
    resourcesObserved: records.inventory.length,
    factsObserved: records.facts.length,
    finalFacts: records.facts.filter((fact) => fact.status === 'final').length,
    pendingFacts: records.facts.filter((fact) => fact.status === 'pending').length,
    unattributedResources: records.inventory.filter((resource) => !resource.workspaceId).length,
    warnings,
  }
}

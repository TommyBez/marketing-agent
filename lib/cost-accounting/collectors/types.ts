export type CollectorWindow = {
  start: Date
  end: Date
}

export type Attribution = {
  workspaceId?: string
  userId?: string
  sessionId?: string
  rootSessionId?: string
}

export type InventoryRecord = Attribution & {
  service: 'sandbox' | 'workflow'
  resourceType: string
  resourceId: string
  sourceParentId?: string
  sourceStatus: string
  firstSeenAt: Date
  lastSeenAt: Date
  terminalAt?: Date
  metadata: Record<string, unknown>
}

export type UsageQuality = 'exact' | 'derived' | 'experimental' | 'estimated'
export type UsageStatus = 'pending' | 'final'

export type UsageFactRecord = Attribution & {
  reconciliationRunId: string
  inventoryKey?: string
  idempotencyKey: string
  service: 'sandbox' | 'workflow'
  metric: string
  resourceType: string
  resourceId: string
  periodStart: Date
  periodEnd?: Date
  quantity?: string
  unit: string
  quality: UsageQuality
  status: UsageStatus
  rateUsd?: string
  rateUnit?: string
  pricingVersion?: string
  standardCostUsd?: string
  rawData: Record<string, unknown>
  observedAt: Date
  finalizedAt?: Date
}

export type CollectorWarning = {
  operation: string
  resourceId?: string
  message: string
  affectsHealth?: boolean
}

export type CollectorResult = {
  service: 'sandbox' | 'workflow'
  status: 'complete' | 'partial'
  resourcesObserved: number
  factsObserved: number
  finalFacts: number
  pendingFacts: number
  unattributedResources: number
  warnings: CollectorWarning[]
}

export function inventoryKey(
  service: InventoryRecord['service'],
  resourceType: string,
  resourceId: string,
): string {
  return `${service}\u0000${resourceType}\u0000${resourceId}`
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function decimal(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid non-negative decimal value: ${value}`)
  }

  return value.toFixed(12)
}

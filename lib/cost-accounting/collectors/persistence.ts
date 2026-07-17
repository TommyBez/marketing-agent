import { db } from '@/lib/db'
import {
  agentExecutionSessions,
  platformResourceInventory,
  platformUsageFacts,
} from '@/lib/db/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { Attribution, InventoryRecord, UsageFactRecord } from './types'
import { inventoryKey } from './types'

const WRITE_BATCH_SIZE = 250
const LOOKUP_BATCH_SIZE = 500

type SessionAttribution = Attribution & {
  sessionId: string
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

export async function loadSessionAttribution(
  sessionIds: Iterable<string | undefined>,
): Promise<Map<string, SessionAttribution>> {
  const ids = [...new Set([...sessionIds].filter((value): value is string => Boolean(value)))]
  const result = new Map<string, SessionAttribution>()

  for (const batch of chunks(ids, LOOKUP_BATCH_SIZE)) {
    const rows = await db.select({
      rootSessionId: agentExecutionSessions.rootSessionId,
      sessionId: agentExecutionSessions.sessionId,
      userId: agentExecutionSessions.userId,
      workspaceId: agentExecutionSessions.workspaceId,
    }).from(agentExecutionSessions).where(inArray(agentExecutionSessions.sessionId, batch))

    for (const row of rows) result.set(row.sessionId, row)
  }

  return result
}

export async function loadPendingUsageResourceIds(input: {
  service: InventoryRecord['service']
  metric: string
  resourceType: string
}): Promise<string[]> {
  const rows = await db.selectDistinct({
    resourceId: platformUsageFacts.resourceId,
  }).from(platformUsageFacts).where(and(
    eq(platformUsageFacts.service, input.service),
    eq(platformUsageFacts.metric, input.metric),
    eq(platformUsageFacts.resourceType, input.resourceType),
    eq(platformUsageFacts.status, 'pending'),
  ))

  return rows.map((row) => row.resourceId)
}

function dedupeInventory(records: InventoryRecord[]): InventoryRecord[] {
  const deduped = new Map<string, InventoryRecord>()
  for (const record of records) {
    const key = inventoryKey(record.service, record.resourceType, record.resourceId)
    const prior = deduped.get(key)
    deduped.set(key, prior ? {
      ...record,
      firstSeenAt: prior.firstSeenAt < record.firstSeenAt ? prior.firstSeenAt : record.firstSeenAt,
      lastSeenAt: prior.lastSeenAt > record.lastSeenAt ? prior.lastSeenAt : record.lastSeenAt,
      terminalAt: record.terminalAt ?? prior.terminalAt,
    } : record)
  }
  return [...deduped.values()]
}

async function upsertInventory(records: InventoryRecord[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>()

  for (const batch of chunks(dedupeInventory(records), WRITE_BATCH_SIZE)) {
    const rows = await db.insert(platformResourceInventory).values(batch.map((record) => ({
      service: record.service,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      sourceParentId: record.sourceParentId,
      sourceStatus: record.sourceStatus,
      workspaceId: record.workspaceId,
      userId: record.userId,
      sessionId: record.sessionId,
      rootSessionId: record.rootSessionId,
      firstSeenAt: record.firstSeenAt,
      lastSeenAt: record.lastSeenAt,
      terminalAt: record.terminalAt,
      metadata: record.metadata,
      updatedAt: record.lastSeenAt,
    }))).onConflictDoUpdate({
      target: [
        platformResourceInventory.service,
        platformResourceInventory.resourceType,
        platformResourceInventory.resourceId,
      ],
      set: {
        sourceParentId: sql`coalesce(excluded."sourceParentId", ${platformResourceInventory.sourceParentId})`,
        sourceStatus: sql`excluded."sourceStatus"`,
        workspaceId: sql`coalesce(excluded."workspaceId", ${platformResourceInventory.workspaceId})`,
        userId: sql`coalesce(excluded."userId", ${platformResourceInventory.userId})`,
        sessionId: sql`coalesce(excluded."sessionId", ${platformResourceInventory.sessionId})`,
        rootSessionId: sql`coalesce(excluded."rootSessionId", ${platformResourceInventory.rootSessionId})`,
        firstSeenAt: sql`least(excluded."firstSeenAt", ${platformResourceInventory.firstSeenAt})`,
        lastSeenAt: sql`greatest(excluded."lastSeenAt", ${platformResourceInventory.lastSeenAt})`,
        terminalAt: sql`coalesce(excluded."terminalAt", ${platformResourceInventory.terminalAt})`,
        metadata: sql`excluded."metadata"`,
        updatedAt: sql`greatest(excluded."lastSeenAt", ${platformResourceInventory.lastSeenAt})`,
      },
    }).returning({
      id: platformResourceInventory.id,
      resourceId: platformResourceInventory.resourceId,
      resourceType: platformResourceInventory.resourceType,
      service: platformResourceInventory.service,
    })

    for (const row of rows) {
      ids.set(inventoryKey(row.service as InventoryRecord['service'], row.resourceType, row.resourceId), row.id)
    }
  }

  return ids
}

function dedupeFacts(records: UsageFactRecord[]): UsageFactRecord[] {
  const deduped = new Map<string, UsageFactRecord>()
  for (const record of records) deduped.set(record.idempotencyKey, record)
  return [...deduped.values()]
}

async function upsertFacts(
  records: UsageFactRecord[],
  inventoryIds: Map<string, string>,
): Promise<void> {
  for (const batch of chunks(dedupeFacts(records), WRITE_BATCH_SIZE)) {
    await db.insert(platformUsageFacts).values(batch.map((record) => ({
      reconciliationRunId: record.reconciliationRunId,
      resourceInventoryId: record.inventoryKey ? inventoryIds.get(record.inventoryKey) : undefined,
      idempotencyKey: record.idempotencyKey,
      service: record.service,
      metric: record.metric,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      workspaceId: record.workspaceId,
      userId: record.userId,
      sessionId: record.sessionId,
      rootSessionId: record.rootSessionId,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      quantity: record.quantity,
      unit: record.unit,
      quality: record.quality,
      status: record.status,
      rateUsd: record.rateUsd,
      rateUnit: record.rateUnit,
      pricingVersion: record.pricingVersion,
      standardCostUsd: record.standardCostUsd,
      rawData: record.rawData,
      observedAt: record.observedAt,
      finalizedAt: record.finalizedAt,
      updatedAt: record.observedAt,
    }))).onConflictDoUpdate({
      target: platformUsageFacts.idempotencyKey,
      set: {
        reconciliationRunId: sql`case when ${platformUsageFacts.status} = 'pending' and excluded."status" = 'final' then excluded."reconciliationRunId" else ${platformUsageFacts.reconciliationRunId} end`,
        resourceInventoryId: sql`coalesce(excluded."resourceInventoryId", ${platformUsageFacts.resourceInventoryId})`,
        workspaceId: sql`coalesce(excluded."workspaceId", ${platformUsageFacts.workspaceId})`,
        userId: sql`coalesce(excluded."userId", ${platformUsageFacts.userId})`,
        sessionId: sql`coalesce(excluded."sessionId", ${platformUsageFacts.sessionId})`,
        rootSessionId: sql`coalesce(excluded."rootSessionId", ${platformUsageFacts.rootSessionId})`,
        periodStart: sql`case when ${platformUsageFacts.status} = 'final' then ${platformUsageFacts.periodStart} else least(excluded."periodStart", ${platformUsageFacts.periodStart}) end`,
        periodEnd: sql`case when ${platformUsageFacts.status} = 'final' then ${platformUsageFacts.periodEnd} else coalesce(excluded."periodEnd", ${platformUsageFacts.periodEnd}) end`,
        quantity: sql`case when ${platformUsageFacts.status} = 'final' then ${platformUsageFacts.quantity} else coalesce(excluded."quantity", ${platformUsageFacts.quantity}) end`,
        quality: sql`case when ${platformUsageFacts.status} = 'final' then ${platformUsageFacts.quality} else excluded."quality" end`,
        status: sql`case when ${platformUsageFacts.status} = 'final' then 'final' else excluded."status" end`,
        rateUsd: sql`case when ${platformUsageFacts.status} = 'final' then ${platformUsageFacts.rateUsd} else coalesce(excluded."rateUsd", ${platformUsageFacts.rateUsd}) end`,
        rateUnit: sql`case when ${platformUsageFacts.status} = 'final' then ${platformUsageFacts.rateUnit} else coalesce(excluded."rateUnit", ${platformUsageFacts.rateUnit}) end`,
        pricingVersion: sql`case when ${platformUsageFacts.status} = 'final' then ${platformUsageFacts.pricingVersion} else coalesce(excluded."pricingVersion", ${platformUsageFacts.pricingVersion}) end`,
        standardCostUsd: sql`case when ${platformUsageFacts.status} = 'final' then ${platformUsageFacts.standardCostUsd} else coalesce(excluded."standardCostUsd", ${platformUsageFacts.standardCostUsd}) end`,
        rawData: sql`case when ${platformUsageFacts.status} = 'final' then ${platformUsageFacts.rawData} else excluded."rawData" end`,
        observedAt: sql`greatest(excluded."observedAt", ${platformUsageFacts.observedAt})`,
        finalizedAt: sql`coalesce(${platformUsageFacts.finalizedAt}, excluded."finalizedAt")`,
        updatedAt: sql`greatest(excluded."observedAt", ${platformUsageFacts.observedAt})`,
      },
    })
  }
}

export async function persistCollectorRecords(
  inventory: InventoryRecord[],
  facts: UsageFactRecord[],
): Promise<void> {
  const inventoryIds = await upsertInventory(inventory)
  await upsertFacts(facts, inventoryIds)
}

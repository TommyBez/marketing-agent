import { sql } from 'drizzle-orm'
import { bigint, boolean, check, foreignKey, index, integer, jsonb, numeric, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const organization = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  logo: text('logo'),
  metadata: text('metadata'),
  createdAt: timestamp('createdAt').notNull(),
}, (table) => [uniqueIndex('organization_slug_uidx').on(table.slug)])

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'), userAgent: text('userAgent'),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  activeOrganizationId: text('activeOrganizationId').references(() => organization.id, { onDelete: 'set null' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(), accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'), refreshToken: text('refreshToken'), idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'), refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'), password: text('password'), createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(), identifier: text('identifier').notNull(), value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(), createdAt: timestamp('createdAt').defaultNow(), updatedAt: timestamp('updatedAt').defaultNow(),
})

export const member = pgTable('member', {
  id: text('id').primaryKey(),
  organizationId: text('organizationId').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('member_organization_user_uidx').on(table.organizationId, table.userId),
  index('member_user_organization_idx').on(table.userId, table.organizationId),
])

export const invitation = pgTable('invitation', {
  id: text('id').primaryKey(),
  organizationId: text('organizationId').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull().default('pending'),
  inviterId: text('inviterId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, (table) => [
  index('invitation_organization_status_idx').on(table.organizationId, table.status),
  index('invitation_email_status_idx').on(table.email, table.status),
])

export const companyProfiles = pgTable('company_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: text('organizationId').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull(), websiteUrl: text('websiteUrl').notNull(), normalizedDomain: text('normalizedDomain').notNull(),
  name: text('name').notNull(), summary: text('summary').notNull().default(''), audience: text('audience').notNull().default(''),
  offering: text('offering').notNull().default(''), voice: text('voice').notNull().default(''),
  rawContext: jsonb('rawContext').$type<Record<string, unknown>>().notNull().default({}), createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
}, (table) => [
  index('company_profiles_user_updated_idx').on(table.userId, table.updatedAt),
  uniqueIndex('company_profiles_organization_uidx').on(table.organizationId),
  uniqueIndex('company_profiles_user_domain_uidx').on(table.userId, table.normalizedDomain),
])

export const agentThreads = pgTable('agent_threads', {
  id: uuid('id').primaryKey().defaultRandom(), userId: text('userId').notNull(),
  companyProfileId: uuid('companyProfileId').notNull().references(() => companyProfiles.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('New conversation'),
  eveSessionId: text('eveSessionId'), continuationToken: text('continuationToken'), streamIndex: integer('streamIndex').notNull().default(0),
  events: jsonb('events').notNull().default([]), channel: text('channel').notNull().default('web'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
}, (table) => [
  unique('agent_threads_company_id_unique').on(table.companyProfileId, table.id),
  uniqueIndex('agent_threads_eve_session_uidx').on(table.eveSessionId),
  index('agent_threads_user_company_updated_idx').on(table.userId, table.companyProfileId, table.updatedAt),
  index('agent_threads_company_updated_idx').on(table.companyProfileId, table.updatedAt.desc()),
])

export const artifacts = pgTable('artifacts', {
  id: uuid('id').primaryKey().defaultRandom(), userId: text('userId').notNull(),
  companyProfileId: uuid('companyProfileId').notNull().references(() => companyProfiles.id, { onDelete: 'cascade' }),
  threadId: uuid('threadId').references(() => agentThreads.id, { onDelete: 'set null' }),
  title: text('title').notNull(), content: text('content').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
}, (table) => [
  unique('artifacts_company_id_unique').on(table.companyProfileId, table.id),
  foreignKey({
    name: 'artifacts_company_thread_fk',
    columns: [table.companyProfileId, table.threadId],
    foreignColumns: [agentThreads.companyProfileId, agentThreads.id],
  }),
  index('artifacts_user_company_updated_idx').on(table.userId, table.companyProfileId, table.updatedAt),
  index('artifacts_company_updated_idx').on(table.companyProfileId, table.updatedAt.desc()),
])

export const publicShares = pgTable('public_shares', {
  id: uuid('id').primaryKey().defaultRandom(),
  publicId: text('publicId').notNull(),
  companyProfileId: uuid('companyProfileId').notNull().references(() => companyProfiles.id, { onDelete: 'cascade' }),
  createdByUserId: text('createdByUserId').references(() => user.id, { onDelete: 'set null' }),
  resourceType: text('resourceType').notNull(),
  artifactId: uuid('artifactId'),
  threadId: uuid('threadId'),
  snapshot: jsonb('snapshot').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: 'public_shares_company_artifact_fk',
    columns: [table.companyProfileId, table.artifactId],
    foreignColumns: [artifacts.companyProfileId, artifacts.id],
  }).onDelete('cascade'),
  foreignKey({
    name: 'public_shares_company_thread_fk',
    columns: [table.companyProfileId, table.threadId],
    foreignColumns: [agentThreads.companyProfileId, agentThreads.id],
  }).onDelete('cascade'),
  uniqueIndex('public_shares_public_id_uidx').on(table.publicId),
  uniqueIndex('public_shares_artifact_uidx').on(table.artifactId),
  uniqueIndex('public_shares_thread_uidx').on(table.threadId),
  index('public_shares_company_created_idx').on(table.companyProfileId, table.createdAt),
  check('public_shares_resource_check', sql`(
    (${table.resourceType} = 'artifact' AND ${table.artifactId} IS NOT NULL AND ${table.threadId} IS NULL)
    OR
    (${table.resourceType} = 'conversation' AND ${table.threadId} IS NOT NULL AND ${table.artifactId} IS NULL)
  )`),
])

export const aiCreditAccounts = pgTable('ai_credit_accounts', {
  workspaceId: uuid('workspaceId').primaryKey(),
  organizationId: text('organizationId').notNull(),
  currency: text('currency').notNull().default('USD'),
  balanceMicrousd: bigint('balanceMicrousd', { mode: 'bigint' }).notNull().default(sql`0`),
  archivedAt: timestamp('archivedAt', { withTimezone: true }),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('ai_credit_accounts_organization_uidx').on(table.organizationId),
  check('ai_credit_accounts_currency_check', sql`${table.currency} = 'USD'`),
])

export const agentExecutionSessions = pgTable('agent_execution_sessions', {
  sessionId: text('sessionId').primaryKey(),
  rootSessionId: text('rootSessionId').notNull(),
  parentSessionId: text('parentSessionId'),
  parentTurnId: text('parentTurnId'),
  workspaceId: uuid('workspaceId').notNull().references(() => aiCreditAccounts.workspaceId, { onDelete: 'restrict' }),
  organizationId: text('organizationId').notNull(),
  userId: text('userId').notNull(),
  conversationId: uuid('conversationId'),
  kind: text('kind').notNull(),
  agentId: text('agentId').notNull(),
  status: text('status').notNull().default('running'),
  startedAt: timestamp('startedAt', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('lastSeenAt', { withTimezone: true }).notNull(),
  terminalAt: timestamp('terminalAt', { withTimezone: true }),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('agent_execution_sessions_root_conversation_uidx')
    .on(table.conversationId)
    .where(sql`${table.kind} = 'root' AND ${table.conversationId} IS NOT NULL`),
  index('agent_execution_sessions_root_idx').on(table.rootSessionId),
  index('agent_execution_sessions_workspace_started_idx').on(table.workspaceId, table.startedAt),
  index('agent_execution_sessions_conversation_idx').on(table.conversationId),
  check('agent_execution_sessions_kind_check', sql`${table.kind} IN ('root', 'subagent')`),
  check('agent_execution_sessions_status_check', sql`${table.status} IN ('running', 'waiting', 'completed', 'failed')`),
  check('agent_execution_sessions_lineage_check', sql`(
    (${table.kind} = 'root' AND ${table.rootSessionId} = ${table.sessionId} AND ${table.parentSessionId} IS NULL)
    OR
    (${table.kind} = 'subagent' AND ${table.parentSessionId} IS NOT NULL)
  )`),
  check('agent_execution_sessions_terminal_check', sql`(
    (${table.status} IN ('running', 'waiting') AND ${table.terminalAt} IS NULL)
    OR
    (${table.status} IN ('completed', 'failed') AND ${table.terminalAt} IS NOT NULL)
  )`),
])

export const aiTurns = pgTable('ai_turns', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('sessionId').notNull().references(() => agentExecutionSessions.sessionId, { onDelete: 'restrict' }),
  eveTurnId: text('eveTurnId').notNull(),
  sequence: integer('sequence').notNull(),
  workspaceId: uuid('workspaceId').notNull().references(() => aiCreditAccounts.workspaceId, { onDelete: 'restrict' }),
  organizationId: text('organizationId').notNull(),
  userId: text('userId').notNull(),
  conversationId: uuid('conversationId'),
  status: text('status').notNull().default('running'),
  failure: jsonb('failure').$type<Record<string, unknown>>(),
  startedAt: timestamp('startedAt', { withTimezone: true }).notNull(),
  completedAt: timestamp('completedAt', { withTimezone: true }),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('ai_turns_session_turn_uidx').on(table.sessionId, table.eveTurnId),
  uniqueIndex('ai_turns_session_sequence_uidx').on(table.sessionId, table.sequence),
  index('ai_turns_workspace_started_idx').on(table.workspaceId, table.startedAt),
  index('ai_turns_user_started_idx').on(table.userId, table.startedAt),
  index('ai_turns_status_started_idx').on(table.status, table.startedAt),
  check('ai_turns_sequence_check', sql`${table.sequence} >= 0`),
  check('ai_turns_status_check', sql`${table.status} IN ('running', 'completed', 'failed')`),
  check('ai_turns_completed_check', sql`(
    (${table.status} = 'running' AND ${table.completedAt} IS NULL)
    OR
    (${table.status} IN ('completed', 'failed') AND ${table.completedAt} IS NOT NULL)
  )`),
])

export const aiModelCalls = pgTable('ai_model_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  callId: text('callId').notNull(),
  gatewayGenerationId: text('gatewayGenerationId'),
  aiTurnId: uuid('aiTurnId').references(() => aiTurns.id, { onDelete: 'restrict' }),
  sessionId: text('sessionId').notNull().references(() => agentExecutionSessions.sessionId, { onDelete: 'restrict' }),
  rootSessionId: text('rootSessionId').notNull(),
  eveTurnId: text('eveTurnId'),
  workspaceId: uuid('workspaceId').notNull().references(() => aiCreditAccounts.workspaceId, { onDelete: 'restrict' }),
  organizationId: text('organizationId').notNull(),
  userId: text('userId').notNull(),
  conversationId: uuid('conversationId'),
  agentId: text('agentId').notNull(),
  callKind: text('callKind').notNull(),
  attempt: integer('attempt').notNull().default(0),
  stepIndex: integer('stepIndex'),
  status: text('status').notNull().default('pending'),
  modelRequested: text('modelRequested').notNull(),
  modelServed: text('modelServed'),
  provider: text('provider'),
  inputTokens: bigint('inputTokens', { mode: 'number' }),
  outputTokens: bigint('outputTokens', { mode: 'number' }),
  reasoningTokens: bigint('reasoningTokens', { mode: 'number' }),
  cacheReadTokens: bigint('cacheReadTokens', { mode: 'number' }),
  cacheWriteTokens: bigint('cacheWriteTokens', { mode: 'number' }),
  provisionalCostUsd: numeric('provisionalCostUsd', { precision: 28, scale: 12 }),
  reconciledCostUsd: numeric('reconciledCostUsd', { precision: 28, scale: 12 }),
  costCurrency: text('costCurrency').notNull().default('USD'),
  pricingVersion: text('pricingVersion'),
  rawUsage: jsonb('rawUsage').$type<Record<string, unknown>>().notNull().default({}),
  startedAt: timestamp('startedAt', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completedAt', { withTimezone: true }),
  reconciledAt: timestamp('reconciledAt', { withTimezone: true }),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('ai_model_calls_call_uidx').on(table.callId),
  uniqueIndex('ai_model_calls_gateway_generation_uidx').on(table.gatewayGenerationId),
  index('ai_model_calls_status_started_idx').on(table.status, table.startedAt),
  index('ai_model_calls_workspace_started_idx').on(table.workspaceId, table.startedAt),
  index('ai_model_calls_user_started_idx').on(table.userId, table.startedAt),
  index('ai_model_calls_root_session_idx').on(table.rootSessionId),
  index('ai_model_calls_turn_idx').on(table.aiTurnId),
  check('ai_model_calls_kind_check', sql`${table.callKind} IN ('step', 'retry', 'compaction', 'other')`),
  check('ai_model_calls_status_check', sql`${table.status} IN ('pending', 'completed', 'aborted', 'error', 'reconciled')`),
  check('ai_model_calls_attempt_check', sql`${table.attempt} >= 0`),
  check('ai_model_calls_step_check', sql`${table.stepIndex} IS NULL OR ${table.stepIndex} >= 0`),
  check('ai_model_calls_tokens_check', sql`(
    (${table.inputTokens} IS NULL OR ${table.inputTokens} >= 0)
    AND (${table.outputTokens} IS NULL OR ${table.outputTokens} >= 0)
    AND (${table.reasoningTokens} IS NULL OR ${table.reasoningTokens} >= 0)
    AND (${table.cacheReadTokens} IS NULL OR ${table.cacheReadTokens} >= 0)
    AND (${table.cacheWriteTokens} IS NULL OR ${table.cacheWriteTokens} >= 0)
  )`),
  check('ai_model_calls_cost_check', sql`(
    (${table.provisionalCostUsd} IS NULL OR ${table.provisionalCostUsd} >= 0)
    AND (${table.reconciledCostUsd} IS NULL OR ${table.reconciledCostUsd} >= 0)
    AND ${table.costCurrency} = 'USD'
  )`),
])

export const aiCreditLedgerEntries = pgTable('ai_credit_ledger_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspaceId').notNull().references(() => aiCreditAccounts.workspaceId, { onDelete: 'restrict' }),
  userId: text('userId'),
  modelCallId: uuid('modelCallId').references(() => aiModelCalls.id, { onDelete: 'restrict' }),
  kind: text('kind').notNull(),
  amountMicrousd: bigint('amountMicrousd', { mode: 'bigint' }).notNull(),
  balanceAfterMicrousd: bigint('balanceAfterMicrousd', { mode: 'bigint' }).notNull(),
  idempotencyKey: text('idempotencyKey').notNull(),
  reason: text('reason').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: timestamp('occurredAt', { withTimezone: true }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('ai_credit_ledger_entries_idempotency_uidx').on(table.idempotencyKey),
  index('ai_credit_ledger_entries_workspace_created_idx').on(table.workspaceId, table.createdAt.desc(), table.id),
  index('ai_credit_ledger_entries_model_call_idx').on(table.modelCallId),
  check('ai_credit_ledger_entries_kind_check', sql`${table.kind} IN (
    'pilot_grant',
    'usage',
    'reconciliation_adjustment',
    'manual_adjustment',
    'refund',
    'topup'
  )`),
  check('ai_credit_ledger_entries_amount_check', sql`(
    (${table.kind} IN ('pilot_grant', 'refund', 'topup') AND ${table.amountMicrousd} > 0)
    OR
    (${table.kind} = 'usage' AND ${table.amountMicrousd} < 0)
    OR
    (${table.kind} IN ('reconciliation_adjustment', 'manual_adjustment') AND ${table.amountMicrousd} <> 0)
  )`),
])

export const costReconciliationRuns = pgTable('cost_reconciliation_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  runKey: text('runKey').notNull(),
  trigger: text('trigger').notNull(),
  status: text('status').notNull().default('running'),
  windowStart: timestamp('windowStart', { withTimezone: true }).notNull(),
  windowEnd: timestamp('windowEnd', { withTimezone: true }).notNull(),
  billingSnapshotComplete: boolean('billingSnapshotComplete').notNull().default(false),
  sourceStatuses: jsonb('sourceStatuses').$type<Record<string, unknown>>().notNull().default({}),
  error: jsonb('error').$type<Record<string, unknown>>(),
  startedAt: timestamp('startedAt', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completedAt', { withTimezone: true }),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('cost_reconciliation_runs_key_uidx').on(table.runKey),
  index('cost_reconciliation_runs_status_started_idx').on(table.status, table.startedAt),
  index('cost_reconciliation_runs_window_idx').on(table.windowStart, table.windowEnd),
  check('cost_reconciliation_runs_trigger_check', sql`${table.trigger} IN ('scheduled', 'manual')`),
  check('cost_reconciliation_runs_status_check', sql`${table.status} IN ('running', 'complete', 'partial', 'failed')`),
  check('cost_reconciliation_runs_window_check', sql`${table.windowEnd} > ${table.windowStart}`),
  check('cost_reconciliation_runs_completed_check', sql`(
    (${table.status} = 'running' AND ${table.completedAt} IS NULL)
    OR
    (${table.status} IN ('complete', 'partial', 'failed') AND ${table.completedAt} IS NOT NULL)
  )`),
])

export const platformResourceInventory = pgTable('platform_resource_inventory', {
  id: uuid('id').primaryKey().defaultRandom(),
  service: text('service').notNull(),
  resourceType: text('resourceType').notNull(),
  resourceId: text('resourceId').notNull(),
  sourceParentId: text('sourceParentId'),
  sourceStatus: text('sourceStatus').notNull(),
  workspaceId: uuid('workspaceId').references(() => aiCreditAccounts.workspaceId, { onDelete: 'restrict' }),
  userId: text('userId'),
  sessionId: text('sessionId'),
  rootSessionId: text('rootSessionId'),
  firstSeenAt: timestamp('firstSeenAt', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('lastSeenAt', { withTimezone: true }).notNull(),
  terminalAt: timestamp('terminalAt', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('platform_resource_inventory_resource_uidx').on(table.service, table.resourceType, table.resourceId),
  index('platform_resource_inventory_status_seen_idx').on(table.service, table.resourceType, table.sourceStatus, table.lastSeenAt),
  index('platform_resource_inventory_workspace_seen_idx').on(table.workspaceId, table.lastSeenAt),
  index('platform_resource_inventory_session_idx').on(table.sessionId),
  check('platform_resource_inventory_service_check', sql`${table.service} IN ('sandbox', 'workflow', 'functions', 'queues')`),
  check('platform_resource_inventory_seen_check', sql`${table.lastSeenAt} >= ${table.firstSeenAt}`),
])

export const platformUsageFacts = pgTable('platform_usage_facts', {
  id: uuid('id').primaryKey().defaultRandom(),
  reconciliationRunId: uuid('reconciliationRunId').notNull().references(() => costReconciliationRuns.id, { onDelete: 'restrict' }),
  resourceInventoryId: uuid('resourceInventoryId').references(() => platformResourceInventory.id, { onDelete: 'restrict' }),
  idempotencyKey: text('idempotencyKey').notNull(),
  service: text('service').notNull(),
  metric: text('metric').notNull(),
  resourceType: text('resourceType').notNull(),
  resourceId: text('resourceId').notNull(),
  workspaceId: uuid('workspaceId').references(() => aiCreditAccounts.workspaceId, { onDelete: 'restrict' }),
  userId: text('userId'),
  sessionId: text('sessionId'),
  rootSessionId: text('rootSessionId'),
  periodStart: timestamp('periodStart', { withTimezone: true }).notNull(),
  periodEnd: timestamp('periodEnd', { withTimezone: true }),
  quantity: numeric('quantity', { precision: 28, scale: 12 }),
  unit: text('unit').notNull(),
  quality: text('quality').notNull(),
  status: text('status').notNull().default('pending'),
  rateUsd: numeric('rateUsd', { precision: 28, scale: 12 }),
  rateUnit: text('rateUnit'),
  pricingVersion: text('pricingVersion'),
  standardCostUsd: numeric('standardCostUsd', { precision: 28, scale: 12 }),
  rawData: jsonb('rawData').$type<Record<string, unknown>>().notNull().default({}),
  observedAt: timestamp('observedAt', { withTimezone: true }).notNull().defaultNow(),
  finalizedAt: timestamp('finalizedAt', { withTimezone: true }),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('platform_usage_facts_idempotency_uidx').on(table.idempotencyKey),
  index('platform_usage_facts_service_status_idx').on(table.service, table.status, table.observedAt),
  index('platform_usage_facts_workspace_period_idx').on(table.workspaceId, table.periodStart),
  index('platform_usage_facts_root_session_idx').on(table.rootSessionId),
  index('platform_usage_facts_run_idx').on(table.reconciliationRunId),
  check('platform_usage_facts_service_check', sql`${table.service} IN ('sandbox', 'workflow', 'functions', 'queues')`),
  check('platform_usage_facts_quality_check', sql`${table.quality} IN ('exact', 'derived', 'experimental', 'estimated')`),
  check('platform_usage_facts_status_check', sql`${table.status} IN ('pending', 'final')`),
  check('platform_usage_facts_period_check', sql`${table.periodEnd} IS NULL OR ${table.periodEnd} > ${table.periodStart}`),
  check('platform_usage_facts_quantity_check', sql`${table.quantity} IS NULL OR ${table.quantity} >= 0`),
  check('platform_usage_facts_cost_check', sql`(
    (${table.rateUsd} IS NULL OR ${table.rateUsd} >= 0)
    AND (${table.standardCostUsd} IS NULL OR ${table.standardCostUsd} >= 0)
  )`),
  check('platform_usage_facts_final_check', sql`(
    ${table.status} = 'pending'
    OR
    (
      ${table.periodEnd} IS NOT NULL
      AND ${table.quantity} IS NOT NULL
      AND ${table.standardCostUsd} IS NOT NULL
      AND ${table.finalizedAt} IS NOT NULL
    )
  )`),
])

export const vercelBillingCharges = pgTable('vercel_billing_charges', {
  id: uuid('id').primaryKey().defaultRandom(),
  reconciliationRunId: uuid('reconciliationRunId').notNull().references(() => costReconciliationRuns.id, { onDelete: 'restrict' }),
  sourceChargeKey: text('sourceChargeKey').notNull(),
  serviceName: text('serviceName').notNull(),
  skuId: text('skuId'),
  skuName: text('skuName'),
  chargeCategory: text('chargeCategory'),
  chargePeriodStart: timestamp('chargePeriodStart', { withTimezone: true }).notNull(),
  chargePeriodEnd: timestamp('chargePeriodEnd', { withTimezone: true }).notNull(),
  usageQuantity: numeric('usageQuantity', { precision: 28, scale: 12 }),
  usageUnit: text('usageUnit'),
  listCostUsd: numeric('listCostUsd', { precision: 28, scale: 12 }),
  billedCostUsd: numeric('billedCostUsd', { precision: 28, scale: 12 }).notNull(),
  effectiveCostUsd: numeric('effectiveCostUsd', { precision: 28, scale: 12 }).notNull(),
  currency: text('currency').notNull(),
  rawCharge: jsonb('rawCharge').$type<Record<string, unknown>>().notNull(),
  importedAt: timestamp('importedAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('vercel_billing_charges_run_source_uidx').on(table.reconciliationRunId, table.sourceChargeKey),
  index('vercel_billing_charges_service_period_idx').on(table.serviceName, table.chargePeriodStart),
  index('vercel_billing_charges_run_idx').on(table.reconciliationRunId),
  check('vercel_billing_charges_period_check', sql`${table.chargePeriodEnd} > ${table.chargePeriodStart}`),
  check('vercel_billing_charges_currency_check', sql`char_length(${table.currency}) = 3`),
])

export const infrastructureCostAllocations = pgTable('infrastructure_cost_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  reconciliationRunId: uuid('reconciliationRunId').notNull().references(() => costReconciliationRuns.id, { onDelete: 'restrict' }),
  billingChargeId: uuid('billingChargeId').notNull().references(() => vercelBillingCharges.id, { onDelete: 'restrict' }),
  usageFactId: uuid('usageFactId').references(() => platformUsageFacts.id, { onDelete: 'restrict' }),
  allocationKey: text('allocationKey').notNull(),
  scope: text('scope').notNull(),
  workspaceId: uuid('workspaceId').references(() => aiCreditAccounts.workspaceId, { onDelete: 'restrict' }),
  method: text('method').notNull(),
  weight: numeric('weight', { precision: 28, scale: 12 }).notNull(),
  billedCostUsd: numeric('billedCostUsd', { precision: 28, scale: 12 }).notNull(),
  effectiveCostUsd: numeric('effectiveCostUsd', { precision: 28, scale: 12 }).notNull(),
  periodStart: timestamp('periodStart', { withTimezone: true }).notNull(),
  periodEnd: timestamp('periodEnd', { withTimezone: true }).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('infrastructure_cost_allocations_key_uidx').on(table.allocationKey),
  index('infrastructure_cost_allocations_run_idx').on(table.reconciliationRunId),
  index('infrastructure_cost_allocations_charge_idx').on(table.billingChargeId),
  index('infrastructure_cost_allocations_workspace_period_idx').on(table.workspaceId, table.periodStart),
  check('infrastructure_cost_allocations_scope_check', sql`(
    (${table.scope} = 'workspace' AND ${table.workspaceId} IS NOT NULL)
    OR
    (${table.scope} = 'platform_shared' AND ${table.workspaceId} IS NULL)
  )`),
  check('infrastructure_cost_allocations_method_check', sql`${table.method} IN ('direct', 'weighted', 'shared')`),
  check('infrastructure_cost_allocations_weight_check', sql`${table.weight} >= 0 AND ${table.weight} <= 1`),
  check('infrastructure_cost_allocations_period_check', sql`${table.periodEnd} > ${table.periodStart}`),
])

export const pilotCostReports = pgTable('pilot_cost_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportKey: text('reportKey').notNull(),
  generatedFromRunId: uuid('generatedFromRunId').notNull().references(() => costReconciliationRuns.id, { onDelete: 'restrict' }),
  periodStart: timestamp('periodStart', { withTimezone: true }).notNull(),
  periodEnd: timestamp('periodEnd', { withTimezone: true }).notNull(),
  timezone: text('timezone').notNull().default('Europe/Rome'),
  status: text('status').notNull().default('provisional'),
  version: integer('version').notNull().default(1),
  report: jsonb('report').$type<Record<string, unknown>>().notNull(),
  generatedAt: timestamp('generatedAt', { withTimezone: true }).notNull().defaultNow(),
  finalizedAt: timestamp('finalizedAt', { withTimezone: true }),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('pilot_cost_reports_key_uidx').on(table.reportKey),
  uniqueIndex('pilot_cost_reports_period_uidx').on(table.periodStart, table.periodEnd, table.timezone),
  index('pilot_cost_reports_status_period_idx').on(table.status, table.periodStart),
  check('pilot_cost_reports_status_check', sql`${table.status} IN ('provisional', 'complete', 'failed')`),
  check('pilot_cost_reports_period_check', sql`${table.periodEnd} > ${table.periodStart}`),
  check('pilot_cost_reports_version_check', sql`${table.version} > 0`),
  check('pilot_cost_reports_finalized_check', sql`(
    (${table.status} = 'complete' AND ${table.finalizedAt} IS NOT NULL)
    OR
    (${table.status} IN ('provisional', 'failed'))
  )`),
])

export interface CompanyContext {
  name?: string
  description?: string
  audience?: string
  offering?: string
  voice?: string
  [key: string]: unknown
}

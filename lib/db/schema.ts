import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

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
  userId: text('userId').notNull(), websiteUrl: text('websiteUrl').notNull(),
  name: text('name').notNull(), summary: text('summary').notNull().default(''), audience: text('audience').notNull().default(''),
  offering: text('offering').notNull().default(''), voice: text('voice').notNull().default(''),
  rawContext: jsonb('rawContext').notNull().default({}), createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
}, (table) => [
  index('company_profiles_user_updated_idx').on(table.userId, table.updatedAt),
  uniqueIndex('company_profiles_organization_uidx').on(table.organizationId),
])

export const agentThreads = pgTable('agent_threads', {
  id: uuid('id').primaryKey().defaultRandom(), userId: text('userId').notNull(),
  companyProfileId: uuid('companyProfileId').notNull().references(() => companyProfiles.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('New conversation'),
  eveSessionId: text('eveSessionId'), continuationToken: text('continuationToken'), streamIndex: integer('streamIndex').notNull().default(0),
  events: jsonb('events').notNull().default([]), channel: text('channel').notNull().default('web'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
}, (table) => [index('agent_threads_user_company_updated_idx').on(table.userId, table.companyProfileId, table.updatedAt)])

export const artifacts = pgTable('artifacts', {
  id: uuid('id').primaryKey().defaultRandom(), userId: text('userId').notNull(),
  companyProfileId: uuid('companyProfileId').notNull().references(() => companyProfiles.id, { onDelete: 'cascade' }),
  threadId: uuid('threadId').references(() => agentThreads.id, { onDelete: 'set null' }),
  title: text('title').notNull(), content: text('content').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
}, (table) => [index('artifacts_user_company_updated_idx').on(table.userId, table.companyProfileId, table.updatedAt)])

export interface CompanyContext {
  name?: string
  description?: string
  audience?: string
  offering?: string
  voice?: string
  [key: string]: unknown
}

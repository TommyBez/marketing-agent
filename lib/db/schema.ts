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

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'), userAgent: text('userAgent'),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
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

export const companyProfiles = pgTable('company_profiles', {
  id: uuid('id').primaryKey().defaultRandom(), userId: text('userId').notNull(), websiteUrl: text('websiteUrl').notNull(),
  name: text('name').notNull(), summary: text('summary').notNull().default(''), audience: text('audience').notNull().default(''),
  offering: text('offering').notNull().default(''), voice: text('voice').notNull().default(''),
  rawContext: jsonb('rawContext').notNull().default({}), createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
}, (table) => [index('company_profiles_user_updated_idx').on(table.userId, table.updatedAt)])

export const agentThreads = pgTable('agent_threads', {
  id: uuid('id').primaryKey().defaultRandom(), userId: text('userId').notNull(), companyProfileId: uuid('companyProfileId').notNull(),
  eveSessionId: text('eveSessionId'), continuationToken: text('continuationToken'), streamIndex: integer('streamIndex').notNull().default(0),
  events: jsonb('events').notNull().default([]), channel: text('channel').notNull().default('web'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
}, (table) => [
  index('agent_threads_user_workspace_idx').on(table.userId, table.companyProfileId),
  uniqueIndex('agent_threads_workspace_channel_unique').on(table.userId, table.companyProfileId, table.channel),
])

export interface CompanyContext {
  name?: string
  description?: string
  audience?: string
  offering?: string
  voice?: string
  [key: string]: unknown
}

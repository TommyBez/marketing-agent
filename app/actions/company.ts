'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { agentThreads, artifacts, companyProfiles, type CompanyContext } from '@/lib/db/schema'
import { and, desc, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'

const workspaceIdSchema = z.string().uuid()
const workspaceNameSchema = z.string().trim().min(1, 'Workspace name is required').max(80, 'Workspace name must be 80 characters or fewer')
const urlSchema = z.string().url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Use an HTTP or HTTPS URL')

async function getUserId() {
  const currentSession = await auth.api.getSession({ headers: await headers() })
  if (!currentSession?.user) throw new Error('Unauthorized')
  return currentSession.user.id
}

function getDomain(value: string) {
  return new URL(value).hostname.replace(/^www\./, '')
}

export async function analyzeCompany(websiteUrl: string) {
  const userId = await getUserId()
  const parsedUrl = urlSchema.parse(websiteUrl)
  const domain = getDomain(parsedUrl).toLowerCase()
  const matchingWorkspace = (await db.select().from(companyProfiles).where(eq(companyProfiles.userId, userId)))
    .find((workspace) => getDomain(workspace.websiteUrl).toLowerCase() === domain)
  if (matchingWorkspace) return matchingWorkspace

  const apiKey = process.env.CONTEXT_DEV_API_KEY
  if (!apiKey) throw new Error('Context.dev is not configured')

  const [brandResponse, scrapeResponse] = await Promise.all([
    fetch('https://api.context.dev/v1/brand/retrieve', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'by_domain', domain: getDomain(parsedUrl) }), cache: 'no-store',
    }),
    fetch(`https://api.context.dev/v1/web/scrape/markdown?url=${encodeURIComponent(parsedUrl)}`, {
      headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store',
    }),
  ])

  if (!brandResponse.ok) throw new Error(`Context.dev brand lookup failed (${brandResponse.status})`)
  const brandPayload = await brandResponse.json() as { brand?: CompanyContext }
  const scrapePayload = scrapeResponse.ok ? await scrapeResponse.json() as { markdown?: string } : {}
  const brand = brandPayload.brand ?? {}
  const name = String(brand.name ?? getDomain(parsedUrl))
  const summary = String(brand.description ?? scrapePayload.markdown?.slice(0, 900) ?? '')
  const audience = String(brand.audience ?? '')
  const offering = String(brand.offering ?? summary.slice(0, 320))
  const voice = String(brand.voice ?? 'Clear, credible, and customer-focused')

  try {
    const [workspace] = await db.insert(companyProfiles).values({
      userId, websiteUrl: parsedUrl, name, summary, audience, offering, voice,
      rawContext: { brand, markdown: scrapePayload.markdown?.slice(0, 40_000) },
    }).returning()
    revalidatePath('/workspace', 'layout')
    return workspace
  } catch (cause) {
    if (!(cause instanceof Error) || !('code' in cause) || cause.code !== '23505') throw cause
    const workspace = (await db.select().from(companyProfiles).where(eq(companyProfiles.userId, userId)))
      .find((candidate) => getDomain(candidate.websiteUrl).toLowerCase() === domain)
    if (!workspace) throw cause
    return workspace
  }
}

export async function listWorkspaces() {
  const userId = await getUserId()
  return db.select().from(companyProfiles).where(eq(companyProfiles.userId, userId)).orderBy(desc(companyProfiles.updatedAt))
}

export async function getWorkspace(workspaceId: string) {
  const userId = await getUserId()
  const parsedWorkspaceId = workspaceIdSchema.safeParse(workspaceId)
  if (!parsedWorkspaceId.success) return null
  return (await db.select().from(companyProfiles).where(and(
    eq(companyProfiles.id, parsedWorkspaceId.data),
    eq(companyProfiles.userId, userId),
  )).limit(1))[0] ?? null
}

export async function getLatestCompanyProfile() {
  return (await listWorkspaces())[0] ?? null
}

export async function renameWorkspace(workspaceId: string, name: string) {
  const userId = await getUserId()
  const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId)
  const parsedName = workspaceNameSchema.parse(name)
  const [workspace] = await db.update(companyProfiles).set({ name: parsedName, updatedAt: new Date() }).where(and(
    eq(companyProfiles.id, parsedWorkspaceId),
    eq(companyProfiles.userId, userId),
  )).returning()
  if (!workspace) throw new Error('Workspace not found')
  revalidatePath('/workspace', 'layout')
  return workspace
}

export async function deleteWorkspace(workspaceId: string) {
  const userId = await getUserId()
  const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId)

  const nextWorkspace = (await db.select({ id: companyProfiles.id }).from(companyProfiles).where(and(
    eq(companyProfiles.userId, userId),
    ne(companyProfiles.id, parsedWorkspaceId),
  )).orderBy(desc(companyProfiles.updatedAt)).limit(1))[0] ?? null

  // Outside the transaction: a missing artifacts table (42P01, before `pnpm db:push` runs) must not block workspace deletion.
  try {
    await db.delete(artifacts).where(and(
      eq(artifacts.companyProfileId, parsedWorkspaceId),
      eq(artifacts.userId, userId),
    ))
  } catch (cause) {
    const isMissingTable = (function check(candidate: unknown): boolean {
      if (!candidate || typeof candidate !== 'object') return false
      if ('code' in candidate && (candidate as { code?: unknown }).code === '42P01') return true
      return 'cause' in candidate && check((candidate as { cause?: unknown }).cause)
    })(cause)
    if (!isMissingTable) throw cause
  }

  const wasDeleted = await db.transaction(async (transaction) => {
    await transaction.delete(agentThreads).where(and(
      eq(agentThreads.companyProfileId, parsedWorkspaceId),
      eq(agentThreads.userId, userId),
    ))
    const [deletedWorkspace] = await transaction.delete(companyProfiles).where(and(
      eq(companyProfiles.id, parsedWorkspaceId),
      eq(companyProfiles.userId, userId),
    )).returning({ id: companyProfiles.id })
    return Boolean(deletedWorkspace)
  })

  if (!wasDeleted) throw new Error('Workspace not found')
  revalidatePath('/workspace', 'layout')
  return { nextWorkspaceId: nextWorkspace?.id ?? null }
}

'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { companyProfiles, member, type CompanyContext } from '@/lib/db/schema'
import { requireUser, requireWorkspaceMembership } from '@/lib/workspace-access'
import { and, desc, eq, getTableColumns, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

const workspaceIdSchema = z.string().uuid()
const workspaceNameSchema = z.string().trim().min(1, 'Workspace name is required').max(80, 'Workspace name must be 80 characters or fewer')
const urlSchema = z.string().url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Use an HTTP or HTTPS URL')

function getDomain(value: string) {
  return new URL(value).hostname.replace(/^www\./, '')
}

function createOrganizationSlug(domain: string) {
  const base = domain.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'workspace'
  return `${base}-${randomUUID().slice(0, 8)}`
}

export async function analyzeCompany(websiteUrl: string) {
  const { requestHeaders, userId } = await requireUser()
  const parsedUrl = urlSchema.parse(websiteUrl)
  const domain = getDomain(parsedUrl).toLowerCase()
  const matchingWorkspace = (await db.select(getTableColumns(companyProfiles)).from(companyProfiles).innerJoin(member, and(
    eq(member.organizationId, companyProfiles.organizationId),
    eq(member.userId, userId),
  )))
    .find((workspace) => getDomain(workspace.websiteUrl).toLowerCase() === domain)
  if (matchingWorkspace) {
    await auth.api.setActiveOrganization({
      body: { organizationId: matchingWorkspace.organizationId },
      headers: requestHeaders,
    })
    return matchingWorkspace
  }

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

  const createdOrganization = await auth.api.createOrganization({
    body: {
      name,
      slug: createOrganizationSlug(domain),
    },
    headers: requestHeaders,
  })

  try {
    const [workspace] = await db.insert(companyProfiles).values({
      organizationId: createdOrganization.id,
      userId, websiteUrl: parsedUrl, name, summary, audience, offering, voice,
      rawContext: { brand, markdown: scrapePayload.markdown?.slice(0, 40_000) },
    }).returning()
    revalidatePath('/workspace', 'layout')
    return workspace
  } catch (cause) {
    await auth.api.deleteOrganization({
      body: { organizationId: createdOrganization.id },
      headers: requestHeaders,
    }).catch(() => undefined)
    throw cause
  }
}

export async function listWorkspaces() {
  const { userId } = await requireUser()
  return db.select({
    ...getTableColumns(companyProfiles),
    role: member.role,
  }).from(companyProfiles).innerJoin(member, and(
    eq(member.organizationId, companyProfiles.organizationId),
    eq(member.userId, userId),
  )).orderBy(desc(companyProfiles.updatedAt))
}

export async function getWorkspace(workspaceId: string) {
  const parsedWorkspaceId = workspaceIdSchema.safeParse(workspaceId)
  if (!parsedWorkspaceId.success) return null
  const { userId } = await requireUser()
  return (await db.select({
    ...getTableColumns(companyProfiles),
    role: member.role,
  }).from(companyProfiles).innerJoin(member, and(
    eq(member.organizationId, companyProfiles.organizationId),
    eq(member.userId, userId),
  )).where(
    eq(companyProfiles.id, parsedWorkspaceId.data),
  ).limit(1))[0] ?? null
}

export async function getLatestCompanyProfile() {
  return (await listWorkspaces())[0] ?? null
}

export async function renameWorkspace(workspaceId: string, name: string) {
  const { organizationId, requestHeaders, workspace } = await requireWorkspaceMembership(workspaceId, ['owner', 'admin'])
  const parsedName = workspaceNameSchema.parse(name)
  await auth.api.updateOrganization({
    body: {
      data: { name: parsedName },
      organizationId,
    },
    headers: requestHeaders,
  })
  revalidatePath('/workspace', 'layout')
  return { ...workspace, name: parsedName }
}

export async function deleteWorkspace(workspaceId: string) {
  const { organizationId, requestHeaders, userId, workspace } = await requireWorkspaceMembership(workspaceId, ['owner'])

  const nextWorkspace = (await db.select({ id: companyProfiles.id }).from(companyProfiles).innerJoin(member, and(
    eq(member.organizationId, companyProfiles.organizationId),
    eq(member.userId, userId),
  )).where(ne(companyProfiles.id, workspace.id)).orderBy(desc(companyProfiles.updatedAt)).limit(1))[0] ?? null

  await auth.api.deleteOrganization({
    body: { organizationId },
    headers: requestHeaders,
  })
  revalidatePath('/workspace', 'layout')
  return { nextWorkspaceId: nextWorkspace?.id ?? null }
}

export async function setActiveWorkspace(workspaceId: string) {
  const { organizationId, requestHeaders } = await requireWorkspaceMembership(workspaceId)
  await auth.api.setActiveOrganization({
    body: { organizationId },
    headers: requestHeaders,
  })
  return { organizationId }
}

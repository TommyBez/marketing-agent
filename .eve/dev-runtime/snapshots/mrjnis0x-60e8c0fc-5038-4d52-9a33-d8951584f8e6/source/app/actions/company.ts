'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { companyProfiles, type CompanyContext } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

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

  const [profile] = await db.insert(companyProfiles).values({
    userId, websiteUrl: parsedUrl, name, summary, audience, offering, voice,
    rawContext: { brand, markdown: scrapePayload.markdown?.slice(0, 40_000) },
  }).returning()
  revalidatePath('/')
  return profile
}

export async function getLatestCompanyProfile() {
  const userId = await getUserId()
  return (await db.select().from(companyProfiles).where(eq(companyProfiles.userId, userId)).orderBy(desc(companyProfiles.updatedAt)).limit(1))[0] ?? null
}

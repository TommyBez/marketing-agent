import { z } from 'zod'

export const PRODUCT_MARKETING_CONTEXT_MAX_LENGTH = 24_000

export const productMarketingSectionKeys = [
  'productOverview',
  'targetAudience',
  'personas',
  'problemsAndPainPoints',
  'competitiveLandscape',
  'differentiation',
  'objectionsAndAntiPersonas',
  'switchingDynamics',
  'customerLanguage',
  'brandVoice',
  'proofPoints',
  'goals',
] as const

const sectionSchema = z.string().trim().min(1).max(4_000).nullable()

export const productMarketingUpdatesSchema = z.object({
  productOverview: sectionSchema.optional().describe('Product overview, category, product type, business model, and pricing.'),
  targetAudience: sectionSchema.optional().describe('Target companies or consumers, decision-makers, use cases, and jobs to be done.'),
  personas: sectionSchema.optional().describe('Relevant buyer, user, champion, financial, and technical personas.'),
  problemsAndPainPoints: sectionSchema.optional().describe('Core problems, shortcomings of alternatives, costs, and emotional tension.'),
  competitiveLandscape: sectionSchema.optional().describe('Direct, secondary, and indirect competitors or alternatives.'),
  differentiation: sectionSchema.optional().describe('Differentiators, how the product solves the problem, and why that is better.'),
  objectionsAndAntiPersonas: sectionSchema.optional().describe('Common objections, responses, and who is not a good fit.'),
  switchingDynamics: sectionSchema.optional().describe('Push, pull, habit, and anxiety forces affecting a switch.'),
  customerLanguage: sectionSchema.optional().describe('Verbatim customer language, preferred and avoided terms, and glossary.'),
  brandVoice: sectionSchema.optional().describe('Tone, communication style, and brand personality.'),
  proofPoints: sectionSchema.optional().describe('Metrics, customers, testimonials, value themes, and supporting evidence.'),
  goals: sectionSchema.optional().describe('Business goal, conversion action, and current metrics.'),
}).strict()

export type ProductMarketingUpdates = z.infer<typeof productMarketingUpdatesSchema>

const storedProductMarketingContextSchema = productMarketingUpdatesSchema.extend({
  schemaVersion: z.literal(1),
  updatedAt: z.iso.datetime({ offset: true }),
}).strict()

export type ProductMarketingContext = z.infer<typeof storedProductMarketingContextSchema>

function hasProductMarketingContent(context: ProductMarketingContext) {
  return productMarketingSectionKeys.some((key) => typeof context[key] === 'string')
}

export function readProductMarketingContext(rawContext: Record<string, unknown>): ProductMarketingContext | null {
  if (!Object.hasOwn(rawContext, 'productMarketing')) return null

  const parsed = storedProductMarketingContextSchema.safeParse(rawContext.productMarketing)
  if (!parsed.success)
    throw new Error('The stored product marketing context is invalid and requires repair.')

  if (JSON.stringify(parsed.data).length > PRODUCT_MARKETING_CONTEXT_MAX_LENGTH)
    throw new Error('The stored product marketing context exceeds the supported size.')

  return parsed.data
}

export function productMarketingContextForPrompt(rawContext: Record<string, unknown>) {
  const stored = readProductMarketingContext(rawContext)
  if (!stored) return null

  const { schemaVersion: _schemaVersion, ...context } = stored
  return context
}

export function mergeProductMarketingContext(
  current: ProductMarketingContext | null,
  updates: ProductMarketingUpdates,
  updatedAt: string,
): ProductMarketingContext {
  const merged: ProductMarketingContext = {
    ...(current ?? {}),
    ...updates,
    schemaVersion: 1 as const,
    updatedAt,
  }

  if (JSON.stringify(merged).length > PRODUCT_MARKETING_CONTEXT_MAX_LENGTH)
    throw new Error('The product marketing context is too large. Keep the approved profile concise.')

  return merged
}

export function replaceProductMarketingContext(
  rawContext: Record<string, unknown>,
  productMarketing: ProductMarketingContext,
) {
  if (hasProductMarketingContent(productMarketing)) return { ...rawContext, productMarketing }

  const { productMarketing: _productMarketing, ...withoutProductMarketing } = rawContext
  return withoutProductMarketing
}

export function supportingContextWithoutProductMarketing(rawContext: Record<string, unknown>) {
  const { productMarketing: _productMarketing, ...supportingContext } = rawContext
  return supportingContext
}

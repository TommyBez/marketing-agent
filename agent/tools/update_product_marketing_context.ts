import {
  mergeProductMarketingContext,
  productMarketingUpdatesSchema,
  readProductMarketingContext,
  replaceProductMarketingContext,
} from '@/agent/lib/product-marketing-context'
import { db } from '@/lib/db'
import { companyProfiles, member } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { defineTool } from 'eve/tools'
import { always } from 'eve/tools/approval'
import { z } from 'zod'

function compactSections(maxLength: number, ...sections: Array<string | null | undefined>) {
  const combined = sections.map((section) => section?.trim()).filter(Boolean).join('\n\n')
  return combined.length > maxLength ? `${combined.slice(0, maxLength - 1)}…` : combined
}

export default defineTool({
  description:
    'Persist approved product marketing section updates to the authenticated caller\'s selected workspace profile. Pass only sections that should change; omitted sections are preserved and null intentionally clears a section. The workspace is resolved from verified session auth and cannot be selected by the model.',
  inputSchema: z.object({
    sections: productMarketingUpdatesSchema.describe('Only the product marketing sections the user has reviewed and wants to change. Use null only when the user explicitly wants a section cleared.'),
  }).refine((input) => Object.keys(input.sections).length > 0, {
    message: 'At least one product marketing section must be updated.',
    path: ['sections'],
  }),
  approval: always(),
  async execute({ sections }, ctx) {
    const caller = ctx.session.auth.current
    if (caller?.authenticator !== 'better-auth-session')
      throw new Error('An authenticated user with a verified workspace is required.')

    const currentWorkspaceId = caller.attributes.workspaceId as string
    const initiatingWorkspaceId = ctx.session.auth.initiator?.attributes.workspaceId as string
    if (currentWorkspaceId !== initiatingWorkspaceId) {
      throw new Error(
        'Product marketing updates must be approved by a verified member in the original workspace.',
      )
    }

    return db.transaction(async (transaction) => {
      const [result] = await transaction
        .select({ profile: companyProfiles })
        .from(companyProfiles)
        .innerJoin(member, and(
          eq(member.organizationId, companyProfiles.organizationId),
          eq(member.userId, caller.principalId),
        ))
        .where(eq(companyProfiles.id, initiatingWorkspaceId))
        .for('update')
        .limit(1)

      if (!result) throw new Error('The selected workspace is unavailable.')

      const { profile } = result
      const updatedAt = new Date()
      const productMarketingContext = mergeProductMarketingContext(
        readProductMarketingContext(profile.rawContext),
        sections,
        updatedAt.toISOString(),
      )

      const summary = Object.hasOwn(sections, 'productOverview')
        ? compactSections(1_200, productMarketingContext.productOverview)
        : profile.summary
      const audience = Object.hasOwn(sections, 'targetAudience') || Object.hasOwn(sections, 'personas')
        ? compactSections(1_600, productMarketingContext.targetAudience, productMarketingContext.personas)
        : profile.audience
      const offering = Object.hasOwn(sections, 'productOverview') || Object.hasOwn(sections, 'differentiation')
        ? compactSections(1_600, productMarketingContext.productOverview, productMarketingContext.differentiation)
        : profile.offering
      const voice = Object.hasOwn(sections, 'brandVoice')
        ? compactSections(800, productMarketingContext.brandVoice)
        : profile.voice

      const updatedProfile = (await transaction
        .update(companyProfiles)
        .set({
          summary,
          audience,
          offering,
          voice,
          rawContext: replaceProductMarketingContext(profile.rawContext, productMarketingContext),
          updatedAt,
        })
        .where(eq(companyProfiles.id, profile.id))
        .returning({
          id: companyProfiles.id,
          name: companyProfiles.name,
          websiteUrl: companyProfiles.websiteUrl,
          summary: companyProfiles.summary,
          audience: companyProfiles.audience,
          offering: companyProfiles.offering,
          voice: companyProfiles.voice,
          updatedAt: companyProfiles.updatedAt,
        }))[0]!

      return {
        workspaceId: updatedProfile.id,
        updatedSections: Object.keys(sections),
        brief: {
          name: updatedProfile.name,
          websiteUrl: updatedProfile.websiteUrl,
          summary: updatedProfile.summary,
          audience: updatedProfile.audience,
          offering: updatedProfile.offering,
          voice: updatedProfile.voice,
        },
        updatedAt: updatedProfile.updatedAt.toISOString(),
      }
    })
  },
})

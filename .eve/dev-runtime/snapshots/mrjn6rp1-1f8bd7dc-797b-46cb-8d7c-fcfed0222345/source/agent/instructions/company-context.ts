import { db } from '@/lib/db'
import { companyProfiles } from '@/lib/db/schema'
import { defineDynamic, defineInstructions } from 'eve/instructions'
import { desc, eq } from 'drizzle-orm'

function serializeProfile(profile: typeof companyProfiles.$inferSelect) {
  return JSON.stringify({
    name: profile.name,
    websiteUrl: profile.websiteUrl,
    summary: profile.summary,
    audience: profile.audience,
    offering: profile.offering,
    voice: profile.voice,
    rawContext: profile.rawContext,
  })
}

export default defineDynamic({
  events: {
    'session.started': async (_event, ctx) => {
      const currentUserId = ctx.session.auth.current?.principalId
      if (!currentUserId || ctx.session.auth.current?.principalType !== 'user') {
        return defineInstructions({
          markdown: 'No authenticated company profile is available. Do not perform company-specific work.',
        })
      }

      const [profile] = await db
        .select()
        .from(companyProfiles)
        .where(eq(companyProfiles.userId, currentUserId))
        .orderBy(desc(companyProfiles.updatedAt))
        .limit(1)

      return defineInstructions({
        markdown: profile
          ? `Use this server-resolved company profile as the source of truth. Never ask the client to send company context.\n\n${serializeProfile(profile)}`
          : 'No company profile exists for this user. Ask them to finish workspace setup before company-specific work.',
      })
    },
  },
})

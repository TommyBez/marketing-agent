import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: '.env.local', quiet: true })
config({ path: '.env', quiet: true })

const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL must be configured')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: databaseUrl,
  },
})

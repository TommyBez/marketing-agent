import { config } from 'dotenv'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

config({ path: '.env.local', quiet: true })
config({ path: '.env', quiet: true })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to migrate Better Auth organizations')
}

const migrationPath = fileURLToPath(new URL('./migrations/001_better_auth_organizations.sql', import.meta.url))
const migration = await readFile(migrationPath, 'utf8')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

try {
  await pool.query(migration)
  console.log('Better Auth organization migration completed.')
} finally {
  await pool.end()
}

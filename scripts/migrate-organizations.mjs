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
const [transactionalMigration, concurrentMigration] = migration.split('-- migrate:concurrent')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

try {
  await pool.query(transactionalMigration)
  if (concurrentMigration?.trim()) {
    const existingIndex = await pool.query(`
      SELECT pg_index.indisvalid
      FROM pg_index
      INNER JOIN pg_class ON pg_class.oid = pg_index.indexrelid
      INNER JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
      WHERE pg_class.relname = 'company_profiles_organization_uidx'
        AND pg_namespace.nspname = current_schema()
    `)
    if (existingIndex.rows[0]?.indisvalid === false) {
      await pool.query('DROP INDEX CONCURRENTLY "company_profiles_organization_uidx"')
    }
    await pool.query(concurrentMigration.trim())
  }
  console.log('Better Auth organization migration completed.')
} finally {
  await pool.end()
}

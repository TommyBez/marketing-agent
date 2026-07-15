import { config } from 'dotenv'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

config({ path: '.env.local', quiet: true })
config({ path: '.env', quiet: true })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to migrate workspace integrity')
}

const migrationPath = fileURLToPath(new URL('./migrations/003_workspace_integrity.sql', import.meta.url))
const migration = await readFile(migrationPath, 'utf8')
const [transactionalMigration, ...concurrentMigrations] = migration.split('-- migrate:concurrent')
const concurrentIndexNames = [
  'company_profiles_user_domain_uidx',
  'artifacts_company_updated_idx',
  'agent_threads_company_updated_idx',
]
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

try {
  await pool.query(transactionalMigration)
  for (const [index, concurrentMigration] of concurrentMigrations.entries()) {
    const statement = concurrentMigration.trim()
    if (!statement) continue

    const indexName = concurrentIndexNames[index]
    if (!indexName) throw new Error('Workspace integrity migration contains an unexpected concurrent index')
    const existingIndex = await pool.query({
      text: `
        SELECT pg_index.indisvalid
        FROM pg_index
        INNER JOIN pg_class ON pg_class.oid = pg_index.indexrelid
        INNER JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_class.relname = $1
          AND pg_namespace.nspname = current_schema()
      `,
      values: [indexName],
    })
    if (existingIndex.rows[0]?.indisvalid === false) {
      await pool.query(`DROP INDEX CONCURRENTLY "${indexName}"`)
    }

    await pool.query(statement)
  }
  console.log('Workspace integrity migration completed.')
} finally {
  await pool.end()
}

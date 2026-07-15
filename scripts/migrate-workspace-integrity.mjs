import { config } from 'dotenv'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { normalizeWorkspaceDomain } from '../lib/workspace-domain.mjs'

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

function normalizeWorkspaceRows(rows) {
  const normalizedRows = []
  const invalidRows = []

  for (const row of rows) {
    try {
      normalizedRows.push({
        ...row,
        canonicalDomain: normalizeWorkspaceDomain(row.websiteUrl),
      })
    } catch {
      invalidRows.push(`${row.id} (${JSON.stringify(row.websiteUrl)})`)
    }
  }

  if (invalidRows.length > 0) {
    throw new Error(
      `Workspace integrity migration found URLs that cannot be normalized: ${invalidRows.join(', ')}`,
    )
  }

  const groups = new Map()
  for (const row of normalizedRows) {
    const key = `${row.userId}\u0000${row.canonicalDomain}`
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }

  const duplicateDetails = [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const [{ canonicalDomain, userId }] = group
      return `${userId}/${canonicalDomain}: ${group.map((row) => row.id).join(', ')}`
    })

  if (duplicateDetails.length > 0) {
    throw new Error(
      `Workspace integrity migration found duplicate owner/domain groups. Reconcile these workspaces before retrying: ${duplicateDetails.join('; ')}`,
    )
  }

  return normalizedRows
}

async function getIndexValidity(indexName) {
  const result = await pool.query({
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
  return result.rows[0]?.indisvalid
}

async function dropInvalidIndex(indexName) {
  if (await getIndexValidity(indexName) === false) {
    await pool.query(`DROP INDEX CONCURRENTLY "${indexName}"`)
  }
}

async function backfillDomains() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('LOCK TABLE "company_profiles" IN SHARE ROW EXCLUSIVE MODE')
    const result = await client.query(`
      SELECT "id"::text AS "id", "userId", "websiteUrl", "normalizedDomain"
      FROM "company_profiles"
      ORDER BY "userId", "id"
    `)
    const rows = normalizeWorkspaceRows(result.rows)

    if (rows.some((row) => row.normalizedDomain !== row.canonicalDomain)) {
      await client.query(`
        CREATE TEMPORARY TABLE workspace_domain_backfill (
          "id" uuid PRIMARY KEY,
          "normalizedDomain" text NOT NULL
        ) ON COMMIT DROP
      `)

      const chunkSize = 1_000
      for (let offset = 0; offset < rows.length; offset += chunkSize) {
        const chunk = rows.slice(offset, offset + chunkSize)
        await client.query({
          text: `
            INSERT INTO workspace_domain_backfill ("id", "normalizedDomain")
            SELECT * FROM unnest($1::uuid[], $2::text[])
          `,
          values: [
            chunk.map((row) => row.id),
            chunk.map((row) => row.canonicalDomain),
          ],
        })
      }

      // A slash cannot occur in a URL hostname. Moving every row through this
      // unique sentinel keeps an existing valid domain index satisfied while
      // canonical values are corrected or swapped.
      await client.query(`
        UPDATE "company_profiles"
        SET "normalizedDomain" = '__branderize_migration_003__/' || "id"::text
      `)
      await client.query(`
        UPDATE "company_profiles" AS workspace
        SET "normalizedDomain" = backfill."normalizedDomain"
        FROM workspace_domain_backfill AS backfill
        WHERE workspace."id" = backfill."id"
      `)
    }

    await client.query(`
      ALTER TABLE "company_profiles"
        ALTER COLUMN "normalizedDomain" SET NOT NULL
    `)
    await client.query('COMMIT')
  } catch (cause) {
    await client.query('ROLLBACK')
    throw cause
  } finally {
    client.release()
  }
}

try {
  await pool.query(transactionalMigration)

  // A failed concurrent unique-index build can keep enforcing uniqueness even
  // while invalid, so remove it before correcting legacy values.
  await dropInvalidIndex(concurrentIndexNames[0])
  await backfillDomains()

  for (const [index, concurrentMigration] of concurrentMigrations.entries()) {
    const statement = concurrentMigration.trim()
    if (!statement) continue

    const indexName = concurrentIndexNames[index]
    if (!indexName) throw new Error('Workspace integrity migration contains an unexpected concurrent index')
    await dropInvalidIndex(indexName)
    await pool.query(statement)

    if (await getIndexValidity(indexName) !== true) {
      throw new Error(`${indexName} was not created as a valid index`)
    }
  }
  console.log('Workspace integrity migration completed.')
} finally {
  await pool.end()
}

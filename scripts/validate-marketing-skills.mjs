import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const root = process.cwd()
const upstreamRoot = join(root, '.agents', 'skills')

const assignments = {
  'strategy-intelligence': [
    'competitor-profiling',
    'customer-research',
    'marketing-council',
    'marketing-ideas',
    'marketing-plan',
    'marketing-psychology',
    'offers',
    'pricing',
  ],
  'gtm-distribution': [
    'co-marketing',
    'directory-submissions',
    'free-tools',
    'launch',
    'lead-magnets',
    'marketing-loops',
    'public-relations',
  ],
  'content-organic': [
    'ai-seo',
    'aso',
    'competitors',
    'content-strategy',
    'programmatic-seo',
    'schema',
    'seo-audit',
    'site-architecture',
  ],
  'copy-creative': ['copy-editing', 'copywriting', 'image', 'social', 'video'],
  'paid-acquisition': ['ad-creative', 'ads'],
  'conversion-experimentation': ['ab-testing', 'analytics', 'cro', 'popups', 'signup'],
  'lifecycle-retention': [
    'churn-prevention',
    'community-marketing',
    'emails',
    'onboarding',
    'paywalls',
    'referrals',
    'sms',
  ],
  'revenue-sales': ['cold-email', 'prospecting', 'revops', 'sales-enablement'],
}

const rootSkill = 'product-marketing'
const assignedSkills = Object.values(assignments).flat()
const catalog = [rootSkill, ...assignedSkills]

function fail(message) {
  throw new Error(`Marketing skill coverage is invalid: ${message}`)
}

function assertEqualList(label, actual, expected) {
  const left = [...actual].sort()
  const right = [...expected].sort()

  if (JSON.stringify(left) !== JSON.stringify(right)) {
    fail(`${label}\nexpected: ${right.join(', ')}\nactual:   ${left.join(', ')}`)
  }
}

async function packagedSkillNames(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const names = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const files = await readdir(join(directory, entry.name))
    if (files.includes('SKILL.md')) names.push(entry.name)
  }

  return names
}

async function filesBelow(directory, base = directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await filesBelow(path, base)))
    else if (entry.isFile()) files.push(relative(base, path))
  }

  return files.sort()
}

async function assertExactUpstreamPackage(skill, target) {
  const source = join(upstreamRoot, skill)
  const [sourceFiles, targetFiles] = await Promise.all([
    filesBelow(source),
    filesBelow(target),
  ])

  assertEqualList(`${skill} package files`, targetFiles, sourceFiles)

  for (const file of sourceFiles) {
    const [sourceContent, targetContent] = await Promise.all([
      readFile(join(source, file)),
      readFile(join(target, file)),
    ])

    if (!sourceContent.equals(targetContent)) {
      fail(`${skill}/${file} differs from the upstream package in .agents/skills`)
    }
  }
}

if (catalog.length !== 47) fail(`expected 47 catalog entries, found ${catalog.length}`)
if (new Set(catalog).size !== catalog.length) fail('a catalog skill is assigned more than once')

const rootSkills = await packagedSkillNames(join(root, 'agent', 'skills'))
const rootCatalogSkills = rootSkills.filter((skill) => catalog.includes(skill))
assertEqualList('root catalog skills', rootCatalogSkills, [rootSkill])
await assertExactUpstreamPackage(rootSkill, join(root, 'agent', 'skills', rootSkill))

const subagentEntries = await readdir(join(root, 'agent', 'subagents'), {
  withFileTypes: true,
})
const actualSubagents = subagentEntries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
assertEqualList('subagent directories', actualSubagents, Object.keys(assignments))

for (const [subagent, expectedSkills] of Object.entries(assignments)) {
  const skillRoot = join(root, 'agent', 'subagents', subagent, 'skills')
  const actualSkills = await packagedSkillNames(skillRoot)
  assertEqualList(`${subagent} skills`, actualSkills, expectedSkills)

  for (const skill of expectedSkills) {
    await assertExactUpstreamPackage(skill, join(skillRoot, skill))
  }
}

console.log(
  `Marketing skill coverage valid: ${assignedSkills.length} subagent skills + 1 root-only skill = ${catalog.length}/47`,
)

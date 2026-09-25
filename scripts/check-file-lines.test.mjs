import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  countPhysicalLines,
  classifyTrackedPath,
  DEFAULT_MAX_LINES,
  formatAuditResult,
  getLineLimitForPath,
  inspectTrackedFiles,
  isBinaryContent,
  isPackageManagerLockfile
} from './check-file-lines.mjs'

test('counts the inclusive boundary and a final unterminated line', () => {
  assert.equal(DEFAULT_MAX_LINES, 1200)
  assert.equal(countPhysicalLines('line\n'.repeat(1200)), 1200)
  assert.equal(countPhysicalLines(`${'line\n'.repeat(1199)}line`), 1200)
  assert.equal(countPhysicalLines('line\n'.repeat(1201)), 1201)
  assert.equal(countPhysicalLines('first\r\nsecond\rthird'), 3)
  assert.equal(countPhysicalLines(''), 0)
})

test('classifies binary bytes without excluding ordinary UTF-8 text', () => {
  assert.equal(isBinaryContent(Buffer.from([0x47, 0x49, 0x46, 0x00, 0xff])), true)
  assert.equal(isBinaryContent(Buffer.from([0xff, 0xfe, 0xfd])), true)
  assert.equal(isBinaryContent(Buffer.from('plain text\n中文内容\n')), false)
})

test('recognizes package-manager lockfiles at any repository depth', () => {
  assert.equal(isPackageManagerLockfile('package-lock.json'), true)
  assert.equal(isPackageManagerLockfile('kun/package-lock.json'), true)
  assert.equal(isPackageManagerLockfile('workspace/pnpm-lock.yaml'), true)
  assert.equal(isPackageManagerLockfile('src/lockfile-reader.ts'), false)
})

test('classifies implementation files separately from policy-exempt resources', () => {
  assert.equal(classifyTrackedPath('src/runtime/agent.ts'), 'implementation')
  assert.equal(classifyTrackedPath('src/runtime/agent.test.ts'), 'implementation')
  assert.equal(classifyTrackedPath('docs\\architecture\\overview.md'), 'docs')
  assert.equal(classifyTrackedPath('README.md'), 'docs')
  assert.equal(classifyTrackedPath('tests/fixtures/notes.md'), 'fixture')
  assert.equal(classifyTrackedPath('src/renderer/src/locales/zh/common.json'), 'locale')
  assert.equal(classifyTrackedPath('tests/fixtures/large-response.json'), 'fixture')
  assert.equal(classifyTrackedPath('resources/generated/catalog.json'), 'generated')
  assert.equal(classifyTrackedPath('dist/app.js'), 'generated')
  assert.equal(classifyTrackedPath('tests/__snapshots__/output.snap'), 'fixture')
  assert.equal(classifyTrackedPath('src/catalog.generated.ts'), 'generated')
  assert.equal(classifyTrackedPath('src/app.min.js.map'), 'generated')
  assert.equal(classifyTrackedPath('package-lock.json'), 'lockfile')
  assert.equal(getLineLimitForPath('src/runtime/agent.ts'), 1200)
  assert.equal(getLineLimitForPath('docs/spec.md'), null)
})

test('reports every oversized tracked text file in stable path order', async (context) => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), 'kun-file-lines-'))
  context.after(async () => rm(repositoryRoot, { recursive: true, force: true }))

  spawnSync('git', ['init', '--quiet'], { cwd: repositoryRoot })
  await mkdir(join(repositoryRoot, 'nested'), { recursive: true })
  await mkdir(join(repositoryRoot, 'docs'), { recursive: true })
  await mkdir(join(repositoryRoot, 'src'), { recursive: true })
  await mkdir(join(repositoryRoot, 'src', 'locales'), { recursive: true })
  await mkdir(join(repositoryRoot, 'tests', 'fixtures'), { recursive: true })
  await mkdir(join(repositoryRoot, 'generated'), { recursive: true })
  await writeFile(join(repositoryRoot, 'src', 'runtime.ts'), 'z\n'.repeat(1201))
  await writeFile(join(repositoryRoot, 'nested', 'alpha.test.ts'), 'a\n'.repeat(1202))
  await writeFile(join(repositoryRoot, 'short.txt'), 'short without trailing newline')
  await writeFile(join(repositoryRoot, 'docs', 'spec.md'), 'doc\n'.repeat(2000))
  await writeFile(join(repositoryRoot, 'src', 'locales', 'zh.json'), '{}\n'.repeat(2000))
  await writeFile(join(repositoryRoot, 'tests', 'fixtures', 'large.json'), '{}\n'.repeat(2000))
  await writeFile(join(repositoryRoot, 'generated', 'catalog.json'), '{}\n'.repeat(2000))
  await writeFile(join(repositoryRoot, 'package-lock.json'), '{}\n'.repeat(900))
  await writeFile(join(repositoryRoot, 'asset.bin'), Buffer.from([0x00, 0xff, 0x00, 0xff]))
  const add = spawnSync('git', ['add', '.'], { cwd: repositoryRoot, encoding: 'utf8' })
  assert.equal(add.status, 0, add.stderr)

  const result = await inspectTrackedFiles({ root: repositoryRoot })
  assert.deepEqual(result.violations, [
    { lineCount: 1202, path: 'nested/alpha.test.ts' },
    { lineCount: 1201, path: 'src/runtime.ts' }
  ])
  assert.equal(result.checkedTextFiles, 3)
  assert.equal(result.excludedBinaryFiles, 1)
  assert.equal(result.excludedLockfiles, 1)
  assert.deepEqual(result.excludedByCategory, { docs: 1, locale: 1, fixture: 1, generated: 1 })
  assert.equal(result.missingTrackedFiles, 0)
  assert.equal(
    formatAuditResult(result),
    [
      'File line limit failed: 2 implementation text file(s) exceed 1200 lines.',
      'nested/alpha.test.ts: 1202 lines (maximum 1200)',
      'src/runtime.ts: 1201 lines (maximum 1200)'
    ].join('\n')
  )
})

test('passes when all applicable tracked text files are within the limit', async (context) => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), 'kun-file-lines-pass-'))
  context.after(async () => rm(repositoryRoot, { recursive: true, force: true }))

  spawnSync('git', ['init', '--quiet'], { cwd: repositoryRoot })
  await writeFile(join(repositoryRoot, 'boundary.txt'), 'line\n'.repeat(1200))
  spawnSync('git', ['add', '.'], { cwd: repositoryRoot })

  const result = await inspectTrackedFiles({ root: repositoryRoot })
  assert.equal(result.violations.length, 0)
  assert.equal(
    formatAuditResult(result),
    'File line limit passed: 1 implementation text files are at or below 1200 lines; 0 policy-exempt text files skipped.'
  )
})

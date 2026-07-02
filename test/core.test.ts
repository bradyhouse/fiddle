import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { nextNumber, resolveFiddle, frameworkDir, getEntry } from '../src/core.ts'
import { resolveHome } from '../src/config.ts'

/** Point the collection home at a fresh temp dir for the next call. */
function isolate(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-test-'))
  process.env.FIDDLE_HOME = d
  return d
}

test('resolveHome honors FIDDLE_HOME', () => {
  const d = isolate()
  assert.equal(resolveHome(), d)
})

test('nextNumber: an empty framework starts at 0001', () => {
  isolate()
  assert.equal(nextNumber(frameworkDir('vue')), '0001')
})

test('nextNumber: increments from the max existing (padded)', () => {
  isolate()
  const fw = frameworkDir('three')
  fs.mkdirSync(path.join(fw, 'fiddle-0001-a'))
  fs.mkdirSync(path.join(fw, 'fiddle-0003-b'))
  assert.equal(nextNumber(fw), '0004')
})

test('resolveFiddle: by number (1 / 01 / 0001) and by friendly name', () => {
  isolate()
  const fw = frameworkDir('three')
  fs.mkdirSync(path.join(fw, 'fiddle-0002-spinner'))
  for (const n of ['2', '02', '0002', 'spinner']) {
    assert.equal(path.basename(resolveFiddle('three', n)), 'fiddle-0002-spinner')
  }
})

test('resolveFiddle: throws on an unknown name', () => {
  isolate()
  frameworkDir('three')
  assert.throws(() => resolveFiddle('three', 'nope'))
})

test('getEntry: known builtin + delegate, unknown throws', () => {
  assert.equal(getEntry('three').provider, 'builtin')
  assert.equal(getEntry('react').provider, 'delegate')
  assert.throws(() => getEntry('cobol'))
})

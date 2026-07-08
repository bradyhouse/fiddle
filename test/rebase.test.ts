import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { rebaseBuiltDist, normalizeBase } from '../src/core.js'

function fixtureDist(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-rebase-'))
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    '<!doctype html><head><base href="/"><script src="/vue/fiddle-0008-PlotlyHwJs/assets/index-abc.js"></script></head>'
  )
  fs.writeFileSync(
    path.join(dir, 'app.js'),
    'fetch("/vue/fiddle-0008-PlotlyHwJs/assets/data.json");const r=createRouter({history:Ky("./")})'
  )
  return dir
}

test('rebaseBuiltDist with a mount path bakes the FULL public path (the /fiddles/ nesting bug)', () => {
  const dir = fixtureDist()
  rebaseBuiltDist(dir, 'vue', 'fiddle-0008-PlotlyHwJs', '/fiddles/')
  const idx = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
  const js = fs.readFileSync(path.join(dir, 'app.js'), 'utf8')
  assert.match(idx, /src="\/fiddles\/f\/vue\/fiddle-0008-PlotlyHwJs\/assets\/index-abc\.js"/)
  assert.match(idx, /<base href="\/fiddles\/f\/vue\/fiddle-0008-PlotlyHwJs\/">/)
  assert.match(js, /fetch\("\/fiddles\/f\/vue\/fiddle-0008-PlotlyHwJs\/assets\/data\.json"\)/)
  assert.match(js, /history:Ky\("\/fiddles\/f\/vue\/fiddle-0008-PlotlyHwJs\/"\)/) // vue-router base
  assert.doesNotMatch(idx, /"\/f\/vue\//) // no root-relative leftovers
})

test('rebaseBuiltDist default base is root (preview behavior unchanged)', () => {
  const dir = fixtureDist()
  rebaseBuiltDist(dir, 'vue', 'fiddle-0008-PlotlyHwJs')
  const idx = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
  assert.match(idx, /<base href="\/f\/vue\/fiddle-0008-PlotlyHwJs\/">/)
})

test('normalizeBase handles every spelling', () => {
  assert.equal(normalizeBase(undefined), '/')
  assert.equal(normalizeBase(''), '/')
  assert.equal(normalizeBase('/'), '/')
  assert.equal(normalizeBase('fiddles'), '/fiddles/')
  assert.equal(normalizeBase('/fiddles'), '/fiddles/')
  assert.equal(normalizeBase('/fiddles/'), '/fiddles/')
  assert.equal(normalizeBase('a/b/'), '/a/b/')
})

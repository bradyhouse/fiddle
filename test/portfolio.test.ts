import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildManifest, shellHtml } from '../src/portfolio.ts'

test('buildManifest sorts by framework and shapes url + thumb', () => {
  const m = buildManifest([
    { framework: 'vue', name: 'fiddle-0001-b', friendly: 'b', hasThumb: false },
    { framework: 'three', name: 'fiddle-0001-a', friendly: 'a', hasThumb: true }
  ])
  assert.equal(m[0].framework, 'three') // sorted ahead of vue
  assert.equal(m[0].url, 'f/three/fiddle-0001-a/') // directory, not index.html — so SPA routers match home
  assert.equal(m[0].thumb, 'thumbs/three__fiddle-0001-a.png')
  assert.equal(m[1].thumb, null) // no thumbnail → null, not a broken path
})

test('shellHtml is self-contained and embeds the fiddles', () => {
  const html = shellHtml(
    buildManifest([{ framework: 'three', name: 'fiddle-0001-a', friendly: 'spin', hasThumb: false }])
  )
  assert.match(html, /<!doctype html>/i)
  assert.match(html, /fiddle-0001-a/) // deep-link target
  assert.match(html, /spin/) // friendly label
  assert.doesNotMatch(html, /<script[^>]+src=/) // no external scripts — deploys to any static host offline
})

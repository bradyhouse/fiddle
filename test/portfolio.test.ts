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

test('README metadata flows into the manifest; hostile text cannot break the inline script', () => {
  const m = buildManifest([
    {
      framework: 'three',
      name: 'fiddle-0001-a',
      friendly: 'a',
      hasThumb: false,
      meta: {
        title: 'Planet Tween',
        desc: 'evil </script><img src=x onerror=alert(1)> description',
        date: '01/18/2016',
        tags: ['three.js'],
        fork: 'fiddle-0000-parent',
        pen: 'https://codepen.io/x'
      }
    }
  ])
  assert.equal(m[0].title, 'Planet Tween')
  assert.equal(m[0].fork, 'fiddle-0000-parent')
  const html = shellHtml(m)
  // the ONLY "</script>" in the page is the shell's own closing tag — README text
  // is embedded with `<` escaped, so it can't terminate the script element.
  assert.equal(html.split('</script>').length, 2)
  assert.match(html, /\\u003c\/script/) // the hostile desc arrived, escaped
})

test('empty meta fields are omitted from the manifest (kept lean)', () => {
  const m = buildManifest([
    { framework: 'vue', name: 'fiddle-0001-b', friendly: 'b', hasThumb: false, meta: null }
  ])
  assert.ok(!('title' in m[0]) && !('desc' in m[0]) && !('tags' in m[0]))
})

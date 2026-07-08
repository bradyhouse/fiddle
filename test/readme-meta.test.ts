import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { readFiddleMeta } from '../src/readme-meta.js'
import { readmeMd } from '../src/defaults.js'

function fixture(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-meta-'))
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body)
  return dir
}

const CLASSIC = `fiddle-0011-PlanetTween
======

![Screenshot](screenshot.png)

### Title

Planet Tween

### Creation Date

01/18/2016

### Description

Pen exploring how to apply tween effects in 3D space. It takes the "Tweening" concepts
discussed in Chapter 4 of **WebGL Up and Running**.

### Published Version Link

[codepen.io](http://codepen.io/bradyhouse/pen/JGOWRo)

### Tags

three.js, r46, es6, renderer, object3d

### Forked From

[fiddle-0005-EarthMoon](../fiddle-0005-EarthMoon)
`

test('parses the classic fiddle.sh README format', () => {
  const dir = fixture({ 'README.md': CLASSIC })
  const m = readFiddleMeta(dir)!
  assert.equal(m.title, 'Planet Tween')
  assert.match(m.desc, /^Pen exploring how to apply tween effects/)
  assert.match(m.desc, /WebGL Up and Running/) // bold stripped, text kept
  assert.equal(m.date, '01/18/2016')
  assert.deepEqual(m.tags, ['three.js', 'r46', 'es6', 'renderer', 'object3d'])
  assert.equal(m.fork, 'fiddle-0005-EarthMoon')
  assert.equal(m.pen, 'http://codepen.io/bradyhouse/pen/JGOWRo')
})

test('reads README.markdown (the pre-2017 filename)', () => {
  const dir = fixture({ 'README.markdown': CLASSIC })
  assert.equal(readFiddleMeta(dir)!.title, 'Planet Tween')
})

test('n/a and placeholder sections are dropped', () => {
  const dir = fixture({
    'README.md': '# x\n\n### Title\n\nThing\n\n### Description\n\nn/a\n\n### Forked From\n\nn/a\n'
  })
  const m = readFiddleMeta(dir)!
  assert.equal(m.title, 'Thing')
  assert.equal(m.desc, '')
  assert.equal(m.fork, '')
})

test('unstructured README falls back to the first prose paragraph', () => {
  const dir = fixture({
    'README.md':
      '# my-fiddle\n\n![badge](x.png)\n\nA tiny experiment testing whether canvas blend modes survive devicePixelRatio scaling.\n\n## Setup\n\nnpm i\n'
  })
  const m = readFiddleMeta(dir)!
  assert.match(m.desc, /^A tiny experiment testing whether canvas/)
})

test('name/date header block is not mistaken for a description', () => {
  const base = path.basename(fixture({}))
  const dir = fixture({ 'README.md': `fiddle-0020-TetrisJs\n\nfiddle-0020-TetrisJs\n\n08-02-25\n` })
  const m = readFiddleMeta(dir)
  assert.equal(m, null) // nothing useful → no manifest noise
})

test('.fiddle.json description overrides a boilerplate README', () => {
  const dir = fixture({
    'README.md': '# Vue 3 + Vite\n\nThis template should help get you started developing with Vue 3 in Vite.\n',
    '.fiddle.json': JSON.stringify({ framework: 'vue', name: 'x', description: 'Tetris built to learn the composition API.' })
  })
  assert.equal(readFiddleMeta(dir)!.desc, 'Tetris built to learn the composition API.')
})

test('long descriptions are truncated at a word boundary', () => {
  const dir = fixture({ 'README.md': `### Description\n\n${'word '.repeat(300)}\n` })
  const m = readFiddleMeta(dir)!
  assert.ok(m.desc.length <= 600)
  assert.match(m.desc, /…$/)
})

test('missing README → null, not a crash', () => {
  assert.equal(readFiddleMeta(fixture({})), null)
})

test('the create-template README parses to no placeholder text', () => {
  const dir = fixture({ 'README.md': readmeMd('fiddle-0042-BlendModes', 'Blend Modes') })
  const m = readFiddleMeta(dir)!
  assert.equal(m.title, 'Blend Modes')
  assert.equal(m.desc, '') // the HTML-comment hint must not leak into the manifest
  assert.equal(m.fork, '') // "n/a" must not parse as a fork
  assert.equal(m.pen, '')
})

test('the fork-template README carries lineage', () => {
  const dir = fixture({ 'README.md': readmeMd('fiddle-0043-BlendModes2', 'Blend Modes 2', 'fiddle-0042-BlendModes') })
  assert.equal(readFiddleMeta(dir)!.fork, 'fiddle-0042-BlendModes')
})

// ── regression tests from the adversarial review ────────────────────────────────

test('an EMPTY section must not swallow the next heading (review: high)', () => {
  const dir = fixture({
    'README.md': '### Title\n\nThing One\n\n### Tags\n\n\n### Forked From\n\nfiddle-0001-Parent\n'
  })
  const m = readFiddleMeta(dir)!
  assert.deepEqual(m.tags, []) // NOT ["### Forked From", "fiddle-0001-Parent"]
  assert.equal(m.fork, 'fiddle-0001-Parent')
})

test('the create/fork template round-trips with clean tags (review: high)', () => {
  const dir = fixture({ 'README.md': readmeMd('fiddle-0042-BlendModes', 'Blend Modes', 'fiddle-0041-Parent') })
  const m = readFiddleMeta(dir)!
  assert.deepEqual(m.tags, []) // the empty ### Tags section must stay empty
  assert.equal(m.fork, 'fiddle-0041-Parent')
})

test('hyphenated fork slugs are not truncated; trailing periods are not captured (review: medium)', () => {
  const dir = fixture({
    'README.md': '### Forked From\n\nForked from fiddle-0100-my-cool-thing.\n'
  })
  assert.equal(readFiddleMeta(dir)!.fork, 'fiddle-0100-my-cool-thing')
})

test('a setext H1 paragraph is not mistaken for prose (review: medium)', () => {
  const dir = fixture({
    'README.md': 'Golden Layout Hello World Demo\n======\n\nA fiddle exploring golden-layout panes with Vue components inside.\n'
  })
  assert.match(readFiddleMeta(dir)!.desc, /^A fiddle exploring golden-layout/)
})

test('raw HTML tags are stripped from parsed text (review: medium)', () => {
  const dir = fixture({
    'README.md': '### Description\n\nUses <img src="x.png" width="400"> a sized screenshot to show <b>blend modes</b> at work today.\n'
  })
  const m = readFiddleMeta(dir)!
  assert.ok(!m.desc.includes('<'), m.desc)
  assert.match(m.desc, /blend modes/)
})

test('bullet-list tags lose their markers (review: low)', () => {
  const dir = fixture({ 'README.md': '### Tags\n\n- d3\n- svg\n- charts\n' })
  assert.deepEqual(readFiddleMeta(dir)!.tags, ['d3', 'svg', 'charts'])
})

test('snake_case survives emphasis stripping (review: low)', () => {
  const dir = fixture({ 'README.md': '### Description\n\nExplores the strategy_cooldown_ms knob and _emphasized_ text handling in specs.\n' })
  const m = readFiddleMeta(dir)!
  assert.match(m.desc, /strategy_cooldown_ms/)
  assert.match(m.desc, /\bemphasized\b/)
})

test('prose-length titles are dropped (review: low)', () => {
  const dir = fixture({
    'README.md': `### Title\n\n${'A very long explanation that is clearly a paragraph and not a title at all '.repeat(3)}\n\n### Description\n\nShort real description of the thing.\n`
  })
  const m = readFiddleMeta(dir)!
  assert.equal(m.title, '')
  assert.match(m.desc, /^Short real description/)
})

test('autolink pen URLs do not capture the closing bracket (review: rejected-but-cheap)', () => {
  const dir = fixture({ 'README.md': '### Published Version Link\n\n<https://jsfiddle.net/bradyhouse/q28d9emo/>\n' })
  assert.equal(readFiddleMeta(dir)!.pen, 'https://jsfiddle.net/bradyhouse/q28d9emo/')
})

test('desc never merely echoes the title (review: low)', () => {
  const dir = fixture({
    'README.md': '### Title\n\nFour Word Fiddle Title Here\n\n### Description\n\n<!-- hint -->\n'
  })
  const m = readFiddleMeta(dir)!
  assert.equal(m.title, 'Four Word Fiddle Title Here')
  assert.equal(m.desc, '')
})
